/** Private, ordered registry for push installations. */

import {createHash} from "crypto";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {logger} from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {db} from "../_db";
import {secureCallable} from "../middleware/secure-callable-wrapper";

const TOKENS_COLLECTION = "push_tokens";
const DEVICES_COLLECTION = "push_token_devices";
const MAX_TOKEN_LENGTH = 4096;
const MAX_DEVICE_ID_LENGTH = 200;
export const MAX_ACTIVE_PUSH_INSTALLATIONS = 10;
const ACTIVE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 400;

export type PushPlatform = "ios" | "android" | "web";

interface RegisterPushTokenData {
  token?: unknown;
  deviceId?: unknown;
  platform?: unknown;
  sequence?: unknown;
}

interface UnregisterPushTokenData {
  token?: unknown;
  deviceId?: unknown;
  sequence?: unknown;
}

interface PushTokenRecord {
  userId: string;
  token: string;
  deviceIdHash: string;
  expiresAt?: Timestamp;
}

export interface PushTokenMutationResult {
  applied: boolean;
}

/**
 * Keeps credentials out of document IDs and logs.
 * @param {string} value Raw value.
 * @return {string} SHA-256 hexadecimal hash.
 */
export function hashPushToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Validates a required payload string.
 * @param {unknown} value Raw value.
 * @param {string} field Public field name.
 * @param {number} maxLength Maximum length.
 * @return {string} Normalized string.
 */
