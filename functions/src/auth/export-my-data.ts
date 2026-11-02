/**
 * EXPORT MY DATA — #4482 (LGPD art. 18, V: portabilidade)
 *
 * Callable `exportMyData`, chamada pela web (services/cloudFunctions.ts).
 * Sem payload; o uid vem só de `request.auth.uid`. Devolve um JSON único
 * com os dados do titular. Spec: specs/FEATURE_4482_EXPORT_MY_DATA.md.
 *
 * IRMÃOS: a exclusão (`onUserDeleted` em account-cleanup.ts, mais
 * account-deletion-cascade.ts) e o merge (account-merge.ts) enumeram o mesmo
 * conjunto de coleções. Quando cada irmão tinha a própria lista, um virava o
 * ponto cego do outro (#4112/#4113). Por isso:
 * - campos e caminhos vêm de `uid-owned-collections.ts` (verificados contra
 *   os ESCRITORES reais), nunca digitados aqui;
 * - `EXPORT_SOURCES` é declarativo e os leitores consultam exatamente os
 *   `uidFields` declarados em cada fonte;
 * - functions/test/auth/export-my-data.test.ts falha se uma coleção do mapa,
 *   do cleanup, da cascata ou do merge ficar fora daqui sem motivo em
 *   `EXPORT_EXCLUSIONS`.
 *
 * Terceiros: documentos compartilhados (jogos, grupos, caixa, avaliações,
 * votos, convites, notificações, mensagens) passam por ALLOWLIST. Campo novo
 * num escritor não vaza sozinho. Votos e avaliações RECEBIDOS não revelam
 * quem votou/avaliou.
 *
 * Entrega: retorno direto (sem cópia no Storage). `getSignedUrl` depende de
 * signBlob, removido pelo #4083, e o download token do Firebase não expira.
 * Teto de MAX_EXPORT_BYTES; acima disso as maiores listas são cortadas e
 * marcadas em `truncated_sources`.
 *
 * Falha de uma fonte (ex.: índice COLLECTION_GROUP ainda não publicado ⇒
 * FAILED_PRECONDITION) não derruba a exportação nem é engolida: entra em
 * `incomplete_sources` e `complete` vira false.
 */

