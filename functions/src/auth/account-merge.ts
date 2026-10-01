/**
 * Account claim + merge request flow.
 *
 * Modern account merge rules:
 * - phone possession is proven by Firebase Phone Auth on the target account;
 * - source account possession is proven by a valid ID token captured before
 *   switching sessions;
 * - no destructive merge happens before CPF/phone invariants are satisfied;
 * - request IDs returned to clients never expose either UID.
 */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import * as crypto from "crypto";
import {db} from "../_db";
import {FUNCTION_REGION} from "../constants";
import {checkRateLimit} from "../middleware/rate-limiter";
import {getAuth} from "../utils/firebase-lazy";
import {hashPhoneIdentity} from "../validation/phone-identity";
import {
  loadIdentityIndexHashes,
  resolveLegacyIdentityHash,
} from "./identity-index";
import {isValidPhoneBR} from "../validation/phone-br";
import {getLevelForXp} from "../xp/pipeline";
import {
  ACTIVITIES,
  MVP_VOTES,
  SEASON_PARTICIPATION,
  STATISTICS,
  USER_BADGES,
  XP_LOGS,
  sumNumericCounters,
} from "./uid-owned-collections";

export {resolveLegacyIdentityHash} from "./identity-index";

type UserPrivateData = {
  cpfHash?: unknown;
  cpfMasked?: unknown;
  cpfVerifiedAt?: unknown;
  phoneHash?: unknown;
  phoneIndexHashes?: string[];
};

type CpfRelation =
  | "matched"
  | "missing_source"
  | "missing_target"
  | "missing_both";

const MERGE_REQUESTS_PER_HOUR = 3;
const COMPLETE_REQUESTS_PER_HOUR = 3;
const GOOGLE_PROVIDER_ID = "google.com";
const PROOF_TTL_MS = 15 * 60 * 1000;
const PROCESSING_LEASE_MS = 2 * 60 * 1000;
const MAX_DOCS_PER_QUERY = 500;

type MergeStatus = "pending_cpf" | "ready";

/**
 * FIX #4039: drena uma coleção de alto volume/baixo risco com cursor
 * (`startAfter`) em vez de aplicar o guard de saturação. Coleções como
 * `notifications`, `game_summons` e `group_invites` acumulam centenas de docs
 * não críticos e saturavam permanentemente o merge; aqui elas são lidas até
 * esvaziar (o excedente deixa de ser órfão).
 *
 * @param {FirebaseFirestore.Firestore} database Instância do Firestore.
 * @param {string} collection Nome da coleção.
 * @param {string} field Campo filtrado por igualdade.
 * @param {string} uid UID de origem.
 * @return {Promise<Object>} Documentos acumulados e contagem total.
 */
async function drainDocsByField(
  database: FirebaseFirestore.Firestore,
  collection: string,
  field: string,
  uid: string
): Promise<{
  docs: FirebaseFirestore.QueryDocumentSnapshot[];
  size: number;
}> {
  const docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let query = database
      .collection(collection)
      .where(field, "==", uid)
      .limit(MAX_DOCS_PER_QUERY);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snapshot = await query.get();
    if (snapshot.empty) break;

    docs.push(...snapshot.docs);
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.size < MAX_DOCS_PER_QUERY) break;
  }

  return {docs, size: docs.length};
}

/**
 * Deriva estado seguro do pedido pela relação dos CPFs privados.
 * @param {CpfRelation} relation Relação entre os hashes privados.
 * @return {MergeStatus} Estado do pedido.
 */
export function mergeStatus(relation: CpfRelation): MergeStatus {
  // A posse das duas sessões e do telefone do destino já foi provada. Portanto,
  // um CPF server-side presente em qualquer uma das contas pode ser transferido
  // para a identidade canônica; somente a ausência em ambas exige verificação.
  return relation !== "missing_both" ?
    "ready" :
    "pending_cpf";
}

/**
 * Impede uma nova solicitação de apagar o estado de um merge ainda em curso.
 *
 * @param {FirebaseFirestore.DocumentData|undefined} data Pedido existente.
 * @param {number} nowMs Momento atual.
 */
export function assertMergeRequestRefreshable(
  data: FirebaseFirestore.DocumentData | undefined,
  nowMs = Date.now(),
): void {
  const lease = data?.processingLeaseExpiresAt;
  if (
    data?.status === "processing" &&
    lease instanceof Timestamp &&
    lease.toMillis() > nowMs
  ) {
    throw new HttpsError(
      "aborted",
      "A união já está sendo processada.",
    );
  }
}

/**
 * Combina confirmações duplicadas de modo determinístico; timestamps mais
 * recentes vencem e o ID desempata replays com o mesmo timestamp.
 *
 * @param {{id: string, data: FirebaseFirestore.DocumentData}[]} records Registros.
 * @return {FirebaseFirestore.DocumentData} Payload consolidado.
 */
export function mergeConfirmationRecords(
  records: Array<{id: string; data: FirebaseFirestore.DocumentData}>,
): FirebaseFirestore.DocumentData {
  const ordered = [...records].sort((left, right) => {
    const leftTimestamp = left.data.updated_at ?? left.data.created_at;
    const rightTimestamp = right.data.updated_at ?? right.data.created_at;
    const leftMillis = typeof leftTimestamp?.toMillis === "function" ?
      leftTimestamp.toMillis() :
      0;
    const rightMillis = typeof rightTimestamp?.toMillis === "function" ?
      rightTimestamp.toMillis() :
      0;
    return leftMillis - rightMillis || left.id.localeCompare(right.id);
  });
  return Object.assign({}, ...ordered.map(({data}) => data));
}

/**
 * Une listas de strings sem duplicatas, tolerando valores ausentes.
 *
 * @param {unknown[]} lists Listas persistidas (podem não ser arrays).
 * @return {string[]} União ordenada por inserção.
 */
function unionStringLists(...lists: unknown[]): string[] {
  const merged = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === "string" && item.length > 0) merged.add(item);
    }
  }
  return [...merged];
}

/**
 * #4112: funde `statistics/{sourceUid}` em `statistics/{targetUid}`.
 *
 * Todo campo numérico é SOMADO (jogos, gols, assistências, cartões...) — o
 * destino pode já ter histórico próprio. Exceções vêm de
 * `STATISTICS.maxFields` (máximos históricos: maior vence) e
 * `STATISTICS.latestFields` (estado corrente: destino vence). Campos não
 * numéricos seguem a regra do perfil: destino vence, origem preenche
 * lacunas. Escritores gravam contadores camelCase (Functions) e snake_case
 * (Android legado) — cada chave é somada de forma independente, como os
 * leitores já toleram as duas grafias.
 *
 * @param {FirebaseFirestore.DocumentData} source Estatísticas da origem.
 * @param {FirebaseFirestore.DocumentData} target Estatísticas do destino.
 * @param {string} targetUid Identidade canônica.
 * @return {FirebaseFirestore.DocumentData} Documento consolidado.
 */
export function mergeStatisticsRecords(
  source: FirebaseFirestore.DocumentData,
  target: FirebaseFirestore.DocumentData,
  targetUid: string,
): FirebaseFirestore.DocumentData {
  const merged: FirebaseFirestore.DocumentData = {...source, ...target};
  const keys = new Set([...Object.keys(source), ...Object.keys(target)]);
  for (const key of keys) {
    const s = source[key];
    const t = target[key];
    const sNum = typeof s === "number" && Number.isFinite(s);
    const tNum = typeof t === "number" && Number.isFinite(t);
    if (!sNum || !tNum) {
      // Número só de um lado: copia (o spread já cobre o caso do destino).
      if (sNum && t === undefined) merged[key] = s;
      continue;
    }
    if (STATISTICS.maxFields.includes(key)) {
      merged[key] = Math.max(s, t);
    } else if (STATISTICS.latestFields.includes(key)) {
      merged[key] = t;
    } else {
      merged[key] = s + t;
    }
  }
  merged[STATISTICS.legacyUidField] = targetUid;
  merged.merged_from_alias = true;
  return merged;
}

/**
 * #4112: funde `season_participation/{seasonId}_{sourceUid}` no doc do
 * destino da mesma temporada. Contadores (`SEASON_PARTICIPATION.counterFields`)
 * são somados no nível plano e dentro de `by_gender.{G}`; `group_ids` é
 * unido; os demais campos (rating/divisão de liga, locks, timestamps)
 * seguem "destino vence, origem preenche".
 *
 * @param {FirebaseFirestore.DocumentData} source Participação da origem.
 * @param {FirebaseFirestore.DocumentData} target Participação do destino.
 * @param {string} targetUid Identidade canônica.
 * @return {FirebaseFirestore.DocumentData} Documento consolidado.
 */
