/**
 * Mapeia códigos de erro do Firebase Auth para mensagens em PT-BR.
 * Centraliza o tratamento de erros evitando duplicação nos componentes.
 * Erros críticos (permission-denied, unauthenticated, etc.) são também
 * persistidos via logError para debug posterior.
 */

import { logError } from './errorLogger';

const FIREBASE_AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Email ou senha inválidos',
  'auth/invalid-email': 'Email inválido',
  'auth/user-disabled': 'Esta conta foi desativada',
  // FIX #930: user-not-found e wrong-password mapeados para a mesma mensagem genérica
  // para prevenir enumeração de email (atacante não consegue distinguir "email existe" vs "senha errada")
  'auth/user-not-found': 'Email ou senha inválidos',
  'auth/wrong-password': 'Email ou senha inválidos',
  'auth/email-already-in-use': 'Este email já está em uso',
  'auth/weak-password': 'Senha muito fraca. Use pelo menos 6 caracteres',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
  'auth/network-request-failed': 'Erro de conexão. Verifique sua internet',
  'auth/popup-closed-by-user': 'Login cancelado',
  'auth/popup-blocked': 'Pop-up bloqueado pelo navegador. Permita pop-ups e tente novamente',
  'auth/account-exists-with-different-credential': 'Já existe uma conta com este email usando outro método de login',
  'auth/requires-recent-login': 'Sessão expirada. Faça login novamente',
  'auth/operation-not-allowed': 'Método de login não habilitado',
};

const FIREBASE_FIRESTORE_ERRORS: Record<string, string> = {
  'permission-denied': 'Sem permissão para realizar esta ação',
  'not-found': 'Dado não encontrado',
  'already-exists': 'Este registro já existe',
  'resource-exhausted': 'Limite de operações excedido. Tente novamente em alguns minutos',
  'unavailable': 'Serviço temporariamente indisponível. Tente novamente',
  'deadline-exceeded': 'A operação demorou demais. Tente novamente',
  'cancelled': 'Operação cancelada',
  'unauthenticated': 'Sessão expirada. Faça login novamente',
  'failed-precondition': 'Operação não permitida no estado atual',
};

/**
 * Códigos de erro Firestore/Functions que devem ser persistidos para debug —
 * indicam problemas de permissão ou infra que o user precisa reportar.
 */
const LOG_WORTHY_CODES = new Set([
  'permission-denied',
  'unauthenticated',
  'failed-precondition',
  'unavailable',
]);

/**
 * Retorna mensagem de erro em PT-BR para um erro do Firebase Auth.
 */
export function getAuthErrorMessage(error: unknown, fallback?: string): string {
  const code = (error as { code?: string })?.code || '';
  return FIREBASE_AUTH_ERRORS[code] || fallback || 'Erro inesperado. Tente novamente';
}

/**
 * Retorna mensagem de erro em PT-BR para um erro do Firestore.
 * Erros críticos são automaticamente registrados via logError.
 */
export function getFirestoreErrorMessage(error: unknown, fallback?: string): string {
  const code = (error as { code?: string })?.code || '';

  // Persiste erros críticos de permissão/infra para investigação posterior
  if (code && LOG_WORTHY_CODES.has(code)) {
    logError(
      error instanceof Error ? error : new Error(`Firestore error: ${code}`),
      { kind: 'firebase', extra: { code } }
    );
  }

  return FIREBASE_FIRESTORE_ERRORS[code] || fallback || 'Erro ao acessar dados. Tente novamente';
}

/**
 * Mapa de códigos HttpsError do Firebase Functions para mensagens PT-BR.
 * Códigos seguem a convenção `functions/<code>` retornada pelo SDK.
 */
const FIREBASE_FUNCTIONS_ERRORS: Record<string, string> = {
  'functions/permission-denied': 'Você não tem permissão para esta ação.',
  'functions/unauthenticated': 'Faça login para continuar.',
  'functions/failed-precondition': 'Operação temporariamente indisponível. Recarregue a página e tente novamente.',
  'functions/resource-exhausted': 'Limite atingido. Aguarde alguns minutos.',
  'functions/unavailable': 'Servidor temporariamente indisponível. Recarregue a página e tente novamente.',
  'functions/internal': 'Ocorreu um erro inesperado no servidor.',
  'functions/not-found': 'Recurso não encontrado.',
  'functions/invalid-argument': 'Dados inválidos enviados.',
  // Códigos sem prefixo (alguns SDKs omitem o prefixo functions/)
  'permission-denied': 'Você não tem permissão para esta ação.',
  'unauthenticated': 'Faça login para continuar.',
  'failed-precondition': 'Operação temporariamente indisponível. Recarregue a página e tente novamente.',
  'resource-exhausted': 'Limite atingido. Aguarde alguns minutos.',
  'unavailable': 'Servidor temporariamente indisponível. Recarregue a página e tente novamente.',
  'internal': 'Ocorreu um erro inesperado no servidor.',
  'not-found': 'Recurso não encontrado.',
  'invalid-argument': 'Dados inválidos enviados.',
};

/**
 * Retorna mensagem de erro em PT-BR para um erro de Cloud Function (HttpsError).
 * Erros críticos são automaticamente registrados via logError.
 */
export function getFunctionErrorMessage(
  error: unknown,
  functionName: string,
  fallback?: string
): string {
  const code = (error as { code?: string })?.code || '';

  // Persiste erros relevantes de Functions para debug
  if (code && LOG_WORTHY_CODES.has(code.replace('functions/', ''))) {
    logError(
      error instanceof Error ? error : new Error(`Function error [${functionName}]: ${code}`),
      { kind: 'firebase', functionName, extra: { code } }
    );
  }

  return (
    FIREBASE_FUNCTIONS_ERRORS[code] ||
    fallback ||
    'Não foi possível completar a operação.'
  );
}

/**
 * Alias com `s` para consistência com a convenção `getFunctionsErrorMessage`.
 * @see getFunctionErrorMessage
 */
export const getFunctionsErrorMessage = getFunctionErrorMessage;