import {HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {createHash} from "crypto";
import {db} from "../_db";
import {getStorage} from "../utils/firebase-lazy";
import {secureCallable} from "../middleware/secure-callable-wrapper";
import {
  ACTIVITIES,
  AUDIT_LOGS,
  CASHBOX,
  GROUP_INVITES,
  GROUP_MEMBERS,
  GROUPS,
  LOCATION_REVIEWS,
  MONTHLY_PAYERS,
  MVP_VOTES,
  POST_GAME_REPUTATION,
  SEASON_PARTICIPATION,
  STATISTICS,
  USER_BADGES,
  USER_GROUP_LINKS,
  USER_STREAKS,
  XP_LOGS,
  redactNameInText,
} from "./uid-owned-collections";

type Firestore = FirebaseFirestore.Firestore;
type Query = FirebaseFirestore.Query;
type DocumentSnapshot = FirebaseFirestore.DocumentSnapshot;
type QueryDocumentSnapshot = FirebaseFirestore.QueryDocumentSnapshot;
type DocumentData = FirebaseFirestore.DocumentData;
type JsonObject = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Limites
// ---------------------------------------------------------------------------

/** Versão do formato do arquivo. Mudança incompatível ⇒ incrementar. */
export const EXPORT_SCHEMA_VERSION = 1;

/** Tamanho de página das consultas (mesmo do cleanup). */
export const PAGE_SIZE = 500;

/** Teto de documentos por fonte; acima disso a fonte sai `truncated`. */
export const MAX_DOCS_PER_SOURCE = 5000;

/** Guarda contra laço sem avanço de cursor (mesmo teto do #2323). */
const MAX_PAGE_ITERATIONS = 1000;

/**
 * Teto do JSON serializado. A resposta HTTP de Cloud Run functions aceita
 * 32 MiB; 8 MiB deixa folga para o envelope da callable e para o navegador.
 */
export const MAX_EXPORT_BYTES = 8 * 1024 * 1024;

/** Limite diário por usuário (rate-limiter.ts). */
export const EXPORT_RATE_LIMIT = {
  maxRequests: 3,
  windowMs: 24 * 60 * 60 * 1000,
  keyPrefix: "export_my_data",
} as const;

/** Timeout da função; a web usa o mesmo valor no httpsCallable. */
export const EXPORT_TIMEOUT_SECONDS = 180;

// ---------------------------------------------------------------------------
// Allowlists de documentos compartilhados (nunca denylist)
// ---------------------------------------------------------------------------

export const ALLOWLISTS = {
  /** notifications/helpers.ts:968-981 — sem sender_id/sender_name/created_by. */
  notifications: ["type", "title", "body", "game_id", "group_id", "action", "read", "read_at", "created_at"],
  /** GameSummonRepositoryImpl.kt:76-88 — sem summoned_by/summoned_by_name. */
  gameSummons: ["game_id", "group_id", "status", "summoned_at", "responded_at", "updated_at"],
  /** InvitePlayersScreen.tsx:229-240 — sem o nome/uid/foto do outro lado. */
  groupInvites: ["group_id", "group_name", "status", "created_at", "updated_at", "responded_at", "expires_at"],
  /** Grupos de que o titular é dono — sem `members` (uids de terceiros). */
  ownedGroups: [
    "name", "description", "status", "city", "state", "neighborhood", "photo_url", "logo_url",
    "visibility", "is_public", "created_at", "updated_at", "deleted_at",
    ...GROUPS.ownerIdFields, ...Object.values(GROUPS.ownerNameByIdField),
  ],
  /** mvp-voting.ts:556 — nem em quem o titular votou, nem quem votou nele. */
  mvpVotes: ["game_id", "category", "created_at", "voted_at"],
  /** Escritores de audit_logs variam; só o que descreve o evento. */
  auditLogs: ["action", "type", "status", "source", "created_at", "timestamp"],
  /** cashbox/callable.ts:420-437 — sem *_name e sem receipt_url. */
  cashbox: [
    "group_id", "type", "amount", "amount_cents", "description", "category", "custom_category",
    "status", "reference_date", "game_id", "created_at", "updated_at", "voided_at",
  ],
  /** post-game-reputation.ts:485-500 — avaliações que o titular FEZ. */
  reputationGiven: [
    "game_id", "group_id", "punctuality", "respect", "commitment", "overall", "comment",
    "created_at", "updated_at",
  ],
  /** Avaliações que o titular RECEBEU: só notas (comentário pode identificar o avaliador). */
  reputationReceived: [
    "game_id", "group_id", "punctuality", "respect", "commitment", "overall", "created_at", "updated_at",
  ],
  /** useGames.ts:586-605 — sem players/co_organizers/owner_id de terceiros. */
  games: [
    "name", "title", "date", "time", "end_time", "date_time", "dateTime", "status", "group_id",
    "group_name", "location_id", "location_name", "location_address", "field_id", "field_name",
    "field_type", "gender", "visibility", "is_public", "max_players", "daily_price",
    "price_per_player", "team1_score", "team2_score", "created_at", "updated_at", "deleted_at",
  ],
  /** Locais de que o titular é dono/gestor — sem managers/owner_id. */
  locations: [
    "name", "description", "address", "city", "state", "neighborhood", "zip_code", "phone",
    "whatsapp", "instagram", "website", "is_active", "status", "created_at", "updated_at",
  ],
  schedules: [
    "name", "group_id", "day_of_week", "time", "start_time", "end_time", "duration", "location_id",
    "location_name", "field_name", "recurrence", "frequency", "status", "is_active",
    "created_at", "updated_at",
  ],
  /** direct-messages.ts:516-523 — só o que o titular escreveu. */
  messages: ["text", "created_at", "updated_at", "edited_at", "deleted", "deleted_at"],
  /** game_photos / game_videos — metadados do upload, sem bytes. */
  gameMedia: [
    "game_id", "caption", "storage_path", "content_type", "size", "duration", "status",
    "thumbnail_path", "created_at", "updated_at",
  ],
  /** push-token-registry.ts — plataforma e datas, nunca o token. */
  pushDevices: ["platform", "created_at", "updated_at", "expires_at", "last_seen_at", "app_version"],
} as const;

/** Campos de jogo que só o DONO recebe (o nome dele mesmo). */
const GAME_OWNER_ONLY_FIELDS = ["owner_name"];

/** Placeholder do nome de outra pessoa em texto livre (descrição do caixa). */
export const OTHER_PERSON_PLACEHOLDER = "[outra pessoa]";

// ---------------------------------------------------------------------------
// Registro declarativo das fontes (testado contra os irmãos)
// ---------------------------------------------------------------------------

export type ExportProjection = "own" | "allowlist" | "count" | "metadata";

export interface ExportSourceSpec {
  /** Chave em `data` no JSON exportado. */
  readonly key: string;
  /**
   * Coleção/caminho no MESMO formato de `UID_OWNED_COLLECTIONS.collection`
   * (subcoleções com `{uid}`/`{groupId}`).
   */
  readonly collection: string;
  /** Campos de uid consultados com igualdade. */
  readonly uidFields: readonly string[];
  /** Campos de uid consultados com array-contains (subconjunto de uidFields). */
  readonly arrayUidFields?: readonly string[];
  /** Lido também pelo ID do doc (esquema `{uid}`). */
  readonly byDocId?: boolean;
  /** Coleções/campos usados só para DESCOBRIR os docs (ex.: games.group_id). */
  readonly discovery?: ReadonlyArray<{readonly collection: string; readonly field: string}>;
  /** Subcoleções conhecidas (documentação; listCollections cobre as novas). */
  readonly knownSubcollections?: readonly string[];
  readonly projection: ExportProjection;
}

/** Subcoleções de users/{uid} exportadas só como contagem (terceiros). */
export const COUNT_ONLY_USER_SUBCOLLECTIONS = ["followers", "following"] as const;

export const EXPORT_SOURCES: readonly ExportSourceSpec[] = [
  {key: "profile", collection: "users", uidFields: [], byDocId: true, projection: "own"},
  {key: "private_profile", collection: "users_private", uidFields: [], byDocId: true, projection: "own"},
  {
    key: "user_subcollections",
    collection: "users/{uid}/*",
    uidFields: [],
    knownSubcollections: ["groups", "game_templates", "badges", "preferences", ...COUNT_ONLY_USER_SUBCOLLECTIONS],
    projection: "own",
  },
  {key: "confirmations", collection: "confirmations", uidFields: ["user_id", "userId"], projection: "own"},
  {key: "notifications", collection: "notifications", uidFields: ["user_id"], projection: "allowlist"},
  {key: "game_summons", collection: "game_summons", uidFields: ["user_id"], projection: "allowlist"},
  {
    key: "group_invites_received",
    collection: GROUP_INVITES.collection,
    uidFields: GROUP_INVITES.invitedUserFields,
    projection: "allowlist",
  },
  {
    key: "group_invites_sent",
    collection: GROUP_INVITES.collection,
    uidFields: [GROUP_INVITES.inviterField],
    projection: "allowlist",
  },
  {key: "owned_groups", collection: GROUPS.collection, uidFields: GROUPS.ownerIdFields, projection: "allowlist"},
  {
    key: "group_memberships",
    collection: "groups/{groupId}/members",
    uidFields: [GROUP_MEMBERS.uidField],
    byDocId: true,
    discovery: [{collection: GROUPS.membersSubcollection, field: GROUP_MEMBERS.uidField}],
    projection: "own",
  },
  {
    key: "statistics",
    collection: STATISTICS.collection,
    uidFields: [STATISTICS.legacyUidField],
    byDocId: true,
    projection: "own",
  },
  {key: "xp_logs", collection: XP_LOGS.collection, uidFields: [XP_LOGS.uidField], projection: "own"},
  {key: "user_badges", collection: USER_BADGES.collection, uidFields: [USER_BADGES.uidField], projection: "own"},
  {
    key: "season_participation",
    collection: SEASON_PARTICIPATION.collection,
    uidFields: [SEASON_PARTICIPATION.uidField],
    projection: "own",
  },
  {
    key: "mvp_votes_cast",
    collection: MVP_VOTES.collection,
    uidFields: [MVP_VOTES.voterField],
    projection: "allowlist",
  },
  {
    key: "mvp_votes_received",
    collection: MVP_VOTES.collection,
    uidFields: [MVP_VOTES.votedPlayerField],
    projection: "allowlist",
  },
  {key: "activities", collection: ACTIVITIES.collection, uidFields: [ACTIVITIES.uidField], projection: "own"},
  {
    key: "user_streaks",
    collection: USER_STREAKS.collection,
    uidFields: [USER_STREAKS.uidField],
    byDocId: true,
    projection: "own",
  },
  {
    key: "audit_logs",
    collection: AUDIT_LOGS.collection,
    // `userId` (gravado pelo secureCallable/logAudit) vem de otherUidFields,
    // o mesmo mapa que o onUserDeleted varre (#4487).
    uidFields: [AUDIT_LOGS.targetField, AUDIT_LOGS.actorField, ...AUDIT_LOGS.otherUidFields],
    projection: "allowlist",
  },
  {
    key: "cashbox_entries",
    collection: "groups/{groupId}/cashbox",
    uidFields: [CASHBOX.uidField, CASHBOX.playerIdField],
    projection: "allowlist",
  },
  {
    key: "monthly_finance_payers",
    collection: "groups/{groupId}/monthly_finance_periods/{periodKey}/payers",
    uidFields: [MONTHLY_PAYERS.uidField],
    byDocId: true,
    projection: "own",
  },
  {
    key: "location_reviews",
    collection: "locations/{locationId}/reviews",
    uidFields: [LOCATION_REVIEWS.uidField],
    projection: "own",
  },
  {
    key: "reputation_given",
    collection: POST_GAME_REPUTATION.collection,
    uidFields: [POST_GAME_REPUTATION.sides[0].uidField],
    projection: "allowlist",
  },
  {
    key: "reputation_received",
    collection: POST_GAME_REPUTATION.collection,
    uidFields: [POST_GAME_REPUTATION.sides[1].uidField],
    projection: "allowlist",
  },
  {
    key: "games",
    collection: "games",
    uidFields: ["owner_id", "co_organizers"],
    arrayUidFields: ["co_organizers"],
    projection: "allowlist",
  },
  {
    key: "locations",
    collection: "locations",
    uidFields: ["owner_id", "managers"],
    arrayUidFields: ["managers"],
    projection: "allowlist",
  },
  {key: "schedules", collection: "schedules", uidFields: ["owner_id"], projection: "allowlist"},
  {
    key: "game_waitlist",
    collection: "games/{gameId}/waitlist",
    uidFields: ["user_id"],
    byDocId: true,
    discovery: [{collection: "games", field: "group_id"}],
    projection: "own",
  },
  {
    key: "direct_messages_sent",
    collection: "chats/{chatId}/messages",
    uidFields: ["sender_id"],
    discovery: [{collection: "chats", field: "participants"}],
    projection: "allowlist",
  },
  {key: "game_photos", collection: "game_photos", uidFields: ["uploaded_by"], projection: "allowlist"},
  {key: "game_videos", collection: "game_videos", uidFields: ["uploaded_by"], projection: "allowlist"},
  {key: "push_tokens", collection: "push_tokens", uidFields: ["userId"], projection: "metadata"},
  {key: "push_token_devices", collection: "push_token_devices", uidFields: ["userId"], projection: "metadata"},
  {
    key: "notification_settings",
    collection: "notification_settings",
    uidFields: [],
    byDocId: true,
    projection: "own",
  },
  {key: "user_location", collection: "user_locations", uidFields: [], byDocId: true, projection: "own"},
  {key: "session", collection: "sessions", uidFields: [], byDocId: true, projection: "own"},
  {
    key: "storage_files",
    // Prefixos do Storage apagados pelo onUserDeleted (passo 20).
    collection: "storage:users/{uid}/|profile_photos/{uid}.|profile_photos/thumbnails/{uid}_thumb",
    uidFields: [],
    projection: "metadata",
  },
];

/**
 * Coleções que a exclusão ou o merge tocam e que a exportação deixa de fora
 * DE PROPÓSITO. O teste exige motivo para cada uma.
 */
export const EXPORT_EXCLUSIONS: Readonly<Record<string, string>> = {
  cpf_index: "Índice derivado (chave = hash do CPF); o dado fornecido sai em private_profile.",
  phone_index: "Índice derivado (chave = hash do telefone); o dado fornecido sai em private_profile.",
  rate_limits: "Contador operacional efêmero; não é dado fornecido pelo titular.",
  verification_failures:
    "Registro antifraude da verificação, mantido para prevenção à fraude (LGPD art. 11, II, g).",
  live_games: "Estado efêmero de partida ao vivo; o resultado consolidado sai em games/confirmations.",
  live_scores: "Estado efêmero de placar ao vivo; o resultado consolidado sai em games/confirmations.",
  account_aliases: "Registro técnico da união de contas; só contém uids do próprio titular.",
  account_merge_requests: "Registro técnico da união de contas; só contém uids do próprio titular.",
};

// ---------------------------------------------------------------------------
// Serialização
// ---------------------------------------------------------------------------

const MAX_SERIALIZE_DEPTH = 32;

/**
 * Converte valores do Firestore em JSON puro: Timestamp/Date ⇒ ISO 8601 UTC,
 * GeoPoint ⇒ {latitude, longitude}, DocumentReference ⇒ caminho, bytes ⇒
 * base64, número não finito ⇒ null. Duck typing de propósito: funciona com
 * o Admin SDK e com os fakes dos testes.
 *
 * @param {unknown} value valor lido do Firestore
 * @param {number} depth profundidade atual (guarda contra ciclo)
 * @return {unknown} valor serializável em JSON
 */
export function toJsonSafe(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (depth > MAX_SERIALIZE_DEPTH) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  if (Array.isArray(value)) return value.map((item) => toJsonSafe(item, depth + 1));

  const record = value as Record<string, unknown>;
  if (typeof record.toDate === "function" && typeof record.toMillis === "function") {
    const date = (record.toDate as () => Date)();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  }
  if (
    typeof record.latitude === "number" &&
    typeof record.longitude === "number" &&
    typeof record.isEqual === "function"
  ) {
    return {latitude: record.latitude, longitude: record.longitude};
  }
  if (typeof record.path === "string" && "firestore" in record && "parent" in record) {
    return record.path;
  }
  const out: JsonObject = {};
  for (const [key, item] of Object.entries(record)) {
    out[key] = toJsonSafe(item, depth + 1);
  }
  return out;
}

/** Chaves que funcionam como credencial ou índice derivado. */
const CREDENTIAL_KEY_PATTERN = /token|hash$|password|secret/i;

/**
 * Remove (recursivamente) chaves de credencial/índice derivado de um
 * documento já serializado: fcm_token, tokens push, cpfHash, phoneHash.
 *
 * @param {unknown} value valor JSON
 * @return {unknown} valor sem credenciais
 */
export function stripCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCredentials);
  if (value === null || typeof value !== "object") return value;
  const out: JsonObject = {};
  for (const [key, item] of Object.entries(value as JsonObject)) {
    if (CREDENTIAL_KEY_PATTERN.test(key)) continue;
    out[key] = stripCredentials(item);
  }
  return out;
}

