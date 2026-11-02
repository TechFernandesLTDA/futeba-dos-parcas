/**
 * Lista canônica de "coleções pertencentes a um uid" — #4112 / #4113.
 *
 * `account-merge.ts` (completeAccountMerge) e `account-cleanup.ts`
 * (onUserDeleted) resolvem o mesmo problema: enumerar tudo que identifica um
 * uid. Quando cada arquivo mantinha a própria lista, elas divergiam nas duas
 * direções (o merge não enxergava a gamificação; o cleanup lia campos que
 * nenhum escritor grava — `ownerId`, `members[].userName`).
 *
 * REGRA: todo nome de campo aqui foi verificado contra o ESCRITOR REAL
 * (arquivo:linha em `writer`), nunca contra modelos/tipos declarados. Ao
 * criar uma coleção nova chaveada por uid, registre-a aqui e consuma a
 * constante nos dois arquivos — nunca digite o nome do campo inline.
 */

/** Valor usado no lugar de nomes denormalizados (LGPD Art. 18 VI). */
export const ANONYMIZED_USER_NAME = "Usuário removido";

/** Tratamento aplicado por completeAccountMerge. */
export type MergeStrategy =
  | "repoint" // reescreve o campo de uid no lugar (doc segue no mesmo path)
  | "move" // copia para o ID determinístico do destino e apaga a origem
  | "sum" // soma contadores numéricos no doc do destino e apaga a origem
  | "union" // copia só o que o destino ainda não tem; apaga a origem
  | "ownership" // transferência de posse relida em transação
  | "profile" // campos vazios do perfil canônico recebem fallback
  | "none"; // não migrado (documentado o motivo)

/** Tratamento aplicado por onUserDeleted. */
export type CleanupStrategy =
  | "delete" // docs do uid são apagados
  | "anonymize" // PII denormalizada é substituída, o doc permanece
  | "none";

export interface UidOwnedCollection {
  /** Nome ou caminho da coleção (subcoleções usam `{uid}`/`{groupId}`). */
  readonly collection: string;
  /** Campos que apontam para o uid; o primeiro é o canônico do escritor. */
  readonly uidFields: readonly string[];
  /** Esquema do ID do doc quando determinístico. */
  readonly docIdScheme?: string;
  /** Escritor real verificado (arquivo:linha). */
  readonly writer: string;
  readonly merge: MergeStrategy;
  readonly cleanup: CleanupStrategy;
  /** Campos com PII denormalizada anonimizados no cleanup. */
  readonly piiFields?: readonly string[];
}

// ---------------------------------------------------------------------------
// Gamificação
// ---------------------------------------------------------------------------

/**
 * `statistics/{uid}` — doc único por usuário, ID = uid. O escritor das Cloud
 * Functions (index.ts onGameFinished) NÃO grava `user_id`: só contadores
 * camelCase (`totalGames`, `totalGoals`, ...). O escritor Android legado
 * (MatchFinalizationService.kt:458) grava o modelo Kotlin com `user_id` e
 * contadores snake_case (`total_games`, ...). Por isso o cleanup apaga pelo
 * ID e só usa `user_id` como complemento legado.
 */
export const STATISTICS = {
  collection: "statistics",
  legacyUidField: "user_id",
  docId: (uid: string): string => uid,
  /** Máximos históricos: o merge pega o maior, nunca soma. */
  maxFields: [
    "bestMvpStreak",
    "best_streak",
    "longest_streak",
    "last_game_date",
  ] as readonly string[],
  /** Estado corrente: o destino (canônico, mais recente) vence. */
  latestFields: [
    "currentMvpStreak",
    "current_streak",
  ] as readonly string[],
} as const;

/**
 * `xp_logs` — IDs determinísticos (`game_{gameId}_user_{uid}`,
 * `badge_{badgeId}_user_{uid}`, transactionId); campo `user_id`
 * (xp/processing.ts:431 buildXpLogData, index.ts:1197).
 */
export const XP_LOGS = {
  collection: "xp_logs",
  uidField: "user_id",
} as const;

/**
 * `user_badges/{uid}_{badgeId}` — badges/user-badge-docs.ts:47
 * (`user_id`, `badge_id`, `earned_at`, `last_earned_at`, `count`).
 */
