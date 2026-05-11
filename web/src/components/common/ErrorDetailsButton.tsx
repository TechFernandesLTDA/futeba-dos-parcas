/**
 * Botão reutilizável para copiar detalhes do erro para o clipboard.
 * Usado em ErrorBoundary, NotFoundScreen e outras telas de erro.
 */

import React, { useState } from 'react';
import { Button, Tooltip } from '@mui/material';
import { ContentCopy as CopyIcon, Check as CheckIcon } from '@mui/icons-material';
import type { ErrorLogEntry } from '../../utils/errorLogger';

interface ErrorDetailsButtonProps {
  entry: Partial<ErrorLogEntry> & { errorId: string };
  size?: 'small' | 'medium' | 'large';
}

export const ErrorDetailsButton: React.FC<ErrorDetailsButtonProps> = ({
  entry,
  size = 'small',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback para browsers sem clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = JSON.stringify(entry, null, 2);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Tooltip title={copied ? 'Copiado!' : 'Copia JSON com detalhes do erro para o suporte'}>
      <Button
        size={size}
        variant="outlined"
        color="inherit"
        startIcon={copied ? <CheckIcon /> : <CopyIcon />}
        onClick={handleCopy}
        aria-label="Copiar detalhes do erro"
        sx={{ textTransform: 'none' }}
      >
        {copied ? 'Copiado!' : 'Copiar detalhes'}
      </Button>
    </Tooltip>
  );
};
