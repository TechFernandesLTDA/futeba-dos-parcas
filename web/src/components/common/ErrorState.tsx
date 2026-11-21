import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Collapse,
} from '@mui/material';
import { Arte } from '../artes/Arte';
import { componentMaxWidth } from '../../theme/pageTokens';
import {
  Refresh as RefreshIcon,
  Code as CodeIcon,
} from '@mui/icons-material';

interface ErrorStateProps {
  message?: string;
  error?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Ocorreu um erro ao carregar os dados.',
  error,
  onRetry,
  retryLabel = 'Tentar novamente',
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Box
      role="alert"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 4,
        textAlign: 'center',
      }}
    >
      {/* Bola na trave: erro leve, a arte acalma; o texto explica. */}
      <Arte id="bola_na_trave" larguraMaxima={200} sx={{ mb: 2.5, '@media (max-height: 520px)': { maxWidth: 120 } }} />

      <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600 }} gutterBottom>
        Ops! Algo deu errado
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: componentMaxWidth.stateMessage }}>
        {message}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        {onRetry && (
          <Button
            variant="contained"
            onClick={onRetry}
            startIcon={<RefreshIcon />}
            aria-label={retryLabel}
          >
            {retryLabel}
          </Button>
        )}

        {import.meta.env.DEV && error && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowDetails(v => !v)}
            startIcon={<CodeIcon />}
          >
            {showDetails ? 'Ocultar' : 'Detalhes'}
          </Button>
        )}
      </Box>

      <Collapse in={showDetails && !!error}>
        <Box
          component="pre"
          sx={{
            mt: 2,
            p: 2,
            bgcolor: 'action.hover',
            borderRadius: 2,
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            overflow: 'auto',
            maxWidth: '100%',
            textAlign: 'left',
            color: 'error.main',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {error}
        </Box>
      </Collapse>
    </Box>
  );
};
