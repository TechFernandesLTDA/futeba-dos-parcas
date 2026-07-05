#!/usr/bin/env node
'use strict';

/**
 * Pipeline de release notes — fonte unica para CHANGELOG, bundle de fallback e
 * publicacao no Firestore.
 *
 *   node scripts/release-notes.js validate
 *   node scripts/release-notes.js changelog
 *   node scripts/release-notes.js bundle
 *   node scripts/release-notes.js publish --platform <android|web|ios> --version <x.y.z>
 *
 * Os arquivos-fonte ficam em release-notes/<plataforma>/<versao>.md.
 * Ver release-notes/README.md (formato) e docs/RELEASE_PROCESS.md (processo).
 * Spec: specs/feat-2026-05-22-version-control-release-notes.md
 *
 * validate/changelog/bundle nao tem dependencias. publish carrega firebase-admin
 * sob demanda (lazy require) — rode num contexto que tenha a dependencia.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NOTES_DIR = path.join(ROOT, 'release-notes');
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md');
const REPO_RELEASE_NOTES_BASE_URL =
  'https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes';

const PLATFORMS = ['android', 'web', 'ios', 'functions'];
// Plataformas com app cliente: recebem bundle embarcado e doc no Firestore.
const CLIENT_PLATFORMS = ['android', 'web', 'ios'];
// Plataformas com app nativo: buildNumber e obrigatorio.
const NATIVE_PLATFORMS = ['android', 'ios'];
const VALID_TYPES = ['major', 'minor', 'patch'];

const SECTION_USER = 'Para o usuário';
const SECTION_TECH = 'Técnico';
const USER_SECTIONS = ['Headline', 'Destaques', 'Novidades', 'Melhorias', 'Correções'];
const TECH_SECTIONS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

const TECH_LABEL_PT = {
  Added: 'Adicionado',
  Changed: 'Mudado',
  Deprecated: 'Depreciado',
  Removed: 'Removido',
  Fixed: 'Corrigido',
  Security: 'Segurança',
};

const PLATFORM_LABEL = {
  android: 'Android',
  web: 'Web',
  ios: 'iOS',
  functions: 'Cloud Functions',
};

// Cada plataforma pode ter mais de um destino para o JSON de fallback.
// iOS: o leitor (`ReleaseNotesAssetReader` iosMain) usa `NSBundle.mainBundle`,
// ou seja, o app bundle principal do target Xcode `iosApp` — o recurso em
// `composeResources` é empacotado na ComposeApp.framework e não chega lá.
// Por isso o JSON é gravado também em `iosApp/iosApp/release-notes.json`.
const BUNDLE_TARGETS = {
  android: ['app/src/main/assets/release-notes.json'],
  web: ['web/public/release-notes.json'],
  ios: [
    'composeApp/src/commonMain/composeResources/files/release-notes.json',
    'iosApp/iosApp/release-notes.json',
  ],
};

const AUTOGEN_START = '<!-- AUTOGEN:START -->';
const AUTOGEN_END = '<!-- AUTOGEN:END -->';

// ==========================================================================
// Helpers de erro
// ==========================================================================

function fail(msg) {
  console.error(`erro: ${msg}`);
  process.exit(1);
}

function printErrors(errors) {
  console.error(`release-notes: ${errors.length} erro(s) de validacao:`);
  for (const e of errors) console.error(`  - ${e}`);
}

// ==========================================================================
// Parsing
// ==========================================================================

/** Converte um valor escalar do frontmatter (subconjunto YAML estrito). */
function parseScalar(raw) {
  const v = raw.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((s) => {
      const t = s.trim();
      return /^\d+$/.test(t) ? Number(t) : t;
    });
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

function parseFrontmatter(text, file, errors) {
  const fm = {};
  text.split('\n').forEach((line, i) => {
    if (line.trim() === '') return;
    const m = line.match(/^([a-zA-Z][a-zA-Z0-9_]*):\s*(.*)$/);
    if (!m) {
      errors.push(`${file}: frontmatter linha ${i + 1} invalida: "${line.trim()}"`);
      return;
    }
    fm[m[1]] = parseScalar(m[2]);
  });
  return fm;
}

/** Retorna { 'Para o usuário': { Sub: [itens] }, 'Técnico': { Sub: [itens] } }. */
function parseBody(body, file, errors) {
  const result = {};
  let h2 = null;
  let h3 = null;
  for (const line of body.split('\n')) {
    if (line.trim() === '') continue;
    const mH2 = line.match(/^##\s+(.+?)\s*$/);
    const mH3 = line.match(/^###\s+(.+?)\s*$/);
    const mItem = line.match(/^-\s+(.+?)\s*$/);
    if (mH2) {
      h2 = mH2[1];
      h3 = null;
      result[h2] = {};
    } else if (mH3) {
      if (!h2) {
        errors.push(`${file}: "### ${mH3[1]}" fora de uma secao "## "`);
        continue;
      }
      h3 = mH3[1];
      result[h2][h3] = [];
    } else if (mItem) {
      if (!h2 || !h3) {
        errors.push(`${file}: item de lista fora de uma subsecao "### ": "${line.trim()}"`);
        continue;
      }
      result[h2][h3].push(mItem[1]);
    } else {
      errors.push(`${file}: linha fora do formato (cada item deve caber em 1 linha): "${line.trim()}"`);
    }
  }
  return result;
}

function parseReleaseNote(file, errors) {
  const raw = fs.readFileSync(file, 'utf-8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) {
    errors.push(`${file}: sem frontmatter YAML valido (--- ... ---)`);
    return null;
  }
  return { fm: parseFrontmatter(m[1], file, errors), body: parseBody(m[2], file, errors) };
}

/** Decompoe um item de destaque "icon=nome | Titulo | Descricao". */
function parseHighlight(item, file, errors) {
  const parts = item.split(' | ');
  if (parts.length !== 3) {
    errors.push(`${file}: destaque mal formado (esperado "icon=X | Titulo | Descricao"): "${item}"`);
    return null;
  }
  if (item.split('|').length !== 3) {
    errors.push(`${file}: destaque contem "|" extra (use apenas o separador " | "): "${item}"`);
    return null;
  }
  const iconM = parts[0].trim().match(/^icon=([a-z_]+)$/);
  if (!iconM) {
    errors.push(`${file}: destaque sem "icon=<nome>" valido: "${parts[0]}"`);
    return null;
  }
  return { icon: iconM[1], title: parts[1].trim(), description: parts[2].trim() };
}

// ==========================================================================
// Descoberta e validacao
// ==========================================================================

function discoverNotes() {
  const notes = [];
  for (const platform of PLATFORMS) {
    const dir = path.join(NOTES_DIR, platform);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith('.md') || f === 'README.md') continue;
      notes.push({ platform, version: f.replace(/\.md$/, ''), file: path.join(dir, f) });
    }
  }
  return notes;
}

function validateNote(meta, parsed, errors) {
  const { fm, body } = parsed;
  const file = meta.file;
  const E = (msg) => errors.push(`${file}: ${msg}`);

  if (!PLATFORMS.includes(fm.platform)) E(`platform invalida: "${fm.platform}"`);
  if (fm.platform !== meta.platform) E(`platform "${fm.platform}" difere da pasta "${meta.platform}"`);
  if (fm.version !== meta.version) E(`version "${fm.version}" difere do nome do arquivo "${meta.version}"`);
  if (!/^\d+\.\d+\.\d+$/.test(String(fm.version))) E(`version fora do padrao semver: "${fm.version}"`);
  if (!VALID_TYPES.includes(fm.type)) E(`type invalido: "${fm.type}" (use major|minor|patch)`);
  if (typeof fm.showPopup !== 'boolean') E('showPopup deve ser true ou false');
  if (fm.published !== undefined && typeof fm.published !== 'boolean') E('published deve ser true ou false');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fm.date))) E(`date fora do padrao YYYY-MM-DD: "${fm.date}"`);
  if (NATIVE_PLATFORMS.includes(meta.platform) && typeof fm.buildNumber !== 'number') {
    E(`buildNumber obrigatorio (numero) para ${meta.platform}`);
  }
  for (const key of ['issues', 'prs']) {
    if (fm[key] === undefined) continue;
    if (!Array.isArray(fm[key]) || fm[key].some((x) => typeof x !== 'number')) {
      E(`${key} deve ser uma lista de numeros, ex: [123, 456]`);
    }
  }
  if (typeof fm.milestone !== 'string' || fm.milestone === '') E('milestone obrigatorio (string)');

  const user = body[SECTION_USER];
  const tech = body[SECTION_TECH];
  if (!user) E(`falta a secao "## ${SECTION_USER}"`);
  if (!tech) E(`falta a secao "## ${SECTION_TECH}"`);

  if (user) {
    for (const sub of Object.keys(user)) {
      if (!USER_SECTIONS.includes(sub)) E(`subsecao de usuario desconhecida: "### ${sub}"`);
    }
    if (!user.Headline || user.Headline.length !== 1) {
      E('"### Headline" deve ter exatamente 1 item');
    }
    const destaques = user.Destaques || [];
    if (destaques.length > 3) E(`"### Destaques" aceita no maximo 3 itens (tem ${destaques.length})`);
    for (const d of destaques) parseHighlight(d, file, errors);
  }
  if (tech) {
    for (const sub of Object.keys(tech)) {
      if (!TECH_SECTIONS.includes(sub)) E(`subsecao tecnica desconhecida: "### ${sub}"`);
    }
    const total = Object.values(tech).reduce((acc, v) => acc + v.length, 0);
    if (total === 0) E(`a secao "## ${SECTION_TECH}" precisa de ao menos 1 item`);
  }
}

