type AdminLocale = "pt-BR" | "en" | "es";

export interface AdminNotification {
  readonly title: (locale: AdminLocale) => string;
  readonly body: (
    locale: AdminLocale,
    params?: Record<string, string | number>
  ) => string;
}

/**
 * Cria AdminNotification com título e corpo fixos.
 * @param {string} title - Título da notificação
 * @param {string} body - Corpo da notificação
 * @return {AdminNotification} Notificação configurada
 */
function fixed(title: string, body: string): AdminNotification {
  return {
    title: () => title,
    body: () => body,
  };
}

/**
 * Cria AdminNotification com título fixo e corpo parametrizável.
 * @param {string} title - Título fixo
 * @param {Function} body - Função que recebe params e retorna o corpo
 * @return {AdminNotification} Notificação configurada
 */
function titleFixedBodyDynamic(
  title: string,
  body: (params?: Record<string, string | number>) => string
): AdminNotification {
  return {
    title: () => title,
    body: (_l, params) => body(params),
  };
}

export const ADMIN_NOTIFICATIONS = {
  XP_STALE: titleFixedBodyDynamic(
    "Jogos com XP processing travado",
    (p) =>
      `${p?.count ?? 0} jogos com xp_processing=true há >1h. ` +
      `IDs: ${(Array.isArray(p?.gameIds) ? p?.gameIds.join(", ") : "")}`,
  ),
  DLQ_ACCUMULATING: fixed(
    "Dead Letter Queue acumulando",
    "Há mensagens na DLQ há mais de 1 hora."
  ),
  FCM_FAILING: fixed(
    "Notificações FCM falhando",
    "Taxa de falha de envio FCM acima do limite aceitável."
  ),
  RATE_LIMIT_EXCESSIVE: fixed(
    "Rate limiting excessivo",
    "Número de requests bloqueados por rate limit acima do limite."
  ),
  XP_FAILURES: fixed(
    "Muitas falhas de XP",
    "Múltiplas falhas ao processar XP nos últimos minutos."
  ),
  HEALTH_CHECK_SLOW: fixed(
    "Health check lento",
    "Tempo de execução do health check acima do limite aceitável."
  ),
  ALERTS_ACCUMULATING: fixed(
    "Alertas acumulando",
    "Múltiplos alertas críticos ativos no sistema."
  ),
} as const;

/**
 * Retorna o título de uma notificação admin pelo locale padrão (pt-BR).
 * @param {string} key - Chave da notificação
 * @return {string} Título formatado
 */
export function getAdminTitle(
  key: keyof typeof ADMIN_NOTIFICATIONS
): string {
  return ADMIN_NOTIFICATIONS[key].title("pt-BR");
}

/**
 * Retorna o corpo de uma notificação admin pelo locale padrão (pt-BR).
 * @param {string} key - Chave da notificação
 * @param {Object} params - Parâmetros opcionais
 * @return {string} Corpo formatado
 */
export function getAdminBody(
  key: keyof typeof ADMIN_NOTIFICATIONS,
  params?: Record<string, string | number>
): string {
  return ADMIN_NOTIFICATIONS[key].body("pt-BR", params);
}

export const RANKING_NOTIFICATIONS = {
  WEEKLY_CLOSED: titleFixedBodyDynamic(
    "Rodada encerrada!",
    (p) =>
      `O ranking da semana ${p?.weekKey ?? ""} está pronto. ` +
      `${p?.leaderName ?? "O líder"} é o primeiro com ${p?.leaderPoints ?? 0} pts!`
  ),
} as const;

/**
 * Retorna o título de uma notificação de ranking pelo locale padrão (pt-BR).
 * @param {string} key - Chave da notificação
 * @return {string} Título formatado
 */
export function getRankingTitle(
  key: keyof typeof RANKING_NOTIFICATIONS
): string {
  return RANKING_NOTIFICATIONS[key].title("pt-BR");
}

/**
 * Retorna o corpo de uma notificação de ranking pelo locale padrão (pt-BR).
 * @param {string} key - Chave da notificação
 * @param {Object} params - Parâmetros opcionais
 * @return {string} Corpo formatado
 */
export function getRankingBody(
  key: keyof typeof RANKING_NOTIFICATIONS,
  params?: Record<string, string | number>
): string {
  return RANKING_NOTIFICATIONS[key].body("pt-BR", params);
}
