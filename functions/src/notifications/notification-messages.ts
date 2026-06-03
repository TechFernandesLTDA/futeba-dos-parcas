/**
 * MENSAGENS DE NOTIFICAÇÕES PUSH - Futeba dos Parças
 *
 * Todas as strings de título e corpo de notificações
 * FCM devem ser externalizadas aqui, organizadas por
 * tipo de notificação, com suporte a múltiplos locais.
 *
 * Issue #2377: Externalize push notification strings
 */

type NotificationLocale = "pt-BR" | "en" | "es";

interface NotificationMessage {
  title: Record<
    NotificationLocale,
    (params?: Record<string, string>) => string
  >;
  body: Record<
    NotificationLocale,
    (params?: Record<string, string>) => string
  >;
}

// ==========================================
// HELPERS DE FORMATAÇÃO
// ==========================================

/**
 * Cria função que retorna uma string fixa.
 *
 * @param {string} s String a retornar
 * @return {Function} Função que retorna a string
 */
function identity(s: string): () => string {
  return () => s;
}

/**
 * Cria NotificationMessage com mesmo title/body para todos os locales.
 * @param {string} title - Título da notificação
 * @param {string} body - Corpo da notificação
 * @return {NotificationMessage} Mensagem configurada
 */
function ptOnly(title: string, body: string): NotificationMessage {
  const all: Record<NotificationLocale, () => string> = {
    "pt-BR": identity(title),
    "en": identity(title),
    "es": identity(title),
  };
  const bodyAll: Record<NotificationLocale, () => string> = {
    "pt-BR": identity(body),
    "en": identity(body),
    "es": identity(body),
  };
  return {title: all, body: bodyAll};
}

/**
 * Cria NotificationMessage com title fixo e body parametrizável.
 * @param {string} title - Título fixo
 * @param {Function} body - Função que recebe params e retorna o corpo
 * @return {NotificationMessage} Mensagem configurada
 */
function ptTitleBody(
  title: string,
  body: (params?: Record<string, string>) => string
): NotificationMessage {
  const titleFn = identity(title);
  const all: Record<NotificationLocale, () => string> = {
    "pt-BR": titleFn,
    "en": titleFn,
    "es": titleFn,
  };
  return {title: all, body: {"pt-BR": body, "en": body, "es": body}};
}

// ==========================================
// NOTIFICAÇÕES DE JOGOS
// ==========================================

export const GAME_NOTIFICATIONS = {
  GAME_CREATED: ptTitleBody(
    "Novo jogo criado!",
    (p) =>
      `${p?.ownerName ?? "Alguém"} criou um novo jogo. ` +
      "Confirme sua presença!",
  ),

  GAME_CANCELLED: ptOnly(
    "Jogo cancelado",
    "O jogo foi cancelado pelo organizador.",
  ),

  GAME_UPDATED: ptOnly(
    "Jogo atualizado",
    "Os detalhes do jogo mudaram. Confira no app.",
  ),

  AUTO_CANCELLED: ptOnly(
    "Jogo cancelado",
    "foi cancelado automaticamente por baixo quórum.",
  ),

  GAME_VACANCY: ptTitleBody(
    "Vaga disponível!",
    (p) =>
      `Abriu uma vaga em ${p?.gameName ?? "o jogo"}. ` +
      "Corra para confirmar!",
  ),

  GAME_VACANCY_GROUP: ptTitleBody(
    "Vaga disponível!",
    (p) =>
      `Abriu uma vaga em ${p?.gameName ?? "o jogo"}` +
      `${p?.gameDate ? ` (${p.gameDate})` : ""}. ` +
      "Confirme sua presença!",
  ),
} as const satisfies Record<string, NotificationMessage>;

// ==========================================
// NOTIFICAÇÕES DE CONQUISTAS
// ==========================================

export const ACHIEVEMENT_NOTIFICATIONS = {
  LEVEL_UP: ptTitleBody(
    "Subiu de nível!",
    (p) =>
      `Parabéns! Você agora é ${p?.levelName ?? "Nível superior"}!`,
  ),

  BADGE_AWARDED: ptTitleBody(
    "Conquista Desbloqueada!",
    (p) =>
      `Você desbloqueou: ${p?.badgeName ?? "uma conquista"}!`,
  ),

  MVP_RECEIVED: ptTitleBody(
    "Você foi eleito MVP!",
    (p) =>
      "Parabéns! Você foi escolhido" +
      ` o Craque da Partida em ${p?.gameName ?? "a partida"}`,
  ),

  DIVISION_PROMOTED: ptOnly(
    "Promoção de Liga!",
    "Parabéns! Você subiu para a divisão.",
  ),

  DIVISION_DEMOTED: ptOnly(
    "Mudança de Liga",
    "Você desceu para a divisão. Continue jogando!",
  ),

  STREAK_30: ptOnly(
    "Sequência Épica!",
    "30 jogos consecutivos! Você é uma lenda!",
  ),

  STREAK_10: ptOnly(
    "Sequência Incrível!",
    "10 jogos consecutivos! Expert!",
  ),

  STREAK_7: ptOnly(
    "Sequência Forte!",
    "7 jogos consecutivos! Profissional!",
  ),

  STREAK_3: ptOnly(
    "Sequência Iniciada!",
    "3 jogos consecutivos! Continue assim!",
  ),
} as const satisfies Record<string, NotificationMessage>;

