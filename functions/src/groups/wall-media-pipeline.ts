import * as functions from "firebase-functions/v2";
import {logger} from "firebase-functions/v2";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import type {Bucket, File, FileMetadata} from "@google-cloud/storage";
import {createHash, randomUUID} from "crypto";
import {createReadStream} from "fs";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {execFile} from "child_process";
import {promisify} from "util";
import sharp from "sharp";
import {db} from "../_db";
import {FUNCTION_REGION} from "../constants";
import {
  MEDIA_PROCESSOR_SERVICE_ACCOUNT,
  currentFfmpegPath,
  safeFfmpegMovInputArgs,
} from "../media/ffmpeg-runtime";
import {checkRateLimit} from "../middleware/rate-limiter";
import {
  WALL_MEDIA_DRAFT_TTL_MS,
  WALL_MEDIA_MAX_IMAGE_DIMENSION,
  WALL_MEDIA_MAX_IMAGE_PIXELS,
  WALL_MEDIA_PIPELINE_VERSION,
  WALL_MEDIA_PROCESSING_LEASE_MS,
  WallMediaContentType,
  WallMediaDraftStatus,
  WallMediaErrorCode,
  WallMediaHighlightRef,
  WallMediaKind,
  WallMediaIntent,
  WallVideoProbe,
  buildWallMediaMetric,
  detectWallMediaContentType,
  maxBytesForContentType,
  mediaKindForContentType,
  normalizeWallMediaIntent,
  parseWallMediaStagingPath,
  parseWallVideoProbe,
  validateWallVideoProbe,
  wallMediaErrorMessage,
  wallMediaIntentHash,
  wallMediaPostId,
  wallMediaUploadPath,
} from "./wall-media-contract";

const execFileAsync = promisify(execFile);
const JANITOR_BATCH_SIZE = 200;
const JANITOR_MAX_DRAFTS_PER_RUN = 2_000;
const JANITOR_CONCURRENCY = 10;
const JANITOR_TIME_BUDGET_MS = 240_000;
const WALL_MEDIA_MAX_PROCESSING_ATTEMPTS = 5;
const WALL_MEDIA_DRAFT_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60_000,
  keyPrefix: "wall_media_draft",
} as const;

interface CreateWallMediaDraftData {
  groupId: string;
  clientRequestId: string;
  text: string;
  declaredContentType: string;
  sizeBytes: number;
  highlightRef?: unknown;
}

export interface ReserveWallMediaDraftInput {
  groupId: string;
  ownerId: string;
  intent: WallMediaIntent;
  authName?: string | null;
  authPicture?: string | null;
  now?: Date;
}

export interface ReserveWallMediaDraftResult {
  postId: string;
  uploadPath: string;
  expiresAt: string;
  maxBytes: number;
  pipelineVersion: number;
  duplicate: boolean;
}

interface ClaimedDraft {
  result: "CLAIMED";
  ref: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData;
  attempt: number;
}

type DraftClaim = ClaimedDraft | {
  result: "ORPHAN";
  ref: FirebaseFirestore.DocumentReference;
  data?: FirebaseFirestore.DocumentData;
  attempt?: number;
} | {
  result: "BUSY";
  ref: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData;
} | {
  result: "TERMINAL";
  ref: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData;
};

interface ProcessedWallMedia {
  sourceContentType: WallMediaContentType;
  finalContentType: "image/webp" | "video/mp4";
  mediaKind: WallMediaKind;
  sha256: string;
  finalLocalPath: string;
  posterLocalPath: string;
  durationSec: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  container: string;
  width: number;
  height: number;
}

export interface UploadedImmutableObject {
  file: File;
  path: string;
  generation: string;
  token: string;
  created: boolean;
}

/** Erro permanente e acionável de validação da mídia do usuário. */
class WallMediaRejectedError extends Error {
  /**
   * @param {WallMediaErrorCode} code Código público seguro.
   */
  constructor(readonly code: WallMediaErrorCode) {
    super(wallMediaErrorMessage(code));
  }
}

export type WallMediaProbeFailureClassification =
  | {disposition: "PARSE"; stderr: string}
  | {disposition: "REJECT"; stderr: null}
  | {disposition: "RETRY"; stderr: null};

/**
 * Separa saída normal de inspeção inválida de falhas do processo/runtime.
 * O FFmpeg encerra com código numérico não-zero ao inspecionar sem output;
 * timeouts, sinais e erros do SO não podem virar rejeição permanente do usuário.
 * @param {unknown} error Falha retornada por child_process.execFile.
 * @return {WallMediaProbeFailureClassification} Tratamento seguro da falha.
 */
export function classifyWallMediaProbeFailure(
  error: unknown
): WallMediaProbeFailureClassification {
  if (!error || typeof error !== "object") {
    return {disposition: "RETRY", stderr: null};
  }
  const failure = error as {
    code?: number | string | null;
    killed?: boolean;
    signal?: string | null;
    stderr?: string | Buffer;
  };
  const stderr = typeof failure.stderr === "string" ? failure.stderr :
    Buffer.isBuffer(failure.stderr) ? failure.stderr.toString("utf8") : "";
  if (failure.killed === true ||
      (typeof failure.signal === "string" && failure.signal.length > 0)) {
    return {disposition: "RETRY", stderr: null};
  }
  if (failure.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
    return {disposition: "REJECT", stderr: null};
  }
  if (typeof failure.code === "string") {
    return {disposition: "RETRY", stderr: null};
  }
  if (typeof failure.code !== "number" ||
      !Number.isSafeInteger(failure.code) || failure.code === 0 ||
      stderr.trim().length === 0) {
    return {disposition: "RETRY", stderr: null};
  }
  return {disposition: "PARSE", stderr};
}

/**
 * Cria draft idempotente antes de qualquer upload do cliente.
 * @return {Promise<object>} Contrato de upload para Web/Android.
 */
export const createGroupWallMediaDraft = functions.https.onCall<
  CreateWallMediaDraftData
>({
  region: FUNCTION_REGION,
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
  consumeAppCheckToken: true,
}, async (request) => {
  if (!request.auth?.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Usuário precisa estar autenticado"
    );
  }
  const ownerId = request.auth.uid;
  const rateLimit = await checkRateLimit(ownerId, WALL_MEDIA_DRAFT_RATE_LIMIT);
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
    );
    throw new functions.https.HttpsError(
      "resource-exhausted",
      `Muitos envios de mídia. Tente novamente em ${retryAfter} segundos.`,
      {retryAfter, limit: WALL_MEDIA_DRAFT_RATE_LIMIT.maxRequests}
    );
  }
  const groupId = requireSafeId(request.data?.groupId, "groupId");
  let intent: WallMediaIntent;
  try {
    intent = normalizeWallMediaIntent({
      clientRequestId: request.data?.clientRequestId,
      text: request.data?.text,
      declaredContentType: request.data?.declaredContentType,
      sizeBytes: request.data?.sizeBytes,
      highlightRef: request.data?.highlightRef,
    });
  } catch (error) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      error instanceof Error ? error.message : "Payload de mídia inválido"
    );
  }
  return reserveGroupWallMediaDraft(db(), {
    groupId,
    ownerId,
    intent,
    authName: firstString(request.auth?.token?.name),
    authPicture: firstString(request.auth?.token?.picture),
  });
});