/**
 * @param {DocumentData} data documento
 * @param {readonly string[]} fields allowlist
 * @return {JsonObject} só os campos permitidos presentes no doc
 */
export function pickFields(data: DocumentData, fields: readonly string[]): JsonObject {
  const out: JsonObject = {};
  for (const field of fields) {
    if (field in data) out[field] = toJsonSafe(data[field]);
  }
  return out;
}

/**
 * @param {DocumentSnapshot} snap documento
 * @return {JsonObject} identificação do documento no Firestore
 */
function docMeta(snap: DocumentSnapshot): JsonObject {
  return {document_id: snap.id, document_path: snap.ref.path};
}

/**
 * Documento do próprio titular: inteiro, sem credenciais.
 *
 * @param {DocumentSnapshot} snap documento
 * @return {JsonObject} item exportado
 */
function ownItem(snap: DocumentSnapshot): JsonObject {
  const data = stripCredentials(toJsonSafe(snap.data() ?? {})) as JsonObject;
  return {...data, ...docMeta(snap)};
}

/**
 * Documento compartilhado: só a allowlist.
 *
 * @param {DocumentSnapshot} snap documento
 * @param {readonly string[]} fields allowlist
 * @param {JsonObject} extra campos calculados (papel do titular)
 * @return {JsonObject} item exportado
 */
