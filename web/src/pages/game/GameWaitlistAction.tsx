import React from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface GameWaitlistActionProps {
  queuePosition: number | null;
  loading: boolean;
  acting: boolean;
  error: string | null;
  onJoin: () => void | Promise<void>;
  onLeave: () => void | Promise<void>;
}

/**
 * Ação compartilhada pelo rodapé e pela aba de jogadores do detalhe do jogo.
 * A elegibilidade é decidida pela tela; este componente só representa o estado
 * atual da fila e impede ações concorrentes enquanto o hook está trabalhando.
 */
export const GameWaitlistAction: React.FC<GameWaitlistActionProps> = ({
  queuePosition,
  loading,
  acting,
  error,
  onJoin,
  onLeave,
}) => {
  const { t } = useTranslation();
  const pending = loading || acting;

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (queuePosition !== null) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1,
        }}
        aria-live="polite"
      >
        <Typography variant="body2" color="warning.main" fontWeight={700}>
          {t('games.waitlistPosition', { position: queuePosition })}
        </Typography>
        <Button
          variant="outlined"
          color="warning"
          onClick={onLeave}
          disabled={pending}
          startIcon={pending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading
            ? t('common.loading')
            : acting
              ? t('games.leavingWaitlist')
              : t('games.leaveWaitlist')}
        </Button>
      </Box>
    );
  }

  return (
    <Button
      variant="outlined"
      color="warning"
      fullWidth
      onClick={onJoin}
      disabled={pending}
      startIcon={pending ? <CircularProgress size={16} color="inherit" /> : undefined}
    >
      {loading
        ? t('common.loading')
        : acting
          ? t('games.joiningWaitlist')
          : t('games.gameFullJoinWaitlist')}
    </Button>
  );
};
