type AdminLocale = "pt-BR" | "en" | "es";

export interface AdminNotification {
  readonly title: (locale: AdminLocale) => string;
  readonly body: (
    locale: AdminLocale,
    params?: Record<string, string | number>
  ) => string;
}

function fixed(title: string, body: string): AdminNotification {
  return {
    title: () => title,
    body: () => body,
  };
}

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

export function getAdminTitle(
  key: keyof typeof ADMIN_NOTIFICATIONS,
  _locale: AdminLocale = "pt-BR"
): string {
  return ADMIN_NOTIFICATIONS[key].title("pt-BR");
}

export function getAdminBody(
  key: keyof typeof ADMIN_NOTIFICATIONS,
  _locale: AdminLocale = "pt-BR",
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

export function getRankingTitle(
  key: keyof typeof RANKING_NOTIFICATIONS,
  _locale: AdminLocale = "pt-BR"
): string {
  return RANKING_NOTIFICATIONS[key].title("pt-BR");
}

export function getRankingBody(
  key: keyof typeof RANKING_NOTIFICATIONS,
  _locale: AdminLocale = "pt-BR",
  params?: Record<string, string | number>
): string {
  return RANKING_NOTIFICATIONS[key].body("pt-BR", params);
}