export const USER_BADGES = {
  collection: "user_badges",
  uidField: "user_id",
  badgeIdField: "badge_id",
  docId: (uid: string, badgeId: string): string => `${uid}_${badgeId}`,
} as const;

/**
 * `season_participation/{seasonId}_{uid}` — game/helpers.ts:779
 * updateSeasonParticipation e voting/mvp-voting.ts:2023 applyVotingXpDelta.
 * Campos planos = visão combinada; `by_gender.{G}` repete os contadores.
 */
export const SEASON_PARTICIPATION = {
  collection: "season_participation",
  uidField: "user_id",
  seasonIdField: "season_id",
  docId: (seasonId: string, uid: string): string => `${seasonId}_${uid}`,
  /** Contadores somados no merge (plano e dentro de by_gender). */
  counterFields: [
    "points",
    "games_played",
    "wins",
    "draws",
    "losses",
    "goals_scored",
    "assists",
    "mvp_count",
    "total_xp",
    "best_gk_count",
    "worst_player_count",
  ] as readonly string[],
  /** Arrays unidos no merge. */
  unionFields: ["group_ids"] as readonly string[],
  genderMapField: "by_gender",
} as const;

/**
 * `mvp_votes/{gameId}_{voterId}_{category}` — voting/mvp-voting.ts:556
 * (`voter_id`, `voted_player_id`, `game_id`, `category`).
 */
export const MVP_VOTES = {
  collection: "mvp_votes",
  voterField: "voter_id",
  votedPlayerField: "voted_player_id",
  gameIdField: "game_id",
  categoryField: "category",
  docId: (gameId: string, voterId: string, category: string): string =>
    `${gameId}_${voterId}_${category}`,
} as const;

/**
 * `activities` — activities.ts:117 (`user_id`, `user_name`, `user_photo`) e
 * KMP FirebaseDataSource.kt:4202 activityToMap (mesmos campos).
 */
export const ACTIVITIES = {
  collection: "activities",
  uidField: "user_id",
} as const;

// ---------------------------------------------------------------------------
// Grupos / convites
// ---------------------------------------------------------------------------

/**
 * `groups/{groupId}` — web/src/hooks/useGroups.ts:402-403 e
 * GroupRepository.kt:1014 gravam `owner_id`/`owner_name` (snake). Nenhum
 * escritor grava `ownerId`/`ownerName`; a variante camel fica só como
 * defesa legada. `members` no doc raiz é um array de STRINGS de uid
 * (useGroups.ts:406) — não carrega PII.
 */
export const GROUPS = {
  collection: "groups",
  ownerIdFields: ["owner_id", "ownerId"] as readonly string[],
  ownerNameByIdField: {
    owner_id: "owner_name",
    ownerId: "ownerName",
  } as Readonly<Record<string, string>>,
  membersSubcollection: "members",
} as const;

/**
 * `groups/{groupId}/members/{uid}` — fonte canônica de membership.
 * useGroups.ts:419-429 grava `user_id`, `user_name`, `user_photo_url`;
 * KMP FirebaseDataSource.kt:2064 grava `user_id`, `user_name`, `user_photo`.
 */
export const GROUP_MEMBERS = {
  uidField: "user_id",
  nameField: "user_name",
  photoFields: ["user_photo_url", "user_photo"] as readonly string[],
  path: (groupId: string, uid: string): string =>
    `${GROUPS.collection}/${groupId}/${GROUPS.membersSubcollection}/${uid}`,
} as const;

/**
 * `users/{uid}/groups/{groupId}` — espelho de membership por usuário
 * (useGroups.ts:432, FirebaseDataSource.kt:2080). É o caminho mais barato
 * para descobrir os grupos de um uid sem índice de collectionGroup.
 */
export const USER_GROUP_LINKS = {
  path: (uid: string): string => `users/${uid}/groups`,
} as const;

/**
 * `group_invites` — web/src/pages/groups/InvitePlayersScreen.tsx:229-240 e
 * useLeagueInvites.ts:106-109: `invited_user_id`, `invited_user_name`,
 * `invited_user_photo`, `invited_by_id`, `invited_by_name`. `invitedUserId`
 * (camel) só como defesa legada.
 */
