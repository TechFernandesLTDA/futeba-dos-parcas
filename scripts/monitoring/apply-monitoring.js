#!/usr/bin/env node
'use strict';

/**
 * Aplica as métricas de log e as políticas de alerta versionadas em
 * `monitoring/` no Cloud Monitoring (#4417).
 *
 * Fonte da verdade: `monitoring/manifest.json`. As políticas são casadas pelo
 * `displayName` e as métricas pelo `name`, então rodar de novo não duplica nada.
 * O canal de notificação é injetado pelo script (os arquivos não o repetem).
 *
 * Padrão: SÓ MOSTRA o plano (dry-run, somente leitura). Para criar/atualizar:
 *
 *   node scripts/monitoring/apply-monitoring.js            # plano
 *   node scripts/monitoring/apply-monitoring.js --apply    # aplica
 *
 * Opções:
 *   --project <id>        projeto (padrão: manifest.project)
 *   --channel <nome>      canal (repetível; substitui manifest.notificationChannels)
 *   --validate-only       só valida os arquivos locais, sem chamar a API
 *
 * Autenticação: token do `gcloud auth print-access-token` (conta com papel
 * Monitoring AlertPolicy Editor e Logs Configuration Writer). As chamadas usam
 * o projeto alvo como projeto de cota (cabeçalho x-goog-user-project).
 * Nunca apaga nada: política ou métrica remota fora do manifesto só é listada.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MONITORING_DIR = path.resolve(__dirname, '..', '..', 'monitoring');
const MIN_LOG_MATCH_RATE_LIMIT_S = 300;

function parseArgs(argv) {
  const args = { apply: false, validateOnly: false, project: '', channels: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--apply') args.apply = true;
    else if (key === '--validate-only') args.validateOnly = true;
    else if (key === '--project') { args.project = argv[i + 1]; i += 1; }
    else if (key === '--channel') { args.channels.push(argv[i + 1]); i += 1; }
    else throw new Error(`Argumento desconhecido: ${key}`);
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Carrega o manifesto e os arquivos que ele lista. */
function loadConfig(dir = MONITORING_DIR) {
  const manifest = readJson(path.join(dir, 'manifest.json'));
  const load = (rel) => ({ file: rel, body: readJson(path.join(dir, rel)) });
  const topLevelJson = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'manifest.json');
  return {
    manifest,
    metrics: (manifest.logMetrics || []).map(load),
    policies: (manifest.alertPolicies || []).map(load),
    topLevelJson,
  };
}

function seconds(duration) {
  const m = /^(\d+)s$/.exec(String(duration || ''));
  return m ? Number(m[1]) : NaN;
}

/**
 * Valida os arquivos locais (função pura). Retorna a lista de erros.
 * @param {{manifest: object, metrics: Array<{file: string, body: object}>, policies: Array<{file: string, body: object}>, topLevelJson: string[]}} config
 */
