import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Snackbar, Alert, AlertColor, IconButton, Box, LinearProgress } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface Toast {
  id: string;
  message: string;
  severity: AlertColor;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  undo?: {
    onUndo: () => Promise<void>;
    onExpire?: () => void;
  };
}

interface ToastContextType {
  showToast: (message: string, severity?: AlertColor, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  showWithAction: (message: string, action: { label: string; onClick: () => void }, severity?: AlertColor) => void;
  showUndo: (message: string, onUndo: () => Promise<void>, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DEFAULT_DURATIONS: Record<AlertColor, number> = {
  success: 4000,
  info: 5000,
  warning: 8000,
  error: 10000,
};

const UNDO_DURATION = 6000;

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

function UndoProgressBar({ duration }: { duration: number }) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());
  const durationRef = useRef(duration);

  useEffect(() => {
    startRef.current = Date.now();
    durationRef.current = duration;
    setProgress(100);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / durationRef.current) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  return (
    <LinearProgress
      variant="determinate"
      value={progress}
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        borderRadius: 0,
        '& .MuiLinearProgress-bar': {
          transition: 'none',
        },
      }}
    />
  );
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, severity: AlertColor = 'info', duration?: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const resolvedDuration = duration ?? DEFAULT_DURATIONS[severity];
    const newToast: Toast = { id, message, severity, duration: resolvedDuration };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration?: number) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    showToast(message, 'warning', duration);
  }, [showToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  const showWithAction = useCallback((
    message: string,
    action: { label: string; onClick: () => void },
    severity: AlertColor = 'info'
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newToast: Toast = { id, message, severity, action, duration: 6000 };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const showUndo = useCallback((
    message: string,
    onUndo: () => Promise<void>,
    duration?: number,
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const resolvedDuration = duration ?? UNDO_DURATION;
    const newToast: Toast = {
      id,
      message,
      severity: 'warning',
      duration: resolvedDuration,
      action: { label: 'Desfazer', onClick: () => {} },
      undo: { onUndo },
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleClose = useCallback((id: string) => (_: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    dismissToast(id);
  }, [dismissToast]);

  const handleUndoAction = useCallback((toast: Toast) => {
    if (toast.undo) {
      toast.undo.onUndo().then(() => {
        showSuccess(t('feedback.undo.success'));
      }).catch(() => {
        showError(t('feedback.undo.error'));
      });
    }
    dismissToast(toast.id);
  }, [dismissToast, showSuccess, showError, t]);

  return (
    <ToastContext.Provider
      value={useMemo(() => ({
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showWithAction,
        showUndo,
        dismissToast,
      }), [showToast, showSuccess, showError, showWarning, showInfo, showWithAction, showUndo, dismissToast])}
    >
      {children}
      {toasts.map((toast, index) => (
        <Snackbar
          key={toast.id}
          open={true}
          autoHideDuration={toast.duration}
          onClose={handleClose(toast.id)}
          anchorOrigin={
            toast.undo
              ? { vertical: 'bottom', horizontal: 'center' }
              : toast.severity === 'error'
              ? { vertical: 'bottom', horizontal: 'center' }
              : { vertical: 'top', horizontal: 'center' }
          }
          sx={
            // #2144: stacking de toasts. Antes usava `!important` para vencer o
            // posicionamento do Snackbar; agora usamos seletor de maior
            // especificidade (`&.MuiSnackbar-root`), sem `!important`.
            toast.undo || toast.severity === 'error'
              ? { '&.MuiSnackbar-root': { bottom: 16 + index * 64 }, zIndex: 99999 }
              : { '&.MuiSnackbar-root': { top: 80 + index * 60 }, zIndex: 99999 }
          }
        >
          <Alert
            severity={toast.severity}
            onClose={handleClose(toast.id)}
            action={
              toast.undo ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box
                    component="span"
                    sx={{
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontWeight: 600,
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => handleUndoAction(toast)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleUndoAction(toast);
                      }
                    }}
                  >
                    Desfazer
                  </Box>
                  <IconButton
                    aria-label="Fechar notificação"
                    onClick={() => dismissToast(toast.id)}
                    sx={{ padding: '8px' }}
                    size="small"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : toast.action ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box
                    component="span"
                    sx={{
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      mr: 1,
                    }}
                    onClick={() => {
                      toast.action!.onClick();
                      dismissToast(toast.id);
                    }}
                  >
                    {toast.action.label}
                  </Box>
                  <IconButton
                    aria-label="Fechar notificação"
                    onClick={() => dismissToast(toast.id)}
                    sx={{ padding: '8px' }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : undefined
            }
            sx={{
              width: '100%',
              maxWidth: toast.undo ? 420 : 400,
              position: 'relative',
              overflow: 'hidden',
              '& .MuiAlert-message': { flex: 1 },
            }}
          >
            {toast.message}
            {toast.undo && <UndoProgressBar duration={toast.duration ?? UNDO_DURATION} />}
          </Alert>
        </Snackbar>
      ))}
    </ToastContext.Provider>
  );
};
