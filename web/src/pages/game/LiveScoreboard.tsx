import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Chip, Typography, useTheme, alpha } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { TeamScore, TeamPaletteKey } from '../../utils/liveScores';

/**
 * #3942 — Placar ao vivo para 2-4 times.
 *
 * Renderização puramente apresentacional: recebe a lista já resolvida por
 * `buildTeamScores()` e adapta o layout:
 *  - 2 times: layout clássico "Nome 2 – 1 Nome" com separador e destaque
 *    do líder (preserva a estética anterior, sem regressão visual).
 *  - 3-4 times: grid responsivo com um card por time.
 *
 * Acessibilidade:
 *  - O container é `role="group"` com `aria-label` descritivo do placar.
 *  - Cada time expõe nome + placar como texto visível (lido por SR).
 *  - Uma região `aria-live="polite"` oculta anuncia o placar sempre que ele
 *    muda, para que usuários de leitor de tela saibam dos gols sem navegar.
 *
 * Cores vêm sempre do `theme.palette` (primary/secondary/info/warning),
 * nunca hardcoded, para manter contraste AA em light/dark.
 */
export interface LiveScoreboardProps {
  teamScores: TeamScore[];
  /** Indica se o jogo está em andamento (mostra o chip "Ao Vivo"). */
  isLive: boolean;
}

/** Estilo utilitário "visually hidden" (sr-only) — sem cores hardcoded. */
const VISUALLY_HIDDEN_SX = {
  position: 'absolute' as const,
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden' as const,
  clip: 'rect(0px, 0px, 0px, 0px)',
  whiteSpace: 'nowrap' as const,
  border: 0,
};

function paletteColor(
  theme: Theme,
  key: TeamPaletteKey,
): string {
  // TS: as 4 chaves existem em palette e todas têm `.main`.
  return (theme.palette as Record<TeamPaletteKey, { main: string }>)[key].main;
}

export const LiveScoreboard: React.FC<LiveScoreboardProps> = ({
  teamScores,
  isLive,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // Resumo textual para a região aria-live (anuncia mudanças do placar).
  const summary = teamScores.map((team) => `${team.name} ${team.score}`).join(', ');
  const scoreboardAria = t('games.live.scoreboardAria', {
    defaultValue: 'Placar do jogo ao vivo',
  });

  if (teamScores.length === 0) {
    return null;
  }

  return (
    <Box sx={{ textAlign: 'center' }}>
      {isLive && (
        <Chip
          size="small"
          color="error"
          label={t('games.statusLive')}
          sx={{ fontWeight: 800, letterSpacing: 0.8, mb: 1.5 }}
        />
      )}

      <Box role="group" aria-label={scoreboardAria}>
        {/* Região live para leitores de tela — anuncia gols sem poluir a navegação. */}
        <Box aria-live="polite" aria-atomic="true" sx={VISUALLY_HIDDEN_SX}>
          {summary}
        </Box>

        {teamScores.length === 2 ? (
          <ClassicTwoTeamScore teamScores={teamScores} theme={theme} />
        ) : (
          <MultiTeamGrid teamScores={teamScores} theme={theme} />
        )}
      </Box>
    </Box>
  );
};

/**
 * Layout clássico de 2 times com separador "–" e destaque do líder.
 * Preserva a estética anterior ao #3942 (sem regressão visual).
 */
const ClassicTwoTeamScore: React.FC<{
  teamScores: TeamScore[];
  theme: Theme;
}> = ({ teamScores, theme }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: { xs: 1.5, sm: 3 },
    }}
  >
    {teamScores.map((team, index) => (
      <React.Fragment key={team.teamId}>
        {index === 1 && (
          <Typography variant="h2" color="text.secondary" fontWeight={300} sx={{ px: 1 }}>
            –
          </Typography>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} color="text.secondary" noWrap>
            {team.name}
          </Typography>
          <Typography
            key={`${team.teamId}-${team.score}`}
            variant="h1"
            fontWeight={team.isLeader ? 800 : 600}
            sx={{
              color: paletteColor(theme, team.paletteKey),
              opacity: teamScores.some((other) => other.isLeader) && !team.isLeader ? 0.6 : 1,
              lineHeight: 1,
              animation: 'scoreFlash 280ms ease-out',
              '@keyframes scoreFlash': {
                '0%': { transform: 'scale(1.12)' },
                '100%': { transform: 'scale(1)' },
              },
              transition: theme.transitions.create(['opacity', 'font-weight'], {
                duration: theme.transitions.duration.shorter,
              }),
            }}
          >
            {team.score}
          </Typography>
        </Box>
      </React.Fragment>
    ))}
  </Box>
);

/**
 * Grid responsivo para 3-4 times: 2 colunas no mobile, até 4 no desktop.
 * Cada time vira um card com nome + placar grande; o líder é destacado.
 */
const MultiTeamGrid: React.FC<{
  teamScores: TeamScore[];
  theme: Theme;
}> = ({ teamScores, theme }) => {
  const hasAnyLeader = teamScores.some((team) => team.isLeader);
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', sm: `repeat(${teamScores.length}, 1fr)` },
        gap: { xs: 1, sm: 2 },
      }}
    >
      {teamScores.map((team) => (
        <Box
          key={team.teamId}
          sx={{
            p: 1.5,
            borderRadius: 2,
            minWidth: 0,
            bgcolor: alpha(paletteColor(theme, team.paletteKey), 0.12),
            border: `1px solid ${alpha(paletteColor(theme, team.paletteKey), team.isLeader ? 0.55 : 0.25)}`,
            opacity: hasAnyLeader && !team.isLeader ? 0.7 : 1,
            transition: theme.transitions.create(['opacity', 'border-color'], {
              duration: theme.transitions.duration.shorter,
            }),
          }}
        >
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary" noWrap>
            {team.name}
          </Typography>
          <Typography
            key={`${team.teamId}-${team.score}`}
            variant="h2"
            fontWeight={team.isLeader ? 800 : 700}
            sx={{
              color: paletteColor(theme, team.paletteKey),
              lineHeight: 1.1,
              animation: 'scoreFlash 280ms ease-out',
              '@keyframes scoreFlash': {
                '0%': { transform: 'scale(1.12)' },
                '100%': { transform: 'scale(1)' },
              },
            }}
          >
            {team.score}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};