function validateConfig(config) {
  const errors = [];
  const { manifest, metrics, policies, topLevelJson } = config;
  if (!manifest.project) errors.push('manifest.project ausente');
  if (!Array.isArray(manifest.notificationChannels) || manifest.notificationChannels.length === 0) {
    errors.push('manifest.notificationChannels vazio: política sem canal não avisa ninguém');
  }

  const listed = new Set([...(manifest.alertPolicies || []), ...Object.keys(manifest.notManaged || {})]);
  for (const f of topLevelJson) {
    if (!listed.has(f)) errors.push(`${f}: não está em alertPolicies nem em notManaged do manifesto`);
  }

  const metricNames = new Set();
  for (const { file, body } of metrics) {
    if (!body.name || !/^[A-Za-z0-9_]+$/.test(body.name)) errors.push(`${file}: name inválido`);
    if (!body.filter) errors.push(`${file}: filter ausente`);
    if (`${body.name}.json` !== path.basename(file)) errors.push(`${file}: nome do arquivo difere de name (${body.name})`);
    metricNames.add(body.name);
  }

  const displayNames = new Set();
  for (const { file, body } of policies) {
    if (!body.displayName) errors.push(`${file}: displayName ausente`);
    if (displayNames.has(body.displayName)) errors.push(`${file}: displayName duplicado (${body.displayName})`);
    displayNames.add(body.displayName);
    if (body.notificationChannels) errors.push(`${file}: não declare notificationChannels no arquivo (o script injeta o do manifesto)`);
    if (!body.documentation || !body.documentation.content) errors.push(`${file}: documentation.content ausente`);
    const conditions = body.conditions || [];
    if (conditions.length === 0) errors.push(`${file}: sem conditions`);

    const logMatch = conditions.filter((c) => c.conditionMatchedLog);
    if (logMatch.length > 0) {
      if (conditions.length !== 1) errors.push(`${file}: política de log-match aceita uma única condition`);
      const period = seconds(body.alertStrategy && body.alertStrategy.notificationRateLimit && body.alertStrategy.notificationRateLimit.period);
      if (!(period >= MIN_LOG_MATCH_RATE_LIMIT_S)) {
        errors.push(`${file}: log-match exige alertStrategy.notificationRateLimit.period >= ${MIN_LOG_MATCH_RATE_LIMIT_S}s`);
      }
    }

    for (const c of conditions) {
      const inner = c.conditionThreshold || c.conditionAbsent || c.conditionMatchedLog;
      if (!c.displayName || !inner || !inner.filter) {
        errors.push(`${file}: condition sem displayName ou filter`);
        continue;
      }
      const userMetric = /logging\.googleapis\.com\/user\/([A-Za-z0-9_]+)/.exec(inner.filter);
      if (userMetric && !metricNames.has(userMetric[1])) {
        errors.push(`${file}: usa a métrica de log ${userMetric[1]}, que não está em manifest.logMetrics`);
      }
    }
  }
  return errors;
}

/** Ordena chaves recursivamente e descarta campos gerados pelo servidor. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (['name', 'creationRecord', 'mutationRecord', 'createTime', 'updateTime', 'resourceName'].includes(key)) continue;
      out[key] = canonical(value[key]);
    }
    return out;
  }
  return value;
}

const POLICY_FIELDS = ['displayName', 'documentation', 'combiner', 'conditions', 'alertStrategy', 'enabled', 'notificationChannels'];

function policyFingerprint(policy) {
  const picked = {};
  for (const f of POLICY_FIELDS) if (policy[f] !== undefined) picked[f] = policy[f];
  if (picked.notificationChannels) picked.notificationChannels = [...picked.notificationChannels].sort();
  return JSON.stringify(canonical(picked));
}

function metricFingerprint(metric) {
  return JSON.stringify(canonical({
    description: metric.description || '',
    filter: metric.filter,
    labelExtractors: metric.labelExtractors || {},
  }));
}

/** Corpo final de uma política: o arquivo mais os canais do manifesto. */
function desiredPolicy(body, channels) {
  return { ...body, notificationChannels: [...channels] };
}

/**
 * Plano das políticas (função pura): casa por displayName.
 * @returns {Array<{action: 'create'|'update'|'unchanged'|'conflict', displayName: string, file: string, remoteName?: string, body: object}>}
 */
function planPolicies(desired, remote) {
  const byName = new Map();
  for (const r of remote || []) {
    const list = byName.get(r.displayName) || [];
    list.push(r);
    byName.set(r.displayName, list);
  }
  return desired.map(({ file, body }) => {
    const matches = byName.get(body.displayName) || [];
    if (matches.length > 1) return { action: 'conflict', displayName: body.displayName, file, body };
    if (matches.length === 0) return { action: 'create', displayName: body.displayName, file, body };
    const same = policyFingerprint(matches[0]) === policyFingerprint(body);
    return { action: same ? 'unchanged' : 'update', displayName: body.displayName, file, remoteName: matches[0].name, body };
  });
}

/** Plano das métricas de log (função pura): casa por name. */
function planMetrics(desired, remote) {
  const byName = new Map((remote || []).map((m) => [m.name, m]));
  return desired.map(({ file, body }) => {
    const current = byName.get(body.name);
    if (!current) return { action: 'create', name: body.name, file, body };
    const same = metricFingerprint(current) === metricFingerprint(body);
    return { action: same ? 'unchanged' : 'update', name: body.name, file, body };
  });
}