// ==========================================
// NOTIFICAÇÕES DE PRESENÇA / GRUPO
// ==========================================

export const PRESENCE_NOTIFICATIONS = {
  GAME_CONFIRMED: ptTitleBody(
    "Nova confirmação!",
    (p) =>
      `${p?.userName ?? "Um jogador"} confirmou presença no jogo.`,
  ),

  GROUP_INVITE: ptTitleBody(
    "Convite para grupo",
    (p) =>
      `${p?.invitedByName ?? "Alguém"} convidou ` +
      `você para ${p?.groupName ?? "um grupo"}`,
  ),

  GROUP_INVITE_ACCEPTED: ptTitleBody(
    "Convite aceito!",
    (p) =>
      `${p?.invitedUserName ?? "Um jogador"} aceitou seu convite ` +
      `para ${p?.groupName ?? "seu grupo"}`,
  ),

  GROUP_INVITE_DECLINED: ptTitleBody(
    "Convite recusado",
    (p) =>
      `${p?.invitedUserName ?? "Um jogador"} recusou seu convite ` +
      `para ${p?.groupName ?? "seu grupo"}`,
  ),

  GROUP_JOIN_APPROVED: ptTitleBody(
    "Pedido aprovado! 🎉",
    (p) =>
      `Você foi aceito em ${p?.groupName ?? "o grupo"}! ` +
      "Toque pra abrir o grupo e ver os jogos.",
  ),

  MEMBER_JOINED: ptTitleBody(
    "Novo membro!",
    (p) =>
      `${p?.memberName ?? "Um jogador"} entrou em ` +
      `${p?.groupName ?? "o grupo"}`,
  ),

  MEMBER_LEFT: ptTitleBody(
    "Membro saiu",
    (p) =>
      `${p?.memberName ?? "Um jogador"} saiu de ` +
      `${p?.groupName ?? "o grupo"}`,
  ),

  CASHBOX_ENTRY: ptOnly(
    "Entrada no caixa",
    "",
  ),

  CASHBOX_EXIT: ptOnly(
    "Saída do caixa",
    "",
  ),
} as const satisfies Record<string, NotificationMessage>;

// ==========================================
// NOTIFICAÇÕES DE LEMBRETES
// ==========================================

export const REMINDER_NOTIFICATIONS = {
  GAME_24H: ptTitleBody(
    "Jogo amanhã! Confirme sua presença",
    (p) =>
      `O jogo${p?.locationInfo ?? ""} acontecerá ` +
      `${p?.formattedDate ?? "em breve"}. Confirme!`,
  ),

  GAME_2H: ptTitleBody(
    "Jogo em 2 horas! Não esqueça",
    (p) =>
      `O jogo${p?.locationInfo ?? ""} começa em ` +
      `2 horas (${p?.formattedDate ?? ""}). Confirme!`,
  ),

  GAME_1H: ptTitleBody(
    "Jogo em 1 hora! Prepare-se",
    (p) =>
      `O jogo${p?.locationInfo ?? ""} começa em ` +
      `1 hora (${p?.formattedDate ?? ""}). Prepare-se!`,
  ),

  WAITLIST_SUMMON: ptOnly(
    "Vaga Disponível!",
    "Uma vaga abriu para o jogo. Você tem 30 minutos para confirmar!",
  ),

  WAITLIST_SUMMON_FIRESTORE: ptOnly(
    "Vaga Disponível!",
    "Uma vaga abriu! Confirme sua presença em até 30 minutos.",
  ),
} as const satisfies Record<string, NotificationMessage>;

// ==========================================
// HELPER: Obter mensagem por locale (default pt-BR)
// ==========================================

/**
 * Obtém o título de uma notificação no locale especificado.
 *
 * @param {NotificationMessage} msg - Mensagem configurada
 * @param {NotificationLocale} locale - Locale desejado
 * @param {Record<string, string>} params - Parâmetros
 * @return {string} Título formatado
 */
export function getNotificationTitle(
  msg: NotificationMessage,
  locale: NotificationLocale = "pt-BR",
  params?: Record<string, string>
): string {
  return msg.title[locale](params);
}

/**
 * Obtém o corpo de uma notificação no locale especificado.
 *
 * @param {NotificationMessage} msg - Mensagem configurada
 * @param {NotificationLocale} locale - Locale desejado
 * @param {Record<string, string>} params - Parâmetros
 * @return {string} Corpo formatado
 */
export function getNotificationBody(
  msg: NotificationMessage,
  locale: NotificationLocale = "pt-BR",
  params?: Record<string, string>
): string {
  return msg.body[locale](params);
}
