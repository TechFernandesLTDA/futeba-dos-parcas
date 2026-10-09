'use strict';

/**
 * Validador de datasets de venues (scripts/data/venues-*.json).
 *
 * Garante contrato de dados ANTES de qualquer dry-run/importação:
 *  - provenance por item (>= 1 fonte com URL http e descrição do dado);
 *  - nada fabricado: preco_hora/nota/horários/coordenadas só se existirem e
 *    forem plausíveis (coordenada dentro do Brasil, nota 0-5, horário HH:MM);
 *  - dedupe por nome normalizado dentro do dataset (e entre datasets quando
 *    mais de um arquivo é validado junto);
 *  - campos obrigatórios do importador (nome, cidade, uf, rodada, gerado_em).
 *
 * Uso:
 *   node scripts/data/validate-venues-dataset.js               # todos
 *   node scripts/data/validate-venues-dataset.js a.json b.json
 * Saída: relatório por arquivo; exit 1 se houver QUALQUER erro.
 */

const fs = require('node:fs');
const path = require('node:path');

// 'media' (sem acento) e o valor do dataset legado R1/R2 (venues-curitiba.json).
const CONFIDENCE = new Set(['alta', 'média', 'media', 'baixa']);
const DIAS = [
  'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo',
];
const HORA = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;
// Limites aproximados do Brasil (evita coordenada trocada/inventada).
const BR = {latMin: -34.0, latMax: 5.4, lonMin: -74.0, lonMax: -32.0};

