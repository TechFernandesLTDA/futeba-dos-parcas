/**
 * Contrato: prefixo estático de chave t() dinâmica deve existir no locale — #3899.
 *
 * Os testes de paridade de chave (`i18n-key-parity.test.ts`, `keyParity.test.ts`) cobrem
 * apenas literais estáticos t('a.b.c') — template literals são explicitamente ignorados
 * porque validar a chave completa exigiria conhecer o domínio da variável interpolada
 * (fora do alcance de uma checagem estática por regex).
 *
 * O que É possível checar sem conhecer o domínio da variável: o prefixo estático antes do
 * primeiro `${` precisa existir nos 3 locales como objeto não-vazio (container), não como
 * folha nem como ausência total. Foi exatamente essa a causa do #3899 — o código usava
 * `t(\`profile.positions.${position}\`)`, mas `profile.positions` não existe em locale
 * nenhum (o namespace correto é `player.positions`). Esse teste teria pego o bug.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';
import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';
import es from './locales/es.json';

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (['.ts', '.tsx'].includes(extname(entry))) {
      results.push(fullPath);
    }
  }
  return results;
}

interface DynamicCall {
  file: string;
  rawPrefix: string;
  /** Prefixo normalizado: sem o `.` final, sem sufixo de concatenação parcial (ex.: `filter_`). */
  namespacePrefix: string;
}

/**
 * Extrai chamadas t(`prefixo.${variável}...`) e devolve o prefixo estático até o `${`.
 *
 * Cobre tanto o padrão de chave aninhada (`t(\`a.b.${x}\`)`, prefixo termina em `.`) quanto
 * o padrão de sufixo concatenado (`t(\`a.filter_${x}\`)`, sem `.` antes do `${`) — neste
 * segundo caso o namespace verificado é o segmento anterior ao último `.` do prefixo bruto.
 */
function extractDynamicKeyPrefixes(source: string, file: string): DynamicCall[] {
  const calls: DynamicCall[] = [];
  const re = /\bt\(`([a-zA-Z0-9_.]*)\$\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const rawPrefix = m[1];
    if (!rawPrefix) continue; // t(`${x}`) sem prefixo — nada a validar aqui
    const namespacePrefix = rawPrefix.endsWith('.')
      ? rawPrefix.slice(0, -1)
      : rawPrefix.includes('.')
        ? rawPrefix.slice(0, rawPrefix.lastIndexOf('.'))
        : rawPrefix;
    calls.push({ file, rawPrefix, namespacePrefix });
  }
  return calls;
}

function resolve(obj: Record<string, unknown>, keyPath: string): unknown {
  const parts = keyPath.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

/** true se o caminho resolve a um objeto com ao menos uma chave (container válido). */
function isNonEmptyContainer(obj: Record<string, unknown>, keyPath: string): boolean {
  const val = resolve(obj, keyPath);
  return typeof val === 'object' && val !== null && Object.keys(val).length > 0;
}

const SRC_DIR = join(__dirname, '..');
const sourceFiles = collectSourceFiles(SRC_DIR).filter(
  (f) => !f.includes('.test.') && !f.includes('.spec.') && !f.includes('/i18n/'),
);

const allDynamicCalls: DynamicCall[] = [];
for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf-8');
  allDynamicCalls.push(...extractDynamicKeyPrefixes(content, file));
}

const locales: Record<string, Record<string, unknown>> = {
  'pt-BR': ptBR as Record<string, unknown>,
  en: en as Record<string, unknown>,
  es: es as Record<string, unknown>,
};

describe('i18n dynamic key prefix contract (#3899)', () => {
  it('encontrou ao menos uma chamada dinâmica t(`...${...}`) para analisar (sanity check)', () => {
    // Se isso falhar, o regex de extração provavelmente quebrou com uma mudança de sintaxe —
    // não é sinal de que o app parou de usar chaves dinâmicas.
    expect(allDynamicCalls.length).toBeGreaterThan(0);
  });

  for (const localeName of Object.keys(locales)) {
    it(`todo prefixo estático de t(\`...\${...}\`) resolve a um objeto não-vazio em ${localeName}.json`, () => {
      const messages = locales[localeName];
      const broken = allDynamicCalls.filter((c) => !isNonEmptyContainer(messages, c.namespacePrefix));
      const details = broken
        .map((c) => `${c.file.replace(SRC_DIR, 'src')}: t(\`${c.rawPrefix}\${...}\`) — prefixo "${c.namespacePrefix}" não existe (ou está vazio) em ${localeName}.json`)
        .join('\n');
      expect(broken, details).toEqual([]);
    });
  }
});