/**
 * Núcleo transacional usado pelo callable e pelo harness real do Emulator.
 * @param {FirebaseFirestore.Firestore} database Firestore/Admin SDK.
 * @param {ReserveWallMediaDraftInput} input Identidade e intenção validada.
 * @return {Promise<ReserveWallMediaDraftResult>} Contrato determinístico.
 */
export async function reserveGroupWallMediaDraft(
  database: FirebaseFirestore.Firestore,
  input: ReserveWallMediaDraftInput
): Promise<ReserveWallMediaDraftResult> {
  const {groupId, ownerId, intent} = input;
  const groupRef = database.doc(`groups/${groupId}`);
  const memberRef = database.doc(`groups/${groupId}/members/${ownerId}`);
  const userRef = database.doc(`users/${ownerId}`);
  const postId = wallMediaPostId(groupId, ownerId, intent.clientRequestId);
  const draftRef = database.doc(
    `groups/${groupId}/wall_post_drafts/${postId}`
  );
  const postRef = database.doc(`groups/${groupId}/wall_posts/${postId}`);
  const uploadPath = wallMediaUploadPath(
    groupId,
    postId,
    ownerId,
    intent.declaredContentType
  );
  const intentHash = wallMediaIntentHash(intent);
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + WALL_MEDIA_DRAFT_TTL_MS);

  const result = await database.runTransaction(async (tx) => {
    const [groupSnap, memberSnap, userSnap, existing, existingPost] =
      await Promise.all([
        tx.get(groupRef),
        tx.get(memberRef),
        tx.get(userRef),
        tx.get(draftRef),
        tx.get(postRef),
      ]);
    authorizeWallDraft(groupSnap, memberSnap, ownerId);
    if (existing.exists) {
      const current = existing.data() ?? {};
      if (current.author_id !== ownerId || current.group_id !== groupId ||
          current.client_request_id !== intent.clientRequestId ||
          current.intent_hash !== intentHash || current.temp_path !== uploadPath) {
        throw new functions.https.HttpsError(
          "already-exists",
          "clientRequestId já foi usado com outro envio"
        );
      }
      return {
        expiresAt: timestampIso(current.expires_at) ?? expiresAt.toISOString(),
        duplicate: true,
      };
    }
    if (existingPost.exists) {
      const post = existingPost.data() ?? {};
      const samePublishedIntent =
        post.group_id === groupId &&
        post.author_id === ownerId &&
        post.media_status === "READY" &&
        post.media_pipeline_draft_id === postId &&
        post.media_pipeline_intent_hash === intentHash;
      if (!samePublishedIntent) {
        throw new functions.https.HttpsError(
          "already-exists",
          "O identificador deste envio já pertence a outra publicação"
        );
      }
      // Defesa em profundidade: se um tombstone READY foi removido fora do
      // pipeline, ele é reconstruído sem tocar no post social ou ressuscitá-lo.
      tx.create(draftRef, {
        pipeline_version: WALL_MEDIA_PIPELINE_VERSION,
        post_id: postId,
        group_id: groupId,
        author_id: ownerId,
        client_request_id: intent.clientRequestId,
        intent_hash: intentHash,
        temp_path: uploadPath,
        declared_content_type: intent.declaredContentType,
        declared_size_bytes: intent.declaredSizeBytes,
        media_kind: mediaKindForContentType(intent.declaredContentType),
        status: "READY" satisfies WallMediaDraftStatus,
        media_path: post.media_path ?? null,
        poster_path: post.thumbnail_path ?? null,
        media_sha256: post.media_sha256 ?? null,
        expires_at: null,
        recovered_from_post_at: FieldValue.serverTimestamp(),
        created_at: post.created_at ?? FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      return {expiresAt: expiresAt.toISOString(), duplicate: true};
    }
    const profile = userSnap.data() ?? {};
    const authorName = firstString(
      profile.display_name,
      profile.name,
      input.authName
    ) ?? "Jogador";
    const authorPhotoUrl = firstString(
      profile.photo_url,
      profile.photoUrl,
      input.authPicture
    );
    tx.create(draftRef, {
      pipeline_version: WALL_MEDIA_PIPELINE_VERSION,
      post_id: postId,
      group_id: groupId,
      author_id: ownerId,
      author_name: authorName.slice(0, 120),
      author_photo_url: authorPhotoUrl?.slice(0, 2048) ?? null,
      client_request_id: intent.clientRequestId,
      intent_hash: intentHash,
      text: intent.text,
      highlight_ref: intent.highlightRef,
      declared_content_type: intent.declaredContentType,
      declared_size_bytes: intent.declaredSizeBytes,
      media_kind: mediaKindForContentType(intent.declaredContentType),
      temp_path: uploadPath,
      status: "AWAITING_UPLOAD" satisfies WallMediaDraftStatus,
      attempt: 0,
      processing_generation: null,
      processing_lease_expires_at: null,
      error_code: null,
      error_message: null,
      expires_at: Timestamp.fromDate(expiresAt),
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    return {expiresAt: expiresAt.toISOString(), duplicate: false};
  });

  return {
    postId,
    uploadPath,
    expiresAt: result.expiresAt,
    maxBytes: maxBytesForContentType(intent.declaredContentType),
    pipelineVersion: WALL_MEDIA_PIPELINE_VERSION,
    duplicate: result.duplicate,
  };
}

/**
 * Processa somente objetos no staging do mural.
 * @return {Promise<void>} Conclusão idempotente do evento.
 */
export const onGroupWallMediaStaged = functions.storage.onObjectFinalized({
  region: FUNCTION_REGION,
  serviceAccount: MEDIA_PROCESSOR_SERVICE_ACCOUNT,
  memory: "1GiB",
  timeoutSeconds: 300,
  cpu: 1,
  // Capacidade para bursts sem pré-alocação: o autoscaler só cobra instâncias
  // efetivamente ativas. Concurrency 2 limita FFmpeg por processo; backlog e
  // custo são observados pelas métricas do pipeline antes de ajustar este teto.
  concurrency: 2,
  maxInstances: 100,
  retry: true,
}, async (event) => {
  const object = event.data;
  if (!object.name) return;
  const parsed = parseWallMediaStagingPath(object.name);
  if (!parsed) return;
  const startedAt = Date.now();
  const database = db();
  const bucket = getStorage().bucket(object.bucket);
  const generation = storageGeneration(object.generation);
  if (!generation) {
    logger.error("[GROUP_WALL_MEDIA] Missing Storage generation", {
      code: "MISSING_GENERATION",
    });
    return;
  }
  const tempFile = bucket.file(object.name, {
    generation,
    preconditionOpts: {ifGenerationMatch: generation},
  });
  const claim = await claimDraftForProcessing(
    database,
    parsed,
    object.name,
    generation
  );
  if (claim.result === "BUSY") {
    // Não confirme a entrega duplicada: se o holder atual cair depois do claim,
    // o retry com backoff é o único caminho que retoma o draft após o lease.
    // Retornar aqui poderia deixar a mídia presa até o janitor expirar o draft.
    throw new Error("WALL_MEDIA_GENERATION_ALREADY_PROCESSING");
  }
  if (claim.result === "TERMINAL") {
    await deleteStorageGeneration(tempFile);
    return;
  }
  if (claim.result === "ORPHAN") {
    await deleteStorageGeneration(tempFile);
    await writeMetric(database, {
      ...buildWallMediaMetric({
        event: "ORPHAN_CLEANED",
        mediaKind: null,
        sourceBytes: storedObjectSize(object.size),
      }),
      timestamp: FieldValue.serverTimestamp(),
    });
    return;
  }

  let workDir: string | null = null;
  const immutableUploads: UploadedImmutableObject[] = [];
  let finalized = false;
  try {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), "wall-media-"));
    const sourcePath = path.join(workDir, parsed.fileName);
    const draft = claim.data;
    const declaredType = draft.declared_content_type as WallMediaContentType;
    const objectSize = storedObjectSize(object.size);
    // O SDK envia os bytes brutos e a Storage Rule já vincula exatamente
    // request.resource.size ao draft. Preserve a igualdade como defesa em
    // profundidade contra objetos gravados por caminhos privilegiados.
    if (objectSize <= 0 || objectSize !== draft.declared_size_bytes ||
        objectSize >= maxBytesForContentType(declaredType)) {
      throw new WallMediaRejectedError("INVALID_SIZE");
    }
    if (object.contentType !== declaredType) {
      throw new WallMediaRejectedError("MIME_MISMATCH");
    }
    if (declaredType === "video/mp4") await currentFfmpegPath();
    await tempFile.download({destination: sourcePath});
    const processed = await prepareWallMedia(sourcePath, workDir, declaredType);
    const immutable = immutablePaths(
      parsed.groupId,
      parsed.postId,
      processed
    );
    await recordPendingImmutablePaths(
      claim,
      generation,
      immutable.mediaPath,
      immutable.posterPath
    );
    const mediaToken = randomUUID();
    const posterToken = randomUUID();
    immutableUploads.push(await uploadImmutableWallMediaObject(
      bucket,
      processed.finalLocalPath,
      immutable.mediaPath,
      immutableMetadata(
        processed.finalContentType,
        mediaToken,
        parsed.postId,
        processed.sha256
      ),
      parsed.postId,
      processed.sha256,
      mediaToken
    ));
    immutableUploads.push(await uploadImmutableWallMediaObject(
      bucket,
      processed.posterLocalPath,
      immutable.posterPath,
      immutableMetadata(
        "image/webp",
        posterToken,
        parsed.postId,
        processed.sha256
      ),
      parsed.postId,
      processed.sha256,
      posterToken
    ));
    const [mediaStat, posterStat] = await Promise.all([
      fs.stat(processed.finalLocalPath),
      fs.stat(processed.posterLocalPath),
    ]);
    const mediaUrl = firebaseDownloadUrl(
      bucket.name,
      immutable.mediaPath,
      immutableUploads[0].token
    );
    const posterUrl = firebaseDownloadUrl(
      bucket.name,
      immutable.posterPath,
      immutableUploads[1].token
    );
    await finalizeReadyPost(database, claim, parsed, generation, processed, {
      mediaPath: immutable.mediaPath,
      mediaUrl,
      posterPath: immutable.posterPath,
      posterUrl,
      egressBytes: mediaStat.size + posterStat.size,
    });
    finalized = true;
    await writeMetricSafely(database, {
      ...buildWallMediaMetric({
        event: "READY",
        mediaKind: processed.mediaKind,
        latencyMs: Date.now() - startedAt,
        sourceBytes: objectSize,
        egressBytes: mediaStat.size + posterStat.size,
        durationSec: processed.durationSec,
        attempt: claim.attempt,
      }),
      timestamp: FieldValue.serverTimestamp(),
    });
    await deleteStorageGeneration(tempFile);
  } catch (error) {
    if (finalized) {
      logger.warn("[GROUP_WALL_MEDIA] Post ready; cleanup will retry", {
        code: "READY_CLEANUP_RETRY",
      });
      throw error;
    }
    const commitState = immutableUploads.length > 0 ?
      await wallMediaReadyCommitState(
        database,
        claim,
        parsed.groupId,
        parsed.postId,
        generation,
        immutableUploads
      ) : "NOT_READY";
    if (commitState === "READY") {
      await writeMetricSafely(database, {
        ...buildWallMediaMetric({
          event: "READY",
          mediaKind: claim.data.media_kind as WallMediaKind,
          latencyMs: Date.now() - startedAt,
          sourceBytes: storedObjectSize(object.size),
          attempt: claim.attempt,
        }),
        recovered_ambiguous_commit: true,
        timestamp: FieldValue.serverTimestamp(),
      });
      await deleteStorageGeneration(tempFile);
      return;
    }
    const permanentRejection = error instanceof WallMediaRejectedError;
    const code = permanentRejection ? error.code : "PROCESSING_ERROR";
    logger.error("[GROUP_WALL_MEDIA] Processing failed", {
      code,
      generation,
      error: error instanceof Error ? error.message : "unknown",
    });
    if (commitState === "NOT_READY") {
      await cleanupCreatedImmutableObjects(immutableUploads);
    }
    if (permanentRejection) {
      await rejectDraft(claim, generation, code);
      await deleteStorageGeneration(tempFile);
    } else {
      await releaseDraftForRetry(claim, generation);
    }
    await writeMetricSafely(database, {
      ...buildWallMediaMetric({
        event: permanentRejection ? "REJECTED" : "PROCESSING_RETRY",
        mediaKind: claim.data.media_kind as WallMediaKind,
        latencyMs: Date.now() - startedAt,
        sourceBytes: storedObjectSize(object.size),
        attempt: claim.attempt,
        errorCode: code,
      }),
      timestamp: FieldValue.serverTimestamp(),
    });
    if (!permanentRejection) throw error;
  } finally {
    if (workDir) {
      await fs.rm(workDir, {recursive: true, force: true});
    }
  }
});

