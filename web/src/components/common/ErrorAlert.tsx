import React from 'react';
import { Alert, Button, SxProps, Theme } from '@mui/material';
import { Refresh as RetryIcon } from '@mui/icons-material';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
  sx?: SxProps<Theme>;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = React.memo(({ message, onRetry, sx }) => {
  return (
    <Alert
      severity="error"
      sx={{ mb: 2, ...sx }}
      role="alert"
      action={
        onRetry ? (
          <Button
            color="inherit"
            size="small"
            startIcon={<RetryIcon />}
            onClick={onRetry}
          >
            Tentar novamente
          </Button>
        ) : undefined
      }
    >
      {message}
    </Alert>
  );
});
