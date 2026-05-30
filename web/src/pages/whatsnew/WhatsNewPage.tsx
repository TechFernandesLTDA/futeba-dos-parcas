/**
 * Tela "Novidades" — histórico completo de notas de versão.
 *
 * Espelha `WhatsNewScreen.kt` do Android: estados Loading/Empty/Error/Success,
 * cards de versão expansíveis (o mais recente já aberto).
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase F, task #21.
 */

import { useEffect } from 'react';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Container,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  NewReleases as NewReleasesIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useReleaseNotes } from '../../hooks/useReleaseNotes';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { ReleaseNoteContent, ReleaseTypeBadge } from '../../components/whatsnew/ReleaseNoteContent';
import { formatReleaseDate } from '../../utils/releaseNotesFormat';
import { trackEvent } from '../../utils/analytics';
import { ReleaseNote } from '../../types/releaseNotes';

const VersionCard: React.FC<{ note: ReleaseNote; defaultExpanded: boolean }> = ({
  note,
  defaultExpanded,
}) => {
  const { i18n } = useTranslation();
  const dateLabel = formatReleaseDate(note.releaseDate, i18n.language);
  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          sx={{ flex: 1, mr: 1 }}
        >
          <Typography variant="subtitle1" fontWeight={700}>
            {`v${note.version}`}
          </Typography>
          <ReleaseTypeBadge type={note.type} />
          {dateLabel && (
            <Typography variant="caption" color="text.secondary">
              {dateLabel}
            </Typography>
          )}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <ReleaseNoteContent note={note} showHeadline />
      </AccordionDetails>
    </Accordion>
  );
};

export const WhatsNewPage: React.FC = () => {
  const { t } = useTranslation();
  const goBack = useNavigateBack('/settings');
  const { notes, loading, error, refetch } = useReleaseNotes();

  useDocumentTitle(t('whatsNew.title'));

  // Analytics: registra a abertura da tela (origem: Ajustes).
  useEffect(() => {
    trackEvent('whats_new_opened', { source: 'settings' });
  }, []);

  return (
    <Box sx={{ pb: 4 }}>
      {/* #2174: header padronizado via ScreenHeader */}
      <ScreenHeader title={t('whatsNew.title')} onBack={goBack} backAriaLabel={t('common.back')} />

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading && (
          <Stack spacing={2}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={88} />
            ))}
          </Stack>
        )}

        {!loading && error && (
          <ErrorState
            message={t('whatsNew.error')}
            error={error}
            onRetry={() => refetch()}
          />
        )}

        {!loading && !error && notes.length === 0 && (
          <EmptyState
            icon={<NewReleasesIcon />}
            title={t('whatsNew.emptyTitle')}
            description={t('whatsNew.emptyDesc')}
          />
        )}

        {!loading && !error && notes.length > 0 && (
          <Stack spacing={1}>
            {notes.map((note, index) => (
              <VersionCard
                key={`${note.platform}/${note.version}`}
                note={note}
                defaultExpanded={index === 0}
              />
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
};
