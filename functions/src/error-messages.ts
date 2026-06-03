import {HttpsError} from "firebase-functions/v2/https";
import type {FunctionsErrorCode} from "firebase-functions/v2/https";

export const ERROR_MSGS = {
  UNAUTHENTICATED: "Login obrigatório.",
  PROFILE_INCOMPLETE: "Perfil incompleto. Complete seu cadastro antes de continuar.",

  NOT_FOUND: (entity: string) => `${entity} não encontrado(a).`,
  GAME_NOT_FOUND: "Jogo não encontrado.",
  GROUP_NOT_FOUND: "Grupo não encontrado.",
  USER_NOT_FOUND: "Usuário não encontrado.",
  LOCATION_NOT_FOUND: (id: string) => `Local ${id} não encontrado.`,
  VOTE_NOT_FOUND: "Voto não encontrado para este jogo.",

  FIELD_REQUIRED: (field: string) => `${field} é obrigatório(a).`,
  INVALID_VALUE: (field: string) => `${field} inválido(a).`,
  FIELD_TOO_LONG: (field: string, max: number) =>
    `${field} deve ter no máximo ${max} caracteres.`,
  FIELD_LENGTH_RANGE: (field: string, min: number, max: number) =>
    `${field} deve ter entre ${min} e ${max} caracteres.`,
  BODY_INVALID: "Corpo da requisição inválido.",
  ALLOWED_VALUES: (field: string, values: readonly string[]) =>
    `${field} inválido(a). Valores aceitos: ${values.join(", ")}.`,

  RATE_LIMIT_RETRY: (seconds: number) =>
    `Muitas tentativas. Tente novamente em ${seconds} segundos.`,
  RATE_LIMIT_GENERIC: "Muitas tentativas. Tente novamente mais tarde.",
  RATE_LIMIT_MINUTES: (minutes: number) =>
    `Muitas tentativas. Tente novamente em ${minutes} minutos.`,
  RATE_LIMIT_EXCEEDED: "Limite de requisições excedido.",
  RATE_LIMIT_APP_CHECK: "App Check verification failed.",
  MIGRATION_LOCKED: (minutes: number) =>
    `Migração já foi executada recentemente. Tente em ${minutes} minutos.`,

  ADMIN_ONLY: "Apenas administradores podem executar esta ação.",
  OWNER_ONLY: "Apenas o dono pode executar esta ação.",
  CONFIRMED_PLAYERS_ONLY: "Apenas jogadores confirmados podem votar.",
  OWNER_OR_ADMIN_ONLY: "Apenas o dono ou administrador pode executar esta ação.",

  CANNOT_VOTE_SELF: "Não é permitido votar em si mesmo.",
  VOTE_OWNER_ONLY: "Apenas o dono do jogo pode encerrar a votação.",
  VOTING_CLOSED: "Votação já foi encerrada para este jogo.",
  VOTING_NOT_STARTED: "Votação disponível apenas para jogos finalizados.",
  VOTING_EXPIRED: "Prazo de votação expirado (24h após o jogo).",
  ALREADY_VOTED: (category: string) =>
    `Você já votou na categoria ${category} neste jogo.`,
  VOTE_REGISTERED: "Voto registrado com sucesso.",
  VOTE_ALREADY_CONCLUDED: "Votação já havia sido encerrada.",
  PLAYER_NOT_IN_GAME: "Jogador votado não participou deste jogo.",

  GAME_NOT_FINALIZED: "O jogo precisa estar finalizado para esta operação.",
  GAME_ALREADY_LIVE: "Jogo já está em andamento.",
  CANNOT_DELETE_LIVE: "Não é possível deletar jogo em andamento.",
  ALREADY_DELETED: (entity: string) => `${entity} já estava deletado(a).`,
  NOT_DELETED: (entity: string) => `${entity} não está deletado(a).`,

  CPF_INVALID: "CPF inválido.",
  CPF_NOT_STRING: "CPF deve ser uma string.",
  CPF_REQUIRED: "Verifique seu CPF antes de concluir o cadastro.",
  PHONE_REQUIRED: "Verifique seu telefone antes de concluir o cadastro.",
  PHONE_INVALID: "Telefone E.164 inválido.",
  CPF_SALT_MISSING: "CPF_SALT não configurado no ambiente.",

  VERIFICATION_SENT: "Verification code sent if CPF is valid.",

  GPS_REQUIRED: "Coordenadas GPS (lat/lng) ou qr_token são obrigatórios.",
  GPS_INVALID_RANGE: "Coordenadas fora de range.",
  GPS_INVALID_LOCATION: "Localização inválida.",
  GPS_INSUFFICIENT: (accuracy: number, max: number) =>
    `Precisão GPS insuficiente (${Math.round(accuracy)}m). Máximo ${max}m.`,
  CHECKIN_NOT_LIVE: "Check-in permitido apenas em jogos CONFIRMED ou LIVE.",
  CHECKIN_TOO_EARLY: "Fora da janela de check-in (mais de 30 min antes).",
  CHECKIN_TOO_LATE: "Fora da janela de check-in (jogo já encerrou).",
  CHECKIN_ALREADY_DONE: "Você já fez check-in neste jogo.",
  CHECKIN_OUT_OF_RANGE: (dist: number, radius: number) =>
    `Você está a ${Math.round(dist)}m do campo (limite ${radius}m).`,
  CHECKIN_NOT_CONFIRMED: "Você não está confirmado neste jogo.",
  QR_TOKEN_INVALID: "QR token expirado ou inválido.",

  LOCATION_ID_REQUIRED: "locationId é obrigatório e deve ser uma string válida.",
  USER_ID_REQUIRED: "userId é obrigatório.",
  ID_INVALID_CHARS: "IDs não podem conter caracteres especiais.",
  GAME_ID_REQUIRED: "gameId é obrigatório e deve ser uma string válida.",
  GAME_ID_LENGTH: "gameId deve ter entre 1 e 128 caracteres.",

  SEASON_ID_REQUIRED: "seasonId é obrigatório.",
  SEASON_ID_TOO_LONG: "seasonId excede 100 caracteres.",

  ALREADY_IN_GROUP: "Você já é membro deste grupo.",
  JOIN_REQUEST_PENDING: "Você já tem um pedido de entrada pendente.",
  OWNER_CANNOT_LEAVE: "O dono do grupo não pode sair diretamente.",
  INVITE_ALREADY_USED: "Este convite já foi utilizado.",
  INVITE_EXPIRED: "Este convite expirou.",

  INTERNAL_ERROR: "Erro interno. Tente novamente.",
  UNEXPECTED_ERROR: "Ocorreu um erro inesperado.",
  CONFIG_MISSING: "Configuração de ambiente ausente.",
  TITLE_REQUIRED: "Título é obrigatório e deve ser string.",
  BODY_REQUIRED: "Corpo é obrigatório e deve ser string.",
  TITLE_TOO_LONG: (max: number) => `Título não pode exceder ${max} caracteres.`,
  BODY_TOO_LONG: (max: number) => `Corpo não pode exceder ${max} caracteres.`,
  NOTIFICATION_TYPE_INVALID: (values: string) =>
    `Tipo inválido. Valores aceitos: ${values}.`,

  CLEANUP_ADMIN_ONLY: "Apenas ADMIN pode executar cleanup.",
  DENORMALIZE_ADMIN_ONLY: "Apenas ADMIN pode executar a denormalização.",
  RECURRENCE_LIMIT_REACHED: "Limite de recorrências atingido.",

  NOTIFICATION_SENT: "Notificação enviada!",
  NOTIFICATION_FAILED: "Falha ao enviar notificação.",
} as const;

/**
 * Lança um HttpsError com código e mensagem.
 * @param {FunctionsErrorCode} code - Código do erro
 * @param {string} message - Mensagem de erro
 */
export function throwError(
  code: FunctionsErrorCode,
  message: string
): never {
  throw new HttpsError(code, message);
}

/**
 * Retorna mensagem de rate limit com segundos restantes.
 * @param {number} resetInSeconds - Segundos até reset
 * @return {string} Mensagem formatada
 */
export function getRateLimitMessage(
  resetInSeconds: number
): string {
  // eslint-disable-next-line new-cap
  return ERROR_MSGS.RATE_LIMIT_RETRY(resetInSeconds);
}