export const GROUP_INVITES = {
  collection: "group_invites",
  invitedUserFields: ["invited_user_id", "invitedUserId"] as readonly string[],
  inviterField: "invited_by_id",
  inviterNameField: "invited_by_name",
} as const;

// ---------------------------------------------------------------------------
// Outras coleções com PII denormalizada (cleanup)
// ---------------------------------------------------------------------------

/**
 * `locations/{id}/reviews/{uid}` — web LocationDetailScreen.tsx:376-393
 * grava `user_id`, `user_name`, `user_photo`; KMP (LocationReview) grava
 * `user_photo_url`. Ambas as chaves de foto precisam ser anuladas.
 */
export const LOCATION_REVIEWS = {
  collectionGroup: "reviews",
  uidField: "user_id",
  nameField: "user_name",
  photoFields: ["user_photo", "user_photo_url"] as readonly string[],
} as const;

/**
 * `groups/{id}/cashbox/{entryId}` — cashbox/callable.ts:434-436
 * (`created_by`, `created_by_name`: quem LANÇOU a entrada) e
 * cashbox/callable.ts:430-431 (`player_id`, `player_name`: o jogador que
 * PAGOU, opcional). A baixa mensal (cashbox/monthly.ts:1831) grava só
 * `player_id`, sem nome.
 *
 * `created_by` tem fieldOverride COLLECTION_GROUP (firestore.indexes.json);
 * `player_id` NÃO tem — por isso o cleanup consulta `player_id` em escopo
 * COLLECTION (`path(groupId)`), grupo a grupo, a partir de users/{uid}/groups.
 *
 * `description` é texto livre e pode repetir o nome do pagador (o Android
 * gravava "Pagamento de <nome>" por padrão em RecordPaymentUseCase). O cleanup
 * substitui o `player_name` original dentro dela no MESMO update que anonimiza
 * `player_name` — depois dele o nome original não existe mais em lugar algum.
 */
export const CASHBOX = {
  collectionGroup: "cashbox",
  uidField: "created_by",
  nameField: "created_by_name",
  playerIdField: "player_id",
  playerNameField: "player_name",
  descriptionField: "description",
  path: (groupId: string): string =>
    `${GROUPS.collection}/${groupId}/cashbox`,
} as const;

/**
 * `groups/{groupId}/monthly_finance_periods/{periodKey}/payers/{uid}` —
 * cashbox/monthly.ts:1286-1296 (`user_id`, `user_name`, `user_photo_url`;
 * ID do doc = uid do pagador). Sem índice de collectionGroup: o cleanup lista
 * os períodos de cada grupo (escopo COLLECTION, sem filtro) e lê o pagador
 * pelo ID.
 */
export const MONTHLY_PAYERS = {
  uidField: "user_id",
  nameField: "user_name",
  photoFields: ["user_photo_url"] as readonly string[],
  periodsPath: (groupId: string): string =>
    `${GROUPS.collection}/${groupId}/monthly_finance_periods`,
  path: (groupId: string, periodKey: string, uid: string): string =>
    `${GROUPS.collection}/${groupId}/monthly_finance_periods/${periodKey}` +
    `/payers/${uid}`,
} as const;

/**
 * `post_game_reputation/{gameId}_{reviewerId}_{targetUserId}` (coleção raiz)
 * — reputation/post-game-reputation.ts:488-493 grava os DOIS lados da
 * avaliação com PII denormalizada das confirmations: quem avaliou
 * (`reviewer_id`, `reviewer_name`, `reviewer_photo`) e quem foi avaliado
 * (`target_user_id`, `target_user_name`, `target_user_photo`). Sem foto, o
 * escritor grava `""` — o cleanup usa o mesmo valor vazio.
 *
 * `reviewer_id`/`target_user_id` não têm fieldOverride: o índice single-field
 * automático de escopo COLLECTION atende a igualdade (sem índice novo).
 */
export const POST_GAME_REPUTATION = {
  collection: "post_game_reputation",
  /** Valor vazio que o escritor grava quando não há foto. */
  emptyPhoto: "",
  sides: [
    {
      label: "reviewer",
      uidField: "reviewer_id",
      nameField: "reviewer_name",
      photoField: "reviewer_photo",
    },
    {
      label: "target",
      uidField: "target_user_id",
      nameField: "target_user_name",
      photoField: "target_user_photo",
    },
  ],
} as const;