/**
 * Remove drafts expirados e staging órfão em lotes limitados.
 * @return {Promise<object>} Contadores agregados sem PII.
 */
export const cleanupExpiredGroupWallMediaDrafts = functions.scheduler.onSchedule({
  region: FUNCTION_REGION,
  serviceAccount: MEDIA_PROCESSOR_SERVICE_ACCOUNT,
  schedule: "every 10 minutes",
  timeZone: "America/Sao_Paulo",
  timeoutSeconds: 300,
  memory: "512MiB",
}, async () => {
  const database = db();
  const now = Timestamp.now();
  const bucket = getStorage().bucket();
  const deadline = Date.now() + JANITOR_TIME_BUDGET_MS;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let scanned = 0;
  let cleaned = 0;
  let cleanupFailures = 0;
  let oldestExpiredAgeMs: number | null = null;
  let backlogPossible = false;

  while (scanned < JANITOR_MAX_DRAFTS_PER_RUN && Date.now() < deadline) {
    const pageSize = Math.min(
      JANITOR_BATCH_SIZE,
      JANITOR_MAX_DRAFTS_PER_RUN - scanned
    );
    let query: FirebaseFirestore.Query = database
      .collectionGroup("wall_post_drafts")
      .where("status", "in", [
        "AWAITING_UPLOAD",
        "PROCESSING",
        "REJECTED",
        "EXPIRED",
      ] satisfies WallMediaDraftStatus[])
      .where("expires_at", "<=", now)
      .orderBy("expires_at", "asc")
      .limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    if (oldestExpiredAgeMs == null) {
      const oldestExpiry = snapshot.docs[0].data().expires_at;
      oldestExpiredAgeMs = oldestExpiry instanceof Timestamp ?
        Math.max(0, now.toMillis() - oldestExpiry.toMillis()) : null;
    }
    scanned += snapshot.size;
    cursor = snapshot.docs[snapshot.docs.length - 1];
    for (let index = 0; index < snapshot.docs.length;
      index += JANITOR_CONCURRENCY) {
      const chunk = snapshot.docs.slice(index, index + JANITOR_CONCURRENCY);
      const results = await Promise.all(chunk.map((candidate) =>
        cleanupExpiredWallMediaDraft(database, bucket, candidate, now)
      ));
      cleaned += results.filter((result) => result === "CLEANED").length;
      cleanupFailures += results.filter((result) => result === "FAILED").length;
    }
    if (snapshot.size < pageSize) break;
    backlogPossible = true;
  }
  backlogPossible = backlogPossible &&
    (scanned >= JANITOR_MAX_DRAFTS_PER_RUN || Date.now() >= deadline);
  if (scanned > 0 || cleanupFailures > 0) {
    await writeMetricSafely(database, {
      ...buildWallMediaMetric({
        event: "DRAFT_EXPIRED",
        mediaKind: null,
      }),
      orphan_count: cleaned,
      scanned,
      cleanup_failures: cleanupFailures,
      backlog_possible: backlogPossible,
      oldest_expired_age_ms: oldestExpiredAgeMs,
      timestamp: FieldValue.serverTimestamp(),
    });
  }
  // Issue #3969: os sinais backlog_possible / cleanup_failures /
  // oldest_expired_age_ms já eram gravados, mas nunca logados — ninguém
  // era notificado quando o janitor saturava ou um draft ficava preso.
  // Drafts EXPIRED que retornam FAILED casam com a query da próxima execução,
  // então sem alarme a retentativa infinita é invisível.
  if (backlogPossible) {
    logger.warn(
      "[GROUP_WALL_MEDIA] Janitor SATURADO: backlog_possible=true " +
      `(scanned=${scanned}, oldest_expired_age_ms=${oldestExpiredAgeMs}). ` +
      "Drafts expirados permanecerao na fila; risco de acumulo."
    );
  }
  if (cleanupFailures > 0) {
    logger.warn(
      "[GROUP_WALL_MEDIA] Janitor com falhas de cleanup: " +
      `${cleanupFailures} draft(s) retornaram FAILED e permanecem ` +
      "EXPIRED (retentativa infinita, sem contador de tentativas)."
    );
  }
  logger.info("[GROUP_WALL_MEDIA] Janitor completed", {
    scanned,
    cleaned,
    cleanupFailures,
    backlogPossible,
    oldestExpiredAgeMs,
  });
});