function allowlistItem(
  snap: DocumentSnapshot,
  fields: readonly string[],
  extra: JsonObject = {},
): JsonObject {
  return {...pickFields(snap.data() ?? {}, fields), ...extra, ...docMeta(snap)};
}

// ---------------------------------------------------------------------------
// Leitura paginada
// ---------------------------------------------------------------------------

interface Collected {
  snap: DocumentSnapshot;
  /** Campos de uid que casaram (papel do titular no doc). */
  matchedBy: Set<string>;
}

/** Acumula documentos de uma fonte com dedup por caminho e teto. */
class Collector {
  readonly docs = new Map<string, Collected>();
  truncated = false;

  /**
   * @param {DocumentSnapshot} snap documento
   * @param {string} matchedBy campo que casou (opcional)
   * @return {boolean} false quando o teto foi atingido
   */
  add(snap: DocumentSnapshot, matchedBy?: string): boolean {
    const existing = this.docs.get(snap.ref.path);
    if (existing) {
      if (matchedBy) existing.matchedBy.add(matchedBy);
      return true;
    }
    if (this.docs.size >= MAX_DOCS_PER_SOURCE) {
      this.truncated = true;
      return false;
    }
    this.docs.set(snap.ref.path, {snap, matchedBy: new Set(matchedBy ? [matchedBy] : [])});
    return true;
  }

  /** @return {Collected[]} documentos em ordem de caminho */
  values(): Collected[] {
    return [...this.docs.values()].sort((a, b) =>
      a.snap.ref.path < b.snap.ref.path ? -1 : a.snap.ref.path > b.snap.ref.path ? 1 : 0);
  }
}

/**
 * Pagina uma consulta por cursor (startAfter), sem orderBy: reusa a ordem
 * implícita por __name__ do índice single-field (mesmo padrão do cleanup).
 *
 * @param {Query} query consulta base
 * @param {function} onDoc recebe cada doc; false interrompe
 * @return {Promise<void>}
 */
async function forEachDoc(
  query: Query,
  onDoc: (doc: QueryDocumentSnapshot) => boolean,
): Promise<void> {
  let last: QueryDocumentSnapshot | null = null;
  for (let iteration = 1; iteration <= MAX_PAGE_ITERATIONS; iteration++) {
    let page = query.limit(PAGE_SIZE);
    if (last) page = page.startAfter(last);
    const snap = await page.get();
    for (const doc of snap.docs) {
      if (!onDoc(doc)) return;
    }
    if (snap.size < PAGE_SIZE) return;
    last = snap.docs[snap.docs.length - 1];
  }
  throw new Error(`Limite de ${MAX_PAGE_ITERATIONS} páginas excedido`);
}

/**
 * @param {Query} query consulta
 * @param {Collector} into destino
 * @param {string} matchedBy campo que casou
 * @return {Promise<void>}
 */
function drainInto(query: Query, into: Collector, matchedBy?: string): Promise<void> {
  return forEachDoc(query, (doc) => into.add(doc, matchedBy));
}

/**
 * @param {Query} query consulta
 * @return {Promise<string[]>} ids (até MAX_DOCS_PER_SOURCE)
 */
async function collectIds(query: Query): Promise<string[]> {
  const ids: string[] = [];
  await forEachDoc(query.select(), (doc) => {
    ids.push(doc.id);
    return ids.length < MAX_DOCS_PER_SOURCE;
  });
  return ids;
}

