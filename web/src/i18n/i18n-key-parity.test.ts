/**
 * Teste de paridade de chaves i18n.
 *
 * Verifica que:
 * 1. Toda chave estática t('literal') referenciada no código fonte existe no pt-BR.json
 *    (considerando sufixos plurais i18next: _one, _other, etc.)
 * 2. Os três arquivos de locale (pt-BR, en, es) possuem exatamente o mesmo conjunto de chaves.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';
import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';
import es from './locales/es.json';

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

/** Retorna todos os arquivos .ts/.tsx recursivamente a partir de um diretório. */
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

/** Extrai chaves estáticas de chamadas t('key') / t("key"). */
function extractStaticTKeys(source: string): string[] {
  const keys: string[] = [];
  // Captura apenas literais simples — pula template literals e variáveis
  const re = /\bt\(['"]([a-zA-Z0-9_.]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

/**
 * Resolve um caminho pontilhado em um objeto JSON.
 * Retorna o valor encontrado ou undefined.
 */
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

/**
 * Verifica se uma chave está presente no locale, considerando:
 * - Valor direto (string)
 * - Sufixos plurais i18next: _one, _other, _zero, _two, _few, _many
 */
function isPresent(obj: Record<string, unknown>, keyPath: string): boolean {
  const val = resolve(obj, keyPath);
  if (val !== undefined && typeof val !== 'object') return true;
  const pluralSuffixes = ['_one', '_other', '_zero', '_two', '_few', '_many'];
  for (const suffix of pluralSuffixes) {
    const v = resolve(obj, keyPath + suffix);
    if (v !== undefined) return true;
  }
  return false;
}

/** Achata um objeto JSON em uma lista de caminhos pontilhados de valores folha (strings). */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      keys.push(...flattenKeys(v as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

const SRC_DIR = join(__dirname, '..');
const sourceFiles = collectSourceFiles(SRC_DIR).filter(
  // Exclui arquivos de teste e o próprio diretório i18n
  (f) => !f.includes('.test.') && !f.includes('.spec.') && !f.includes('/i18n/'),
);

const allStaticKeys = new Set<string>();
for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf-8');
  for (const key of extractStaticTKeys(content)) {
    allStaticKeys.add(key);
  }
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('i18n key parity', () => {
  it('todas as chaves estáticas t("...") devem estar presentes em pt-BR.json', () => {
    const missing: string[] = [];
    for (const key of allStaticKeys) {
      if (!isPresent(ptBR as Record<string, unknown>, key)) {
        missing.push(key);
      }
    }
    expect(
      missing,
      `Chaves referenciadas no código mas ausentes em pt-BR.json:\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  it('pt-BR.json e en.json devem ter o mesmo conjunto de chaves folha', () => {
    const ptKeys = new Set(flattenKeys(ptBR as Record<string, unknown>));
    const enKeys = new Set(flattenKeys(en as Record<string, unknown>));
    const onlyInPt = [...ptKeys].filter((k) => !enKeys.has(k));
    const onlyInEn = [...enKeys].filter((k) => !ptKeys.has(k));
    expect(
      { onlyInPt, onlyInEn },
      'Diferenças entre pt-BR.json e en.json',
    ).toEqual({ onlyInPt: [], onlyInEn: [] });
  });

  it('pt-BR.json e es.json devem ter o mesmo conjunto de chaves folha', () => {
    const ptKeys = new Set(flattenKeys(ptBR as Record<string, unknown>));
    const esKeys = new Set(flattenKeys(es as Record<string, unknown>));
    const onlyInPt = [...ptKeys].filter((k) => !esKeys.has(k));
    const onlyInEs = [...esKeys].filter((k) => !ptKeys.has(k));
    expect(
      { onlyInPt, onlyInEs },
      'Diferenças entre pt-BR.json e es.json',
    ).toEqual({ onlyInPt: [], onlyInEs: [] });
  });
});
