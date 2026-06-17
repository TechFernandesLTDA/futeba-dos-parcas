import * as admin from "firebase-admin";
import {Timestamp} from "firebase-admin/firestore";

const getDb = () => admin.firestore();

/**
 * FIX #2477 (regressão recorrente de #785 / #926 / #1143):
 * Schema CANÔNICO ÚNICO para preferências de notificação.
 *
 * Histórico do bug: havia 3 schemas em jogo e reader↔writer NUNCA batiam:
 *  - `users.notification_preferences` (lido por shouldNotifyUser) — NENHUM writer
 *  - `notification_settings` camelCase (escrito pelo Android)
 *  - `notification_settings` snake_case (escrito pelo Web, dominante)
 *
 * Resultado: todo opt-out era silenciosamente ignorado.
 *
 * Solução: TODA leitura de preferência passa por {@link getNotificationSettings},
 * que lê `notification_settings/{uid}` e tolera AMBOS os casings (snake do web +
 * camel do android). Os gates de certeza (push global, lembretes, mute) são
 * resolvidos com precisão; toggles por-tipo SEM mapeamento conhecido são
 * FAIL-OPEN (nunca super-suprimir — foi justamente a super/sub-supressão que
 * fez os "consertos" anteriores reincidirem).
 */
export interface NotificationSettings {
  /** false APENAS se explicitamente desativado por algum writer. */
  pushEnabled: boolean;
  gameReminders: boolean;
  muteUntil: Date | null;
  muteGroups: string[];
  /** Doc cru, para checagens por-tipo tolerantes a casing. */
  raw: Record<string, unknown>;
}

/**
 * Retorna true se ALGUM dos aliases presente no doc for explicitamente `false`.
 * Campos ausentes ou `undefined` NÃO contam como desativados (fail-open).
 *
 * @param {Record<string, unknown>} data - Doc de preferências.
 * @param {string[]} aliases - Nomes de campo equivalentes (snake + camel).
 * @return {boolean} true se desativado explicitamente.
 */
function anyExplicitlyFalse(
  data: Record<string, unknown>,
  aliases: string[],
): boolean {
  return aliases.some((k) => data[k] === false);
}

/**
 * Lê e normaliza as preferências de notificação de um usuário a partir da
 * coleção canônica `notification_settings/{uid}`, tolerando snake_case (web) e
 * camelCase (android). Doc ausente => tudo habilitado (fail-open).
 *
 * @param {string} userId - UID do usuário.
 * @return {Promise<NotificationSettings>} Preferências normalizadas.
 */
export async function getNotificationSettings(
  userId: string,
): Promise<NotificationSettings> {
  const snap = await getDb()
    .collection("notification_settings")
    .doc(userId)
    .get();
  const d = ((snap.exists ? snap.data() : {}) ?? {}) as Record<string, unknown>;

  // mute_until (web) | muteUntilTime (android). Duck-typing em `.toDate`
  // (em vez de instanceof Timestamp) tolera Firestore Timestamp real e é
  // testável sem mock de classe.
  let muteUntil: Date | null = null;
  const rawMute = d.mute_until ?? d.muteUntilTime;
  if (
    rawMute &&
    typeof (rawMute as {toDate?: unknown}).toDate === "function"
  ) {
    muteUntil = (rawMute as Timestamp).toDate();
  } else if (typeof rawMute === "string" || typeof rawMute === "number") {
    const parsed = new Date(rawMute);
    if (!isNaN(parsed.getTime())) muteUntil = parsed;
  }

  const muteGroups = Array.isArray(d.muteGroups) ?
    (d.muteGroups as string[]) :
    Array.isArray(d.mute_groups) ?
      (d.mute_groups as string[]) :
      [];

  return {
    pushEnabled: !anyExplicitlyFalse(
      d, ["push_enabled", "enablePushNotifications"]),
    gameReminders: !anyExplicitlyFalse(
      d, ["game_reminders", "enableGameReminders"]),
    muteUntil,
    muteGroups,
    raw: d,
  };
}

/**
 * Aliases de campo (web snake + android camel) por NotificationType.
 * Tipos sem toggle dedicado nos writers ficam de fora => fail-open.
 */
const TYPE_FIELD_ALIASES: Record<string, string[]> = {
  GAME_REMINDER: ["game_reminders", "enableGameReminders"],
  GAME_INVITE: ["game_invites", "enableInviteNotifications"],
  GAME_SUMMON: ["game_invites", "enableInviteNotifications"],
  GAME_VACANCY: ["game_invites", "enableInviteNotifications"],
  GROUP_INVITE: ["group_invites", "enableGroupNotifications"],
  GROUP_INVITE_ACCEPTED: ["group_invites", "enableGroupNotifications"],
  GROUP_INVITE_DECLINED: ["group_invites", "enableGroupNotifications"],
  GROUP_JOIN_APPROVED: ["group_invites", "enableGroupNotifications"],
  MEMBER_JOINED: ["group_invites", "enableGroupNotifications"],
  MEMBER_LEFT: ["group_invites", "enableGroupNotifications"],
  CASHBOX_ENTRY: ["enableCashboxNotifications"],
  CASHBOX_EXIT: ["enableCashboxNotifications"],
  ACHIEVEMENT: ["achievements", "enableAchievementNotifications"],
  LEVEL_UP: ["level_up"],
  MVP_RECEIVED: ["mvp_votes"],
  // GAME_CONFIRMED / GAME_CANCELLED / GAME_UPDATED / RANKING_CHANGED:
  // sem toggle dedicado nos writers => fail-open.
};

/**
 * Retorna false APENAS se o tipo estiver explicitamente desativado por algum
 * writer. Tipos sem mapeamento conhecido são fail-open (allow).
 *
 * @param {NotificationSettings} settings - Preferências normalizadas.
 * @param {string} notificationType - Valor do enum NotificationType.
 * @return {boolean} true se o tipo deve ser entregue.
 */
export function isNotificationTypeEnabled(
  settings: NotificationSettings,
  notificationType: string,
): boolean {
  const aliases = TYPE_FIELD_ALIASES[notificationType];
  if (!aliases || aliases.length === 0) return true;
  return !anyExplicitlyFalse(settings.raw, aliases);
}

/**
 * @param {NotificationSettings} settings - Preferências normalizadas.
 * @return {boolean} true se o usuário está silenciado globalmente agora.
 */
export function isMuted(settings: NotificationSettings): boolean {
  return (
    settings.muteUntil !== null &&
    settings.muteUntil.getTime() > Date.now()
  );
}

/**
 * @param {NotificationSettings} settings - Preferências normalizadas.
 * @param {string | null | undefined} groupId - Grupo a checar.
 * @return {boolean} true se o usuário silenciou esse grupo.
 */
export function isGroupMuted(
  settings: NotificationSettings,
  groupId?: string | null,
): boolean {
  return !!groupId && settings.muteGroups.includes(groupId);
}
