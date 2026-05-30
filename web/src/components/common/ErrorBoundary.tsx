import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Container, Paper, Chip } from '@mui/material';
import { Error as ErrorIcon, Refresh as RefreshIcon, Home as HomeIcon } from '@mui/icons-material';
import { createLogger } from '../../utils/logger';
import { logError } from '../../utils/errorLogger';
import { ErrorDetailsButton } from './ErrorDetailsButton';
import type { ErrorLogEntry } from '../../utils/errorLogger';

const logger = createLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /**
   * #2221: callback opcional disparado quando um erro é capturado.
   * Útil para boundaries com fallback silencioso (ex.: overlays) que ainda
   * precisam dar feedback ao usuário via toast.
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  logEntry: Partial<ErrorLogEntry> & { errorId: string } | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      logEntry: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Error caught by boundary:', { error, errorInfo });
    this.setState({ errorInfo });

    // #2221: permite que o consumidor reaja (ex.: exibir toast) sem
    // depender de um fallback visível.
    this.props.onError?.(error, errorInfo);

    // Persiste o erro com contexto completo (best-effort, não bloqueia render)
    logError(error, { kind: 'render', errorInfo }).then((errorId) => {
      const entry: Partial<ErrorLogEntry> & { errorId: string } = {
        errorId,
        kind: 'render',
        message: error.message,
        name: error.name,
        stack: error.stack?.slice(0, 10_000),
        url: window.location.href,
        route: window.location.pathname,
        context: { kind: 'render', componentStack: errorInfo.componentStack ?? undefined },
        createdAt: new Date().toISOString(),
      };
      this.setState({ errorId, logEntry: entry });
    });
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { errorId, logEntry, error, errorInfo } = this.state;

      return (
        <Box
          sx={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
          }}
        >
          <Container maxWidth="sm">
            <Paper
              sx={{
                p: 4,
                textAlign: 'center',
                borderRadius: 3,
              }}
              role="alert"
              aria-live="assertive"
            >
              <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />

              <Typography variant="h5" gutterBottom fontWeight={600}>
                Ops! Algo deu errado
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                Ocorreu um erro inesperado. Por favor, tente novamente.
              </Typography>

              {/* ID do erro — para o usuário reportar ao suporte */}
              {errorId && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" color="text.secondary">
                    Código do erro:
                  </Typography>
                  <Chip
                    label={errorId}
                    size="small"
                    variant="outlined"
                    sx={{ ml: 1, fontFamily: 'monospace' }}
                  />
                </Box>
              )}

              {/* Stack trace apenas em desenvolvimento */}
              {import.meta.env.DEV && error && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mb: 3,
                    bgcolor: 'grey.50',
                    textAlign: 'left',
                    overflow: 'auto',
                    maxHeight: 200,
                  }}
                >
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      m: 0,
                    }}
                  >
                    {error.toString()}
                    {errorInfo?.componentStack}
                  </Typography>
                </Paper>
              )}

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<HomeIcon />}
                  onClick={this.handleGoHome}
                  aria-label="Voltar ao início"
                >
                  Ir para Início
                </Button>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleRefresh}
                  aria-label="Recarregar a página"
                >
                  Recarregar
                </Button>
                {logEntry && (
                  <ErrorDetailsButton entry={logEntry} />
                )}
              </Box>
            </Paper>
          </Container>
        </Box>
      );
    }

    return this.props.children;
  }
}

export const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) => {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
};