/** Descobre, faz parse e valida tudo. Retorna { notes, errors }. */
function collectNotes() {
  const errors = [];
  const discovered = discoverNotes();
  if (discovered.length === 0) {
    errors.push('nenhum arquivo em release-notes/<plataforma>/*.md');
  }
  const notes = [];
  for (const meta of discovered) {
    const parsed = parseReleaseNote(meta.file, errors);
    if (!parsed) continue;
    validateNote(meta, parsed, errors);
    notes.push({ ...meta, fm: parsed.fm, body: parsed.body });
  }
  return { notes, errors };
}

function loadNotesOrExit() {
  const { notes, errors } = collectNotes();
  if (errors.length) {
    printErrors(errors);
    process.exit(1);
  }
  return notes;
}

// ==========================================================================
// Semver
// ==========================================================================

/** Ordena versoes da mais nova para a mais antiga. */
function compareVersionsDesc(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pb[i] - pa[i];
  }
  return 0;
}

function uniqueNonEmpty(items) {
  return [...new Set(items.filter((item) => typeof item === 'string' && item.trim() !== ''))];
}

function buildReleaseNoteLinkLabel(note) {
  return `${note.platform}-${note.version}`;
}

function buildReleaseNoteSourceUrl(note) {
  return `${REPO_RELEASE_NOTES_BASE_URL}/${note.platform}/${note.version}.md`;
}