export function mergeSeasonParticipationRecords(
  source: FirebaseFirestore.DocumentData,
  target: FirebaseFirestore.DocumentData,
  targetUid: string,
): FirebaseFirestore.DocumentData {
  const merged: FirebaseFirestore.DocumentData = {
    ...source,
    ...target,
    ...sumNumericCounters(source, target, SEASON_PARTICIPATION.counterFields),
  };

  const genderField = SEASON_PARTICIPATION.genderMapField;
  const sourceGenders = (source[genderField] ?? {}) as Record<string, unknown>;
  const targetGenders = (target[genderField] ?? {}) as Record<string, unknown>;
  const genderKeys = new Set([
    ...Object.keys(sourceGenders),
    ...Object.keys(targetGenders),
  ]);
  if (genderKeys.size > 0) {
    const mergedGenders: Record<string, unknown> = {};
    for (const gender of genderKeys) {
      const s = (sourceGenders[gender] ?? {}) as Record<string, unknown>;
      const t = (targetGenders[gender] ?? {}) as Record<string, unknown>;
      mergedGenders[gender] = {
        ...s,
        ...t,
        ...sumNumericCounters(s, t, SEASON_PARTICIPATION.counterFields),
      };
    }
    merged[genderField] = mergedGenders;
  }

  for (const field of SEASON_PARTICIPATION.unionFields) {
    const union = unionStringLists(source[field], target[field]);
    if (union.length > 0) merged[field] = union;
  }

  merged[SEASON_PARTICIPATION.uidField] = targetUid;
  merged.merged_from_alias = true;
  return merged;
}

const PROFILE_FALLBACK_FIELDS = [
  "display_name",
  "name",
  "username",
  "photo_url",
  "position",
  "bio",
] as const;

/**
 * Copia da origem apenas campos ainda vazios no perfil canônico. Esta função é
 * aplicada sobre snapshots relidos dentro da transação para que uma edição
 * concorrente do usuário no destino sempre vença.
 *
 * @param {FirebaseFirestore.DocumentData} source Perfil da conta de origem.
 * @param {FirebaseFirestore.DocumentData} target Perfil canônico atual.
 * @return {Record<string, unknown>} Somente os campos ausentes no destino.
 */
export function missingCanonicalProfileFields(
  source: FirebaseFirestore.DocumentData,
  target: FirebaseFirestore.DocumentData,
): Record<string, unknown> {
  const fallback: Record<string, unknown> = {};
  for (const field of PROFILE_FALLBACK_FIELDS) {
    if (!target[field] && source[field]) {
      fallback[field] = source[field];
    }
  }
  return fallback;
}

/**
 * Escolhe o maior privilégio de grupo sem permitir que um mirror MEMBER
 * rebaixe um OWNER/ADMIN durante a consolidação.
 *
 * @param {unknown[]} roles Roles encontrados nos mirrors e membership.
 * @return {string|undefined} Role consolidado.
 */
export function strongestGroupRole(...roles: unknown[]): string | undefined {
  const normalized = roles.filter(
    (role): role is string => typeof role === "string" && role.length > 0,
  );
  return ["OWNER", "ADMIN", "MEMBER"]
    .find((role) => normalized.includes(role)) ?? normalized[0];
}

/**
 * Consolida o estado da membership sem permitir que uma conta canônica
 * explicitamente inativa/banida seja reativada por um alias antigo.
 *
 * @param {boolean} sourceExists Membership do alias existe.
 * @param {unknown} sourceStatus Estado da membership do alias.
 * @param {boolean} targetExists Membership canônica existe.
 * @param {unknown} targetStatus Estado da membership canônica.
 * @param {boolean} sourceOwnsGroup Alias ainda é owner do grupo.
 * @return {string} Estado canônico persistido.
 */
export function canonicalMembershipStatus(
  sourceExists: boolean,
  sourceStatus: unknown,
  targetExists: boolean,
  targetStatus: unknown,
  sourceOwnsGroup: boolean,
): string {
  const normalize = (status: unknown): string | undefined =>
    typeof status === "string" && status.trim() ?
      status.trim().toUpperCase() :
      undefined;
  const canonicalStatus = normalize(targetStatus);
  if (
    sourceOwnsGroup &&
    targetExists &&
    canonicalStatus &&
    canonicalStatus !== "ACTIVE"
  ) {
    throw new HttpsError(
      "failed-precondition",
      "A conta canônica está inativa em um grupo administrado pela origem.",
    );
  }
  if (sourceOwnsGroup) return "ACTIVE";
  if (targetExists) return canonicalStatus ?? "ACTIVE";
  if (sourceExists) return normalize(sourceStatus) ?? "ACTIVE";
  return "INACTIVE";
}

/**
 * Garante que o telefone canônico não mudou entre a criação dos índices e o
 * commit final. Auth e Firestore não compartilham transação; divergência deve
 * abortar e ser reconciliada por uma nova tentativa idempotente.
 *
 * @param {string|undefined} phoneNumber Telefone relido do Firebase Auth.
 * @param {string} expectedHash Hash materializado no início do processamento.
 * @param {string} salt Salt secreto da identidade.
 */
export function assertCanonicalPhoneUnchanged(
  phoneNumber: string | undefined,
  expectedHash: string,
  salt: string,
): asserts phoneNumber is string {
  if (
    !phoneNumber ||
    !isValidPhoneBR(phoneNumber) ||
    hashPhoneIdentity(phoneNumber, salt) !== expectedHash
  ) {
    throw new HttpsError(
      "aborted",
      "O telefone da conta mudou durante a união. Tente novamente.",
    );
  }
}

/**
 * Lista hashes antigos únicos que devem ser reconciliados com o canônico.
 *
 * @param {string} canonicalHash Hash do telefone atual no Firebase Auth.
 * @param {unknown[]} candidates Hashes privados das contas envolvidas.
 * @return {string[]} Hashes antigos distintos.
 */
export function staleIdentityHashes(
  canonicalHash: string,
  ...candidates: unknown[]
): string[] {
  return [...new Set(candidates.filter(
    (hash): hash is string =>
      typeof hash === "string" && hash.length > 0 && hash !== canonicalHash,
  ))];
}

/**
 * Preserva todos os hashes conhecidos de telefone; mudanças legítimas podem
 * deixar temporariamente private/index com valores diferentes.
 *
 * @param {unknown} privateHash Hash materializado em users_private.
 * @param {string[]} indexedHashes Hashes atualmente indexados pelo UID.
 * @return {string[]} Conjunto único de hashes conhecidos.
 */
export function knownPhoneIdentityHashes(
  privateHash: unknown,
  indexedHashes: string[],
): string[] {
  return [...new Set([
    ...(typeof privateHash === "string" && privateHash ? [privateHash] : []),
    ...indexedHashes.filter(Boolean),
  ])];
}

/**
 * Substitui UID em listas de delegação, removendo duplicatas.
 *
 * @param {unknown} value Lista persistida.
 * @param {string} sourceUid Alias antigo.
 * @param {string} targetUid Identidade canônica.
 * @return {string[]} Lista reconciliada.
 */
export function replaceIdentityInList(
  value: unknown,
  sourceUid: string,
  targetUid: string,
): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((uid): uid is string => typeof uid === "string" && uid.length > 0)
    .map((uid) => uid === sourceUid ? targetUid : uid))];
}

/**
 * Migra ownership/delegações relendo o documento dentro de transação. A query
 * inicial serve apenas para descobrir candidatos; ela nunca autoriza restaurar
 * um owner ou uma lista que mudou concorrentemente.
 *
 * @param {FirebaseFirestore.Firestore} database Firestore.
 * @param {FirebaseFirestore.DocumentReference} ref Documento candidato.
 * @param {string} sourceUid Alias antigo.
 * @param {string} targetUid Identidade canônica.
 * @param {string[]} ownerFields Campos escalares de ownership.
 * @param {string[]} delegateFields Campos-array de delegação.
 * @return {Promise<boolean>} Se alguma referência foi efetivamente migrada.
 */
async function migrateFreshOwnership(
  database: FirebaseFirestore.Firestore,
  ref: FirebaseFirestore.DocumentReference,
  sourceUid: string,
  targetUid: string,
  ownerFields: string[],
  delegateFields: string[] = [],
): Promise<boolean> {
  return database.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) return false;
    const data = fresh.data() ?? {};
    const update: Record<string, unknown> = {};
    for (const field of ownerFields) {
      if (data[field] === sourceUid) update[field] = targetUid;
    }
    const ownerTransferred = ownerFields.some((field) => update[field] === targetUid);
    for (const field of delegateFields) {
      if (Array.isArray(data[field]) && data[field].includes(sourceUid)) {
        update[field] = replaceIdentityInList(
          data[field],
          sourceUid,
          targetUid,
        ).filter((uid) => !ownerTransferred || uid !== targetUid);
      }
    }
    if (Object.keys(update).length === 0) return false;
    tx.set(ref, {
      ...update,
      merged_from_alias: true,
      updated_at: FieldValue.serverTimestamp(),
    }, {merge: true});
    return true;
  });
}

/**
 * Exige autenticação recente feita pelo provedor Phone Auth no destino.
 * Renovar um token Google antigo não constitui prova de posse do telefone.
 *
 * @param {Record<string, unknown>} token Claims do ID token do destino.
 * @param {number} nowSeconds Epoch atual em segundos.
 */
export function assertRecentTargetPhoneProof(
  token: Record<string, unknown>,
  nowSeconds = Math.floor(Date.now() / 1000),
): void {
  const authTime = Number(token.auth_time ?? 0);
  const firebase = token.firebase as {sign_in_provider?: unknown} | undefined;
  const provider = firebase?.sign_in_provider;
  if (
    authTime <= 0 ||
    nowSeconds - authTime > PROOF_TTL_MS / 1000 ||
    provider !== "phone"
  ) {
    throw new HttpsError(
      "permission-denied",
      "Confirme novamente o telefone antes de unir as contas.",
    );
  }
}

