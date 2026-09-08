/**
 * Coleções canônicas de gamificação que pertencem a um UID.
 *
 * Esta lista é compartilhada pelo apagamento LGPD e pela união de contas.
 * A identidade document-id cobre statistics/{uid}; as demais coleções usam
 * o campo gravado pelos escritores reais.
 */
export const GAMIFICATION_UID_COLLECTIONS = {
  statistics: {
    collection: "statistics",
    identity: "document-id",
  },
  xpLogs: {
    collection: "xp_logs",
    identity: "field",
    ownerField: "user_id",
  },
  userBadges: {
    collection: "user_badges",
    identity: "field",
    ownerField: "user_id",
  },
  seasonParticipation: {
    collection: "season_participation",
    identity: "field",
    ownerField: "user_id",
  },
  mvpVotes: {
    collection: "mvp_votes",
    identity: "field",
    ownerField: "voter_id",
  },
  activities: {
    collection: "activities",
    identity: "field",
    ownerField: "user_id",
  },
} as const;

export type GamificationCollectionKey =
  keyof typeof GAMIFICATION_UID_COLLECTIONS;

export const FIELD_OWNED_GAMIFICATION_COLLECTIONS = Object.values(
  GAMIFICATION_UID_COLLECTIONS
).filter((definition): definition is Extract<
  (typeof GAMIFICATION_UID_COLLECTIONS)[GamificationCollectionKey],
  {identity: "field"}
> => definition.identity === "field");
