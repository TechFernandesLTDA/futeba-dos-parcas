/**
 * MENSAGENS DE ERRO CENTRALIZADAS - Futeba dos Parças
 *
 * Todas as mensagens de erro de Cloud Functions
 * devem usar estas constantes para garantir
 * consistência de idioma (PT-BR padrão) e acentuação.
 *
 * Issue #2376 / #2378: Externalize HttpsError messages
 */

import {HttpsError} from "firebase-functions/v2/https";
import type {FunctionsErrorCode} from "firebase-functions/v2/https";

// ==========================================
// CONSTANTES DE ERRO
// ==========================================

export const ERROR_MSGS = {
  // Autenticação
  UNAUTHENTICATED: "Login obrigatório.",
  PROFILE_INCOMPLETE: "Perfil incompleto. Complete seu cadastro antes de continuar.",

  // Not found genérico
  NOT_FOUND: (entity: string) => `${entity} não encontrado(a).`,
  GAME_NOT_FOUND: "Jogo não encontrado.",
  GROUP_NOT_FOUND: "Grupo não encontrado.",
  USER_NOT_FOUND: "Usuário não encontrado.",

  // Validação
  FIELD_REQUIRED: (field: string) => `${field} é obrigatório(a).`,
  INVALID_VALUE: (field: string) => `${field} inválido(a).`,

  // Rate limit
  rateLimit: (seconds: number) =>
    `Muitas tentativas. Tente novamente em ${seconds} segundos.`,
  rateLimitGeneric: "Muitas tentativas. Tente novamente mais tarde.",

  // Permissão
  ADMIN_ONLY: "Apenas administradores podem executar esta ação.",
  OWNER_ONLY: "Apenas o dono pode executar esta ação.",
  CONFIRMED_PLAYERS_ONLY: "Apenas jogadores confirmados podem votar.",

  // Operações
  ALREADY_DELETED: (entity: string) => `${entity} já estava deletado(a).`,
  NOT_DELETED: (entity: string) => `${entity} não está deletado(a).`,
  CANNOT_DELETE_LIVE: "Não é possível deletar jogo em andamento.",

  // Erro interno
  INTERNAL_ERROR: "Erro interno. Tente novamente.",
  UNEXPECTED_ERROR: "Ocorreu um erro inesperado.",
} as const;

// ==========================================
// HELPER: throwError
// ==========================================

/**
 * Lança um HttpsError com código e mensagem.
 * Centraliza a criação de erros para garantir
 * consistência e evitar strings literais.
 *
 * @param {FunctionsErrorCode} code - Código de erro Firebase
 * @param {string} message - Mensagem descritiva
 * @throws {HttpsError} Sempre lança exceção
 */
export function throwError(
  code: FunctionsErrorCode,
  message: string
): never {
  throw new HttpsError(code, message);
}

// ==========================================
// HELPERS DE MENSAGENS DINÂMICAS
// ==========================================

/**
 * Retorna a mensagem de rate limit com o número
 * de segundos até o reset.
 *
 * @param {number} resetInSeconds - Segundos restantes
 * @return {string} Mensagem formatada
 */
export function getRateLimitMessage(
  resetInSeconds: number
): string {
  return ERROR_MSGS.rateLimit(resetInSeconds);
}
