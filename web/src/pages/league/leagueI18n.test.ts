import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(process.cwd(), '..');

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

describe('league screen translations', () => {
  it('keeps user-facing PT-BR literals out of both league screens', () => {
    const leagueScreen = readRepoFile('web/src/pages/league/LeagueScreen.tsx');
    const groupLeagueScreen = readRepoFile('web/src/pages/group/GroupLeagueScreen.tsx');

    expect(leagueScreen).not.toMatch(
      /label="Você"|zona de promoção!|zona de rebaixamento|Continue jogando para subir!|\(Ativa\)/,
    );
    expect(groupLeagueScreen).not.toMatch(
      /label="Você"|Você precisa ser membro|>Voltar<|title="Liga do Grupo"|ª posição|Vitórias|Empates|Derrotas|Gols Pró|Gols Contra/,
    );
  });

  it('keeps the group league keys aligned across all locales', () => {
    const localePaths = ['pt-BR', 'en', 'es'];
    const requiredKeys = [
      'activeSeasonSuffix',
      'collapsePlayerAria',
      'drawsShort',
      'gamesShort',
      'goalsAgainst',
      'goalsFor',
      'goalsShort',
      'groupStandingSummary',
      'lossesShort',
      'pointsShort',
      'winsShort',
    ];

    for (const locale of localePaths) {
      const messages = JSON.parse(readRepoFile(`web/src/i18n/locales/${locale}.json`));
      for (const key of requiredKeys) {
        expect(messages.league[key], `${locale}: league.${key}`).toBeTruthy();
      }
    }
  });
});