/** Políticas e métricas remotas que não estão no manifesto (só informativo). */
function unmanaged(remotePolicies, remoteMetrics, config) {
  const names = new Set(config.policies.map((p) => p.body.displayName));
  const metricNames = new Set(config.metrics.map((m) => m.body.name));
  return {
    policies: (remotePolicies || []).filter((p) => !names.has(p.displayName)).map((p) => p.displayName),
    metrics: (remoteMetrics || []).filter((m) => !metricNames.has(m.name)).map((m) => m.name),
  };
}

function makeClient(project) {
  const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
  return async function request(url, { method = 'GET', body } = {}) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-goog-user-project': project,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const msg = data.error && data.error.message ? data.error.message : text;
      throw new Error(`${method} ${url} -> HTTP ${res.status}: ${msg}`);
    }
    return data;
  };
}

async function listAll(request, url, key) {
  const items = [];
  let pageToken = '';
  do {
    const sep = url.includes('?') ? '&' : '?';
    const data = await request(`${url}${sep}pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
    items.push(...(data[key] || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return items;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const errors = validateConfig(config);
  if (errors.length) {
    for (const e of errors) console.error(`ERRO ${e}`);
    process.exit(1);
  }
  console.log(`Arquivos válidos: ${config.metrics.length} métricas de log, ${config.policies.length} políticas.`);
  if (args.validateOnly) return;

  const project = args.project || config.manifest.project;
  const channels = args.channels.length ? args.channels : config.manifest.notificationChannels;
  const request = makeClient(project);
  const MON = `https://monitoring.googleapis.com/v3/projects/${project}`;
  const LOG = `https://logging.googleapis.com/v2/projects/${project}`;

  for (const ch of channels) {
    const channel = await request(`https://monitoring.googleapis.com/v3/${ch}`);
    console.log(`Canal: ${channel.displayName || ch} (${channel.type}, enabled=${channel.enabled !== false})`);
  }

  const remoteMetrics = await listAll(request, `${LOG}/metrics`, 'metrics');
  const remotePolicies = await listAll(request, `${MON}/alertPolicies`, 'alertPolicies');
  const metricPlan = planMetrics(config.metrics, remoteMetrics);
  const desired = config.policies.map(({ file, body }) => ({ file, body: desiredPolicy(body, channels) }));
  const policyPlan = planPolicies(desired, remotePolicies);

  console.log(`\nProjeto ${project} — ${args.apply ? 'APLICANDO' : 'plano (dry-run; use --apply para aplicar)'}`);
  for (const m of metricPlan) console.log(`  métrica  ${m.action.padEnd(9)} ${m.name}`);
  for (const p of policyPlan) console.log(`  política ${p.action.padEnd(9)} ${p.displayName}`);
  const extra = unmanaged(remotePolicies, remoteMetrics, config);
  for (const p of extra.policies) console.log(`  (fora do manifesto, não mexo) política: ${p}`);
  for (const m of extra.metrics) console.log(`  (fora do manifesto, não mexo) métrica: ${m}`);

  const conflicts = policyPlan.filter((p) => p.action === 'conflict');
  if (conflicts.length) {
    for (const c of conflicts) console.error(`ERRO mais de uma política remota com displayName "${c.displayName}": resolva no console antes`);
    process.exit(1);
  }
  if (!args.apply) return;

  // Métricas antes das políticas: a política referencia a métrica pelo nome.
  for (const m of metricPlan) {
    if (m.action === 'create') await request(`${LOG}/metrics`, { method: 'POST', body: m.body });
    if (m.action === 'update') await request(`${LOG}/metrics/${encodeURIComponent(m.name)}`, { method: 'PUT', body: m.body });
    if (m.action !== 'unchanged') console.log(`  OK métrica ${m.action} ${m.name}`);
  }
  for (const p of policyPlan) {
    if (p.action === 'create') {
      const created = await request(`${MON}/alertPolicies`, { method: 'POST', body: p.body });
      console.log(`  OK política criada ${p.displayName} -> ${created.name}`);
    } else if (p.action === 'update') {
      await request(`https://monitoring.googleapis.com/v3/${p.remoteName}`, { method: 'PATCH', body: p.body });
      console.log(`  OK política atualizada ${p.displayName}`);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`apply-monitoring falhou: ${err.message}`);
    process.exit(2);
  });
}

module.exports = {
  canonical,
  desiredPolicy,
  loadConfig,
  parseArgs,
  planMetrics,
  planPolicies,
  policyFingerprint,
  unmanaged,
  validateConfig,
};