/**
 * Lê documentos pelo caminho em blocos e adiciona os existentes.
 *
 * @param {Firestore} firestore Firestore
 * @param {string[]} paths caminhos
 * @param {Collector} into destino
 * @return {Promise<void>}
 */
async function getExistingInto(firestore: Firestore, paths: string[], into: Collector): Promise<void> {
  const unique = [...new Set(paths)];
  for (let i = 0; i < unique.length; i += 100) {
    const snaps = await Promise.all(unique.slice(i, i + 100).map((path) => firestore.doc(path).get()));
    for (const snap of snaps) {
      if (snap.exists && !into.add(snap)) return;
    }
  }
}

/**
 * Consulta uma coleção por TODOS os campos de uid da fonte.
 *
 * @param {Firestore} firestore Firestore
 * @param {ExportSourceSpec} spec fonte
 * @param {string} uid titular
 * @param {Collector} into destino
 * @param {string} collectionPath caminho concreto (default: spec.collection)
 * @return {Promise<void>}
 */
async function queryByUidFields(
  firestore: Firestore,
  spec: ExportSourceSpec,
  uid: string,
  into: Collector,
  collectionPath: string = spec.collection,
): Promise<void> {
  const arrayFields = new Set(spec.arrayUidFields ?? []);
  for (const field of spec.uidFields) {
    const op = arrayFields.has(field) ? "array-contains" : "==";
    await drainInto(firestore.collection(collectionPath).where(field, op, uid), into, field);
  }
}

// ---------------------------------------------------------------------------
// Execução das fontes
// ---------------------------------------------------------------------------

export interface SourceIssue {
  source: string;
  reason: string;
}

interface SourceOutput {
  value: unknown;
  truncated?: boolean;
  /** Problemas parciais (a fonte devolveu algo, mas não tudo). */
  issues?: SourceIssue[];
}

interface ExportContext {
  firestore: Firestore;
  uid: string;
  /** Lista arquivos do Storage por prefixo (injetável nos testes). */
  listStorageFiles: (prefix: string) => Promise<StorageFileInfo[]>;
  groups: Promise<GroupDiscovery> | null;
}