/**
 * Valida expiração da prova, permitindo recovery idempotente de execução que
 * já entrou no estágio processing e pode ter desabilitado a origem.
 *
 * @param {unknown} proofExpiresAt Timestamp persistido.
 * @param {unknown} status Estado do merge.
 * @param {number} nowMs Epoch atual em millis.
 */
export function assertMergeProofUsable(
  proofExpiresAt: unknown,
  status: unknown,
  nowMs = Date.now(),
): void {
  const expired = !(proofExpiresAt instanceof Timestamp) ||
    proofExpiresAt.toMillis() < nowMs;
  if (expired && status !== "processing") {
    throw new HttpsError(
      "permission-denied",
      "A confirmação das contas expirou. Reinicie a união.",
    );
  }
}

/**
 * Preserva claims atuais ao aplicar estado verificado do destino.
 *
 * @param {Record<string, unknown>} currentClaims Claims lidos imediatamente antes.
 * @param {boolean} profileComplete Resultado server-side do perfil.
 * @return {Record<string, unknown>} Claims reconciliados.
 */
export function buildVerifiedClaims(
  currentClaims: Record<string, unknown>,
  profileComplete: boolean,
): Record<string, unknown> {
  return {...currentClaims, verified: true, profileComplete};
}

/**
 * Enriquece users_private sem expor os hashes ao cliente.
 *
 * @param {FirebaseFirestore.Firestore} database Firestore.
 * @param {string} uid Identidade pesquisada.
 * @param {UserPrivateData} privateData Dados privados existentes.
 * @return {Promise<UserPrivateData>} Identidade reconciliada.
 */
async function resolveLegacyPrivateIdentity(
  database: FirebaseFirestore.Firestore,
  uid: string,
  privateData: UserPrivateData,
): Promise<UserPrivateData> {
  const [cpfIndexes, phoneIndexes] = await Promise.all([
    loadIdentityIndexHashes(database, "cpf_index", uid),
    loadIdentityIndexHashes(database, "phone_index", uid),
  ]);
  return {
    ...privateData,
    cpfHash: resolveLegacyIdentityHash(privateData.cpfHash, cpfIndexes, "CPF"),
    // Telefone pode mudar legitimamente no Firebase Auth. Mantemos todos os
    // hashes legados para o complete reconciliar sob guarda de ownership.
    phoneHash: typeof privateData.phoneHash === "string" ?
      privateData.phoneHash :
      phoneIndexes[0],
    phoneIndexHashes: knownPhoneIdentityHashes(
      privateData.phoneHash,
      phoneIndexes,
    ),
  };
}

/**
 * Carrega salt server-only usado pelo índice de telefone.
 *
 * @return {string} Salt configurado.
 */
function getIdentitySalt(): string {
  const salt = process.env.CPF_SALT;
  if (!salt || salt.length < 16) {
    throw new HttpsError(
      "failed-precondition",
      "Não foi possível validar a identidade neste momento.",
    );
  }
  return salt;
}

/**
 * Gera ID determinístico sem revelar UIDs ao cliente.
 * @param {string} sourceUid UID da conta origem.
 * @param {string} targetUid UID da identidade canônica.
 * @return {string} SHA-256 hexadecimal.
 */
export function opaqueRequestId(sourceUid: string, targetUid: string): string {
  return crypto
    .createHash("sha256")
    .update(`account-merge:${sourceUid}:${targetUid}`)
    .digest("hex");
}

/**
 * Compara os CPFs privados das duas contas sem expor o hash para o cliente.
 *
 * @param {UserPrivateData} sourcePrivate - Dados privados da conta origem.
 * @param {UserPrivateData} targetPrivate - Dados privados da conta destino.
 * @return {CpfRelation} Relação segura entre os CPFs.
 */
export function cpfRelation(
  sourcePrivate: UserPrivateData,
  targetPrivate: UserPrivateData,
): CpfRelation {
  const sourceCpfHash = typeof sourcePrivate.cpfHash === "string" ?
    sourcePrivate.cpfHash :
    null;
  const targetCpfHash = typeof targetPrivate.cpfHash === "string" ?
    targetPrivate.cpfHash :
    null;

  if (sourceCpfHash && targetCpfHash && sourceCpfHash === targetCpfHash) {
    return "matched";
  }
  if (sourceCpfHash && targetCpfHash && sourceCpfHash !== targetCpfHash) {
    throw new HttpsError(
      "failed-precondition",
      "As contas possuem CPFs diferentes. A unificação exige revisão manual.",
    );
  }
  if (sourceCpfHash) return "missing_target";
  if (targetCpfHash) return "missing_source";
  return "missing_both";
}

/**
 * Creates an auditable account merge request after the user has proven control
 * over both sessions.
 *
 * @return {Promise<object>} request status.
 */
export const requestAccountMerge = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Login obrigatório");
      }

      const sourceIdToken: unknown = request.data?.sourceIdToken;
      if (typeof sourceIdToken !== "string" || sourceIdToken.length < 32) {
        throw new HttpsError(
          "invalid-argument",
          "sourceIdToken deve ser um token válido",
        );
      }

      const rateLimit = await checkRateLimit(request.auth.uid, {
        maxRequests: MERGE_REQUESTS_PER_HOUR,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "account_merge_request",
      });
      if (!rateLimit.allowed) {
        const retryAfterSec = Math.ceil(
          (rateLimit.resetAt.getTime() - Date.now()) / 1000,
        );
        throw new HttpsError(
          "resource-exhausted",
          "Muitas solicitações. Tente novamente mais tarde.",
          {retryAfter: retryAfterSec},
        );
      }

      const auth = getAuth();
      const targetUid = request.auth.uid;
      let sourceUid: string;
      let sourceTokenIssuedAt: number;
      try {
        const decodedSource = await auth.verifyIdToken(sourceIdToken, true);
        sourceUid = decodedSource.uid;
        sourceTokenIssuedAt = Number(decodedSource.iat ?? 0);
      } catch (error) {
        logger.warn("[ACCOUNT_MERGE] Invalid source token", {
          error,
          targetUid,
        });
        throw new HttpsError(
          "permission-denied",
          "Não foi possível validar a conta anterior.",
        );
      }

      if (sourceUid === targetUid) {
        throw new HttpsError(
          "invalid-argument",
          "A conta de origem e destino devem ser diferentes",
        );
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      const targetTokenIssuedAt = Number(request.auth.token.iat ?? 0);
      assertRecentTargetPhoneProof(
        request.auth.token as Record<string, unknown>,
        nowSeconds,
      );
      if (
        sourceTokenIssuedAt <= 0 ||
        targetTokenIssuedAt <= 0 ||
        nowSeconds - sourceTokenIssuedAt > PROOF_TTL_MS / 1000 ||
        nowSeconds - targetTokenIssuedAt > PROOF_TTL_MS / 1000
      ) {
        throw new HttpsError(
          "permission-denied",
          "Confirme novamente o acesso às duas contas.",
        );
      }

      const [sourceAuth, targetAuth] = await Promise.all([
        auth.getUser(sourceUid),
        auth.getUser(targetUid),
      ]);

      if (sourceAuth.disabled || targetAuth.disabled) {
        throw new HttpsError(
          "failed-precondition",
          "Não é possível unificar contas desativadas.",
        );
      }
      if (!targetAuth.phoneNumber) {
        throw new HttpsError(
          "failed-precondition",
          "A conta de destino precisa ter telefone verificado.",
        );
      }

      const database = db();
      const [
        sourceUserSnap,
        targetUserSnap,
        sourcePrivateSnap,
        targetPrivateSnap,
      ] = await Promise.all([
        database.doc(`users/${sourceUid}`).get(),
        database.doc(`users/${targetUid}`).get(),
        database.doc(`users_private/${sourceUid}`).get(),
        database.doc(`users_private/${targetUid}`).get(),
      ]);

      const [sourceIdentity, targetIdentity] = await Promise.all([
        resolveLegacyPrivateIdentity(
          database,
          sourceUid,
          sourcePrivateSnap.data() ?? {},
        ),
        resolveLegacyPrivateIdentity(
          database,
          targetUid,
          targetPrivateSnap.data() ?? {},
        ),
      ]);
      const relation = cpfRelation(sourceIdentity, targetIdentity);
      const requestId = opaqueRequestId(sourceUid, targetUid);
      const requestRef = database.doc(`account_merge_requests/${requestId}`);
      const auditRef = database.collection("audit_logs").doc();
      const now = FieldValue.serverTimestamp();

      await database.runTransaction(async (tx) => {
        const existing = await tx.get(requestRef);
        if (existing.exists && existing.data()?.status === "completed") {
          throw new HttpsError(
            "already-exists",
            "Essa unificação já foi concluída.",
          );
        }
        assertMergeRequestRefreshable(existing.data());

        tx.set(
          requestRef,
          {
            sourceUid,
            targetUid,
            requestedBy: targetUid,
            status: mergeStatus(relation),
            cpfRelation: relation,
            sourceUserExists: sourceUserSnap.exists,
            targetUserExists: targetUserSnap.exists,
            sourceHasEmail: !!sourceAuth.email,
            targetHasEmail: !!targetAuth.email,
            sourceHasPhone: !!sourceAuth.phoneNumber,
            targetHasPhone: !!targetAuth.phoneNumber,
            proofs: {
              sourceIdTokenVerified: true,
              targetPhoneAuthVerified: true,
              sourceTokenIssuedAt,
              targetTokenIssuedAt,
            },
            proofExpiresAt: Timestamp.fromMillis(Date.now() + PROOF_TTL_MS),
            createdAt: existing.exists ?
              existing.data()?.createdAt ?? now :
              now,
            updatedAt: now,
            processingLeaseId: FieldValue.delete(),
            processingLeaseExpiresAt: FieldValue.delete(),
          },
          {merge: true},
        );

        tx.set(auditRef, {
          type: "ACCOUNT_MERGE_REQUESTED",
          source_user_id: sourceUid,
          target_user_id: targetUid,
          requested_by: targetUid,
          merge_request_id: requestId,
          cpf_relation: relation,
          timestamp: now,
        });
      });

      logger.info("[ACCOUNT_MERGE] Request created", {
        requestId,
        sourceUid,
        targetUid,
        cpfRelation: relation,
      });

      return {
        success: true,
        requestId,
        status: mergeStatus(relation),
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("requestAccountMerge failed", {
        error,
        uid: request.auth?.uid,
      });
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  },
);

