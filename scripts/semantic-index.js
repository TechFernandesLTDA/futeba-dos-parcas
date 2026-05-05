#!/usr/bin/env node
/**
 * Semantic search local via Ollama nomic-embed-text.
 *
 * Indexa specs/*.md, audit reports e GitHub issues do projeto.
 * Permite query semântica sem mandar dados pra cloud.
 *
 * Uso:
 *   node scripts/semantic-index.js index        # cria/atualiza index
 *   node scripts/semantic-index.js query "X"    # busca
 *   node scripts/semantic-index.js stats        # info do index
 *
 * Pré-requisito: ollama serve + nomic-embed-text:latest pulled.
 *
 * Storage: ~/.cache/futeba-semantic-index.json (gitignored)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(os.homedir(), '.cache', 'futeba-semantic-index.json');
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = 'nomic-embed-text:latest';
const CHUNK_SIZE = 800; // chars por chunk (overlap 200)
const CHUNK_OVERLAP = 200;

async function embed(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: text }),
  });
  if (!res.ok) {
    throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.embedding;
}

function chunkText(text, source, meta = {}) {
  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const piece = text.slice(i, i + CHUNK_SIZE).trim();
    if (piece.length < 50) continue;
    chunks.push({
      source,
      offset: i,
      text: piece,
      ...meta,
    });
  }
  return chunks;
}

function gatherSpecs() {
  const specsDir = path.join(REPO_ROOT, 'specs');
  return fs.readdirSync(specsDir)
    .filter(f => f.endsWith('.md'))
    .flatMap(f => {
      const fullPath = path.join(specsDir, f);
      const text = fs.readFileSync(fullPath, 'utf8');
      return chunkText(text, `specs/${f}`, { kind: 'spec' });
    });
}

function gatherAuditReports() {
  const tmpFiles = fs.readdirSync('/tmp')
    .filter(f => /^(audit|security)_/.test(f) && f.endsWith('.md'));
  return tmpFiles.flatMap(f => {
    const fullPath = path.join('/tmp', f);
    const text = fs.readFileSync(fullPath, 'utf8');
    return chunkText(text, `tmp/${f}`, { kind: 'audit' });
  });
}

function gatherIssues() {
  const json = execSync(
    'gh issue list --repo TechFernandesLTDA/futeba-dos-parcas --state all --limit 200 --json number,title,body,state,labels',
    { encoding: 'utf8' },
  );
  const issues = JSON.parse(json);
  return issues.flatMap(issue => {
    const text = `#${issue.number} [${issue.state}] ${issue.title}\n\n${issue.body || ''}`;
    return chunkText(text, `issue/#${issue.number}`, {
      kind: 'issue',
      number: issue.number,
      state: issue.state,
    });
  });
}

function cosineSim(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function buildIndex() {
  console.log('Gathering sources...');
  const specs = gatherSpecs();
  const audits = gatherAuditReports();
  const issues = gatherIssues();
  const all = [...specs, ...audits, ...issues];
  console.log(`Total chunks: ${all.length} (${specs.length} specs, ${audits.length} audits, ${issues.length} issues)`);

  const index = [];
  let done = 0;
  for (const chunk of all) {
    try {
      const vector = await embed(chunk.text);
      index.push({ ...chunk, vector });
    } catch (err) {
      console.error(`Embed failed for ${chunk.source}@${chunk.offset}:`, err.message);
    }
    done++;
    if (done % 20 === 0) process.stdout.write(`  ${done}/${all.length}\r`);
  }
  console.log(`\nEmbedded ${index.length}/${all.length} chunks`);

  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify({
    model: MODEL,
    builtAt: new Date().toISOString(),
    chunkCount: index.length,
    chunks: index,
  }));
  console.log(`Index saved → ${INDEX_PATH}`);
}

async function query(q, topK = 5) {
  if (!fs.existsSync(INDEX_PATH)) {
    console.error('Index não existe. Rode: node scripts/semantic-index.js index');
    process.exit(1);
  }
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const queryVec = await embed(q);

  const scored = index.chunks.map(c => ({
    score: cosineSim(queryVec, c.vector),
    source: c.source,
    kind: c.kind,
    state: c.state,
    text: c.text.slice(0, 250),
  }));
  scored.sort((a, b) => b.score - a.score);

  console.log(`\nTop ${topK} results para: "${q}"\n`);
  scored.slice(0, topK).forEach((r, i) => {
    const tag = r.state ? ` [${r.state}]` : '';
    console.log(`${i + 1}. (${r.score.toFixed(3)}) ${r.source}${tag}`);
    console.log(`   ${r.text.replace(/\n/g, ' ').slice(0, 200)}...`);
    console.log();
  });
}

function stats() {
  if (!fs.existsSync(INDEX_PATH)) {
    console.log('Index não existe.');
    return;
  }
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const byKind = {};
  index.chunks.forEach(c => { byKind[c.kind] = (byKind[c.kind] || 0) + 1; });
  console.log(`Index: ${INDEX_PATH}`);
  console.log(`Built: ${index.builtAt}`);
  console.log(`Model: ${index.model}`);
  console.log(`Chunks: ${index.chunkCount}`);
  Object.entries(byKind).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'index': await buildIndex(); break;
    case 'query': await query(process.argv.slice(3).join(' '), 5); break;
    case 'stats': stats(); break;
    default:
      console.log('Usage:');
      console.log('  node scripts/semantic-index.js index');
      console.log('  node scripts/semantic-index.js query "..."');
      console.log('  node scripts/semantic-index.js stats');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