export interface StorageFileInfo {
  name: string;
  contentType?: string | null;
  size?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface GroupDiscovery {
  groupIds: string[];
  issues: SourceIssue[];
}

const GRPC_CODE_NAMES: Readonly<Record<number, string>> = {
  1: "CANCELLED",
  2: "UNKNOWN",
  3: "INVALID_ARGUMENT",
  4: "DEADLINE_EXCEEDED",
  5: "NOT_FOUND",
  7: "PERMISSION_DENIED",
  8: "RESOURCE_EXHAUSTED",
  9: "FAILED_PRECONDITION",
  10: "ABORTED",
  13: "INTERNAL",
  14: "UNAVAILABLE",
};

/**
 * Motivo legível e sem conteúdo de documento (vai para o arquivo e o log).
 *
 * @param {unknown} error erro capturado
 * @return {string} código gRPC ou "ERROR"
 */
export function reasonOf(error: unknown): string {
  const code = (error as {code?: unknown} | null)?.code;
  if (typeof code === "number") return GRPC_CODE_NAMES[code] ?? `CODE_${code}`;
  if (typeof code === "string" && code.length > 0) return code.toUpperCase();
  return "ERROR";
}

/**
 * Grupos do titular: espelho users/{uid}/groups (escopo COLLECTION, sempre
 * indexado) + collectionGroup("members").user_id (alcança grupos que ele
 * deixou; depende do fieldOverride members.user_id). Mesmo par usado pelo
 * onUserDeleted (USER_GROUP_LINKS + discoverMemberGroupIds).
 *
 * @param {ExportContext} ctx contexto
 * @return {Promise<GroupDiscovery>} grupos e problemas
 */
function discoverGroups(ctx: ExportContext): Promise<GroupDiscovery> {
  if (ctx.groups) return ctx.groups;
  ctx.groups = (async () => {
    const groupIds = new Set<string>();
    const issues: SourceIssue[] = [];
    try {
      for (const id of await collectIds(ctx.firestore.collection(USER_GROUP_LINKS.path(ctx.uid)))) {
        groupIds.add(id);
      }
    } catch (error) {
      issues.push({source: "group_discovery:users_groups", reason: reasonOf(error)});
    }
    try {
      await forEachDoc(
        ctx.firestore.collectionGroup(GROUPS.membersSubcollection).where(GROUP_MEMBERS.uidField, "==", ctx.uid),
        (doc) => {
          const parts = doc.ref.path.split("/");
          if (parts.length === 4 && parts[0] === GROUPS.collection) groupIds.add(parts[1]);
          return groupIds.size < MAX_DOCS_PER_SOURCE;
        },
      );
    } catch (error) {
      issues.push({source: "group_discovery:members_collection_group", reason: reasonOf(error)});
    }
    return {groupIds: [...groupIds].sort(), issues};
  })();
  return ctx.groups;
}

/**
 * @param {Collector} collector documentos
 * @param {function} map projeção
 * @return {SourceOutput} lista projetada
 */
function listOutput(collector: Collector, map: (item: Collected) => JsonObject): SourceOutput {
  return {value: collector.values().map(map), truncated: collector.truncated};
}

/**
 * @param {Set<string>} matchedBy campos que casaram
 * @return {JsonObject} papel do titular no doc
 */
function roleOf(matchedBy: Set<string>): JsonObject {
  return {matched_by: [...matchedBy].sort()};
}

type SourceRunner = (ctx: ExportContext, spec: ExportSourceSpec) => Promise<SourceOutput>;

/** Lê pelo ID `{collection}/{uid}`; doc inexistente ⇒ null. */
const byIdOwn: SourceRunner = async (ctx, spec) => {
  const snap = await ctx.firestore.doc(`${spec.collection}/${ctx.uid}`).get();
  return {value: snap.exists ? ownItem(snap) : null};
};

/** Consulta por todos os uidFields; projeção do próprio titular. */
const queryOwn: SourceRunner = async (ctx, spec) => {
  const collector = new Collector();
  if (spec.byDocId) {
    await getExistingInto(ctx.firestore, [`${spec.collection}/${ctx.uid}`], collector);
  }
  await queryByUidFields(ctx.firestore, spec, ctx.uid, collector);
  return listOutput(collector, (item) => ({...ownItem(item.snap), ...roleOf(item.matchedBy)}));
};

/**
 * Consulta por todos os uidFields; projeção por allowlist.
 *
 * @param {readonly string[]} fields allowlist
 * @param {boolean} withRole inclui `matched_by`
 * @return {SourceRunner} leitor
 */
function queryAllowlist(fields: readonly string[], withRole = false): SourceRunner {
  return async (ctx, spec) => {
    const collector = new Collector();
    await queryByUidFields(ctx.firestore, spec, ctx.uid, collector);
    return listOutput(collector, (item) =>
      allowlistItem(item.snap, fields, withRole ? roleOf(item.matchedBy) : {}));
  };
}

const RUNNERS: Readonly<Record<string, SourceRunner>> = {
  profile: byIdOwn,
  private_profile: byIdOwn,
  notification_settings: byIdOwn,
  user_location: byIdOwn,
  session: byIdOwn,

  // Espelho do recursiveDelete de users/{uid}: listCollections cobre também
  // subcoleções futuras. followers/following só contam (uids de terceiros).
  user_subcollections: async (ctx) => {
    const subcollections = await ctx.firestore.doc(`users/${ctx.uid}`).listCollections();
    const value: JsonObject = {};
    let truncated = false;
    for (const sub of [...subcollections].sort((a, b) => a.id.localeCompare(b.id))) {
      if ((COUNT_ONLY_USER_SUBCOLLECTIONS as readonly string[]).includes(sub.id)) {
        const ids = await collectIds(sub);
        value[sub.id] = {count: ids.length};
        continue;
      }
      const collector = new Collector();
      await drainInto(sub, collector);
      truncated = truncated || collector.truncated;
      value[sub.id] = collector.values().map((item) => ownItem(item.snap));
    }
    return {value, truncated};
  },

  confirmations: queryOwn,
  statistics: queryOwn,
  xp_logs: queryOwn,
  user_badges: queryOwn,
  season_participation: queryOwn,
  activities: queryOwn,
  user_streaks: queryOwn,

  notifications: queryAllowlist(ALLOWLISTS.notifications),
  game_summons: queryAllowlist(ALLOWLISTS.gameSummons),
  group_invites_received: queryAllowlist(ALLOWLISTS.groupInvites),
  group_invites_sent: queryAllowlist(ALLOWLISTS.groupInvites),
  owned_groups: queryAllowlist(ALLOWLISTS.ownedGroups),
  mvp_votes_cast: queryAllowlist(ALLOWLISTS.mvpVotes),
  mvp_votes_received: queryAllowlist(ALLOWLISTS.mvpVotes),
  audit_logs: queryAllowlist(ALLOWLISTS.auditLogs, true),
  reputation_given: queryAllowlist(ALLOWLISTS.reputationGiven),
  reputation_received: queryAllowlist(ALLOWLISTS.reputationReceived),
  locations: queryAllowlist(ALLOWLISTS.locations, true),
  schedules: queryAllowlist(ALLOWLISTS.schedules),
  game_photos: queryAllowlist(ALLOWLISTS.gameMedia),
  game_videos: queryAllowlist(ALLOWLISTS.gameMedia),
  push_tokens: queryAllowlist(ALLOWLISTS.pushDevices),
  push_token_devices: queryAllowlist(ALLOWLISTS.pushDevices),

  games: async (ctx, spec) => {
    const collector = new Collector();
    await queryByUidFields(ctx.firestore, spec, ctx.uid, collector);
    return listOutput(collector, (item) => {
      const isOwner = item.matchedBy.has("owner_id");
      const fields = isOwner ? [...ALLOWLISTS.games, ...GAME_OWNER_ONLY_FIELDS] : ALLOWLISTS.games;
      return allowlistItem(item.snap, fields, roleOf(item.matchedBy));
    });
  },

  group_memberships: async (ctx) => {
    const {groupIds, issues} = await discoverGroups(ctx);
    const collector = new Collector();
    await getExistingInto(
      ctx.firestore,
      groupIds.map((groupId) => GROUP_MEMBERS.path(groupId, ctx.uid)),
      collector,
    );
    return {...listOutput(collector, (item) => ownItem(item.snap)), issues};
  },

  // collectionGroup(cashbox).created_by alcança grupos fora do espelho; por
  // grupo, created_by e player_id em escopo COLLECTION (índice automático).
  cashbox_entries: async (ctx, spec) => {
    const collector = new Collector();
    const issues: SourceIssue[] = [];
    try {
      await drainInto(
        ctx.firestore.collectionGroup(CASHBOX.collectionGroup).where(CASHBOX.uidField, "==", ctx.uid),
        collector,
        CASHBOX.uidField,
      );
    } catch (error) {
      issues.push({source: "cashbox_entries:collection_group", reason: reasonOf(error)});
    }
    const discovery = await discoverGroups(ctx);
    issues.push(...discovery.issues);
    for (const groupId of discovery.groupIds) {
      await queryByUidFields(ctx.firestore, spec, ctx.uid, collector, CASHBOX.path(groupId));
    }
    const output = listOutput(collector, (item) => {
      const data = item.snap.data() ?? {};
      const projected = allowlistItem(item.snap, ALLOWLISTS.cashbox, roleOf(item.matchedBy));
      // A descrição livre pode repetir o nome do pagador ("Pagamento de X").
      // Quando o pagador é outra pessoa, o nome dela sai do texto.
      const playerName = data[CASHBOX.playerNameField];
      const description = projected[CASHBOX.descriptionField];
      if (
        data[CASHBOX.playerIdField] !== ctx.uid &&
        typeof playerName === "string" &&
        typeof description === "string"
      ) {
        projected[CASHBOX.descriptionField] = redactNameInText(description, playerName, OTHER_PERSON_PLACEHOLDER);
      }
      return projected;
    });
    return {...output, issues};
  },

  monthly_finance_payers: async (ctx) => {
    const {groupIds, issues} = await discoverGroups(ctx);
    const collector = new Collector();
    for (const groupId of groupIds) {
      const periodKeys = await collectIds(ctx.firestore.collection(MONTHLY_PAYERS.periodsPath(groupId)));
      await getExistingInto(
        ctx.firestore,
        periodKeys.map((periodKey) => MONTHLY_PAYERS.path(groupId, periodKey, ctx.uid)),
        collector,
      );
    }
    return {...listOutput(collector, (item) => ownItem(item.snap)), issues};
  },

  // Sem alternativa em escopo COLLECTION: depende do fieldOverride
  // reviews.user_id (COLLECTION_GROUP). Sem ele ⇒ incomplete_sources.
  location_reviews: async (ctx) => {
    const collector = new Collector();
    await drainInto(
      ctx.firestore.collectionGroup(LOCATION_REVIEWS.collectionGroup)
        .where(LOCATION_REVIEWS.uidField, "==", ctx.uid),
      collector,
    );
    return listOutput(collector, (item) => ownItem(item.snap));
  },

  // Mesmo caminho do removeWaitlistEntries: jogos dos grupos do titular e a
  // entrada lida pelo ID (não há índice de collectionGroup em waitlist).
  game_waitlist: async (ctx) => {
    const {groupIds, issues} = await discoverGroups(ctx);
    const collector = new Collector();
    for (const groupId of groupIds) {
      const gameIds = await collectIds(ctx.firestore.collection("games").where("group_id", "==", groupId));
      await getExistingInto(
        ctx.firestore,
        gameIds.map((gameId) => `games/${gameId}/waitlist/${ctx.uid}`),
        collector,
      );
    }
    return {...listOutput(collector, (item) => ownItem(item.snap)), issues};
  },

  direct_messages_sent: async (ctx) => {
    const chatIds = await collectIds(
      ctx.firestore.collection("chats").where("participants", "array-contains", ctx.uid),
    );
    const collector = new Collector();
    for (const chatId of chatIds) {
      await drainInto(
        ctx.firestore.collection(`chats/${chatId}/messages`).where("sender_id", "==", ctx.uid),
        collector,
      );
      if (collector.truncated) break;
    }
    return listOutput(collector, (item) =>
      allowlistItem(item.snap, ALLOWLISTS.messages, {chat_id: item.snap.ref.path.split("/")[1]}));
  },

  storage_files: async (ctx) => {
    const prefixes = [
      `users/${ctx.uid}/`,
      `profile_photos/thumbnails/${ctx.uid}_thumb`,
      `profile_photos/${ctx.uid}.`,
    ];
    const files: StorageFileInfo[] = [];
    for (const prefix of prefixes) {
      files.push(...await ctx.listStorageFiles(prefix));
    }
    return {value: files.sort((a, b) => a.name.localeCompare(b.name))};
  },
};

/**
 * Lista arquivos do bucket padrão (mesmo bucket do onUserDeleted, passo 20).
 *
 * @param {string} prefix prefixo
 * @return {Promise<StorageFileInfo[]>} metadados, sem bytes
 */
async function listStorageFilesDefault(prefix: string): Promise<StorageFileInfo[]> {
  const bucketName = process.env.STORAGE_BUCKET || `${process.env.GCLOUD_PROJECT}.appspot.com`;
  const [files] = await getStorage().bucket(bucketName).getFiles({prefix, maxResults: MAX_DOCS_PER_SOURCE});
  return files.map((file) => {
    const metadata = (file.metadata ?? {}) as Record<string, unknown>;
    const size = Number(metadata.size);
    return {
      name: file.name,
      contentType: typeof metadata.contentType === "string" ? metadata.contentType : null,
      size: Number.isFinite(size) ? size : null,
      createdAt: typeof metadata.timeCreated === "string" ? metadata.timeCreated : null,
      updatedAt: typeof metadata.updated === "string" ? metadata.updated : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Montagem do arquivo
// ---------------------------------------------------------------------------

export interface ExportPayload {
  schema_version: number;
  format: string;
  generated_at: string;
  user_id: string;
  complete: boolean;
  incomplete_sources: SourceIssue[];
  truncated_sources: string[];
  counts: Record<string, number>;
  data: Record<string, unknown>;
}

/**
 * @param {unknown} value valor exportado de uma fonte
 * @return {number} número de itens
 */
function countOf(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value === null || value === undefined) return 0;
  if (typeof value === "object") {
    return Object.values(value as JsonObject).reduce<number>((sum, item) => {
      if (Array.isArray(item)) return sum + item.length;
      const count = (item as {count?: unknown} | null)?.count;
      return sum + (typeof count === "number" ? count : 1);
    }, 0);
  }
  return 1;
}

/**
 * @param {unknown} value valor
 * @return {number} bytes do JSON em UTF-8
 */
function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

/**
 * Garante o teto de bytes cortando pela metade a maior lista (de primeiro ou
 * segundo nível) até caber. Cada corte entra em `truncated_sources`.
 *
 * @param {ExportPayload} payload arquivo montado (mutado)
 * @param {number} maxBytes teto
 * @return {number} bytes finais
 */
export function enforceSizeCap(payload: ExportPayload, maxBytes: number = MAX_EXPORT_BYTES): number {
  let bytes = jsonBytes(payload);
  while (bytes > maxBytes) {
    let target: {holder: JsonObject; key: string; label: string; size: number} | null = null;
    for (const [key, value] of Object.entries(payload.data)) {
      const candidates: Array<{holder: JsonObject; key: string; label: string; list: unknown[]}> = [];
      if (Array.isArray(value)) {
        candidates.push({holder: payload.data, key, label: key, list: value});
      } else if (value && typeof value === "object") {
        for (const [subKey, subValue] of Object.entries(value as JsonObject)) {
          if (Array.isArray(subValue)) {
            candidates.push({holder: value as JsonObject, key: subKey, label: `${key}.${subKey}`, list: subValue});
          }
        }
      }
      for (const candidate of candidates) {
        if (candidate.list.length === 0) continue;
        const size = jsonBytes(candidate.list);
        if (!target || size > target.size) target = {...candidate, size};
      }
    }
    if (!target) break;
    const list = target.holder[target.key] as unknown[];
    target.holder[target.key] = list.slice(0, Math.floor(list.length / 2));
    if (!payload.truncated_sources.includes(target.label)) payload.truncated_sources.push(target.label);
    payload.complete = false;
    bytes = jsonBytes(payload);
  }
  return bytes;
}

export interface BuildExportOptions {
  listStorageFiles?: (prefix: string) => Promise<StorageFileInfo[]>;
  now?: Date;
  maxBytes?: number;
}

/**
 * Lê todas as fontes em paralelo e monta o arquivo.
 *
 * @param {Firestore} firestore Firestore
 * @param {string} uid titular
 * @param {BuildExportOptions} options injeções para testes
 * @return {Promise<{payload: ExportPayload, bytes: number}>} arquivo e tamanho
 */
export async function buildExport(
  firestore: Firestore,
  uid: string,
  options: BuildExportOptions = {},
): Promise<{payload: ExportPayload; bytes: number}> {
  const ctx: ExportContext = {
    firestore,
    uid,
    listStorageFiles: options.listStorageFiles ?? listStorageFilesDefault,
    groups: null,
  };

  const results = await Promise.all(EXPORT_SOURCES.map(async (spec) => {
    const runner = RUNNERS[spec.key];
    if (!runner) {
      return {spec, output: null as SourceOutput | null, error: "NO_RUNNER"};
    }
    try {
      return {spec, output: await runner(ctx, spec), error: null as string | null};
    } catch (error) {
      return {spec, output: null as SourceOutput | null, error: reasonOf(error)};
    }
  }));

  const payload: ExportPayload = {
    schema_version: EXPORT_SCHEMA_VERSION,
    format: "futeba-dos-parcas/export-my-data",
    generated_at: (options.now ?? new Date()).toISOString(),
    user_id: uid,
    complete: true,
    incomplete_sources: [],
    truncated_sources: [],
    counts: {},
    data: {},
  };

  const issueKeys = new Set<string>();
  const pushIssue = (issue: SourceIssue) => {
    const key = `${issue.source}|${issue.reason}`;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    payload.incomplete_sources.push(issue);
  };

  for (const {spec, output, error} of results) {
    if (error !== null || output === null) {
      pushIssue({source: spec.key, reason: error ?? "ERROR"});
      payload.data[spec.key] = null;
      payload.counts[spec.key] = 0;
      continue;
    }
    for (const issue of output.issues ?? []) pushIssue(issue);
    if (output.truncated) payload.truncated_sources.push(spec.key);
    payload.data[spec.key] = output.value;
    payload.counts[spec.key] = countOf(output.value);
  }

  const bytes = enforceSizeCap(payload, options.maxBytes ?? MAX_EXPORT_BYTES);
  payload.complete = payload.incomplete_sources.length === 0 && payload.truncated_sources.length === 0;
  return {payload, bytes};
}

/**
 * Hash do uid para logs (mesmo algoritmo de `hashUid` em delete-account.ts;
 * duplicado para não acoplar a callable de exclusão a esta).
 *
 * @param {string} uid uid
 * @return {string} SHA-256 hex
 */
function uidHash(uid: string): string {
  return createHash("sha256").update(uid, "utf8").digest("hex");
}

export const exportMyData = secureCallable<unknown, ExportPayload>(
  {
    rateLimit: {...EXPORT_RATE_LIMIT},
    // O audit do wrapper grava o uid cru e o IP em audit_logs.userId. Esta
    // callable grava o próprio registro, sem PII.
    enableAuditLog: false,
    // Leitura: o cliente pode repetir a chamada (timeout, rede) e o token
    // reaproveitado seria rejeitado como replay. App Check segue exigido.
    consumeAppCheckToken: false,
    timeoutSeconds: EXPORT_TIMEOUT_SECONDS,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      // O wrapper já exige auth; defesa em profundidade.
      throw new HttpsError("unauthenticated", "Faça login para baixar seus dados.");
    }

    const firestore = db();
    const startedAt = Date.now();
    const {payload, bytes} = await buildExport(firestore, uid);

    if (bytes > MAX_EXPORT_BYTES) {
      // Nada mais a cortar (ex.: um único doc gigante). Não devolve um
      // arquivo que o cliente não consegue receber.
      logger.error("[EXPORT_MY_DATA] Exportação acima do teto mesmo após cortes", {
        uidHash: uidHash(uid),
        bytes,
      });
      throw new HttpsError(
        "resource-exhausted",
        "Seus dados passaram do tamanho máximo de exportação. Fale com o suporte.",
        {reason: "export-too-large"},
      );
    }

    if (payload.incomplete_sources.length > 0) {
      logger.error("[EXPORT_MY_DATA] Fontes incompletas", {
        uidHash: uidHash(uid),
        incompleteSources: payload.incomplete_sources,
      });
    }

    try {
      // actor_user_id/target_user_id: apagados pelo onUserDeleted.
      await firestore.collection(AUDIT_LOGS.collection).add({
        action: "DATA_EXPORTED",
        source: "exportMyData",
        [AUDIT_LOGS.actorField]: uid,
        [AUDIT_LOGS.targetField]: uid,
        complete: payload.complete,
        source_count: Object.keys(payload.data).length,
        created_at: FieldValue.serverTimestamp(),
      });
    } catch (auditError) {
      logger.error("[EXPORT_MY_DATA] Falha ao gravar auditoria", {
        uidHash: uidHash(uid),
        error: reasonOf(auditError),
      });
    }

    logger.info("[EXPORT_MY_DATA] Exportação gerada", {
      uidHash: uidHash(uid),
      bytes,
      durationMs: Date.now() - startedAt,
      complete: payload.complete,
      counts: payload.counts,
      truncatedSources: payload.truncated_sources,
    });

    return payload;
  },
);
