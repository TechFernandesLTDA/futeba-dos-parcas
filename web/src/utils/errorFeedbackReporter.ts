import type { ErrorInfo } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { ErrorLogEntry } from './errorLogger';
import { getBreadcrumbs } from './errorContext';
import { createLogger } from './logger';

const logger = createLogger('errorFeedbackReporter');

const MAX_TITLE_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_STACK_LENGTH = 6000;
const MAX_COMPONENT_STACK_LENGTH = 6000;
const MAX_BREADCRUMBS = 10;

export type ErrorFeedbackResult =
  | { ok: true; feedbackId: string }
  | { ok: false; reason: 'unauthenticated' | 'failed' };

export interface ErrorFeedbackInput {
  errorId: string | null;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  logEntry: (Partial<ErrorLogEntry> & { errorId: string }) | null;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength - 1) : value;
}

function removeUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep);
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) {
        result[key] = removeUndefinedDeep(child);
      }
    }
    return result;
  }

  return value;
}

export async function submitErrorFeedbackReport(input: ErrorFeedbackInput): Promise<ErrorFeedbackResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { ok: false, reason: 'unauthenticated' };
  }

  const errorId = input.errorId ?? input.logEntry?.errorId ?? 'sem-codigo';
  const route = window.location.pathname || '/';
  const url = window.location.href;
  const message = input.error?.message ?? input.logEntry?.message ?? 'Erro inesperado';
  const name = input.error?.name ?? input.logEntry?.name ?? 'Error';
  const stack = input.error?.stack ?? input.logEntry?.stack ?? '';
  const componentStack = input.errorInfo?.componentStack ?? input.logEntry?.context?.componentStack;

  const title = truncate(`Erro inesperado em ${route} (${errorId})`, MAX_TITLE_LENGTH);
  const description = truncate(
    [
      'Falha reportada pela tela global de erro.',
      '',
      `Rota: ${route}`,
      `Codigo: ${errorId}`,
      `Mensagem: ${message}`,
    ].join('\n'),
    MAX_DESCRIPTION_LENGTH,
  );

  const context = removeUndefinedDeep({
    platform: 'web',
    source: 'error_boundary',
    errorId,
    route,
    url,
    userAgent: navigator.userAgent,
    language: navigator.language,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    appVersion: import.meta.env.VITE_APP_VERSION || 'unknown',
    error: {
      name,
      message,
      stack: stack ? truncate(stack, MAX_STACK_LENGTH) : undefined,
    },
    componentStack: componentStack ? truncate(componentStack, MAX_COMPONENT_STACK_LENGTH) : undefined,
    breadcrumbs: getBreadcrumbs().slice(-MAX_BREADCRUMBS),
  }) as Record<string, unknown>;

  try {
    const docRef = await addDoc(collection(db, 'user_feedback'), {
      user_id: currentUser.uid,
      user_email: currentUser.email || '',
      type: 'bug',
      title,
      description,
      severity: 'high',
      status: 'open',
      context,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    return { ok: true, feedbackId: docRef.id };
  } catch (error) {
    logger.warn('Falha ao enviar relatorio de erro', { error, errorId });
    return { ok: false, reason: 'failed' };
  }
}