/**
 * Expira e remove um draft sem post publicado, sem listar o bucket.
 * @param {FirebaseFirestore.Firestore} database Firestore Admin.
 * @param {Bucket} bucket Bucket de mídia.
 * @param {FirebaseFirestore.QueryDocumentSnapshot} candidate Draft expirado.
 * @param {Timestamp} now Relógio consistente da execução.
 * @return {Promise<string>} Resultado agregado sem identificadores.
 */
export async function cleanupExpiredWallMediaDraft(
  database: FirebaseFirestore.Firestore,
  bucket: Bucket,
  candidate: FirebaseFirestore.QueryDocumentSnapshot,
  now: Timestamp
): Promise<"CLEANED" | "SKIPPED" | "FAILED"> {
  const identity = parseWallMediaDraftDocPath(candidate.ref.path);
  if (!identity) return "SKIPPED";
  try {
    const postRef = database.doc(
      `groups/${identity.groupId}/wall_posts/${identity.postId}`
    );
    const claimed = await database.runTransaction(async (tx) => {
      const [fresh, post] = await Promise.all([
        tx.get(candidate.ref),
        tx.get(postRef),
      ]);
      const freshData = fresh.data() ?? {};
      const expiresAt = freshData.expires_at;
      if (!fresh.exists || !(expiresAt instanceof Timestamp) ||
          expiresAt.toMillis() > now.toMillis()) return null;
      if (post.exists) {
        if (post.data()?.media_pipeline_draft_id === identity.postId) {
          tx.update(candidate.ref, {
            status: "READY" satisfies WallMediaDraftStatus,
            expires_at: null,
            processing_lease_expires_at: null,
            author_name: FieldValue.delete(),
            author_photo_url: FieldValue.delete(),
            text: FieldValue.delete(),
            highlight_ref: FieldValue.delete(),
            media_url: FieldValue.delete(),
            poster_url: FieldValue.delete(),
            pending_media_path: FieldValue.delete(),
            pending_poster_path: FieldValue.delete(),
            updated_at: FieldValue.serverTimestamp(),
          });
          return {published: true, tempPath: null, postConflict: false};
        }
      }
      if (freshData.status !== "EXPIRED") {
        tx.update(candidate.ref, {
          status: "EXPIRED" satisfies WallMediaDraftStatus,
          expired_at: FieldValue.serverTimestamp(),
          processing_lease_expires_at: null,
          updated_at: FieldValue.serverTimestamp(),
        });
      }
      const tempPath = typeof freshData.temp_path === "string" &&
        parseWallMediaStagingPath(freshData.temp_path) ?
        freshData.temp_path as string : null;
      const pendingPaths = [
        freshData.pending_media_path,
        freshData.pending_poster_path,
      ].filter((value): value is string =>
        isSafeWallMediaFinalPath(value, identity.groupId, identity.postId)
      );
      return {
        published: false,
        tempPath,
        pendingPaths,
        postConflict: post.exists,
      };
    });
    if (!claimed || claimed.published) return "SKIPPED";
    if (claimed.tempPath) {
      await bucket.file(claimed.tempPath).delete({ignoreNotFound: true});
    }
    if (!claimed.postConflict) {
      await Promise.all((claimed.pendingPaths ?? []).map((objectPath) =>
        bucket.file(objectPath).delete({ignoreNotFound: true})
      ));
    }
    const deleted = await database.runTransaction(async (tx) => {
      const [fresh, post] = await Promise.all([
        tx.get(candidate.ref),
        tx.get(postRef),
      ]);
      const publishedByDraft = post.exists &&
        post.data()?.media_pipeline_draft_id === identity.postId;
      if (!fresh.exists || fresh.data()?.status !== "EXPIRED" ||
          publishedByDraft) {
        return false;
      }
      tx.delete(candidate.ref);
      return true;
    });
    return deleted ? "CLEANED" : "SKIPPED";
  } catch (error) {
    logger.error("[GROUP_WALL_MEDIA] Janitor object cleanup failed", {
      code: "JANITOR_OBJECT_CLEANUP_FAILED",
      error: error instanceof Error ? error.message : "unknown",
    });
    return "FAILED";
  }
}

