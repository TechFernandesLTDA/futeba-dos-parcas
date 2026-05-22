/**
 * Componentes compartilhados da feature "Novidades" — usados tanto pelo pop-up
 * ([WhatsNewDialog]) quanto pela página de histórico ([WhatsNewPage]).
 *
 * Espelha `WhatsNewContent.kt` do Android.
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase F, task #21.
 */

import React from 'react';
import { Avatar, Box, Chip, Stack, Typography, useTheme } from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Bolt as BoltIcon,
  BugReport as BugReportIcon,
  Celebration as CelebrationIcon,
  Checklist as ChecklistIcon,
  Construction as ConstructionIcon,
  DarkMode as DarkModeIcon,
  Devices as DevicesIcon,
  Lock as LockIcon,
  Notifications as NotificationsIcon,
  Palette as PaletteIcon,
  Stars as StarsIcon,
  Translate as TranslateIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ReleaseHighlight, ReleaseNote, ReleaseType } from '../../types/releaseNotes';

/**
 * Mapeia o nome do ícone (DSL `icon=<nome>` da nota) para um ícone do MUI.
 * Nomes desconhecidos caem no fallback genérico.
 */
function highlightIcon(name: string): React.ReactElement {
  switch (name.trim().toLowerCase()) {
    case 'palette':
      return <PaletteIcon />;
    case 'dark_mode':
      return <DarkModeIcon />;
    case 'celebration':
      return <CelebrationIcon />;
    case 'checklist':
      return <ChecklistIcon />;
    case 'translate':
      return <TranslateIcon />;
    case 'devices':
      return <DevicesIcon />;
    case 'construction':
      return <ConstructionIcon />;
    case 'bolt':
    case 'speed':
      return <BoltIcon />;
    case 'bug':
    case 'bug_report':
      return <BugReportIcon />;
    case 'lock':
    case 'security':
      return <LockIcon />;
    case 'notifications':
      return <NotificationsIcon />;
    case 'star':
    case 'stars':
      return <StarsIcon />;
    default:
      return <AutoAwesomeIcon />;
  }
}

/**
 * Badge do tipo de release. Não depende só de cor — sempre inclui texto
 * (requisito de acessibilidade, spec §2.4).
 */
export const ReleaseTypeBadge: React.FC<{ type: ReleaseType }> = ({ type }) => {
  const { t } = useTranslation();
  const config: Record<ReleaseType, { labelKey: string; color: 'info' | 'primary' | 'secondary' }> = {
    major: { labelKey: 'whatsNew.typeMajor', color: 'info' },
    minor: { labelKey: 'whatsNew.typeMinor', color: 'primary' },
    patch: { labelKey: 'whatsNew.typePatch', color: 'secondary' },
  };
  const { labelKey, color } = config[type];
  return <Chip label={t(labelKey)} size="small" color={color} variant="outlined" />;
};

/** Card de um destaque do release — ícone circular + título + descrição curta. */
const HighlightCard: React.FC<{ highlight: ReleaseHighlight }> = ({ highlight }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        bgcolor: theme.palette.action.hover,
      }}
    >
      <Avatar
        sx={{
          bgcolor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          width: 40,
          height: 40,
        }}
      >
        {highlightIcon(highlight.icon)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" color="text.primary">
          {highlight.title}
        </Typography>
        {highlight.description && (
          <Typography variant="body2" color="text.secondary">
            {highlight.description}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

/** Seção de lista (Novidades / Melhorias / Correções). Não renderiza se vazia. */
const ReleaseSection: React.FC<{
  title: string;
  icon: React.ReactElement;
  items: string[];
  accentColor: string;
}> = ({ title, icon, items, accentColor }) => {
  if (items.length === 0) return null;
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Box sx={{ color: accentColor, display: 'flex', '& > *': { fontSize: 18 } }}>{icon}</Box>
        <Typography variant="subtitle2" color="text.primary">
          {title}
        </Typography>
      </Stack>
      <Stack component="ul" sx={{ listStyle: 'none', m: 0, pl: 0 }} spacing={0.25}>
        {items.map((item) => (
          <Box component="li" key={item} sx={{ display: 'flex', gap: 1 }}>
            <Box component="span" sx={{ color: accentColor }} aria-hidden>
              •
            </Box>
            <Typography variant="body2" color="text.secondary">
              {item}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

/**
 * Corpo completo de uma nota de versão: headline (opcional) + cards de destaque
 * + seções Novidades/Melhorias/Correções.
 *
 * @param showHeadline `false` quando o headline já é exibido como hero acima
 *        (caso do pop-up).
 */
export const ReleaseNoteContent: React.FC<{ note: ReleaseNote; showHeadline?: boolean }> = ({
  note,
  showHeadline = true,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Stack spacing={2}>
      {showHeadline && note.headline && (
        <Typography variant="subtitle1" color="text.primary">
          {note.headline}
        </Typography>
      )}
      {note.highlights.length > 0 && (
        <Stack spacing={1}>
          {note.highlights.map((highlight) => (
            <HighlightCard key={highlight.title} highlight={highlight} />
          ))}
        </Stack>
      )}
      <ReleaseSection
        title={t('whatsNew.sectionAdded')}
        icon={<AutoAwesomeIcon />}
        items={note.added}
        accentColor={theme.palette.primary.main}
      />
      <ReleaseSection
        title={t('whatsNew.sectionImproved')}
        icon={<BoltIcon />}
        items={note.improved}
        accentColor={theme.palette.info.main}
      />
      <ReleaseSection
        title={t('whatsNew.sectionFixed')}
        icon={<BugReportIcon />}
        items={note.fixed}
        accentColor={theme.palette.secondary.main}
      />
    </Stack>
  );
};