// ==========================================================================
// Transformacao para nota de cliente (bundle / publish)
// ==========================================================================

function toClientNote(note) {
  const user = note.body[SECTION_USER] || {};
  const tech = note.body[SECTION_TECH] || {};
  const highlights = (user.Destaques || [])
    .map((d) => parseHighlight(d, note.file, []))
    .filter(Boolean);
  return {
    version: note.version,
    buildNumber: typeof note.fm.buildNumber === 'number' ? note.fm.buildNumber : null,
    releaseDate: note.fm.date,
    type: note.fm.type,
    showPopup: note.fm.showPopup === true,
    published: note.fm.published !== false,
    headline: (user.Headline || [''])[0],
    highlights,
    added: user.Novidades || [],
    improved: user.Melhorias || [],
    fixed: uniqueNonEmpty([...(user.Correções || []), ...(tech.Fixed || [])]),
    issueRefs: note.fm.issues || [],
  };
}

function buildBundlePayload(platform, notes, generatedAt = new Date().toISOString()) {
  const platformNotes = notes
    .filter((n) => n.platform === platform)
    .sort((a, b) => compareVersionsDesc(a.version, b.version))
    .map(toClientNote);
  return {
    platform,
    generatedAt,
    notes: platformNotes,
  };
}

function validateBundleTargets(notes, errors) {
  for (const platform of CLIENT_PLATFORMS) {
    const expected = buildBundlePayload(platform, notes, '1970-01-01T00:00:00.000Z');
    for (const relativePath of BUNDLE_TARGETS[platform]) {
      const target = path.join(ROOT, relativePath);
      if (!fs.existsSync(target)) {
        errors.push(`${relativePath}: bundle ausente — rode "node scripts/release-notes.js bundle"`);
        continue;
      }
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(target, 'utf-8'));
      } catch (error) {
        errors.push(`${relativePath}: JSON invalido (${error.message})`);
        continue;
      }
      const actual = {
        platform: parsed.platform,
        generatedAt: '1970-01-01T00:00:00.000Z',
        notes: parsed.notes,
      };
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        errors.push(
          `${relativePath}: bundle fora de sincronia com release-notes/${platform}/*.md — rode ` +
            '"node scripts/release-notes.js bundle"'
        );
      }
    }
  }
}

