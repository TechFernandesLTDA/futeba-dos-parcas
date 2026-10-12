import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const SRC = resolve(process.cwd(), 'src');
const LOCALES = ['pt-BR', 'en', 'es'] as const;

function listTsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listTsx(full);
    const isSource = entry.name.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(entry.name);
    return isSource ? [full] : [];
  });
}

// aria-label="Texto fixo" (literal com letras); expressões {t('...')} e {variavel} não casam.
const HARDCODED_ARIA_LABEL = /aria-label="[^"{]*[A-Za-zÀ-ú]{3,}[^"]*"/g;

describe('contrato i18n dos nomes acessíveis', () => {
  it('nenhum aria-label literal em português fixo nos componentes (usar t())', () => {
    const offenders = listTsx(SRC).flatMap((file) => {
      const matches = readFileSync(file, 'utf8').match(HARDCODED_ARIA_LABEL) ?? [];
      return matches.map((m) => `${relative(SRC, file).split(sep).join('/')}: ${m}`);
    });
    expect(offenders).toEqual([]);
  });

  it('as chaves a11y usadas nos 7 pontos corrigidos existem em pt-BR, en e es', () => {
    const keys = [
      'breadcrumb',
      'mainMenu',
      'closeMenu',
      'clearCourtFilters',
      'courtBillingMode',
      'launchRoundExample',
      'monthlyMembersList',
    ];
    for (const locale of LOCALES) {
      const json = JSON.parse(
        readFileSync(resolve(SRC, `i18n/locales/${locale}.json`), 'utf8'),
      ) as { a11y: Record<string, unknown> };
      for (const key of keys) {
        expect(typeof json.a11y[key], `${locale}: a11y.${key}`).toBe('string');
      }
    }
  });
});
