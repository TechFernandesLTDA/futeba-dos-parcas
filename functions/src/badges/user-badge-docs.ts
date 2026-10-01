import {MILESTONES} from "../xp/pipeline";
import {db} from "../_db";

export interface UserBadgeDocInput {
  badgeId: string;
  name?: string | null;
  icon?: string | null;
  description?: string | null;
  type?: string | null;
  xpReward?: number | null;
  earnedAt?: unknown;
  lastEarnedAt?: unknown;
  expiresAt?: unknown;
  earned?: boolean;
  count?: number;
}

/**
 * FIX #4138: espelha uma badge gravada em users/{uid}/badges (subcoleção
 * sem leitor) para a coleção raiz user_badges — o único lugar que os
 * clientes leem (web useBadges e Android FirebaseDataSource). Id
 * determinístico `{uid}_{badge_id}` (mesmo padrão dos milestones) com
 * merge:true torna a operação idempotente (backfill incluído).
 *
 * @param {string} userId UID dono do badge.
 * @param {UserBadgeDocInput} input Dados do badge.
 * @return {Promise<void>} -
 */
export async function mirrorBadgeToRoot(
  userId: string,
  input: UserBadgeDocInput
): Promise<void> {
  const docId = `${userId}_${input.badgeId}`;
  await db()
    .collection("user_badges")
    .doc(docId)
    .set(buildUserBadgeAggregateDoc(userId, input), {merge: true});
}

/**
 * Adiciona campo opcional ao payload quando houver valor.
 *
 * @param {Record<string, unknown>} target Objeto alvo.
 * @param {string} key Nome do campo.
 * @param {unknown} value Valor opcional.
 */
function withOptionalField(
  target: Record<string, unknown>,
  key: string,
  value: unknown
) {
  if (value !== undefined && value !== null) {
    target[key] = value;
  }
}

/**
 * Monta o documento agregado usado pela colecao raiz user_badges.
 *
 * @param {string} userId UID dono do badge.
 * @param {UserBadgeDocInput} input Dados do badge.
 * @return {Record<string, unknown>} Documento pronto para escrita.
 */
export function buildUserBadgeAggregateDoc(
  userId: string,
  input: UserBadgeDocInput
): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    user_id: userId,
    badge_id: input.badgeId,
    earned: input.earned ?? true,
    count: input.count ?? 1,
  };

  withOptionalField(doc, "name", input.name);
  withOptionalField(doc, "icon", input.icon);
  withOptionalField(doc, "description", input.description);
  withOptionalField(doc, "type", input.type);
  withOptionalField(doc, "xp_reward", input.xpReward);
  withOptionalField(doc, "earned_at", input.earnedAt);
  withOptionalField(doc, "last_earned_at", input.lastEarnedAt);
  withOptionalField(doc, "expires_at", input.expiresAt);

  return doc;
}

const MILESTONE_CATEGORY_LABELS: Record<string, string> = {
  GAMES: "Jogos",
  GOALS: "Gols",
  ASSISTS: "Assistencias",
  SAVES: "Defesas",
  WINS: "Vitorias",
  MVP: "MVPs",
};

/**
 * Cria o payload padrao de badge para milestones desbloqueados.
 *
 * @param {string} milestoneName Identificador da milestone.
 * @param {unknown} earnedAt Data de conquista.
 * @return {UserBadgeDocInput} Payload padrao do badge.
 */
export function buildMilestoneBadgeDoc(
  milestoneName: string,
  earnedAt: unknown
): UserBadgeDocInput {
  const definition = MILESTONES.find(
    (milestone) => milestone.name === milestoneName
  );
  const [category, thresholdRaw] = milestoneName.split("_");
  const threshold = Number(thresholdRaw);
  const label =
    MILESTONE_CATEGORY_LABELS[category] ?? milestoneName;
  const countLabel = Number.isFinite(threshold) ?
    `${threshold}` :
    thresholdRaw;

  return {
    badgeId: milestoneName,
    name: `Meta ${label} ${countLabel}`,
    description: `Alcancou ${countLabel} ${label.toLowerCase()}.`,
    type: "MILESTONE",
    xpReward: definition?.xpReward ?? 0,
    earnedAt,
    lastEarnedAt: earnedAt,
    earned: true,
    count: 1,
  };
}
