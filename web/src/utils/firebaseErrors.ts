/**
 * Mapeia códigos de erro do Firebase Auth para mensagens em PT-BR.
 * Centraliza o tratamento de erros evitando duplicação nos componentes.
 */

const FIREBASE_AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Email ou senha inválidos',
  'auth/invalid-email': 'Email inválido',
  'auth/user-disabled': 'Esta conta foi desativada',
  'auth/user-not-found': 'Usuário não encontrado',
  'auth/wrong-password': 'Senha incorreta',
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
};

/**
 * Retorna mensagem de erro em PT-BR para um erro do Firebase Auth.
 */
export function getAuthErrorMessage(error: unknown, fallback?: string): string {
  const code = (error as { code?: string })?.code || '';
  return FIREBASE_AUTH_ERRORS[code] || fallback || 'Erro inesperado. Tente novamente';
}

/**
 * Retorna mensagem de erro em PT-BR para um erro do Firestore.
 */
export function getFirestoreErrorMessage(error: unknown, fallback?: string): string {
  const code = (error as { code?: string })?.code || '';
  return FIREBASE_FIRESTORE_ERRORS[code] || fallback || 'Erro ao acessar dados. Tente novamente';
}
