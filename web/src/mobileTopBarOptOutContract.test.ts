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
import { join, relative, sep } from 'node:path';

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
        offenders.push(relative(PAGES_DIR, file).split(sep).join('/'));
      }
    }

    expect(
      offenders,
      'Telas com header manual sem opt-out da MobileTopBar — chame useHideMobileTopBar() ou migre para ScreenHeader'
    ).toEqual([]);
  });

  // #4051 (3ª onda): telas com header manual NÃO-sticky (IconButton voltar +
  // Typography h5/h6) também empilham com a MobileTopBar global. A detecção
  // por assinatura `sticky` do #3840 não pegava essas. Este scan pega qualquer
  // header manual; as telas conhecidas que ainda não migraram ficam em
  // allowlist explícita (dívida documentada, não aprovada silenciosamente).
  const NON_STICKY_HEADER_ALLOWLIST = new Set([
    // Headers manuais pré-existentes, fora do escopo do fix #4051 — migrar em
    // onda própria e remover da lista:
    'messages/ConversationScreen.tsx',
    'auth/ForgotPasswordScreen.tsx',
    'auth/RegisterScreen.tsx',
    'GroupChallengesScreen.tsx',
    'onboarding/PhoneVerificationScreen.tsx',
  ]);

  it('toda pagina com header manual (voltar + heading, mesmo NAO-sticky) faz opt-out da MobileTopBar (#4051)', () => {
    const offenders: string[] = [];

    for (const file of walkPages(PAGES_DIR)) {
      const source = readFileSync(file, 'utf8');
      const hasManualHeader =
        source.includes('ArrowBack') && /variant=["']h[56]["']/.test(source);
      const optsOut =
        source.includes('useHideMobileTopBar') || source.includes('ScreenHeader');
      const rel = relative(PAGES_DIR, file).split(sep).join('/');

      if (hasManualHeader && !optsOut && !NON_STICKY_HEADER_ALLOWLIST.has(rel)) {
        offenders.push(rel);
      }
    }

    expect(
      offenders,
      'Telas com header manual (não-sticky) sem opt-out da MobileTopBar — migre para ScreenHeader ou chame useHideMobileTopBar(). Se for dívida conhecida, registre no NON_STICKY_HEADER_ALLOWLIST'
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
