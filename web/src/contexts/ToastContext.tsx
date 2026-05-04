import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { Snackbar, Alert, AlertColor, IconButton, Box } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface Toast {
  id: string;
  message: string;
  severity: AlertColor;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  showToast: (message: string, severity?: AlertColor, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  showWithAction: (message: string, action: { label: string; onClick: () => void }, severity?: AlertColor) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, severity: AlertColor = 'info', duration: number = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newToast: Toast = { id, message, severity, duration };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration?: number) => {
    showToast(message, 'error', duration ?? 6000);
  }, [showToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    showToast(message, 'warning', duration ?? 5000);
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

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleClose = (id: string) => (_: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    dismissToast(id);
  };

  return (
    <ToastContext.Provider
      value={useMemo(() => ({
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showWithAction,
        dismissToast,
      }), [showToast, showSuccess, showError, showWarning, showInfo, showWithAction, dismissToast])}
    >
      {children}
      {toasts.map((toast, index) => (
        <Snackbar
          key={toast.id}
          open={true}
          autoHideDuration={toast.duration}
          onClose={handleClose(toast.id)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{ top: `${80 + index * 60}px !important`, zIndex: 99999 }}
        >
          <Alert
            severity={toast.severity}
            onClose={handleClose(toast.id)}
            action={
              toast.action ? (
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
            sx={{ width: '100%', maxWidth: 400 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </ToastContext.Provider>
  );
};