// ==========================================================================
// Comando: validate
// ==========================================================================

function cmdValidate() {
  const { notes, errors } = collectNotes();
  validateBundleTargets(notes, errors);
  if (errors.length) {
    printErrors(errors);
    process.exit(1);
  }
  console.log(`validate: OK — ${notes.length} arquivo(s) de release notes.`);
}

// ==========================================================================
// Comando: changelog
// ==========================================================================

function buildAutogen(notes) {
  const lines = [];
  const linkRefs = [];
  for (const platform of PLATFORMS) {
    const platformNotes = notes
      .filter((n) => n.platform === platform)
      .sort((a, b) => compareVersionsDesc(a.version, b.version));
    if (platformNotes.length === 0) continue;
    lines.push(`## ${PLATFORM_LABEL[platform]}`, '');
    for (const note of platformNotes) {
      const refLabel = buildReleaseNoteLinkLabel(note);
      lines.push(`### [${note.version}][${refLabel}] - ${note.fm.date}`, '');
      const tech = note.body[SECTION_TECH] || {};
      for (const sec of TECH_SECTIONS) {
        const items = tech[sec] || [];
        if (items.length === 0) continue;
        lines.push(`#### ${TECH_LABEL_PT[sec]}`);
        for (const item of items) lines.push(`- ${item}`);
        lines.push('');
      }
      const itemRefs = [];
      if (note.fm.issues && note.fm.issues.length) {
        itemRefs.push(`Issues: ${note.fm.issues.map((i) => `#${i}`).join(', ')}`);
      }
      if (note.fm.prs && note.fm.prs.length) {
        itemRefs.push(`PRs: ${note.fm.prs.map((i) => `#${i}`).join(', ')}`);
      }
      if (itemRefs.length) lines.push(`_${itemRefs.join(' · ')}_`, '');
      linkRefs.push(`[${refLabel}]: ${buildReleaseNoteSourceUrl(note)}`);
    }
  }
  if (linkRefs.length) {
    lines.push('', ...linkRefs);
  }
  return lines.join('\n').trimEnd();
}

function cmdChangelog() {
  const notes = loadNotesOrExit();
  const autogen = buildAutogen(notes);

  if (!fs.existsSync(CHANGELOG_PATH)) {
    fail('CHANGELOG.md nao existe — faca o bootstrap manual com os marcadores AUTOGEN.');
  }
  const current = fs.readFileSync(CHANGELOG_PATH, 'utf-8');
  const startIdx = current.indexOf(AUTOGEN_START);
  const endIdx = current.indexOf(AUTOGEN_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    fail(`CHANGELOG.md sem os marcadores ${AUTOGEN_START} / ${AUTOGEN_END} — bootstrap manual necessario.`);
  }
  const before = current.slice(0, startIdx + AUTOGEN_START.length);
  const after = current.slice(endIdx);
  fs.writeFileSync(CHANGELOG_PATH, `${before}\n\n${autogen}\n\n${after}`);
  console.log('changelog: CHANGELOG.md regenerado (bloco AUTOGEN).');
}

// ==========================================================================
// Comando: bundle
// ==========================================================================

function cmdBundle() {
  const notes = loadNotesOrExit();
  for (const platform of CLIENT_PLATFORMS) {
    const payload = buildBundlePayload(platform, notes);
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    for (const relativePath of BUNDLE_TARGETS[platform]) {
      const target = path.join(ROOT, relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, json);
      console.log(`bundle: ${relativePath} — ${payload.notes.length} nota(s).`);
    }
  }
}

// ==========================================================================
// Comando: publish
// ==========================================================================

async function cmdPublish(opts) {
  const { platform, version } = opts;
  if (!CLIENT_PLATFORMS.includes(platform)) {
    fail(`publish suportado apenas para: ${CLIENT_PLATFORMS.join(', ')}`);
  }
  const file = path.join(NOTES_DIR, platform, `${version}.md`);
  if (!fs.existsSync(file)) fail(`arquivo nao encontrado: ${file}`);

  const errors = [];
  const parsed = parseReleaseNote(file, errors);
  if (parsed) validateNote({ platform, version, file }, parsed, errors);
  if (errors.length) {
    printErrors(errors);
    process.exit(1);
  }

  const note = { platform, version, file, fm: parsed.fm, body: parsed.body };
  const client = toClientNote(note);
  if (!client.published) {
    fail(`${platform} ${version} esta com published: false — nao deve ir ao Firestore.`);
  }

  const tech = parsed.body[SECTION_TECH] || {};
  const technicalSummary = TECH_SECTIONS
    .flatMap((sec) => (tech[sec] || []).map((it) => `${sec}: ${it}`))
    .join(' ');

  // Lazy require: mantem validate/changelog/bundle sem dependencias.
  let admin;
  try {
    admin = require('firebase-admin');
  } catch (e) {
    fail(
      'firebase-admin nao encontrado. Rode num contexto com a dependencia, ex.:\n' +
        '  cd functions && node ../scripts/release-notes.js publish --platform ' +
        `${platform} --version ${version}\n` +
        'Na CI, use GOOGLE_APPLICATION_CREDENTIALS apontando para a service account.'
    );
  }
  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const db = admin.firestore();
  const docId = `${platform}_${version}`;
  const docRef = db.collection('release_notes').doc(docId);
  const existing = await docRef.get();

  const payload = {
    platform,
    version,
    buildNumber: client.buildNumber,
    releaseDate: admin.firestore.Timestamp.fromDate(new Date(`${client.releaseDate}T12:00:00Z`)),
    type: client.type,
    published: true,
    content: {
      'pt-BR': {
        headline: client.headline,
        highlights: client.highlights,
        sections: { added: client.added, improved: client.improved, fixed: client.fixed },
      },
    },
    technicalSummary,
    issueRefs: parsed.fm.issues || [],
    prRefs: parsed.fm.prs || [],
    milestone: parsed.fm.milestone,
    displayConfig: { showPopup: client.showPopup, minBuildToShow: 1 },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!existing.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  await docRef.set(payload, { merge: true });
  console.log(`publish: release_notes/${docId} — ${existing.exists ? 'atualizado' : 'criado'}.`);
}

// ==========================================================================
// CLI
// ==========================================================================

function parseOpts(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--platform') opts.platform = argv[++i];
    else if (argv[i] === '--version') opts.version = argv[++i];
  }
  return opts;
}

function usage() {
  console.log(
    'uso: node scripts/release-notes.js <comando>\n' +
      '  validate                                  valida todos os arquivos-fonte\n' +
      '  changelog                                 regenera o bloco AUTOGEN do CHANGELOG.md\n' +
      '  bundle                                    gera os JSONs de fallback embarcados\n' +
      '  publish --platform <p> --version <x.y.z>  faz upsert do doc no Firestore'
  );
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case 'validate':
      cmdValidate();
      break;
    case 'changelog':
      cmdChangelog();
      break;
    case 'bundle':
      cmdBundle();
      break;
    case 'publish': {
      const opts = parseOpts(rest);
      if (!opts.platform || !opts.version) {
        fail('uso: publish --platform <android|web|ios> --version <x.y.z>');
      }
      cmdPublish(opts).catch((err) => {
        console.error(err);
        process.exit(1);
      });
      break;
    }
    default:
      usage();
      process.exit(cmd ? 1 : 0);
  }
}

// Roda o CLI apenas quando executado direto (`node scripts/release-notes.js`).
// Sob `require()` (testes), apenas exporta as funcoes puras — ver release-notes.test.js.
if (require.main === module) {
  main();
}

module.exports = {
  parseScalar,
  parseFrontmatter,
  parseBody,
  parseHighlight,
  validateNote,
  buildAutogen,
  toClientNote,
  compareVersionsDesc,
};
