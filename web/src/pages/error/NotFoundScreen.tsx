import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Button, useTheme, Chip } from '@mui/material';
import { SentimentDissatisfied as NotFoundIcon } from '@mui/icons-material';
import { logError } from '../../utils/errorLogger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ErrorDetailsButton } from '../../components/common/ErrorDetailsButton';
import type { ErrorLogEntry } from '../../utils/errorLogger';
import { useTranslation } from 'react-i18next';

export const NotFoundScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.notFound'));
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [errorId, setErrorId] = useState<string | null>(null);
  const [logEntry, setLogEntry] = useState<(Partial<ErrorLogEntry> & { errorId: string }) | null>(null);
  const attemptedPathRef = useRef(location.pathname + location.search);

  useEffect(() => {
    attemptedPathRef.current = location.pathname + location.search;
  });

  useEffect(() => {
    // Registra o 404 para saber qual link está quebrado
    const attemptedPath = attemptedPathRef.current;
    logError(new Error(`Rota não encontrada: ${attemptedPath}`), {
      kind: 'route-not-found',
      attemptedPath,
    }).then((id) => {
      setErrorId(id);
      setLogEntry({
        errorId: id,
        kind: 'route-not-found',
        message: `Rota não encontrada: ${attemptedPath}`,
        url: window.location.href,
        route: attemptedPath,
        context: { kind: 'route-not-found', attemptedPath },
        createdAt: new Date().toISOString(),
      });
    });
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        gap: 2,
        px: 3,
        bgcolor: theme.palette.background.default,
        textAlign: 'center',
      }}
      role="main"
      aria-labelledby="not-found-title"
    >
      <NotFoundIcon sx={{ fontSize: 80, color: theme.palette.text.disabled }} />
      <Typography id="not-found-title" variant="h4" fontWeight={700} color={theme.palette.text.primary}>
        404 — Página não encontrada
      </Typography>
      <Typography variant="body1" color={theme.palette.text.secondary}>
        O endereço que você tentou acessar não existe.
      </Typography>

      {/* Código do erro para facilitar suporte */}
      {errorId && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Código:
          </Typography>
          <Chip label={errorId} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', mt: 1 }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate('/')}
          aria-label={t('a11y.backToHome')}
        >
          Voltar pro início
        </Button>
        {logEntry && <ErrorDetailsButton entry={logEntry} />}
      </Box>
    </Box>
  );
};
