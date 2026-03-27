/**
 * Utilitário de logging estruturado.
 * Em produção, loga apenas warn/error. Em dev, loga tudo.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogData = Record<string, unknown> | unknown;

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: LogData;
  timestamp: string;
}

const isDev = import.meta.env.DEV;

function formatEntry(entry: LogEntry): string {
  const parts = [`[${entry.level.toUpperCase()}]`];
  if (entry.context) parts.push(`[${entry.context}]`);
  parts.push(entry.message);
  return parts.join(' ');
}

function log(level: LogLevel, message: string, context?: string, data?: LogData) {
  // Em produção, ignorar debug e info
  if (!isDev && (level === 'debug' || level === 'info')) return;

  const entry: LogEntry = {
    level,
    message,
    context,
    data,
    timestamp: new Date().toISOString(),
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case 'debug':
      console.debug(formatted, data || '');
      break;
    case 'info':
      console.info(formatted, data || '');
      break;
    case 'warn':
      console.warn(formatted, data || '');
      break;
    case 'error':
      console.error(formatted, data || '');
      break;
  }
}

/**
 * Cria um logger com contexto (nome do módulo/componente).
 *
 * @example
 * const log = createLogger('AuthContext');
 * log.info('Usuário logado', { uid: user.uid });
 * log.error('Falha no login', { code: err.code });
 */
export function createLogger(context: string) {
  return {
    debug: (message: string, data?: LogData) => log('debug', message, context, data),
    info: (message: string, data?: LogData) => log('info', message, context, data),
    warn: (message: string, data?: LogData) => log('warn', message, context, data),
    error: (message: string, data?: LogData) => log('error', message, context, data),
  };
}

export const logger = {
  debug: (message: string, data?: LogData) => log('debug', message, undefined, data),
  info: (message: string, data?: LogData) => log('info', message, undefined, data),
  warn: (message: string, data?: LogData) => log('warn', message, undefined, data),
  error: (message: string, data?: LogData) => log('error', message, undefined, data),
};