/**
 * `audit_logs` — o uid aparece em campos diferentes conforme o escritor:
 * `target_user_id` (custom-claims.ts:201, anti-abuse.ts:416,
 * confirm-player-as-manager.ts:279), `actor_user_id` (custom-claims.ts:202,
 * location-management.ts), `performed_by` (maintenance/soft-delete.ts:168/337),
 * `manager_uid` (confirm-player-as-manager.ts:280) e `source_user_id`
 * (account-merge.ts ACCOUNT_MERGE_*). O cleanup só lia os dois primeiros.
 *
 * #4487: `userId` é o uid cru gravado pelo audit do `secureCallable`
 * (middleware/secure-callable-wrapper.ts, logAudit, junto do IP). Fica em
 * `otherUidFields` para a exclusão varrer o campo (igualdade simples, índice
 * single-field automático). A exportação (auth/export-my-data.ts) lê o mesmo
 * campo; o teste de paridade garante que exportar ⊆ apagar.
 */
export const AUDIT_LOGS = {
  collection: "audit_logs",
  targetField: "target_user_id",
  actorField: "actor_user_id",
  otherUidFields: [
    "performed_by",
    "manager_uid",
    "source_user_id",
    "userId",
  ] as readonly string[],
} as const;

/**
 * `user_streaks` — index.ts:1252 grava em `user_streaks/{uid}`, mas os
 * leitores (index.ts:1201, game/helpers.ts:572) localizam o doc por
 * `user_id`, o que admite docs legados com ID diferente do uid.
 */
export const USER_STREAKS = {
  collection: "user_streaks",
  uidField: "user_id",
  docId: (uid: string): string => uid,
} as const;

// ---------------------------------------------------------------------------
// Registro consolidado (documentação executável — testado)
// ---------------------------------------------------------------------------