/**
 * Conclui uma união já autorizada pelas duas sessões.
 *
 * A conta do telefone é canônica. Dados históricos da origem não são
 * apagados; um alias privado preserva resolução e memberships ativos são
 * copiados. Provedores OAuth são desvinculados da origem para o cliente poder
 * vinculá-los à conta canônica com consentimento explícito.
 */
export const completeAccountMerge = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
    timeoutSeconds: 120,
    secrets: ["CPF_SALT"],
  },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Login obrigatório");
      }

      const requestId: unknown = request.data?.requestId;
      if (typeof requestId !== "string" || !/^[a-f0-9]{64}$/.test(requestId)) {
        throw new HttpsError("invalid-argument", "Pedido de união inválido");
      }

      const rateLimit = await checkRateLimit(request.auth.uid, {
        maxRequests: COMPLETE_REQUESTS_PER_HOUR,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "account_merge_complete",
      });
      if (!rateLimit.allowed) {
        throw new HttpsError(
          "resource-exhausted",
          "Muitas tentativas. Tente novamente mais tarde.",
        );
      }

      const database = db();
      const requestRef = database.doc(`account_merge_requests/${requestId}`);
      const requestSnap = await requestRef.get();
      const mergeData = requestSnap.data();
      if (!requestSnap.exists || !mergeData) {
        throw new HttpsError("not-found", "Pedido de união não encontrado");
      }

      const sourceUid = mergeData.sourceUid;
      const targetUid = mergeData.targetUid;
      if (
        typeof sourceUid !== "string" ||
        typeof targetUid !== "string" ||
        targetUid !== request.auth.uid
      ) {
        throw new HttpsError(
          "permission-denied",
          "Este pedido não pertence à sessão atual.",
        );
      }
      if (mergeData.status === "completed") {
        return {
          success: true,
          status: "completed",
          alreadyCompleted: true,
          providersToRelink: mergeData.providersToRelink ?? [],
          tokenRefreshRequired: true,
        };
      }
      const proofExpiresAt = mergeData.proofExpiresAt;
      assertMergeProofUsable(proofExpiresAt, mergeData.status);

      const auth = getAuth();
      const [sourceAuth, targetAuth, sourcePrivate, targetPrivate] =
        await Promise.all([
          auth.getUser(sourceUid),
          auth.getUser(targetUid),
          database.doc(`users_private/${sourceUid}`).get(),
          database.doc(`users_private/${targetUid}`).get(),
        ]);

      if (
        targetAuth.disabled ||
        !targetAuth.phoneNumber ||
        (sourceAuth.disabled && mergeData.status !== "processing")
      ) {
        throw new HttpsError(
          "failed-precondition",
          "A conta canônica precisa estar ativa e com telefone verificado.",
        );
      }

      const [sourceIdentity, targetIdentity] = await Promise.all([
        resolveLegacyPrivateIdentity(
          database,
          sourceUid,
          sourcePrivate.data() ?? {},
        ),
        resolveLegacyPrivateIdentity(
          database,
          targetUid,
          targetPrivate.data() ?? {},
        ),
      ]);
      const relation = cpfRelation(sourceIdentity, targetIdentity);
      if (mergeStatus(relation) !== "ready") {
        await requestRef.set({
          status: "pending_cpf",
          cpfRelation: relation,
          updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        throw new HttpsError(
          "failed-precondition",
          "Verifique o CPF da conta atual antes de concluir a união.",
        );
      }

      const providersToRelink = Array.isArray(mergeData.providersToRelink) ?
        mergeData.providersToRelink.filter(
          (providerId: unknown): providerId is string =>
            providerId === GOOGLE_PROVIDER_ID,
        ) :
        sourceAuth.providerData
          .map(({providerId}) => providerId)
          .filter((providerId) =>
            providerId === GOOGLE_PROVIDER_ID &&
            !targetAuth.providerData.some((provider) =>
              provider.providerId === providerId
            )
          );

      const sourceUserRef = database.doc(`users/${sourceUid}`);
      const targetUserRef = database.doc(`users/${targetUid}`);
      const aliasRef = database.doc(`account_aliases/${sourceUid}`);
      const [
        sourceUser,
        sourceGroupLinks,
        sourceConfirmationsSnake,
        sourceConfirmationsCamel,
        sourceSummons,
        sourceGroupInvitesSnake,
        sourceGroupInvitesCamel,
        sourceNotifications,
        sourceOwnedGames,
        sourceCoorganizedGames,
        sourceOwnedLocations,
        sourceManagedLocations,
        sourceOwnedSchedules,
        sourceOwnedLiveGames,
        sourceOwnedLiveScores,
        sourceGameTemplates,
        sourceStatistics,
        sourceUserBadges,
        sourceSeasonParticipation,
        sourceXpLogs,
        sourceMvpVotesCast,
        sourceMvpVotesReceived,
        sourceActivities,
      ] = await Promise.all([
        sourceUserRef.get(),
        sourceUserRef.collection("groups").limit(MAX_DOCS_PER_QUERY).get(),
        database.collection("confirmations").where("user_id", "==", sourceUid).limit(MAX_DOCS_PER_QUERY).get(),
        database.collection("confirmations").where("userId", "==", sourceUid).limit(MAX_DOCS_PER_QUERY).get(),
        // FIX #4039: coleções de alto volume/baixo risco são drenadas com
        // cursor em vez de saturar o merge permanentemente.
        drainDocsByField(database, "game_summons", "user_id", sourceUid),
        drainDocsByField(database, "group_invites", "invited_user_id", sourceUid),
        drainDocsByField(database, "group_invites", "invitedUserId", sourceUid),
        drainDocsByField(database, "notifications", "user_id", sourceUid),
        database.collection("games").where("owner_id", "==", sourceUid).limit(MAX_DOCS_PER_QUERY).get(),
        database.collection("games")
          .where("co_organizers", "array-contains", sourceUid).limit(MAX_DOCS_PER_QUERY).get(),
        database.collection("locations").where("owner_id", "==", sourceUid).limit(MAX_DOCS_PER_QUERY).get(),
        database.collection("locations")
          .where("managers", "array-contains", sourceUid).limit(MAX_DOCS_PER_QUERY).get(),
        database.collection("schedules").where("owner_id", "==", sourceUid).limit(MAX_DOCS_PER_QUERY).get(),
        database.collection("live_games").where("owner_id", "==", sourceUid).limit(MAX_DOCS_PER_QUERY).get(),
        database.collection("live_scores").where("owner_id", "==", sourceUid).limit(MAX_DOCS_PER_QUERY).get(),
        sourceUserRef.collection("game_templates").limit(MAX_DOCS_PER_QUERY).get(),
        // #4112: gamificação. statistics é 1 doc por uid (ID = uid, sem
        // campo user_id no escritor das Functions) — lido pelo ID.
        database.doc(`${STATISTICS.collection}/${STATISTICS.docId(sourceUid)}`).get(),
        // user_badges e season_participation são CRÍTICAS (o jogador perde
        // conquistas/ranking se ficarem para trás) → guard de saturação.
        database.collection(USER_BADGES.collection)
          .where(USER_BADGES.uidField, "==", sourceUid).limit(MAX_DOCS_PER_QUERY).get(),
        database.collection(SEASON_PARTICIPATION.collection)
          .where(SEASON_PARTICIPATION.uidField, "==", sourceUid).limit(MAX_DOCS_PER_QUERY).get(),
        // xp_logs, mvp_votes e activities acumulam 1 doc por jogo → drenadas
        // com cursor (repoint idempotente, sem risco de perda por truncagem).
        drainDocsByField(database, XP_LOGS.collection, XP_LOGS.uidField, sourceUid),
        drainDocsByField(database, MVP_VOTES.collection, MVP_VOTES.voterField, sourceUid),
        drainDocsByField(database, MVP_VOTES.collection, MVP_VOTES.votedPlayerField, sourceUid),
        drainDocsByField(database, ACTIVITIES.collection, ACTIVITIES.uidField, sourceUid),
      ]);

      // FIX #4015/#4039: Detectar saturação antes do estágio irreversível.
      // Se qualquer query retornar exatamente MAX_DOCS_PER_QUERY docs,
      // o excedente está sendo ignorado — e como a união é irreversível
      // (guard alreadyCompleted), esses docs ficariam órfãos para sempre.
      // Abortar com erro acionável em vez de completar uma união parcial.
      //
      // FIX #4039: o guard só se aplica a coleções CRÍTICAS de posse. As
      // coleções de alto volume/baixo risco (notifications, game_summons,
      // group_invites) foram drenadas com cursor acima — não saturaram, então
      // não participam deste check. Sem isso, um usuário ativo com 500+
      // notificações não lidas era bloqueado para sempre sem caminho algum.
      const saturationChecks: Array<[string, FirebaseFirestore.QuerySnapshot]> = [
        ["groups", sourceGroupLinks],
        ["confirmations (user_id)", sourceConfirmationsSnake],
        ["confirmations (userId)", sourceConfirmationsCamel],
        ["games (owner_id)", sourceOwnedGames],
        ["games (co_organizers)", sourceCoorganizedGames],
        ["locations (owner_id)", sourceOwnedLocations],
        ["locations (managers)", sourceManagedLocations],
        ["schedules (owner_id)", sourceOwnedSchedules],
        ["live_games (owner_id)", sourceOwnedLiveGames],
        ["live_scores (owner_id)", sourceOwnedLiveScores],
        ["game_templates", sourceGameTemplates],
        // #4112: conquistas e ranking são irrecuperáveis se truncados.
        [`${USER_BADGES.collection} (${USER_BADGES.uidField})`, sourceUserBadges],
        [
          `${SEASON_PARTICIPATION.collection} (${SEASON_PARTICIPATION.uidField})`,
          sourceSeasonParticipation,
        ],
      ];
      const saturated = saturationChecks
        .filter(([, snap]) => snap.size >= MAX_DOCS_PER_QUERY)
        .map(([name]) => name);
      if (saturated.length > 0) {
        throw new HttpsError(
          "failed-precondition",
          `A conta de origem possui ${MAX_DOCS_PER_QUERY}+ documentos em: ` +
          `${saturated.join(", ")}. A união não pode ser concluída ` +
          "para evitar perda silenciosa de dados. Tente novamente mais " +
          "tarde.",
        );
      }

      // Lease transacional evita duas conclusões concorrentes. Repetições após
      // expiração continuam seguras porque os destinos têm IDs determinísticos.
      const leaseId = crypto.randomUUID();
      const leaseExpiresAt = Timestamp.fromMillis(
        Date.now() + PROCESSING_LEASE_MS,
      );
      const leaseAcquired = await database.runTransaction(async (tx) => {
        const fresh = await tx.get(requestRef);
        const freshData = fresh.data();
        if (freshData?.status === "completed") {
          return false;
        }
        const activeLease = freshData?.processingLeaseExpiresAt;
        if (
          freshData?.status === "processing" &&
          activeLease instanceof Timestamp &&
          activeLease.toMillis() > Date.now()
        ) {
          throw new HttpsError(
            "aborted",
            "A união já está sendo processada.",
          );
        }
        tx.set(requestRef, {
          status: "processing",
          cpfRelation: relation,
          providersToRelink,
          processingLeaseId: leaseId,
          processingLeaseExpiresAt: leaseExpiresAt,
          updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        return true;
      });
      if (!leaseAcquired) {
        const completed = (await requestRef.get()).data();
        return {
          success: true,
          status: "completed",
          alreadyCompleted: true,
          providersToRelink: completed?.providersToRelink ?? [],
          tokenRefreshRequired: true,
        };
      }

      const sourceCpfHash = typeof sourceIdentity.cpfHash === "string" ?
        sourceIdentity.cpfHash :
        undefined;
      const targetCpfHash = typeof targetIdentity.cpfHash === "string" ?
        targetIdentity.cpfHash :
        undefined;
      const canonicalCpfHash = targetCpfHash ?? sourceCpfHash;
      if (!canonicalCpfHash) {
        throw new HttpsError(
          "failed-precondition",
          "Verifique o CPF antes de concluir a união.",
        );
      }

      const identitySalt = getIdentitySalt();
      const canonicalPhoneHash = hashPhoneIdentity(
        targetAuth.phoneNumber,
        identitySalt,
      );
      const cpfIndexRef = database.doc(`cpf_index/${canonicalCpfHash}`);
      const phoneIndexRef = database.doc(`phone_index/${canonicalPhoneHash}`);
      const sourcePhoneHash = typeof sourceIdentity.phoneHash === "string" ?
        sourceIdentity.phoneHash :
        undefined;
      const targetPhoneHash = typeof targetIdentity.phoneHash === "string" ?
        targetIdentity.phoneHash :
        undefined;
      const stalePhoneRefs = staleIdentityHashes(
        canonicalPhoneHash,
        sourcePhoneHash,
        targetPhoneHash,
        ...(sourceIdentity.phoneIndexHashes ?? []),
        ...(targetIdentity.phoneIndexHashes ?? []),
      ).map((hash) => database.doc(`phone_index/${hash}`));

      // Reatribui índices e materializa users_private de forma atômica. Isso
      // cobre contas legadas cujo cpfHash/phoneHash existia apenas nos índices.
      await database.runTransaction(async (tx) => {
        const [cpfIndex, phoneIndex, ...stalePhoneIndexes] = await Promise.all([
          tx.get(cpfIndexRef),
          tx.get(phoneIndexRef),
          ...stalePhoneRefs.map((ref) => tx.get(ref)),
        ]);

        for (const [label, owner] of [
          ["CPF", cpfIndex.data()?.uid],
          ["telefone", phoneIndex.data()?.uid],
        ] as const) {
          if (owner && owner !== sourceUid && owner !== targetUid) {
            throw new HttpsError(
              "already-exists",
              `O índice de ${label} pertence a outra identidade.`,
            );
          }
        }
        for (const stalePhoneIndex of stalePhoneIndexes) {
          const owner = stalePhoneIndex.data()?.uid;
          if (owner && owner !== sourceUid && owner !== targetUid) {
            throw new HttpsError(
              "already-exists",
              "Um índice antigo de telefone pertence a outra identidade.",
            );
          }
        }

        const now = FieldValue.serverTimestamp();
        tx.set(cpfIndexRef, {
          uid: targetUid,
          createdAt: cpfIndex.data()?.createdAt ?? now,
          updatedAt: now,
        }, {merge: true});
        tx.set(phoneIndexRef, {
          uid: targetUid,
          createdAt: phoneIndex.data()?.createdAt ?? now,
          updatedAt: now,
        }, {merge: true});
        tx.set(database.doc(`users_private/${targetUid}`), {
          cpfHash: canonicalCpfHash,
          ...(typeof targetIdentity.cpfMasked === "string" ? {
            cpfMasked: targetIdentity.cpfMasked,
          } : typeof sourceIdentity.cpfMasked === "string" ? {
            cpfMasked: sourceIdentity.cpfMasked,
          } : {}),
          cpfVerifiedAt: targetIdentity.cpfVerifiedAt ??
            sourceIdentity.cpfVerifiedAt ?? now,
          phoneHash: canonicalPhoneHash,
          phoneNumber: targetAuth.phoneNumber,
          phoneVerifiedAt: now,
          updatedAt: now,
        }, {merge: true});
        tx.set(database.doc(`users_private/${sourceUid}`), {
          mergedToUid: targetUid,
          mergedAt: now,
          updatedAt: now,
        }, {merge: true});

        for (let index = 0; index < stalePhoneRefs.length; index++) {
          const owner = stalePhoneIndexes[index].data()?.uid;
          if (owner === sourceUid || owner === targetUid) {
            tx.delete(stalePhoneRefs[index]);
          }
        }
      });

      // Releitura transacional do perfil: se o usuário preencher nome/foto no
      // destino enquanto o merge está em curso, o valor canônico nunca é
      // substituído por um fallback capturado antes da lease.
      await database.runTransaction(async (tx) => {
        const [freshSourceUser, freshTargetUser] = await Promise.all([
          tx.get(sourceUserRef),
          tx.get(targetUserRef),
        ]);
        const fallbackProfile = missingCanonicalProfileFields(
          freshSourceUser.data() ?? {},
          freshTargetUser.data() ?? {},
        );
        const verifiedAt = FieldValue.serverTimestamp();
        tx.set(targetUserRef, {
          ...fallbackProfile,
          cpfVerifiedAt: verifiedAt,
          // #3935: NÃO gravar `phone` em users/{uid} — torna o usuário
          // verificado ilegível para pares (guard público de PII nas rules).
          // Telefone canônico vive em Firebase Auth + users_private.phoneNumber.
          // `phone_verified` (booleano, não PII) é mantido; seu guard foi
          // removido das rules.
          phone_verified: true,
          verifiedAt,
          updated_at: verifiedAt,
        }, {merge: true});
        tx.set(database.doc(`users_private/${targetUid}`), {
          ...(sourceAuth.email ? {
            alternateEmails: FieldValue.arrayUnion(sourceAuth.email),
          } : {}),
          updatedAt: verifiedAt,
        }, {merge: true});
        tx.set(aliasRef, {
          canonicalUid: targetUid,
          mergeRequestId: requestId,
          status: "active",
          createdAt: verifiedAt,
          updatedAt: verifiedAt,
        }, {merge: true});
        tx.set(sourceUserRef, {
          account_status: "merged",
          updated_at: verifiedAt,
        }, {merge: true});
      });

      const writer = database.bulkWriter();
      // SECFIX #3909: o BulkWriter não agrega nem propaga falhas individuais
      // em close() — cada set() devolve sua própria Promise<WriteResult>, que
      // só rejeita depois que o handler padrão já esgotou os retries de
      // códigos retryable. Capturamos esse retorno aqui (com catch anexado
      // imediatamente, para nunca deixar uma promise sem handler) e checamos
      // as falhas logo após close(), antes do estágio irreversível.
      const bulkWriteFailures: {path: string; code?: string; message: string}[] = [];
      const trackedBulkWrites: Promise<void>[] = [];
      const trackBulkWrite = (
        ref: FirebaseFirestore.DocumentReference,
        write: Promise<unknown>,
      ): void => {
        trackedBulkWrites.push(write.then(
          () => undefined,
          (error: unknown) => {
            const code = typeof (error as {code?: unknown})?.code === "string" ?
              (error as {code: string}).code :
              undefined;
            bulkWriteFailures.push({
              path: ref.path,
              code,
              message: error instanceof Error ? error.message : String(error),
            });
          },
        ));
      };

      let membershipsCopied = 0;
      let groupOwnershipsTransferred = 0;
      let sourceMembershipsDeactivated = 0;
      for (const link of sourceGroupLinks.docs) {
        const targetLink = targetUserRef.collection("groups").doc(link.id);
        const sourceLinkRef = sourceUserRef.collection("groups").doc(link.id);
        const groupRef = database.doc(`groups/${link.id}`);
        const sourceMemberRef = database
          .doc(`groups/${link.id}/members/${sourceUid}`);
        const targetMemberRef = database
          .doc(`groups/${link.id}/members/${targetUid}`);
        const migration = await database.runTransaction(async (tx) => {
          // Releitura transacional: não restaura owner/role/membership removidos
          // por uma ação concorrente depois da query inicial.
          const [
            groupSnap,
            sourceLinkSnap,
            targetLinkSnap,
            sourceMember,
            targetMember,
          ] = await Promise.all([
            tx.get(groupRef),
            tx.get(sourceLinkRef),
            tx.get(targetLink),
            tx.get(sourceMemberRef),
            tx.get(targetMemberRef),
          ]);
          const groupData = groupSnap.data() ?? {};
          const sourceOwnsGroup = groupData.owner_id === sourceUid ||
            groupData.ownerId === sourceUid;
          if (!sourceLinkSnap.exists && !sourceOwnsGroup) {
            return {member: false, owner: false, sourceDeactivated: false};
          }

          const sourceMemberData = sourceMember.data() ?? {};
          const targetMemberData = targetMember.data() ?? {};
          const sourceLinkData = sourceLinkSnap.data() ?? {};
          const targetLinkData = targetLinkSnap.data() ?? {};
          const mergedRole = strongestGroupRole(
            sourceOwnsGroup ? "OWNER" : undefined,
            sourceMemberData.role,
            targetMemberData.role,
            sourceLinkData.role,
            targetLinkData.role,
          );
          const membershipStatus = canonicalMembershipStatus(
            sourceMember.exists,
            sourceMemberData.status,
            targetMember.exists,
            targetMemberData.status,
            sourceOwnsGroup,
          );
          const now = FieldValue.serverTimestamp();

          tx.set(targetLink, {
            ...sourceLinkData,
            ...targetLinkData,
            ...(mergedRole ? {role: mergedRole} : {}),
            user_id: targetUid,
            merged_from_alias: true,
            updated_at: now,
          }, {merge: true});
          if (sourceLinkSnap.exists) tx.delete(sourceLinkRef);

          if (sourceOwnsGroup) {
            tx.set(groupRef, {
              ...(groupData.owner_id === sourceUid ? {owner_id: targetUid} : {}),
              ...(groupData.ownerId === sourceUid ? {ownerId: targetUid} : {}),
              updated_at: now,
            }, {merge: true});
          }

          const memberUpserted = sourceMember.exists || sourceOwnsGroup;
          if (memberUpserted) {
            tx.set(targetMemberRef, {
              ...sourceMemberData,
              ...targetMemberData,
              ...(mergedRole ? {role: mergedRole} : {}),
              status: membershipStatus,
              user_id: targetUid,
              userId: targetUid,
              merged_from_alias: true,
              updated_at: now,
            }, {merge: true});
          }
          if (sourceMember.exists) {
            // Soft-deactivate instead of DELETE. onMemberWritten applies the
            // ACTIVE→INACTIVE delta while onMemberLeft is not fired. Together
            // with the canonical upsert, member_count remains correct.
            tx.set(sourceMemberRef, {
              status: "INACTIVE",
              merged_to_uid: targetUid,
              merged_at: now,
              updated_at: now,
            }, {merge: true});
          }
          return {
            member: memberUpserted,
            owner: sourceOwnsGroup,
            sourceDeactivated: sourceMember.exists,
          };
        });
        if (migration.member) membershipsCopied++;
        if (migration.owner) groupOwnershipsTransferred++;
        if (migration.sourceDeactivated) sourceMembershipsDeactivated++;
      }

      const sourceConfirmationDocs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      for (const doc of [
        ...sourceConfirmationsSnake.docs,
        ...sourceConfirmationsCamel.docs,
      ]) {
        sourceConfirmationDocs.set(doc.ref.path, doc);
      }
      const confirmationGroups = new Map<string, {
        targetRef: FirebaseFirestore.DocumentReference;
        sources: FirebaseFirestore.QueryDocumentSnapshot[];
      }>();
      for (const doc of sourceConfirmationDocs.values()) {
        const gameId = doc.data().game_id ?? doc.data().gameId;
        const targetRef = typeof gameId === "string" && gameId ?
          database.doc(`confirmations/${gameId}_${targetUid}`) :
          doc.ref;
        const group = confirmationGroups.get(targetRef.path) ?? {
          targetRef,
          sources: [],
        };
        group.sources.push(doc);
        confirmationGroups.set(targetRef.path, group);
      }
      let confirmationsCopied = 0;
      for (const {targetRef, sources} of confirmationGroups.values()) {
        confirmationsCopied += await database.runTransaction(async (tx) => {
          // O destino e todas as origens são relidos na mesma transação. Assim,
          // check-in/status simultâneo não é sobrescrito e nenhum source é
          // apagado sem que a cópia canônica seja confirmada atomicamente.
          const refsByPath = new Map<string, FirebaseFirestore.DocumentReference>();
          refsByPath.set(targetRef.path, targetRef);
          for (const source of sources) refsByPath.set(source.ref.path, source.ref);
          const freshSnapshots = await tx.getAll(...refsByPath.values());
          const freshByPath = new Map(
            freshSnapshots.map((snap) => [snap.ref.path, snap]),
          );
          const freshSources = sources
            .map((source) => freshByPath.get(source.ref.path))
            .filter((snap): snap is FirebaseFirestore.DocumentSnapshot =>
              Boolean(snap?.exists) && (
                snap?.data()?.user_id === sourceUid ||
                snap?.data()?.userId === sourceUid
              ));
          if (freshSources.length === 0) return 0;

          const sourceData = mergeConfirmationRecords(
            freshSources.map((source) => ({
              id: source.id,
              data: source.data() ?? {},
            })),
          );
          const targetExisting = freshByPath.get(targetRef.path);
          tx.set(targetRef, {
            ...sourceData,
            ...(targetExisting?.exists ? targetExisting.data() : {}),
            user_id: targetUid,
            userId: targetUid,
            merged_from_alias: true,
            updated_at: FieldValue.serverTimestamp(),
          }, {merge: true});
          for (const source of freshSources) {
            if (targetRef.path !== source.ref.path) tx.delete(source.ref);
          }
          return freshSources.length;
        });
      }

      for (const summon of sourceSummons.docs) {
        trackBulkWrite(summon.ref, writer.set(summon.ref, {
          user_id: targetUid,
          merged_from_alias: true,
          updated_at: FieldValue.serverTimestamp(),
        }, {merge: true}));
      }

      const groupInviteDocs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      for (const invite of [
        ...sourceGroupInvitesSnake.docs,
        ...sourceGroupInvitesCamel.docs,
      ]) {
        groupInviteDocs.set(invite.ref.path, invite);
      }
      for (const invite of groupInviteDocs.values()) {
        trackBulkWrite(invite.ref, writer.set(invite.ref, {
          invited_user_id: targetUid,
          invitedUserId: targetUid,
          merged_from_alias: true,
          updated_at: FieldValue.serverTimestamp(),
        }, {merge: true}));
      }

      for (const notification of sourceNotifications.docs) {
        trackBulkWrite(notification.ref, writer.set(notification.ref, {
          user_id: targetUid,
          merged_from_alias: true,
          updated_at: FieldValue.serverTimestamp(),
        }, {merge: true}));
      }

      const gameOwnershipDocs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      for (const game of [
        ...sourceOwnedGames.docs,
        ...sourceCoorganizedGames.docs,
      ]) {
        gameOwnershipDocs.set(game.ref.path, game);
      }
      let gamesOwnershipMigrated = 0;
      for (const game of gameOwnershipDocs.values()) {
        if (await migrateFreshOwnership(
          database,
          game.ref,
          sourceUid,
          targetUid,
          ["owner_id", "ownerId"],
          ["co_organizers"],
        )) gamesOwnershipMigrated++;
      }

      const locationOwnershipDocs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      for (const location of [
        ...sourceOwnedLocations.docs,
        ...sourceManagedLocations.docs,
      ]) {
        locationOwnershipDocs.set(location.ref.path, location);
      }
      let locationsOwnershipMigrated = 0;
      for (const location of locationOwnershipDocs.values()) {
        if (await migrateFreshOwnership(
          database,
          location.ref,
          sourceUid,
          targetUid,
          ["owner_id", "ownerId"],
          ["managers"],
        )) locationsOwnershipMigrated++;
      }

      let schedulesOwnershipMigrated = 0;
      for (const schedule of sourceOwnedSchedules.docs) {
        if (await migrateFreshOwnership(
          database,
          schedule.ref,
          sourceUid,
          targetUid,
          ["owner_id"],
        )) schedulesOwnershipMigrated++;
      }
      let liveGamesOwnershipMigrated = 0;
      for (const liveGame of sourceOwnedLiveGames.docs) {
        if (await migrateFreshOwnership(
          database,
          liveGame.ref,
          sourceUid,
          targetUid,
          ["owner_id"],
        )) liveGamesOwnershipMigrated++;
      }
      let liveScoresOwnershipMigrated = 0;
      for (const liveScore of sourceOwnedLiveScores.docs) {
        if (await migrateFreshOwnership(
          database,
          liveScore.ref,
          sourceUid,
          targetUid,
          ["owner_id"],
        )) liveScoresOwnershipMigrated++;
      }
      let gameTemplatesMigrated = 0;
      for (const template of sourceGameTemplates.docs) {
        const targetTemplate = targetUserRef
          .collection("game_templates")
          .doc(template.id);
        gameTemplatesMigrated += await database.runTransaction(async (tx) => {
          const [freshSource, freshTarget] = await Promise.all([
            tx.get(template.ref),
            tx.get(targetTemplate),
          ]);
          if (!freshSource.exists) return 0;
          // Em colisões de ID, o modelo que já pertence à conta canônica vence;
          // campos ausentes podem ser completados pela origem.
          tx.set(targetTemplate, {
            ...freshSource.data(),
            ...(freshTarget.exists ? freshTarget.data() : {}),
            owner_id: targetUid,
            user_id: targetUid,
            merged_from_alias: true,
            updated_at: FieldValue.serverTimestamp(),
          }, {merge: true});
          tx.delete(template.ref);
          return 1;
        });
      }

      // ------------------------------------------------------------------
      // #4112: gamificação. Até aqui a união movia a CAUSA (confirmations)
      // e abandonava o EFEITO (XP, estatísticas, badges, temporada) na
      // origem — que é desabilitada para sempre no estágio irreversível.
      // Cada passo é idempotente: origem apagada ou re-apontada some da
      // query na retomada por expiração de lease.
      // ------------------------------------------------------------------

      // statistics/{uid}: SOMA contadores no destino, apaga a origem. A
      // leitura inicial só poupa a transação; a decisão usa a releitura.
      let statisticsMerged = 0;
      if (sourceStatistics.exists) {
        statisticsMerged = await database.runTransaction(async (tx) => {
          const sourceStatsRef = database
            .doc(`${STATISTICS.collection}/${STATISTICS.docId(sourceUid)}`);
          const targetStatsRef = database
            .doc(`${STATISTICS.collection}/${STATISTICS.docId(targetUid)}`);
          const [freshSource, freshTarget] = await Promise.all([
            tx.get(sourceStatsRef),
            tx.get(targetStatsRef),
          ]);
          if (!freshSource.exists) return 0;
          tx.set(targetStatsRef, {
            ...mergeStatisticsRecords(
              freshSource.data() ?? {},
              freshTarget.data() ?? {},
              targetUid,
            ),
            updated_at: FieldValue.serverTimestamp(),
          }, {merge: true});
          tx.delete(sourceStatsRef);
          return 1;
        });
      }

      // season_participation/{seasonId}_{uid}: funde por temporada e apaga a
      // origem — sem isso o jogador aparece duas vezes no ranking.
      let seasonParticipationMerged = 0;
      for (const participation of sourceSeasonParticipation.docs) {
        const rawSeasonId = participation.data()[SEASON_PARTICIPATION.seasonIdField];
        const seasonId = typeof rawSeasonId === "string" && rawSeasonId ?
          rawSeasonId :
          participation.id.endsWith(`_${sourceUid}`) ?
            participation.id.slice(0, -(sourceUid.length + 1)) :
            undefined;
        if (!seasonId) {
          logger.warn("[ACCOUNT_MERGE] season_participation sem season_id; ignorado", {
            requestId,
            path: participation.ref.path,
          });
          continue;
        }
        const targetParticipationRef = database.doc(
          `${SEASON_PARTICIPATION.collection}/` +
          SEASON_PARTICIPATION.docId(seasonId, targetUid),
        );
        seasonParticipationMerged += await database.runTransaction(async (tx) => {
          const [freshSource, freshTarget] = await Promise.all([
            tx.get(participation.ref),
            tx.get(targetParticipationRef),
          ]);
          if (
            !freshSource.exists ||
            freshSource.data()?.[SEASON_PARTICIPATION.uidField] !== sourceUid
          ) return 0;
          tx.set(targetParticipationRef, {
            ...mergeSeasonParticipationRecords(
              freshSource.data() ?? {},
              freshTarget.data() ?? {},
              targetUid,
            ),
            [SEASON_PARTICIPATION.seasonIdField]: seasonId,
            updated_at: FieldValue.serverTimestamp(),
          }, {merge: true});
          if (targetParticipationRef.path !== participation.ref.path) {
            tx.delete(participation.ref);
          }
          return 1;
        });
      }

      // user_badges/{uid}_{badgeId}: UNIÃO. Badge já no destino → mantém a
      // do destino; badge só na origem → copiada com a data original.
      let userBadgesCopied = 0;
      let userBadgesSkipped = 0;
      for (const badge of sourceUserBadges.docs) {
        const rawBadgeId = badge.data()[USER_BADGES.badgeIdField];
        const badgeId = typeof rawBadgeId === "string" && rawBadgeId ?
          rawBadgeId :
          badge.id.startsWith(`${sourceUid}_`) ?
            badge.id.slice(sourceUid.length + 1) :
            badge.id;
        const targetBadgeRef = database.doc(
          `${USER_BADGES.collection}/${USER_BADGES.docId(targetUid, badgeId)}`,
        );
        const outcome = await database.runTransaction(async (tx) => {
          const [freshSource, freshTarget] = await Promise.all([
            tx.get(badge.ref),
            tx.get(targetBadgeRef),
          ]);
          if (
            !freshSource.exists ||
            freshSource.data()?.[USER_BADGES.uidField] !== sourceUid
          ) return "none";
          if (!freshTarget.exists) {
            tx.set(targetBadgeRef, {
              ...freshSource.data(),
              [USER_BADGES.uidField]: targetUid,
              [USER_BADGES.badgeIdField]: badgeId,
              merged_from_alias: true,
            });
          }
          if (targetBadgeRef.path !== badge.ref.path) tx.delete(badge.ref);
          return freshTarget.exists ? "skipped" : "copied";
        });
        if (outcome === "copied") userBadgesCopied++;
        if (outcome === "skipped") userBadgesSkipped++;
      }

      // mvp_votes emitidos: o ID carrega o voterId
      // ({gameId}_{voterId}_{category}) e a checagem "já votou" lê esse ID.
      // Move para o ID canônico; se o destino já votou na mesma categoria do
      // mesmo jogo, o voto da origem é descartado (um voto por eleitor).
      let mvpVotesCastMigrated = 0;
      const mvpVotesReceivedDocs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      for (const vote of sourceMvpVotesReceived.docs) {
        mvpVotesReceivedDocs.set(vote.ref.path, vote);
      }
      for (const vote of sourceMvpVotesCast.docs) {
        // Um doc não pode estar nos dois conjuntos (auto-voto é proibido),
        // mas a dedup protege contra dados legados inconsistentes.
        mvpVotesReceivedDocs.delete(vote.ref.path);
        const data = vote.data();
        const gameId = data[MVP_VOTES.gameIdField];
        const category = data[MVP_VOTES.categoryField];
        const canonicalRef = typeof gameId === "string" && gameId &&
          typeof category === "string" && category ?
          database.doc(
            `${MVP_VOTES.collection}/${MVP_VOTES.docId(gameId, targetUid, category)}`,
          ) :
          vote.ref;
        mvpVotesCastMigrated += await database.runTransaction(async (tx) => {
          const [freshSource, freshTarget] = await Promise.all([
            tx.get(vote.ref),
            tx.get(canonicalRef),
          ]);
          if (
            !freshSource.exists ||
            freshSource.data()?.[MVP_VOTES.voterField] !== sourceUid
          ) return 0;
          const sourceData = freshSource.data() ?? {};
          const repointed = {
            ...sourceData,
            id: canonicalRef.id,
            [MVP_VOTES.voterField]: targetUid,
            ...(sourceData[MVP_VOTES.votedPlayerField] === sourceUid ?
              {[MVP_VOTES.votedPlayerField]: targetUid} :
              {}),
            merged_from_alias: true,
          };
          if (canonicalRef.path === vote.ref.path) {
            tx.set(canonicalRef, repointed, {merge: true});
          } else {
            if (!freshTarget.exists) tx.set(canonicalRef, repointed);
            tx.delete(vote.ref);
          }
          return 1;
        });
      }

      // mvp_votes recebidos, xp_logs e activities: o ID não é lido por
      // ninguém como identidade do uid → basta re-apontar o campo no lugar.
      for (const vote of mvpVotesReceivedDocs.values()) {
        trackBulkWrite(vote.ref, writer.set(vote.ref, {
          [MVP_VOTES.votedPlayerField]: targetUid,
          merged_from_alias: true,
        }, {merge: true}));
      }
      for (const xpLog of sourceXpLogs.docs) {
        trackBulkWrite(xpLog.ref, writer.set(xpLog.ref, {
          [XP_LOGS.uidField]: targetUid,
          merged_from_alias: true,
        }, {merge: true}));
      }
      for (const activity of sourceActivities.docs) {
        trackBulkWrite(activity.ref, writer.set(activity.ref, {
          [ACTIVITIES.uidField]: targetUid,
          merged_from_alias: true,
          updated_at: FieldValue.serverTimestamp(),
        }, {merge: true}));
      }

      // users/{uid}.experience_points / level / milestones_achieved: o
      // agregado de XP que os xp_logs acima derivam. Marcador
      // `xp_merged_to` na origem torna a transferência idempotente na
      // retomada (increment cego dobraria o XP).
      const xpPointsTransferred = await database.runTransaction(async (tx) => {
        const [freshSource, freshTarget] = await Promise.all([
          tx.get(sourceUserRef),
          tx.get(targetUserRef),
        ]);
        const sourceData = freshSource.data() ?? {};
        const targetData = freshTarget.data() ?? {};
        if (!freshSource.exists || sourceData.xp_merged_to === targetUid) return 0;
        const sourceXp = typeof sourceData.experience_points === "number" ?
          sourceData.experience_points :
          0;
        const targetXp = typeof targetData.experience_points === "number" ?
          targetData.experience_points :
          0;
        const mergedXp = Math.max(0, sourceXp + targetXp);
        const now = FieldValue.serverTimestamp();
        tx.set(targetUserRef, {
          experience_points: mergedXp,
          level: getLevelForXp(mergedXp),
          milestones_achieved: unionStringLists(
            sourceData.milestones_achieved,
            targetData.milestones_achieved,
          ),
          updated_at: now,
        }, {merge: true});
        tx.set(sourceUserRef, {
          xp_merged_to: targetUid,
          xp_merged_at: now,
          updated_at: now,
        }, {merge: true});
        return sourceXp;
      });

      await writer.close();
      // close() só espera as escritas pendentes — não agrega nem propaga
      // falhas individuais. Todas as promises rastreadas já estão resolvidas
      // neste ponto; o await abaixo só drena os handlers de catch.
      await Promise.all(trackedBulkWrites);
      if (bulkWriteFailures.length > 0) {
        logger.error(
          "[ACCOUNT_MERGE] escritas do BulkWriter falharam; abortando antes " +
          "do estágio irreversível",
          {requestId, sourceUid, targetUid, bulkWriteFailures},
        );
        // Não tocamos em status/processingLeaseId: o pedido segue
        // "processing" com a lease adquirida em :888-895, então a retomada
        // natural por expiração de lease reprocessa os documentos que
        // faltaram (escritas idempotentes, {merge: true} + IDs
        // determinísticos). Só registramos diagnóstico para visibilidade.
        await requestRef.set({
          lastBulkWriteFailure: {
            failures: bulkWriteFailures,
            attemptedAt: FieldValue.serverTimestamp(),
          },
        }, {merge: true});
        throw new HttpsError(
          "internal",
          "Não foi possível concluir a união; nenhuma alteração " +
          "irreversível foi aplicada. Tente novamente em instantes.",
        );
      }

      // Auth e Firestore não têm transação conjunta. Revalida imediatamente
      // antes do estágio irreversível para não congelar a origem com índice de
      // telefone já obsoleto.
      const targetAuthBeforeFreeze = await auth.getUser(targetUid);
      assertCanonicalPhoneUnchanged(
        targetAuthBeforeFreeze.phoneNumber,
        canonicalPhoneHash,
        identitySalt,
      );

      await database.runTransaction(async (tx) => {
        const fresh = await tx.get(requestRef);
        if (fresh.data()?.processingLeaseId !== leaseId) {
          throw new HttpsError("aborted", "A união foi retomada por outro processo.");
        }
        tx.set(requestRef, {
          status: "processing",
          irreversibleStage: "references_migrated",
          updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
      });

      // Libera somente provedores OAuth que podem ser vinculados novamente
      // pelo próprio usuário no cliente. Senhas nunca são manipuladas aqui.
      await auth.updateUser(sourceUid, {
        disabled: true,
        ...(providersToRelink.length > 0 ? {providersToUnlink: providersToRelink} : {}),
      });
      await auth.revokeRefreshTokens(sourceUid);

      // Releitura tardia evita restaurar role/claims obsoletos capturados antes
      // das migrações e de uma promoção/revogação concorrente.
      const freshTargetAuth = await auth.getUser(targetUid);
      assertCanonicalPhoneUnchanged(
        freshTargetAuth.phoneNumber,
        canonicalPhoneHash,
        identitySalt,
      );
      const targetClaims = freshTargetAuth.customClaims ?? {};
      const targetProfileComplete = isValidPhoneBR(freshTargetAuth.phoneNumber);
      if (
        targetClaims.verified !== true ||
        targetClaims.profileComplete !== targetProfileComplete
      ) {
        await auth.setCustomUserClaims(
          targetUid,
          buildVerifiedClaims(targetClaims, targetProfileComplete),
        );
      }

      // FIX #4124 (LGPD): o user_locations da ORIGEM é apagado — a posição
      // GPS da conta desabilitada não deve sobreviver nem ser herdada sem
      // novo consentimento (spec nearby §3.4).
      try {
        await database.collection("user_locations").doc(sourceUid).delete();
      } catch (locationDeleteError) {
        logger.warn("[ACCOUNT_MERGE] Falha ao apagar user_locations da origem", {
          requestId,
          sourceUid,
          error: locationDeleteError,
        });
      }

      const completedAt = FieldValue.serverTimestamp();
      await database.runTransaction(async (tx) => {
        const fresh = await tx.get(requestRef);
        if (fresh.data()?.processingLeaseId !== leaseId) {
          throw new HttpsError(
            "aborted",
            "A união foi retomada por outro processo.",
          );
        }
        tx.set(requestRef, {
          status: "completed",
          cpfRelation: relation,
          providersToRelink,
          manifest: {
            groupLinksCopied: sourceGroupLinks.size,
            membershipsCopied,
            sourceMembershipsDeactivated,
            groupOwnershipsTransferred,
            confirmationsCopied,
            summonsMigrated: sourceSummons.size,
            groupInvitesMigrated: groupInviteDocs.size,
            notificationsMigrated: sourceNotifications.size,
            gamesOwnershipMigrated,
            locationsOwnershipMigrated,
            schedulesOwnershipMigrated,
            liveGamesOwnershipMigrated,
            liveScoresOwnershipMigrated,
            gameTemplatesMigrated,
            sourceProfilePreserved: sourceUser.exists,
            // #4112: gamificação auditável por coleção.
            statisticsMerged,
            seasonParticipationMerged,
            userBadgesCopied,
            userBadgesSkipped,
            xpLogsMigrated: sourceXpLogs.size,
            mvpVotesCastMigrated,
            mvpVotesReceivedMigrated: mvpVotesReceivedDocs.size,
            activitiesMigrated: sourceActivities.size,
            xpPointsTransferred,
          },
          completedAt,
          updatedAt: completedAt,
          processingLeaseId: FieldValue.delete(),
          processingLeaseExpiresAt: FieldValue.delete(),
        }, {merge: true});
        tx.set(database.collection("audit_logs").doc(), {
          type: "ACCOUNT_MERGE_COMPLETED",
          source_user_id: sourceUid,
          target_user_id: targetUid,
          requested_by: targetUid,
          merge_request_id: requestId,
          cpf_relation: relation,
          providers_to_relink: providersToRelink,
          timestamp: completedAt,
        });
      });

      logger.info("[ACCOUNT_MERGE] Completed", {
        requestId,
        sourceUid,
        targetUid,
        membershipsCopied,
        statisticsMerged,
        seasonParticipationMerged,
        userBadgesCopied,
        xpLogsMigrated: sourceXpLogs.size,
        xpPointsTransferred,
        providersToRelink,
      });
      return {
        success: true,
        status: "completed",
        alreadyCompleted: false,
        providersToRelink,
        tokenRefreshRequired: true,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("completeAccountMerge failed", {
        error,
        uid: request.auth?.uid,
      });
      throw new HttpsError("internal", "Não foi possível concluir a união");
    }
  },
);
