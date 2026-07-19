/**
 * REGRESSAO #3839 — header duplicado no mobile.
 *
 * O MobileShell renderiza a MobileTopBar global em toda rota autenticada.
 * Telas que desenham o proprio header mobile (bloco sticky + botao voltar)
 * precisam fazer opt-out via useHideMobileTopBar() — automatico nas telas
 * que usam ScreenHeader (fix #3818), manual nas demais.
 *
 * Este contrato varre src/pages e barra novas telas de header manual sem
 * opt-out, evitando a terceira onda da regressao introduzida em v1.54.20.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const PAGES_DIR = join(process.cwd(), 'src/pages');

function walkPages(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkPages(fullPath));
    } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('contrato de opt-out da MobileTopBar (#3839)', () => {
  it('toda pagina com header mobile manual (sticky + voltar) faz opt-out da MobileTopBar global', () => {
    const offenders: string[] = [];

    for (const file of walkPages(PAGES_DIR)) {
      const source = readFileSync(file, 'utf8');
      const hasManualHeader =
        /position:\s*'sticky'/.test(source) && source.includes('ArrowBack');
      const optsOut =
        source.includes('useHideMobileTopBar') || source.includes('ScreenHeader');

      if (hasManualHeader && !optsOut) {
        offenders.push(relative(PAGES_DIR, file));
      }
    }

    expect(
      offenders,
      'Telas com header manual sem opt-out da MobileTopBar — chame useHideMobileTopBar() ou migre para ScreenHeader'
    ).toEqual([]);
  });

  it('LeagueScreen so faz opt-out quando standalone (embedded mantem a top bar da home)', () => {
    const source = readFileSync(
      join(PAGES_DIR, 'league/LeagueScreen.tsx'),
      'utf8'
    );
    expect(source).toContain('useHideMobileTopBar(!embedded)');
  });
});