export const UID_OWNED_COLLECTIONS: readonly UidOwnedCollection[] = [
  {
    collection: "users",
    uidFields: [],
    docIdScheme: "{uid}",
    writer: "auth/user-management.ts onUserCreate",
    merge: "profile",
    cleanup: "delete",
  },
  {
    collection: "users_private",
    uidFields: [],
    docIdScheme: "{uid}",
    writer: "auth/cpf-verification.ts",
    merge: "profile",
    cleanup: "delete",
  },
  {
    collection: "confirmations",
    uidFields: ["user_id"],
    docIdScheme: "{gameId}_{uid}",
    writer: "games/join-public-game.ts:458",
    merge: "move",
    cleanup: "delete",
  },
  {
    collection: "notifications",
    uidFields: ["user_id"],
    writer: "notifications/helpers.ts",
    merge: "repoint",
    cleanup: "delete",
  },
  {
    collection: "game_summons",
    uidFields: ["user_id"],
    writer: "summons",
    merge: "repoint",
    cleanup: "none",
  },
  {
    collection: GROUP_INVITES.collection,
    uidFields: [...GROUP_INVITES.invitedUserFields, GROUP_INVITES.inviterField],
    writer: "web InvitePlayersScreen.tsx:229-240",
    merge: "repoint",
    cleanup: "delete",
    piiFields: [GROUP_INVITES.inviterNameField],
  },
  {
    collection: GROUPS.collection,
    uidFields: GROUPS.ownerIdFields,
    writer: "web useGroups.ts:402-403, GroupRepository.kt:1014",
    merge: "ownership",
    cleanup: "anonymize",
    piiFields: Object.values(GROUPS.ownerNameByIdField),
  },
  {
    collection: "groups/{groupId}/members",
    uidFields: [GROUP_MEMBERS.uidField],
    docIdScheme: "{uid}",
    writer: "web useGroups.ts:419-429, FirebaseDataSource.kt:2064",
    merge: "move",
    cleanup: "anonymize",
    piiFields: [GROUP_MEMBERS.nameField, ...GROUP_MEMBERS.photoFields],
  },
  {
    collection: "users/{uid}/groups",
    uidFields: [],
    docIdScheme: "{groupId}",
    writer: "web useGroups.ts:432, FirebaseDataSource.kt:2080",
    merge: "move",
    cleanup: "delete",
  },
  {
    collection: STATISTICS.collection,
    uidFields: [STATISTICS.legacyUidField],
    docIdScheme: "{uid}",
    writer: "index.ts:1440 (sem user_id), MatchFinalizationService.kt:458",
    merge: "sum",
    cleanup: "delete",
  },
  {
    collection: XP_LOGS.collection,
    uidFields: [XP_LOGS.uidField],
    docIdScheme: "game_{gameId}_user_{uid} | badge_{badgeId}_user_{uid}",
    writer: "xp/processing.ts:431, index.ts:1197",
    merge: "repoint",
    cleanup: "delete",
  },
  {
    collection: USER_BADGES.collection,
    uidFields: [USER_BADGES.uidField],
    docIdScheme: "{uid}_{badgeId}",
    writer: "badges/user-badge-docs.ts:47, index.ts:1700",
    merge: "union",
    cleanup: "delete",
  },
  {
    collection: SEASON_PARTICIPATION.collection,
    uidFields: [SEASON_PARTICIPATION.uidField],
    docIdScheme: "{seasonId}_{uid}",
    writer: "game/helpers.ts:779, voting/mvp-voting.ts:2023",
    merge: "sum",
    cleanup: "delete",
  },
  {
    collection: MVP_VOTES.collection,
    uidFields: [MVP_VOTES.voterField, MVP_VOTES.votedPlayerField],
    docIdScheme: "{gameId}_{voterId}_{category}",
    writer: "voting/mvp-voting.ts:556",
    merge: "move",
    cleanup: "delete",
  },
  {
    collection: ACTIVITIES.collection,
    uidFields: [ACTIVITIES.uidField],
    writer: "activities.ts:117, FirebaseDataSource.kt:4202",
    merge: "repoint",
    cleanup: "delete",
  },
  {
    collection: USER_STREAKS.collection,
    uidFields: [USER_STREAKS.uidField],
    docIdScheme: "{uid} (legado: auto)",
    writer: "index.ts:1252/1487",
    merge: "none",
    cleanup: "delete",
  },
  {
    collection: AUDIT_LOGS.collection,
    uidFields: [AUDIT_LOGS.targetField, AUDIT_LOGS.actorField, ...AUDIT_LOGS.otherUidFields],
    writer: "custom-claims.ts:201-202, soft-delete.ts:168, confirm-player-as-manager.ts:279-280",
    merge: "none",
    cleanup: "delete",
  },
  {
    collection: "groups/{groupId}/cashbox",
    uidFields: [CASHBOX.uidField, CASHBOX.playerIdField],
    writer: "cashbox/callable.ts:430-436, cashbox/monthly.ts:1831",
    // Não migrado: a entrada é lançamento contábil do grupo (auditoria do
    // caixa). Se o merge passar a tratá-la, o correto é repoint de
    // `created_by`/`created_by_id`/`player_id` sem tocar valores.
    merge: "none",
    cleanup: "anonymize",
    // `description`: só as ocorrências do player_name original são
    // substituídas (redactNameInText); o resto do texto é preservado.
    piiFields: [CASHBOX.nameField, CASHBOX.playerNameField, CASHBOX.descriptionField],
  },
  {
    collection: "groups/{groupId}/monthly_finance_periods/{periodKey}/payers",
    uidFields: [MONTHLY_PAYERS.uidField],
    docIdScheme: "{uid}",
    writer: "cashbox/monthly.ts:1286-1296",
    // Não migrado: o doc é a cobrança calculada para aquele uid no período
    // (expected/paid/outstanding + calculation_hash). Mover para o uid
    // canônico exigiria somar cobranças e reconciliar juntos os settlements
    // (`payer_id`, monthly.ts) e as entradas de caixa da baixa
    // (`monthly_payer_id`/`player_id`) — fora do escopo do merge atual.
    merge: "none",
    cleanup: "anonymize",
    piiFields: [MONTHLY_PAYERS.nameField, ...MONTHLY_PAYERS.photoFields],
  },
  {
    collection: "locations/{locationId}/reviews",
    uidFields: [LOCATION_REVIEWS.uidField],
    docIdScheme: "{uid} (web) | auto (KMP)",
    writer: "web LocationDetailScreen.tsx:376-393, FirebaseDataSource.kt:3395",
    merge: "none",
    cleanup: "anonymize",
    piiFields: [LOCATION_REVIEWS.nameField, ...LOCATION_REVIEWS.photoFields],
  },
  {
    collection: POST_GAME_REPUTATION.collection,
    uidFields: POST_GAME_REPUTATION.sides.map((side) => side.uidField),
    docIdScheme: "{gameId}_{reviewerId}_{targetUserId}",
    writer: "reputation/post-game-reputation.ts:488-493",
    // Não migrado. Um merge precisaria: (1) repoint de reviewer_id e
    // target_user_id; (2) recriar o doc no ID determinístico do uid canônico,
    // resolvendo colisão quando o canônico já avaliou/foi avaliado pelo mesmo
    // par no mesmo jogo; (3) recomputar os agregados reputation_* (somas e
    // reputation_reviews_count) em users/{target} dos dois uids — mover só os
    // docs deixaria a média do canônico dessincronizada.
    merge: "none",
    cleanup: "anonymize",
    piiFields: POST_GAME_REPUTATION.sides.flatMap((side) => [side.nameField, side.photoField]),
  },
  {
    collection: "games",
    uidFields: ["owner_id", "co_organizers"],
    writer: "games",
    merge: "ownership",
    cleanup: "none",
  },
  {
    collection: "locations",
    uidFields: ["owner_id", "managers"],
    writer: "locations/location-management.ts",
    merge: "ownership",
    cleanup: "none",
  },
];

