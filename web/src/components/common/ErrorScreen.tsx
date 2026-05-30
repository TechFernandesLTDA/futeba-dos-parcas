import React from 'react';
import { Box, Button, Container } from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { ErrorState } from './ErrorState';

type ContainerMaxWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;

interface ErrorScreenProps {
  /** Mensagem descritiva do erro. */
  message?: string;
  /** Handler para tentar novamente (opcional). */
  onRetry?: () => void;
  /** Handler para o botão "Voltar" (opcional). */
  onBack?: () => void;
  /** Largura máxima do Container (default 'sm'). */
  maxWidth?: ContainerMaxWidth;
  /** Label do botão Voltar (default 'Voltar'). */
  backLabel?: string;
}

/**
 * #2178: tela de erro padronizada com botão Voltar.
 *
 * Encapsula o padrão repetido em ≥5 telas (GameDetailScreen, GroupDetailScreen,
 * ProfileScreen, ...):
 * `Container maxWidth="sm" py:2 > ErrorState(message, onRetry) + botão Voltar`.
 *
 * Reutiliza o ErrorState existente internamente — não duplica a lógica.
 */
export const ErrorScreen: React.FC<ErrorScreenProps> = ({
  message,
  onRetry,
  onBack,
  maxWidth = 'sm',
  backLabel = 'Voltar',
}) => {
  return (
    <Container maxWidth={maxWidth} sx={{ py: 2 }}>
      <ErrorState message={message} onRetry={onRetry} />
      {onBack && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button startIcon={<BackIcon />} onClick={onBack}>
            {backLabel}
          </Button>
        </Box>
      )}
    </Container>
  );
};

export default ErrorScreen;
