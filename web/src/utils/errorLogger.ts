/**
 * Infraestrutura de captura e persistência de erros.
 * Persiste em Firestore (error_logs) e localStorage como fallback.
 * NUNCA lança exceção — falha silenciosa para não bloquear UI.
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { getBreadcrumbs, type Breadcrumb } from './errorContext';
import { createLogger } from './logger';

const logger = createLogger('errorLogger');

/**
 * Remove recursivamente campos com valor `undefined` de um objeto.
 * Firestore rejeita `undefined` (só aceita `null`).
 */
/**
 * Remove campos com valor `undefined` de um objeto (shallow).
 * Firestore rejeita `undefined` (só aceita `null`).
 * NÃO é recursivo — evita corromper sentinelas do Firestore
 * como FieldValue.serverTimestamp().
 */
function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result;
}

const LOCAL_STORAGE_KEY = 'futeba_error_logs';
const MAX_LOCAL_LOGS = 50;
// Limita stack a ~10KB para evitar documento Firestore gigante
const MAX_STACK_LENGTH = 10_000;

export type ErrorKind =
  | 'render'
  | 'window-error'
  | 'unhandled-rejection'
  | 'firebase'
  | 'route-not-found'
  | 'unknown';

export interface ErrorContext {
  kind: ErrorKind;
  /** React ErrorInfo (só em render) */
  errorInfo?: { componentStack?: string | null };
  /** Rota tentada (só em route-not-found) */
  attemptedPath?: string;
  /** Nome da função Cloud (só em firebase) */
  functionName?: string;
  /** filename/lineno de window-error */
  filename?: string;
  lineno?: number;
  /** Dados extras livres — NÃO incluir PII */
  extra?: Record<string, unknown>;
}

export interface ErrorLogEntry {
  errorId: string;
  kind: ErrorKind;
  message: string;
  name: string;
  stack: string;
  code?: string;
  userId: string | null;
  userRole: string | null;
  url: string;
  route: string;
  userAgent: string;
  language: string;
  viewport: string;
  appVersion: string;
  breadcrumbs: Breadcrumb[];
  context: Omit<ErrorContext, 'errorInfo'> & { componentStack?: string };
  createdAt: string; // ISO — usado no localStorage. Firestore usa serverTimestamp()
}

/** Gera ID curto (8 chars) sem lib externa */
function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (const byte of array) {
    id += chars[byte % chars.length];
  }
  return id;
}

/** Extrai uid e role do usuário atual de forma síncrona */
function getCurrentUserInfo(): { uid: string | null; role: string | null } {
  const fbUser = auth.currentUser;
  if (!fbUser) return { uid: null, role: null };
  // role vem do custom claim no token (não requer fetch adicional)
  // Para acesso síncrono, usamos o token já parseado se disponível
  return { uid: fbUser.uid, role: null }; // role não é síncrono sem await getIdTokenResult
}

/** Salva no localStorage com limite e resiliência a QuotaExceededError */
function saveToLocalStorage(entry: ErrorLogEntry): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existing: ErrorLogEntry[] = raw ? (JSON.parse(raw) as ErrorLogEntry[]) : [];
    existing.push(entry);
    // Mantém apenas os mais recentes
    const trimmed = existing.slice(-MAX_LOCAL_LOGS);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // QuotaExceededError ou JSON parse error — tenta limpar metade e reinserir
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const existing: ErrorLogEntry[] = JSON.parse(raw) as ErrorLogEntry[];
        const half = existing.slice(-Math.floor(MAX_LOCAL_LOGS / 2));
        half.push(entry);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(half));
      }
    } catch (error) {
      console.warn('Failed to save error log to localStorage (fallback):', error);
    }
  }
}

/**
 * Registra um erro com contexto completo.
 * Persiste em Firestore (best-effort) e localStorage (fallback).
 * @returns errorId curto para exibir ao usuário
 */
export async function logError(
  err: unknown,
  context: ErrorContext
): Promise<string> {
  const errorId = generateShortId();

  try {
    // Extrai campos do erro de forma segura
    let message = 'Erro desconhecido';
    let name = 'Error';
    let stack = '';
    let code: string | undefined;

    if (err instanceof Error) {
      message = err.message || message;
      name = err.name || name;
      stack = (err.stack || '').slice(0, MAX_STACK_LENGTH);
    } else if (typeof err === 'string') {
      message = err;
    } else if (err !== null && typeof err === 'object') {
      const asObj = err as Record<string, unknown>;
      message = String(asObj.message || message);
      name = String(asObj.name || name);
      stack = String(asObj.stack || '').slice(0, MAX_STACK_LENGTH);
      code = asObj.code ? String(asObj.code) : undefined;
    }

    // Extrai código Firebase se presente
    if (!code && err !== null && typeof err === 'object') {
      const asObj = err as Record<string, unknown>;
      code = asObj.code ? String(asObj.code) : undefined;
    }

    const { uid, role } = getCurrentUserInfo();

    // Monta context sem errorInfo (será colocado como componentStack)
    const { errorInfo, ...restContext } = context;
    const contextForLog: ErrorLogEntry['context'] = {
      ...restContext,
      componentStack: errorInfo?.componentStack ?? undefined,
    };

    const entry: ErrorLogEntry = {
      errorId,
      kind: context.kind,
      message,
      name,
      stack,
      ...(code ? { code } : {}),
      userId: uid,
      userRole: role,
      url: window.location.href,
      route: window.location.pathname,
      userAgent: navigator.userAgent,
      language: navigator.language,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      appVersion: import.meta.env.VITE_APP_VERSION || 'unknown',
      breadcrumbs: getBreadcrumbs().map((b) =>
        b.data !== undefined ? b : ({ category: b.category, message: b.message, timestamp: b.timestamp }),
      ),
      context: contextForLog,
      createdAt: new Date().toISOString(),
    };

    // Salva no localStorage antes de tentar Firestore (garante backup)
    saveToLocalStorage(entry);

    // Persiste no Firestore de forma assíncrona (best-effort)
    try {
      const firestoreFields = { ...entry } as Partial<ErrorLogEntry>;
      delete firestoreFields.createdAt;
      await addDoc(collection(db, 'error_logs'), removeUndefined({
        ...firestoreFields,
        createdAt: serverTimestamp(),
      } as unknown as Record<string, unknown>));
    } catch (firestoreErr) {
      // Firestore pode falhar por permission-denied (usuário deslogado) — aceitável
      logger.warn('Falha ao persistir error_log no Firestore', { firestoreErr, errorId });
    }
  } catch (loggingErr) {
    // logError nunca deve lançar — garante não-bloqueante
    logger.warn('Falha interna no errorLogger', { loggingErr });
  }

  return errorId;
}

/**
 * Recupera logs salvos no localStorage (para debug ou suporte).
 */
export function getLocalErrorLogs(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ErrorLogEntry[]) : [];
  } catch (error) {
    console.warn('Failed to read error logs from localStorage:', error);
    return [];
  }
}