function normalizeName(value) {
  return String(value ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
}

function horaValida(value) {
  if (typeof value !== 'string') return false;
  const m = value.match(HORA);
  if (!m) return false;
  return [m[1], m[3]].every((h) => Number(h) >= 0 && Number(h) <= 23)
    && [m[2], m[4]].every((mi) => Number(mi) >= 0 && Number(mi) <= 59);
}

function coordValida(c) {
  if (!c || typeof c !== 'object') return false;
  const {lat, lon} = c;
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return lat >= BR.latMin && lat <= BR.latMax
    && lon >= BR.lonMin && lon <= BR.lonMax;
}

/** Valida um dataset. Retorna lista de erros ('' nunca). */
function validateDataset(dataset, options = {}) {
  const errors = [];
  const prefix = options.prefix ? `${options.prefix}: ` : '';
  const push = (msg) => errors.push(`${prefix}${msg}`);

  if (!dataset || typeof dataset !== 'object') {
    push('dataset não é um objeto JSON');
    return errors;
  }
  if (typeof dataset.gerado_em !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dataset.gerado_em)) {
    push('gerado_em ausente/inválido (esperado YYYY-MM-DD com data de coleta)');
  }
  if (!Number.isInteger(dataset.rodada) || dataset.rodada < 1 || dataset.rodada > 9) {
    push('rodada ausente/inválida (1..9)');
  }
  if (!Array.isArray(dataset.venues) || dataset.venues.length === 0) {
    push('venues ausente ou vazio');
    return errors;
  }

  const seen = new Map();
  dataset.venues.forEach((v, i) => {
    const where = `venues[${i}]`;
    if (!v || typeof v !== 'object') {
      push(`${where}: não é objeto`);
      return;
    }
    const nome = typeof v.nome === 'string' ? v.nome.trim() : '';
    if (nome.length < 2) push(`${where}: nome ausente/curto`);

    const end = v.endereco;
    if (!end || typeof end !== 'object') {
      push(`${where} (${nome}): endereco ausente`);
    } else {
      if (typeof end.cidade !== 'string' || !end.cidade.trim()) {
        push(`${where} (${nome}): endereco.cidade ausente`);
      }
      if (typeof end.uf !== 'string' || !/^[A-Za-z]{2}$/.test(end.uf.trim())) {
        push(`${where} (${nome}): endereco.uf ausente/inválida`);
      }
      for (const campo of ['rua', 'numero', 'bairro', 'cep']) {
        const val = end[campo];
        if (val !== undefined && val !== null && typeof val !== 'string') {
          push(`${where} (${nome}): endereco.${campo} deve ser string ou null`);
        }
      }
    }

    for (const campo of ['telefone', 'whatsapp', 'site', 'instagram',
      'detalhe_quadras', 'tipo_piso']) {
      const val = v[campo];
      if (val !== undefined && val !== null && typeof val !== 'string') {
        push(`${where} (${nome}): ${campo} deve ser string ou null`);
      }
    }

    if (v.preco_hora !== null && v.preco_hora !== undefined
      && typeof v.preco_hora !== 'number' && typeof v.preco_hora !== 'string') {
      push(`${where} (${nome}): preco_hora deve ser null, number ou string`);
    }
    if (typeof v.preco_hora === 'number' && !(v.preco_hora > 0)) {
      push(`${where} (${nome}): preco_hora numérico deve ser > 0`);
    }
    if (v.qtd_quadras !== null && v.qtd_quadras !== undefined
      && (!Number.isInteger(v.qtd_quadras) || v.qtd_quadras <= 0)) {
      push(`${where} (${nome}): qtd_quadras deve ser inteiro > 0 ou null`);
    }
    if (v.nota_media !== null && v.nota_media !== undefined
      && (typeof v.nota_media !== 'number' || v.nota_media < 0 || v.nota_media > 5)) {
      push(`${where} (${nome}): nota_media deve ficar entre 0 e 5`);
    }
    if (v.contagem_avaliacoes !== null && v.contagem_avaliacoes !== undefined
      && (!Number.isInteger(v.contagem_avaliacoes) || v.contagem_avaliacoes < 0)) {
      push(`${where} (${nome}): contagem_avaliacoes deve ser inteiro >= 0`);
    }

    if (v.horarios !== null && v.horarios !== undefined) {
      if (typeof v.horarios !== 'object' || Array.isArray(v.horarios)) {
        push(`${where} (${nome}): horarios deve ser objeto ou null`);
      } else {
        for (const [dia, faixa] of Object.entries(v.horarios)) {
          // 'observacao' = nota textual herdada do dataset R1 (não é dia).
          if (dia === 'observacao') {
            if (typeof faixa !== 'string' || !faixa.trim()) {
              push(`${where} (${nome}): horarios.observacao deve ser string`);
            }
            continue;
          }
          if (!DIAS.includes(dia)) push(`${where} (${nome}): dia inválido "${dia}"`);
          if (!horaValida(faixa)) {
            push(`${where} (${nome}): faixa de horário inválida "${dia}=${faixa}"`);
          }
        }
      }
    }

    if (!Array.isArray(v.comentarios)) push(`${where} (${nome}): comentarios deve ser array`);
    if (!Array.isArray(v.fotos)) {
      push(`${where} (${nome}): fotos deve ser array`);
    } else if (v.fotos.length > 0) {
      const ok = v.fotos.every((f) => (typeof f === 'string' && /^https?:\/\//.test(f))
        || (f && typeof f === 'object' && typeof f.url === 'string' && /^https?:\/\//.test(f.url)));
      if (!ok) push(`${where} (${nome}): fotos com item sem URL http(s)`);
    }

    if (!Array.isArray(v.fontes) || v.fontes.length === 0) {
      push(`${where} (${nome}): fontes ausente (provenance obrigatória)`);
    } else {
      v.fontes.forEach((f, j) => {
        if (!f || typeof f !== 'object'
          || typeof f.url !== 'string'
          || !/^https?:\/\/\S+/.test(f.url)
          || typeof f.dado !== 'string'
          || f.dado.trim().length < 5) {
          push(`${where} (${nome}): fontes[${j}] precisa de url http(s) e dado >= 5 chars`);
        }
      });
    }

    if (typeof v.confidence !== 'string' || !CONFIDENCE.has(v.confidence)) {
      push(`${where} (${nome}): confidence deve ser alta|média|baixa`);
    }
    if (v.coordenadas !== null && v.coordenadas !== undefined && !coordValida(v.coordenadas)) {
      push(`${where} (${nome}): coordenadas fora do Brasil ou não numéricas`);
    }
    if (v.rodada_dados !== undefined && v.rodada_dados !== null
      && !/^R[1-9]$/.test(v.rodada_dados)) {
      push(`${where} (${nome}): rodada_dados inválida "${v.rodada_dados}"`);
    }

    if (nome) {
      const key = `${(end && end.cidade) || ''}::${normalizeName(nome)}`;
      if (seen.has(key)) {
        push(`${where}: nome duplicado "${nome}" (igual a venues[${seen.get(key)}])`);
      } else {
        seen.set(key, i);
      }
    }
  });

  return errors;
}

function defaultFiles() {
  const dir = __dirname;
  return fs.readdirSync(dir)
      .filter((f) => /^venues-.*\.json$/.test(f))
      .sort()
      .map((f) => path.join(dir, f));
}

function main(argv) {
  const files = argv.length ? argv.map((f) => path.resolve(f)) : defaultFiles();
  if (!files.length) {
    console.error('Nenhum dataset para validar.');
    process.exit(1);
  }

  const all = [];
  let totalErrors = 0;
  const seenGlobal = new Map();

  for (const file of files) {
    let dataset;
    try {
      dataset = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.log(`✗ ${path.basename(file)}: JSON inválido — ${err.message}`);
      totalErrors += 1;
      continue;
    }
    const errors = validateDataset(dataset, {prefix: path.basename(file)});
    const venues = Array.isArray(dataset.venues) ? dataset.venues : [];
    // Dedupe GLOBAL entre datasets (mesmo venue não pode entrar em 2 rodadas).
    // Datasets de enriquecimento (modo=enriquecimento) apontam venues já importados por location_id.
    const enriquecimento = dataset && dataset.modo === 'enriquecimento';
    if (enriquecimento) {
      venues.forEach((v, i) => {
        if (!v || typeof v.location_id !== 'string' || v.location_id.length < 10) {
          errors.push(`${path.basename(file)}: venues[${i}] ("${v && v.nome}") sem location_id (obrigatório no modo enriquecimento)`);
        }
      });
    }
    if (!enriquecimento) venues.forEach((v, i) => {
      const cidade = v && v.endereco ? v.endereco.cidade : '';
      const key = `${cidade || ''}::${normalizeName(v && v.nome)}`;
      if (seenGlobal.has(key) && seenGlobal.get(key) !== file) {
        errors.push(`${path.basename(file)}: venues[${i}] ("${v.nome}") já existe em `
          + `${path.basename(seenGlobal.get(key))}`);
      } else {
        seenGlobal.set(key, file);
      }
    });

    const withCoords = venues.filter((v) => coordValida(v.coordenadas)).length;
    const comFonte = venues.filter((v) => Array.isArray(v.fontes) && v.fontes.length > 0).length;
    console.log(
        `• ${path.basename(file)}: ${venues.length} venues, `
        + `${withCoords} com coordenada, ${comFonte} com fonte, `
        + `${errors.length} erro(s)`,
    );
    all.push({file: path.basename(file), venues: venues.length, errors});
    totalErrors += errors.length;
    for (const e of errors) console.log(`    ✗ ${e}`);
  }

  console.log(`\nTotal: ${all.length} dataset(s), ${totalErrors} erro(s)`);
  process.exit(totalErrors > 0 ? 1 : 0);
}

module.exports = {validateDataset, normalizeName, coordValida, horaValida};

if (require.main === module) {
  main(process.argv.slice(2));
}