/**
 * Registra paths exatos antes dos uploads para cleanup com IAM por prefixo.
 * @param {ClaimedDraft} claim Lease atual.
 * @param {string} generation Geração do staging.
 * @param {string} mediaPath Destino original.
 * @param {string} posterPath Destino do poster.
 * @return {Promise<void>} Conclusão transacional.
 */
async function recordPendingImmutablePaths(
  claim: ClaimedDraft,
  generation: string,
  mediaPath: string,
  posterPath: string
): Promise<void> {
  await claim.ref.firestore.runTransaction(async (tx) => {
    const fresh = await tx.get(claim.ref);
    const data = fresh.data() ?? {};
    if (!fresh.exists || data.status !== "PROCESSING" ||
        data.processing_generation !== generation) {
      throw new functions.https.HttpsError(
        "aborted",
        "O processamento foi retomado por outra execução"
      );
    }
    tx.update(claim.ref, {
      pending_media_path: mediaPath,
      pending_poster_path: posterPath,
      updated_at: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Confirma que um path pendente pertence exatamente ao draft.
 * @param {unknown} value Path candidato.
 * @param {string} groupId Grupo esperado.
 * @param {string} postId Post esperado.
 * @return {boolean} Verdadeiro apenas para original/poster content-addressed.
 */
function isSafeWallMediaFinalPath(
  value: unknown,
  groupId: string,
  postId: string
): value is string {
  if (typeof value !== "string") return false;
  const escapedGroup = escapeRegExp(groupId);
  const escapedPost = escapeRegExp(postId);
  return new RegExp(
    `^groups/${escapedGroup}/wall_media/${escapedPost}/` +
    "(?:original/[a-f0-9]{64}\\.(?:webp|mp4)|" +
    "poster/[a-f0-9]{64}\\.webp)$"
  ).test(value);
}


export async function claimDraftForProcessing(
  database: FirebaseFirestore.Firestore,
  parsed: ReturnType<typeof parseWallMediaStagingPath> & object,
  objectPath: string,
  generation: string
): Promise<DraftClaim> {
  const ref = database.doc(
    `groups/${parsed.groupId}/wall_post_drafts/${parsed.postId}`
  );
  const groupRef = database.doc(`groups/${parsed.groupId}`);
  const memberRef = database.doc(
    `groups/${parsed.groupId}/members/${parsed.ownerId}`
  );
  return database.runTransaction(async (tx) => {
    const [snap, groupSnap, memberSnap] = await Promise.all([
      tx.get(ref),
      tx.get(groupRef),
      tx.get(memberRef),
    ]);
    if (!snap.exists) return {result: "ORPHAN" as const, ref};
    const data = snap.data() ?? {};
    if (data.group_id !== parsed.groupId || data.post_id !== parsed.postId ||
        data.author_id !== parsed.ownerId || data.temp_path !== objectPath) {
      return {result: "ORPHAN" as const, ref};
    }
    if (data.status === "READY" || data.status === "REJECTED" ||
        data.status === "EXPIRED") {
      return {result: "TERMINAL" as const, ref, data};
    }
    if (!canPublishWallMedia(groupSnap, memberSnap, parsed.ownerId)) {
      tx.update(ref, {
        status: "REJECTED" satisfies WallMediaDraftStatus,
        error_code: "WALL_ACCESS_REVOKED" satisfies WallMediaErrorCode,
        error_message: wallMediaErrorMessage("WALL_ACCESS_REVOKED"),
        rejected_at: FieldValue.serverTimestamp(),
        processing_lease_expires_at: null,
        updated_at: FieldValue.serverTimestamp(),
      });
      return {result: "TERMINAL" as const, ref, data};
    }
    const nowMs = Date.now();
    const expiresAt = data.expires_at;
    if (!(expiresAt instanceof Timestamp) || expiresAt.toMillis() <= nowMs) {
      tx.update(ref, {
        status: "EXPIRED" satisfies WallMediaDraftStatus,
        expired_at: FieldValue.serverTimestamp(),
        processing_lease_expires_at: null,
        updated_at: FieldValue.serverTimestamp(),
      });
      return {result: "TERMINAL" as const, ref, data};
    }
    const lease = data.processing_lease_expires_at;
    if (data.status === "PROCESSING" &&
        lease instanceof Timestamp && lease.toMillis() > nowMs) {
      return {result: "BUSY" as const, ref, data};
    }
    if (safeCounter(data.attempt) >= WALL_MEDIA_MAX_PROCESSING_ATTEMPTS) {
      tx.update(ref, {
        status: "REJECTED" satisfies WallMediaDraftStatus,
        error_code: "RETRY_LIMIT_EXCEEDED" satisfies WallMediaErrorCode,
        error_message: wallMediaErrorMessage("RETRY_LIMIT_EXCEEDED"),
        rejected_at: FieldValue.serverTimestamp(),
        processing_lease_expires_at: null,
        updated_at: FieldValue.serverTimestamp(),
      });
      return {result: "TERMINAL" as const, ref, data};
    }
    const attempt = safeCounter(data.attempt) + 1;
    tx.update(ref, {
      status: "PROCESSING" satisfies WallMediaDraftStatus,
      attempt,
      processing_generation: generation,
      processing_started_at: FieldValue.serverTimestamp(),
      processing_lease_expires_at: Timestamp.fromMillis(
        nowMs + WALL_MEDIA_PROCESSING_LEASE_MS
      ),
      error_code: null,
      error_message: null,
      updated_at: FieldValue.serverTimestamp(),
    });
    return {result: "CLAIMED" as const, ref, data, attempt};
  });
}

async function prepareWallMedia(
  sourcePath: string,
  workDir: string,
  declaredType: WallMediaContentType
): Promise<ProcessedWallMedia> {
  const prefix = await readPrefix(sourcePath, 32);
  const detectedType = detectWallMediaContentType(prefix);
  if (!detectedType || detectedType !== declaredType) {
    throw new WallMediaRejectedError("MIME_MISMATCH");
  }
  if (declaredType === "video/mp4") {
    return prepareWallVideo(sourcePath, workDir);
  }
  return prepareWallImage(sourcePath, workDir, detectedType);
}

async function prepareWallImage(
  sourcePath: string,
  workDir: string,
  sourceType: WallMediaContentType
): Promise<ProcessedWallMedia> {
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(sourcePath, {failOn: "error"}).metadata();
  } catch {
    throw new WallMediaRejectedError("INVALID_IMAGE");
  }
  const expectedFormat = sourceType === "image/jpeg" ? "jpeg" :
    sourceType === "image/png" ? "png" : "webp";
  if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
    throw new WallMediaRejectedError("MIME_MISMATCH");
  }
  if (metadata.width > WALL_MEDIA_MAX_IMAGE_DIMENSION ||
      metadata.height > WALL_MEDIA_MAX_IMAGE_DIMENSION ||
      metadata.width * metadata.height > WALL_MEDIA_MAX_IMAGE_PIXELS ||
      (metadata.pages ?? 1) > 1) {
    throw new WallMediaRejectedError("IMAGE_TOO_LARGE");
  }
  const finalLocalPath = path.join(workDir, "original.webp");
  const posterLocalPath = path.join(workDir, "poster.webp");
  let finalMetadata: sharp.Metadata;
  try {
    await sharp(sourcePath, {failOn: "error"})
      .rotate()
      .resize({width: 2560, height: 2560, fit: "inside", withoutEnlargement: true})
      .webp({quality: 82, effort: 4})
      .toFile(finalLocalPath);
    await sharp(finalLocalPath)
      .resize({width: 720, height: 720, fit: "inside", withoutEnlargement: true})
      .webp({quality: 72, effort: 3})
      .toFile(posterLocalPath);
    finalMetadata = await sharp(finalLocalPath).metadata();
  } catch {
    throw new WallMediaRejectedError("INVALID_IMAGE");
  }
  return {
    sourceContentType: sourceType,
    finalContentType: "image/webp",
    mediaKind: "IMAGE",
    sha256: await sha256File(finalLocalPath),
    finalLocalPath,
    posterLocalPath,
    durationSec: null,
    videoCodec: null,
    audioCodec: null,
    container: "webp",
    width: finalMetadata.width ?? metadata.width,
    height: finalMetadata.height ?? metadata.height,
  };
}

async function prepareWallVideo(
  sourcePath: string,
  workDir: string
): Promise<ProcessedWallMedia> {
  const probe = await readWallVideoProbe(sourcePath);
  const rejection = validateWallVideoProbe(probe);
  if (rejection) throw new WallMediaRejectedError(rejection);
  let posterLocalPath: string;
  try {
    posterLocalPath = await generateWallVideoPoster(
      sourcePath,
      workDir,
      probe.durationSec as number
    );
  } catch {
    throw new WallMediaRejectedError("INVALID_VIDEO");
  }
  return {
    sourceContentType: "video/mp4",
    finalContentType: "video/mp4",
    mediaKind: "VIDEO",
    sha256: await sha256File(sourcePath),
    finalLocalPath: sourcePath,
    posterLocalPath,
    durationSec: round1(probe.durationSec as number),
    videoCodec: probe.videoCodec,
    audioCodec: probe.audioCodec,
    container: "mp4",
    width: probe.width as number,
    height: probe.height as number,
  };
}

/**
 * Extrai um frame PNG com o FFmpeg 8.1.2 pinado e delega a conversão WebP ao
 * Sharp, mantendo o runtime nativo mínimo e o poster determinístico.
 * @param {string} sourcePath MP4 validado.
 * @param {string} workDir Diretório temporário exclusivo.
 * @param {number} durationSec Duração validada.
 * @return {Promise<string>} Path do poster WebP.
 */
export async function generateWallVideoPoster(
  sourcePath: string,
  workDir: string,
  durationSec: number
): Promise<string> {
  const ffmpegPath = await currentFfmpegPath();
  const frameLocalPath = path.join(workDir, "poster-frame.png");
  const posterLocalPath = path.join(workDir, "poster.webp");
  await execFileAsync(ffmpegPath, [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    ...safeFfmpegMovInputArgs(sourcePath, durationSec < 1 ? 0 : 1),
    "-map", "0:v:0",
    "-an",
    "-sn",
    "-dn",
    "-frames:v", "1",
    "-filter_threads", "1",
    "-vf", "scale='min(720,iw)':-2",
    frameLocalPath,
  ], {timeout: 90_000, maxBuffer: 2 * 1024 * 1024});
  await sharp(frameLocalPath, {failOn: "error"})
    .webp({quality: 75, effort: 3})
    .toFile(posterLocalPath);
  return posterLocalPath;
}

async function readWallVideoProbe(inputPath: string): Promise<WallVideoProbe> {
  const ffmpegPath = await currentFfmpegPath();
  let stderr = "";
  try {
    const result = await execFileAsync(
      ffmpegPath,
      ["-hide_banner", ...safeFfmpegMovInputArgs(inputPath)],
      {timeout: 45_000, maxBuffer: 2 * 1024 * 1024}
    );
    stderr = result.stderr;
  } catch (error) {
    const failure = classifyWallMediaProbeFailure(error);
    if (failure.disposition === "RETRY") throw error;
    if (failure.disposition === "REJECT") {
      throw new WallMediaRejectedError("INVALID_VIDEO");
    }
    stderr = failure.stderr;
  }
  return parseWallVideoProbe(stderr);
}

export async function finalizeReadyPost(
  database: FirebaseFirestore.Firestore,
  claim: ClaimedDraft,
  parsed: ReturnType<typeof parseWallMediaStagingPath> & object,
  generation: string,
  media: ProcessedWallMedia,
  final: {
    mediaPath: string;
    mediaUrl: string;
    posterPath: string;
    posterUrl: string;
    egressBytes: number;
  }
): Promise<void> {
  const postRef = database.doc(
    `groups/${parsed.groupId}/wall_posts/${parsed.postId}`
  );
  const groupRef = database.doc(`groups/${parsed.groupId}`);
  const memberRef = database.doc(
    `groups/${parsed.groupId}/members/${parsed.ownerId}`
  );
  await database.runTransaction(async (tx) => {
    const [freshDraft, existingPost, groupSnap, memberSnap] = await Promise.all([
      tx.get(claim.ref),
      tx.get(postRef),
      tx.get(groupRef),
      tx.get(memberRef),
    ]);
    const draft = freshDraft.data() ?? {};
    if (!freshDraft.exists || draft.status !== "PROCESSING" ||
        draft.processing_generation !== generation) {
      throw new functions.https.HttpsError(
        "aborted",
        "O processamento foi retomado por outra execução"
      );
    }
    if (!canPublishWallMedia(groupSnap, memberSnap, parsed.ownerId)) {
      throw new WallMediaRejectedError("WALL_ACCESS_REVOKED");
    }
    const now = FieldValue.serverTimestamp();
    const postData = {
      group_id: parsed.groupId,
      author_id: draft.author_id,
      author_name: draft.author_name,
      author_photo_url: draft.author_photo_url ?? null,
      text: draft.text ?? "",
      media_url: final.mediaUrl,
      media_path: final.mediaPath,
      media_type: media.finalContentType,
      thumbnail_path: final.posterPath,
      thumbnail_url: final.posterUrl,
      highlight_ref: normalizeStoredHighlight(draft.highlight_ref),
      media_status: "READY",
      media_pipeline_version: WALL_MEDIA_PIPELINE_VERSION,
      media_pipeline_draft_id: parsed.postId,
      media_pipeline_intent_hash: draft.intent_hash,
      media_client_request_id: draft.client_request_id,
      media_sha256: media.sha256,
      media_source_type: media.sourceContentType,
      media_duration_sec: media.durationSec,
      media_video_codec: media.videoCodec,
      media_audio_codec: media.audioCodec,
      media_container: media.container,
      media_width: media.width,
      media_height: media.height,
      pinned: false,
      pinned_by: null,
      pinned_at: null,
      reactions: {},
      comments_count: 0,
      created_at: now,
      updated_at: now,
      edited_at: null,
      deleted_by: null,
      deleted_at: null,
    };
    if (existingPost.exists) {
      const existing = existingPost.data() ?? {};
      const exactIdempotentPost =
        existing.group_id === parsed.groupId &&
        existing.author_id === draft.author_id &&
        existing.media_status === "READY" &&
        existing.media_pipeline_draft_id === parsed.postId &&
        existing.media_pipeline_intent_hash === draft.intent_hash &&
        existing.media_sha256 === media.sha256 &&
        existing.media_path === final.mediaPath &&
        existing.thumbnail_path === final.posterPath;
      if (!exactIdempotentPost) {
        throw new WallMediaRejectedError("POST_ID_CONFLICT");
      }
      // Nunca reescreve o post social: reações, comentários, pin e soft-delete
      // sobrevivem a redelivery/recuperação de commit ambíguo.
    } else {
      tx.create(postRef, postData);
    }
    tx.update(claim.ref, {
      status: "READY" satisfies WallMediaDraftStatus,
      media_path: final.mediaPath,
      poster_path: final.posterPath,
      media_sha256: media.sha256,
      egress_bytes: final.egressBytes,
      ready_at: now,
      processing_lease_expires_at: null,
      error_code: null,
      expires_at: null,
      // Tombstone mínimo: não duplica texto, perfil nem URLs-capability após
      // a publicação e continua suficiente para idempotência permanente.
      author_name: FieldValue.delete(),
      author_photo_url: FieldValue.delete(),
      text: FieldValue.delete(),
      highlight_ref: FieldValue.delete(),
      media_url: FieldValue.delete(),
      media_type: FieldValue.delete(),
      poster_url: FieldValue.delete(),
      source_content_type: FieldValue.delete(),
      duration_sec: FieldValue.delete(),
      video_codec: FieldValue.delete(),
      audio_codec: FieldValue.delete(),
      container: FieldValue.delete(),
      width: FieldValue.delete(),
      height: FieldValue.delete(),
      error_message: FieldValue.delete(),
      pending_media_path: FieldValue.delete(),
      pending_poster_path: FieldValue.delete(),
      updated_at: now,
    });
  });
}

async function rejectDraft(
  claim: ClaimedDraft,
  generation: string,
  code: WallMediaErrorCode
): Promise<void> {
  await claim.ref.firestore.runTransaction(async (tx) => {
    const fresh = await tx.get(claim.ref);
    const data = fresh.data() ?? {};
    if (!fresh.exists || data.status === "READY" ||
        data.processing_generation !== generation) return;
    tx.update(claim.ref, {
      status: "REJECTED" satisfies WallMediaDraftStatus,
      error_code: code,
      error_message: wallMediaErrorMessage(code),
      rejected_at: FieldValue.serverTimestamp(),
      processing_lease_expires_at: null,
      updated_at: FieldValue.serverTimestamp(),
    });
  });
}

async function releaseDraftForRetry(
  claim: ClaimedDraft,
  generation: string
): Promise<void> {
  await claim.ref.firestore.runTransaction(async (tx) => {
    const fresh = await tx.get(claim.ref);
    const data = fresh.data() ?? {};
    if (!fresh.exists || data.status !== "PROCESSING" ||
        data.processing_generation !== generation) return;
    tx.update(claim.ref, {
      processing_lease_expires_at: Timestamp.fromMillis(0),
      error_code: "PROCESSING_ERROR" satisfies WallMediaErrorCode,
      error_message: wallMediaErrorMessage("PROCESSING_ERROR"),
      updated_at: FieldValue.serverTimestamp(),
    });
  });
}

export async function wallMediaReadyCommitState(
  database: FirebaseFirestore.Firestore,
  claim: ClaimedDraft,
  groupId: string,
  postId: string,
  generation: string,
  uploads: UploadedImmutableObject[]
): Promise<"READY" | "NOT_READY" | "UNKNOWN"> {
  try {
    const postRef = database.doc(`groups/${groupId}/wall_posts/${postId}`);
    const [draftSnap, postSnap] = await database.getAll(claim.ref, postRef);
    const draft = draftSnap.data() ?? {};
    const post = postSnap.data() ?? {};
    const mediaPath = uploads.find(({path}) => path.includes("/original/"))?.path;
    const posterPath = uploads.find(({path}) => path.includes("/poster/"))?.path;
    const draftReady = draftSnap.exists && draft.status === "READY" &&
      draft.processing_generation === generation &&
      draft.media_path === mediaPath && draft.poster_path === posterPath;
    const postReady = postSnap.exists && post.media_status === "READY" &&
      post.media_pipeline_draft_id === postId &&
      post.media_path === mediaPath && post.thumbnail_path === posterPath;
    if (draftReady && postReady) return "READY";
    if (draftReady || postReady) return "UNKNOWN";
    return "NOT_READY";
  } catch (error) {
    logger.warn("[GROUP_WALL_MEDIA] Ready commit state is ambiguous", {
      code: "READY_COMMIT_STATE_UNKNOWN",
      error: error instanceof Error ? error.message : "unknown",
    });
    return "UNKNOWN";
  }
}

/**
 * Publica um objeto content-addressed sem sobrescrever uma geração existente.
 * Uma repetição só adota o objeto se postId e SHA-256 forem idênticos.
 * @param {Bucket} bucket Bucket do evento.
 * @param {string} localPath Arquivo processado local.
 * @param {string} destination Path imutável final.
 * @param {FileMetadata} metadata Metadata e token de download.
 * @param {string} postId Draft que possui o objeto.
 * @param {string} sha256 Hash do conteúdo processado.
 * @param {string} token Token gerado para uma criação nova.
 * @return {Promise<UploadedImmutableObject>} Objeto criado ou adotado.
 */
export async function uploadImmutableWallMediaObject(
  bucket: Bucket,
  localPath: string,
  destination: string,
  metadata: FileMetadata,
  postId: string,
  sha256: string,
  token: string
): Promise<UploadedImmutableObject> {
  try {
    const [uploaded] = await bucket.upload(localPath, {
      destination,
      resumable: false,
      validation: "crc32c",
      preconditionOpts: {ifGenerationMatch: 0},
      metadata,
    });
    const [stored] = await uploaded.getMetadata();
    const generation = storageGeneration(stored.generation);
    if (!generation) throw new Error("WALL_MEDIA_GENERATION_UNREADABLE");
    return {
      file: generationFile(bucket, destination, generation),
      path: destination,
      generation,
      token,
      created: true,
    };
  } catch (error) {
    if (!isStoragePreconditionFailed(error)) throw error;
    const existing = bucket.file(destination);
    const [stored] = await existing.getMetadata();
    const custom = stored.metadata ?? {};
    const generation = storageGeneration(stored.generation);
    const existingToken = firstStorageDownloadToken(
      custom.firebaseStorageDownloadTokens
    );
    if (custom.postId !== postId || custom.sha256 !== sha256 ||
        !generation || !existingToken) {
      throw new Error("WALL_MEDIA_IMMUTABLE_PATH_CONFLICT");
    }
    return {
      file: generationFile(bucket, destination, generation),
      path: destination,
      generation,
      token: existingToken,
      created: false,
    };
  }
}

async function cleanupCreatedImmutableObjects(
  uploads: UploadedImmutableObject[]
): Promise<void> {
  const settled = await Promise.allSettled(
    uploads.filter(({created}) => created)
      .map(({file}) => deleteStorageGeneration(file))
  );
  const failures = settled.filter(({status}) => status === "rejected").length;
  if (failures > 0) {
    logger.error("[GROUP_WALL_MEDIA] Immutable cleanup incomplete", {failures});
  }
}

async function deleteStorageGeneration(file: File): Promise<void> {
  await file.delete({ignoreNotFound: true});
}

function generationFile(
  bucket: Bucket,
  objectPath: string,
  generation: string
): File {
  return bucket.file(objectPath, {
    generation,
    preconditionOpts: {ifGenerationMatch: generation},
  });
}

function isStoragePreconditionFailed(error: unknown): boolean {
  const candidate = error as {
    code?: number | string;
    statusCode?: number;
    response?: {statusCode?: number; status?: number};
  };
  return Number(candidate?.code) === 412 || candidate?.statusCode === 412 ||
    candidate?.response?.statusCode === 412 ||
    candidate?.response?.status === 412;
}

function firstStorageDownloadToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.split(",")[0]?.trim();
  return token || null;
}

function immutablePaths(
  groupId: string,
  postId: string,
  media: ProcessedWallMedia
): {mediaPath: string; posterPath: string} {
  const extension = media.finalContentType === "video/mp4" ? "mp4" : "webp";
  const prefix = `groups/${groupId}/wall_media/${postId}`;
  return {
    mediaPath: `${prefix}/original/${media.sha256}.${extension}`,
    posterPath: `${prefix}/poster/${media.sha256}.webp`,
  };
}

function immutableMetadata(
  contentType: string,
  token: string,
  postId: string,
  sha256: string
) {
  return {
    contentType,
    cacheControl: "public,max-age=31536000,immutable",
    metadata: {
      firebaseStorageDownloadTokens: token,
      pipelineVersion: String(WALL_MEDIA_PIPELINE_VERSION),
      postId,
      sha256,
    },
  };
}

function firebaseDownloadUrl(
  bucket: string,
  objectPath: string,
  token: string
): string {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}` +
    `/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(token)}`;
}

async function readPrefix(filePath: string, length: number): Promise<Buffer> {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const {bytesRead} = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

function authorizeWallDraft(
  group: FirebaseFirestore.DocumentSnapshot,
  member: FirebaseFirestore.DocumentSnapshot,
  uid: string
): void {
  if (!group.exists) {
    throw new functions.https.HttpsError("not-found", "Grupo não encontrado");
  }
  if (!canPublishWallMedia(group, member, uid)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Apenas membros ativos podem publicar no mural"
    );
  }
}

function canPublishWallMedia(
  group: FirebaseFirestore.DocumentSnapshot,
  member: FirebaseFirestore.DocumentSnapshot,
  uid: string
): boolean {
  if (!group.exists) return false;
  const groupData = group.data() ?? {};
  const memberData = member.data() ?? {};
  const groupActive = (groupData.status == null || groupData.status === "ACTIVE") &&
    groupData.is_active !== false && groupData.deleted_at == null;
  const owner = groupData.owner_id === uid;
  const activeMember = member.exists && memberData.user_id === uid &&
    (memberData.status == null || memberData.status === "ACTIVE");
  return groupActive && (owner || activeMember);
}

function requireSafeId(value: unknown, field: string): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(id)) {
    throw new functions.https.HttpsError("invalid-argument", `${field} inválido`);
  }
  return id;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function timestampIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function storedObjectSize(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function storageGeneration(value: unknown): string | null {
  const generation = typeof value === "string" || typeof value === "number" ?
    String(value) : "";
  return /^\d+$/.test(generation) ? generation : null;
}

function safeCounter(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ?
    value : 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeStoredHighlight(value: unknown): WallMediaHighlightRef | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  return typeof raw.game_id === "string" &&
    typeof raw.highlight_id === "string" ? {
      game_id: raw.game_id,
      highlight_id: raw.highlight_id,
    } : null;
}

function parseWallMediaDraftDocPath(
  docPath: string
): {groupId: string; postId: string} | null {
  const match = docPath.match(
    /^groups\/([A-Za-z0-9._-]{1,128})\/wall_post_drafts\/([a-f0-9]{40})$/
  );
  return match ? {groupId: match[1], postId: match[2]} : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

async function writeMetric(
  database: FirebaseFirestore.Firestore,
  metric: Record<string, unknown>
): Promise<void> {
  await database.collection("metrics").add(metric);
}

async function writeMetricSafely(
  database: FirebaseFirestore.Firestore,
  metric: Record<string, unknown>
): Promise<void> {
  try {
    await writeMetric(database, metric);
  } catch (error) {
    logger.warn("[GROUP_WALL_MEDIA] Metric write failed", {
      code: "METRIC_WRITE_FAILED",
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