function requiredString(
  value: unknown,
  field: string,
  maxLength: number
): string {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${field} deve ser string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} inválido.`);
  }
  return normalized;
}

/**
 * Validates a monotonic operation sequence.
 * @param {unknown} value Raw value.
 * @return {number} Positive safe integer.
 */
function parseSequence(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new HttpsError(
      "invalid-argument",
      "sequence deve ser um inteiro positivo."
    );
  }
  return value as number;
}

/**
 * Validates client platform.
 * @param {unknown} value Raw value.
 * @return {PushPlatform} Canonical platform.
 */
function parsePlatform(value: unknown): PushPlatform {
  if (value === "ios" || value === "android" || value === "web") {
    return value;
  }
  throw new HttpsError("invalid-argument", "platform inválida.");
}

/**
 * Builds a future expiry timestamp.
 * @param {number} durationMs Retention duration.
 * @return {Timestamp} Future timestamp.
 */
function expiresIn(durationMs: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + durationMs);
}

/**
 * Checks TTL fields defensively.
 * @param {unknown} value Potential timestamp.
 * @return {boolean} Whether the record expired.
 */
function isExpired(value: unknown): boolean {
  return value instanceof Timestamp && value.toMillis() <= Date.now();
}

/**
 * Registers or rotates a token. The globally keyed installation document is
 * the ordering barrier across account changes on the same device.
 * @param {string} userId Authenticated UID.
 * @param {RegisterPushTokenData} input Registration payload.
 * @return {Promise<PushTokenMutationResult>} Application result.
 */
export async function registerPushTokenForUser(
  userId: string,
  input: RegisterPushTokenData
): Promise<PushTokenMutationResult> {
  const token = requiredString(input.token, "token", MAX_TOKEN_LENGTH);
  const deviceId = requiredString(
    input.deviceId,
    "deviceId",
    MAX_DEVICE_ID_LENGTH
  );
  const platform = parsePlatform(input.platform);
  const sequence = parseSequence(input.sequence);
  const tokenHash = hashPushToken(token);
  const deviceIdHash = hashPushToken(deviceId);
  const firestore = db();
  const tokenRef = firestore.collection(TOKENS_COLLECTION).doc(tokenHash);
  const deviceRef = firestore.collection(DEVICES_COLLECTION).doc(deviceIdHash);
  const userRef = firestore.collection("users").doc(userId);
  const installationsQuery = firestore.collection(DEVICES_COLLECTION)
    .where("userId", "==", userId)
    .where("state", "==", "active");

  return firestore.runTransaction(async (transaction) => {
    const [userSnapshot, deviceSnapshot, installationsSnapshot,
      targetTokenSnapshot] =
      await Promise.all([
        transaction.get(userRef),
        transaction.get(deviceRef),
        transaction.get(installationsQuery),
        transaction.get(tokenRef),
      ]);
    if (
      !userSnapshot.exists ||
      userSnapshot.get("status") === "DELETED"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Conta indisponível para registrar notificações."
      );
    }
    const storedSequence = deviceSnapshot.get("sequence") as
      number | undefined;
    if (storedSequence != null && sequence <= storedSequence) {
      return {applied: false};
    }

    const alreadyActiveOwned = deviceSnapshot.exists &&
      deviceSnapshot.get("userId") === userId &&
      deviceSnapshot.get("state") === "active" &&
      !isExpired(deviceSnapshot.get("expiresAt"));
    const activeCount = installationsSnapshot.docs.filter((document) =>
      document.get("state") === "active" &&
      !isExpired(document.get("expiresAt"))
    ).length;
    const replacesOwnedActiveToken = targetTokenSnapshot.exists &&
      targetTokenSnapshot.get("userId") === userId &&
      !isExpired(targetTokenSnapshot.get("expiresAt"));
    if (
      !alreadyActiveOwned &&
      !replacesOwnedActiveToken &&
      activeCount >= MAX_ACTIVE_PUSH_INSTALLATIONS
    ) {
      throw new HttpsError(
        "resource-exhausted",
        `Limite de ${MAX_ACTIVE_PUSH_INSTALLATIONS} instalações atingido.`
      );
    }

    const previousTokenHash = deviceSnapshot.get("tokenHash") as
      string | undefined;
    const reassignedDeviceHash = targetTokenSnapshot.get("deviceIdHash") as
      string | undefined;
    let reassignedDevice:
      {ref: FirebaseFirestore.DocumentReference;
        snapshot: FirebaseFirestore.DocumentSnapshot} | undefined;
    if (reassignedDeviceHash && reassignedDeviceHash !== deviceIdHash) {
      const ref = firestore.collection(DEVICES_COLLECTION)
        .doc(reassignedDeviceHash);
      reassignedDevice = {ref, snapshot: await transaction.get(ref)};
    }
    if (previousTokenHash && previousTokenHash !== tokenHash) {
      const previousRef = firestore.collection(TOKENS_COLLECTION)
        .doc(previousTokenHash);
      const previousSnapshot = await transaction.get(previousRef);
      if (
        previousSnapshot.exists &&
        previousSnapshot.get("deviceIdHash") === deviceIdHash &&
        ((previousSnapshot.get("sequence") as number | undefined) ?? 0) <
          sequence
      ) {
        transaction.delete(previousRef);
      }
    }

    if (
      reassignedDevice?.snapshot.get("tokenHash") === tokenHash
    ) {
      transaction.set(reassignedDevice.ref, {
        userId: reassignedDevice.snapshot.get("userId"),
        deviceIdHash: reassignedDeviceHash,
        sequence: reassignedDevice.snapshot.get("sequence") ?? 0,
        state: "reassigned",
        expiresAt: expiresIn(TOMBSTONE_TTL_MS),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const activeExpiry = expiresIn(ACTIVE_TTL_MS);
    transaction.set(tokenRef, {
      userId,
      token,
      tokenHash,
      deviceIdHash,
      platform,
      sequence,
      expiresAt: activeExpiry,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(deviceRef, {
      userId,
      deviceIdHash,
      tokenHash,
      platform,
      sequence,
      state: "active",
      expiresAt: activeExpiry,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {applied: true};
  });
}

/**
 * Leaves an ordered tombstone, so a delayed register cannot restore a token.
 * @param {string} userId Authenticated UID.
 * @param {UnregisterPushTokenData} input Unregistration payload.
 * @return {Promise<PushTokenMutationResult>} Application result.
 */
export async function unregisterPushTokenForUser(
  userId: string,
  input: UnregisterPushTokenData
): Promise<PushTokenMutationResult> {
  const deviceId = requiredString(
    input.deviceId,
    "deviceId",
    MAX_DEVICE_ID_LENGTH
  );
  const sequence = parseSequence(input.sequence);
  const explicitToken = input.token == null ? undefined :
    requiredString(input.token, "token", MAX_TOKEN_LENGTH);
  const deviceIdHash = hashPushToken(deviceId);
  const firestore = db();
  const deviceRef = firestore.collection(DEVICES_COLLECTION).doc(deviceIdHash);

  return firestore.runTransaction(async (transaction) => {
    const deviceSnapshot = await transaction.get(deviceRef);
    const storedSequence = deviceSnapshot.get("sequence") as
      number | undefined;
    if (storedSequence != null && sequence <= storedSequence) {
      return {applied: false};
    }

    const registeredHash = deviceSnapshot.get("tokenHash") as
      string | undefined;
    const tokenHashes = new Set<string>();
    if (registeredHash) tokenHashes.add(registeredHash);
    if (explicitToken) tokenHashes.add(hashPushToken(explicitToken));
    const tokenRefs = [...tokenHashes].map((value) =>
      firestore.collection(TOKENS_COLLECTION).doc(value)
    );
    const tokenSnapshots = await Promise.all(
      tokenRefs.map((reference) => transaction.get(reference))
    );
    tokenSnapshots.forEach((snapshot, index) => {
      if (
        snapshot.exists &&
        snapshot.get("deviceIdHash") === deviceIdHash &&
        ((snapshot.get("sequence") as number | undefined) ?? 0) < sequence
      ) {
        transaction.delete(tokenRefs[index]);
      }
    });

    transaction.set(deviceRef, {
      userId,
      deviceIdHash,
      sequence,
      state: "unregistered",
      expiresAt: expiresIn(TOMBSTONE_TTL_MS),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {applied: true};
  });
}

/**
 * Reads unexpired canonical records for destination users.
 * @param {string[]} userIds Destination UIDs.
 * @return {Promise<Map<string, string[]>>} Tokens grouped by UID.
 */
export async function getRegisteredPushTokens(
  userIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  for (const chunk of chunked(uniqueUserIds, 10)) {
    const snapshot = await db().collection(TOKENS_COLLECTION)
      .where("userId", "in", chunk).get();
    snapshot.docs.forEach((document) => {
      const record = document.data() as Partial<PushTokenRecord>;
      if (!record.userId || !record.token || isExpired(record.expiresAt)) return;
      const tokens = result.get(record.userId) ?? [];
      if (!tokens.includes(record.token)) tokens.push(record.token);
      result.set(record.userId, tokens);
    });
  }
  return result;
}

/**
 * Resolves ownership globally by token hash, independent of destinations.
 * @param {string[]} tokens Candidate tokens.
 * @return {Promise<Map<string, string>>} Token-to-owner mapping.
 */
export async function resolveRegisteredPushTokenOwners(
  tokens: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];
  const firestore = db();
  for (const tokenChunk of chunked(uniqueTokens, 100)) {
    const references = tokenChunk.map((token) =>
      firestore.collection(TOKENS_COLLECTION).doc(hashPushToken(token))
    );
    const snapshots = typeof firestore.getAll === "function" ?
      await firestore.getAll(...references) :
      await Promise.all(references.map((reference) => reference.get()));
    snapshots.forEach((snapshot, index) => {
      const data = snapshot.data() as Partial<PushTokenRecord> | undefined;
      if (!snapshot.exists || isExpired(data?.expiresAt)) return;
      const owner = data?.userId;
      if (owner) result.set(tokenChunk[index], owner);
    });
  }
  return result;
}

/**
 * Removes legacy candidates reassigned canonically to another account.
 * A lookup outage keeps only records already obtained from the private
 * registry; legacy candidates fail closed to prevent cross-account delivery.
 * @param {Map<string, string>} tokenOwners Expected legacy owners.
 * @param {ReadonlySet<string>} trustedCanonicalTokens Tokens already read
 * from the private registry for the expected owner.
 * @return {Promise<Map<string, string>>} Safe token-to-owner mapping.
 */
export async function filterPushTokensByCanonicalOwner(
  tokenOwners: Map<string, string>,
  trustedCanonicalTokens: ReadonlySet<string> = new Set()
): Promise<Map<string, string>> {
  try {
    const canonical = await resolveRegisteredPushTokenOwners(
      [...tokenOwners.keys()]
    );
    return new Map([...tokenOwners].filter(([token, expectedOwner]) => {
      const canonicalOwner = canonical.get(token);
      return canonicalOwner == null || canonicalOwner === expectedOwner;
    }));
  } catch (error) {
    logger.warn(
      "[PUSH_TOKEN] Canonical lookup unavailable; applying fail-closed.",
      error
    );
    return new Map([...tokenOwners].filter(([token]) =>
      trustedCanonicalTokens.has(token)
    ));
  }
}

/**
 * Removes an invalid canonical token without deleting a reassignment.
 * @param {string} userId Expected owner.
 * @param {string} token Invalid token.
 * @return {Promise<void>} Completion.
 */
export async function removeRegisteredPushToken(
  userId: string,
  token: string
): Promise<void> {
  const firestore = db();
  const tokenHash = hashPushToken(token);
  const tokenRef = firestore.collection(TOKENS_COLLECTION)
    .doc(tokenHash);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(tokenRef);
    if (!snapshot.exists || snapshot.get("userId") !== userId) return;
    const deviceIdHash = snapshot.get("deviceIdHash") as string | undefined;
    if (deviceIdHash) {
      const deviceRef = firestore.collection(DEVICES_COLLECTION)
        .doc(deviceIdHash);
      const deviceSnapshot = await transaction.get(deviceRef);
      if (deviceSnapshot.get("tokenHash") === tokenHash) {
        transaction.set(deviceRef, {
          userId,
          deviceIdHash,
          sequence: (deviceSnapshot.get("sequence") as number | undefined) ?? 0,
          state: "invalid",
          expiresAt: expiresIn(TOMBSTONE_TTL_MS),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
    transaction.delete(tokenRef);
  });
}

/**
 * Deletes expired token/device documents in bounded batches.
 * @return {Promise<number>} Deleted record count.
 */
export async function cleanupExpiredPushTokenRecords(): Promise<number> {
  const firestore = db();
  let deleted = 0;
  for (const collection of [TOKENS_COLLECTION, DEVICES_COLLECTION]) {
    while (true) {
      const snapshot = await firestore.collection(collection)
        .where("expiresAt", "<=", Timestamp.now())
        .limit(CLEANUP_BATCH_SIZE)
        .get();
      if (snapshot.empty) break;
      const batch = firestore.batch();
      snapshot.docs.forEach((document) => batch.delete(document.ref, {
        lastUpdateTime: document.updateTime,
      }));
      try {
        await batch.commit();
      } catch (error) {
        const code = (error as {code?: number | string}).code;
        if (code !== 9 && code !== "failed-precondition") throw error;
        logger.info(
          "[PUSH_TOKEN_CLEANUP] Registro renovado durante cleanup; " +
          "reconsultando sem removê-lo."
        );
        continue;
      }
      deleted += snapshot.size;
      if (snapshot.size < CLEANUP_BATCH_SIZE) break;
    }
  }
  return deleted;
}

/**
 * Divides values into bounded chunks.
 * @param {Array<T>} values Values.
 * @param {number} size Chunk size.
 * @return {Array<Array<T>>} Chunks.
 */
function chunked<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export const registerPushToken = secureCallable<RegisterPushTokenData, {
  success: true;
  applied: boolean;
}>({
  requireAuth: true,
  consumeAppCheckToken: false,
  rateLimit: {maxRequests: 30, windowMs: 60 * 1000,
    keyPrefix: "register_push_token"},
  enableAuditLog: false,
}, async (request) => {
  const result = await registerPushTokenForUser(
    request.auth!.uid,
    request.data || {}
  );
  return {success: true, applied: result.applied};
});

export const unregisterPushToken = secureCallable<UnregisterPushTokenData, {
  success: true;
  applied: boolean;
}>({
  requireAuth: true,
  consumeAppCheckToken: false,
  rateLimit: {maxRequests: 30, windowMs: 60 * 1000,
    keyPrefix: "unregister_push_token"},
  enableAuditLog: false,
}, async (request) => {
  const result = await unregisterPushTokenForUser(
    request.auth!.uid,
    request.data || {}
  );
  return {success: true, applied: result.applied};
});

export const cleanupExpiredPushTokens = onSchedule({
  schedule: "every day 03:15",
  timeZone: "America/Sao_Paulo",
  region: "southamerica-east1",
  timeoutSeconds: 300,
}, async () => {
  await cleanupExpiredPushTokenRecords();
});
