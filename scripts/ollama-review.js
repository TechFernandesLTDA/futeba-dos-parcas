#!/usr/bin/env node
/**
 * Code review local via Ollama.
 * Uso ideal: PRs sensíveis (security, CPF, money) — diff fica no Mac.
 *
 * Uso:
 *   echo "<diff>" | node scripts/ollama-review.js [--model qwen2.5-coder:7b]
 *   git diff master...HEAD | node scripts/ollama-review.js
 *   git diff --cached | node scripts/ollama-review.js
 *
 * Verifica disponibilidade do Ollama antes de chamar.
 * Fallback: avisa user pra usar review cloud se DOWN.
 */
const { execSync } = require('child_process');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2.5-coder:7b';
const REASONING_MODEL = 'deepseek-r1:7b';

const PROMPT_TEMPLATE = `Você é um code reviewer experiente do projeto Futeba dos Parças (Kotlin/Compose Android + React/TS web + Cloud Functions TS).

Faça review crítico do diff abaixo. Foque em:

1. **Security**: SQL/NoSQL injection, auth bypass, race conditions, escalada de privilégio, secrets em logs
2. **Bugs**: null safety, error handling, edge cases não cobertos, off-by-one
3. **Performance**: N+1 queries, memory leaks (listeners não removidos), recomposições desnecessárias
4. **Type safety**: usos de any/Any?, casts inseguros
5. **Convenções projeto**: per CLAUDE.md (StateFlow, sealed UiState, Material3 colors, PT-BR strings)

Output em PT-BR, máximo 600 palavras. Liste no máximo top 5 issues priorizadas (Critical/High/Medium). Pra cada: arquivo:linha + descrição + fix sugerido.

Se o diff é trivial (rename, comment, style), responda apenas: "OK trivial — sem issues".

DIFF:
\`\`\`
{{DIFF}}
\`\`\``;

async function checkOllama() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/version`);
    return res.ok;
  } catch {
    return false;
  }
}

async function review(model, diff) {
  const prompt = PROMPT_TEMPLATE.replace('{{DIFF}}', diff);
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.3 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.response;
}

async function main() {
  const args = process.argv.slice(2);
  const modelIdx = args.indexOf('--model');
  const model = modelIdx >= 0 ? args[modelIdx + 1] : DEFAULT_MODEL;
  const reasoningMode = args.includes('--reasoning');
  const useModel = reasoningMode ? REASONING_MODEL : model;

  if (!(await checkOllama())) {
    console.error('❌ Ollama indisponível em ' + OLLAMA_URL);
    console.error('   Tente: nohup ollama serve > /tmp/ollama.log 2>&1 &');
    console.error('   Fallback: usar code review via Cloud (Claude/Sonnet/Opus)');
    process.exit(2);
  }

  // Read stdin
  const diff = await new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });

  if (!diff.trim()) {
    console.error('Empty diff. Pipe via: git diff | node scripts/ollama-review.js');
    process.exit(1);
  }

  // Cap diff size pra não estourar context (~6K tokens ~ 24K chars)
  const MAX_CHARS = 24000;
  const trimmed = diff.length > MAX_CHARS
    ? diff.slice(0, MAX_CHARS) + `\n\n... (diff truncado: ${diff.length - MAX_CHARS} chars omitted)`
    : diff;

  console.error(`🔍 Reviewing ${diff.length} chars via ${useModel}...`);
  const start = Date.now();
  const result = await review(useModel, trimmed);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(result);
  console.error(`\n⏱️  ${elapsed}s | model=${useModel}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