/**
 * Tamanho mínimo (em caracteres, após trim) de um nome para ser substituído
 * em texto livre. Nomes curtos ("Zé", "Lu") casariam como palavra em textos
 * sem relação com a pessoa e corromperiam a descrição.
 */
export const MIN_REDACTABLE_NAME_LENGTH = 3;

// Caractere de "palavra" Unicode-aware: letra, dígito ou marca combinante.
// `\b` do JS só entende [A-Za-z0-9_] — trataria "ã"/"é" como fronteira.
const WORD_CHAR = "[\\p{L}\\p{N}\\p{M}]";

/**
 * Substitui as ocorrências de `name` como PALAVRA INTEIRA em `text` —
 * sem diferenciar maiúsculas/minúsculas e com fronteira Unicode-aware
 * (acentos do português contam como letra: "Ana" não casa dentro de
 * "Banana" nem de "Anaí"). Espaços internos do nome casam com qualquer
 * sequência de espaços. Nomes com menos de MIN_REDACTABLE_NAME_LENGTH
 * caracteres não são substituídos. Texto e nome são comparados em NFC; sem
 * ocorrência, o texto original volta intacto (mesma referência de string).
 *
 * @param {string} text Texto livre (ex.: descrição do lançamento de caixa).
 * @param {string} name Nome original a remover.
 * @param {string} replacement Valor que entra no lugar do nome.
 * @return {string} Texto com o nome substituído.
 */
export function redactNameInText(
  text: string,
  name: string,
  replacement: string = ANONYMIZED_USER_NAME,
): string {
  const normalizedName = name.normalize("NFC").trim();
  if (Array.from(normalizedName).length < MIN_REDACTABLE_NAME_LENGTH) return text;
  const namePattern = normalizedName
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const pattern = new RegExp(
    `(?<!${WORD_CHAR})${namePattern}(?!${WORD_CHAR})`,
    "giu",
  );
  const source = text.normalize("NFC");
  // Função como substituto: `$&`/`$1` no replacement não são interpretados.
  const redacted = source.replace(pattern, () => replacement);
  return redacted === source ? text : redacted;
}

/**
 * Soma contadores numéricos de dois registros: campos numéricos presentes
 * em ambos são somados; presentes em um só são copiados.
 *
 * @param {Record<string, unknown>} source Registro da origem.
 * @param {Record<string, unknown>} target Registro do destino.
 * @param {string[]} fields Contadores a somar.
 * @return {Record<string, number>} Contadores consolidados.
 */
export function sumNumericCounters(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  fields: readonly string[],
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const field of fields) {
    const s = source[field];
    const t = target[field];
    const sNum = typeof s === "number" && Number.isFinite(s) ? s : undefined;
    const tNum = typeof t === "number" && Number.isFinite(t) ? t : undefined;
    if (sNum === undefined && tNum === undefined) continue;
    merged[field] = (sNum ?? 0) + (tNum ?? 0);
  }
  return merged;
}
