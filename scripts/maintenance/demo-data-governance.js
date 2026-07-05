#!/usr/bin/env node
"use strict";

/**
 * Governanca de dados ficticios/pre-beta.
 *
 * Objetivo:
 * - Marcar dados que podem ser limpos antes/depois do beta publico.
 * - Preservar qualquer usuario com CPF + telefone verificados.
 * - Permitir limpeza futura com dry-run e confirmacao explicita.
 *
 * Uso seguro:
 *   node scripts/maintenance/demo-data-governance.js --mode=inventory
 *   node scripts/maintenance/demo-data-governance.js --mode=mark --dry-run
 *   node scripts/maintenance/demo-data-governance.js --mode=mark --apply --confirm=MARK_DEMO_DATA
 *   node scripts/maintenance/demo-data-governance.js --mode=purge --dry-run
 *   node scripts/maintenance/demo-data-governance.js --mode=purge --apply --confirm=DELETE_DEMO_DATA
 */

const admin = require("firebase-admin");

const DEFAULT_PROJECT = "futebadosparcas";
const DEFAULT_DEMO_SEED_ID = "pre_beta_unverified";
const BATCH_LIMIT = 450;
const MARK_CONFIRMATION = "MARK_DEMO_DATA";
const DELETE_CONFIRMATION = "DELETE_DEMO_DATA";

const ROOT_COLLECTIONS = [
  "activities",
  "confirmations",
  "game_events",
  "games",
  "groups",
  "live_games",
  "live_player_stats",
  "live_scores",
  "locations",
  "notifications",
  "player_stats",
  "ranking_deltas",
  "rankings",
  "season_participation",
  "statistics",
  "teams",
  "users",
  "weekly-rankings",
  "xp_logs",
];

const USER_FIELD_COLLECTIONS = [
  ["confirmations", "user_id"],
  ["game_events", "user_id"],
  ["live_player_stats", "player_id"],
  ["player_stats", "user_id"],
  ["ranking_deltas", "user_id"],
  ["season_participation", "user_id"],
  ["statistics", "user_id"],
  ["xp_logs", "user_id"],
];

const OWNER_FIELD_COLLECTIONS = [
  ["games", "owner_id"],
  ["groups", "owner_id"],
  ["locations", "owner_id"],
];

const GAME_FIELD_COLLECTIONS = [
  ["confirmations", "game_id"],
  ["game_events", "game_id"],
  ["live_games", "game_id"],
  ["live_player_stats", "game_id"],
  ["live_scores", "game_id"],
  ["player_stats", "game_id"],
  ["ranking_deltas", "game_id"],
  ["teams", "game_id"],
  ["xp_logs", "game_id"],
];

function parseArgs() {
  const raw = process.argv.slice(2);
  const args = new Map();
  for (const item of raw) {
    if (item.startsWith("--") && item.includes("=")) {
      const [key, ...rest] = item.slice(2).split("=");
      args.set(key, rest.join("="));
    } else if (item.startsWith("--")) {
      args.set(item.slice(2), "true");
    }
  }
  const mode = args.get("mode") || "inventory";
  const apply = args.get("apply") === "true";
  return {
    mode,
    apply,
    dryRun: !apply,
    confirm: args.get("confirm") || "",
    projectId: args.get("project") || process.env.GCLOUD_PROJECT || DEFAULT_PROJECT,
    seedId: args.get("seed-id") || DEFAULT_DEMO_SEED_ID,
    includeUnverified: args.get("include-unverified") !== "false",
    recursiveDryRun: args.get("recursive-dry-run") === "true",
    createdBeforeIso: args.get("created-before") || new Date().toISOString(),
  };
}

function init(projectId) {
  if (!admin.apps.length) {
    admin.initializeApp({projectId});
  }
}

function chunk(list, size = 10) {
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function isTruthy(value) {
  return value === true;
}

function hasDemoFlag(data) {
  return data.is_mock === true ||
    data.isMock === true ||
    data.demo_data === true ||
    data.demoData === true ||
    data.data_origin === "DEMO" ||
    data.dataOrigin === "DEMO" ||
    data.data_origin === "TEST" ||
    data.dataOrigin === "TEST";
}

function hasSeedMarker(data) {
  return typeof data.seed_id === "string" || typeof data.seedId === "string";
}

function isLikelyTestAccount(id, data) {
  const joined = [
    id,
    data.email,
    data.name,
    data.nickname,
    data.phone,
  ].filter(Boolean).join(" ").toLowerCase();
  return joined.includes("@futeba.demo") ||
    joined.includes("@futeba.test") ||
    joined.includes("mock") ||
    joined.includes("teste e2e") ||
    id.startsWith("mock") ||
    id.startsWith("e2e-") ||
    id.includes("mock6m");
}

async function loadAuthUsers(userIds) {
  const output = new Map();
  for (const ids of chunk(userIds, 100)) {
    if (ids.length === 0) continue;
    const result = await admin.auth().getUsers(ids.map((uid) => ({uid})));
    result.users.forEach((user) => output.set(user.uid, user));
  }
  return output;
}

function isRealProtectedUser(userDoc, privateDoc, authUser) {
  const data = userDoc.data() || {};
  const privateData = privateDoc?.data() || {};
  const hasCpf =
    Boolean(privateData.cpfVerifiedAt) ||
    Boolean(privateData.cpf_verified_at) ||
    Boolean(data.cpfVerifiedAt) ||
    Boolean(data.cpf_verified_at);
  const hasPhone =
    Boolean(privateData.phoneVerifiedAt) ||
    Boolean(privateData.phone_verified_at) ||
    Boolean(authUser?.phoneNumber) ||
    data.phone_verified === true ||
    data.phoneVerified === true;
  const isOperationalAdmin =
    data.role === "ADMIN" ||
    authUser?.customClaims?.role === "ADMIN";
  return isOperationalAdmin || (hasCpf && hasPhone);
}

async function loadUsers(db, createdBefore) {
  const usersSnap = await db.collection("users").get();
  const privateRefs = usersSnap.docs.map((doc) => db.doc(`users_private/${doc.id}`));
  const [privateSnaps, authUsers] = await Promise.all([
    privateRefs.length > 0 ? db.getAll(...privateRefs) : [],
    loadAuthUsers(usersSnap.docs.map((doc) => doc.id)),
  ]);
  const privateById = new Map(privateSnaps.map((doc) => [doc.id, doc]));
  const realProtected = new Set();
  const demoCandidates = new Set();
  const rows = [];

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const createdAt = toDate(data.created_at || data.createdAt);
    const createdBeforeCutoff = !createdAt || createdAt.getTime() <= createdBefore.getTime();
    const privateDoc = privateById.get(userDoc.id);
    const protectedReal = isRealProtectedUser(
      userDoc,
      privateDoc,
      authUsers.get(userDoc.id) || null
    );
    const existingDemo = hasDemoFlag(data) || hasSeedMarker(data);
    const likelyTest = isLikelyTestAccount(userDoc.id, data);

    if (protectedReal) {
      realProtected.add(userDoc.id);
    } else if (createdBeforeCutoff && (existingDemo || likelyTest)) {
      demoCandidates.add(userDoc.id);
    }

    rows.push({
      id: userDoc.id,
      ref: userDoc.ref,
      data,
      protectedReal,
      existingDemo,
      likelyTest,
      createdBeforeCutoff,
      privateDoc,
    });
  }

  return {rows, realProtected, demoCandidates};
}

async function queryRefsByField(db, collectionName, field, values) {
  const refs = new Map();
  for (const ids of chunk([...values].filter(Boolean), 10)) {
    if (ids.length === 0) continue;
    const snap = await db.collection(collectionName).where(field, "in", ids).get();
    snap.docs.forEach((doc) => refs.set(doc.ref.path, doc.ref));
  }
  return refs;
}

async function queryRefsByArrayField(db, collectionName, field, values) {
  const refs = new Map();
  for (const ids of chunk([...values].filter(Boolean), 10)) {
    if (ids.length === 0) continue;
    const snap = await db
      .collection(collectionName)
      .where(field, "array-contains-any", ids)
      .get();
    snap.docs.forEach((doc) => refs.set(doc.ref.path, doc.ref));
  }
  return refs;
}

async function queryFlaggedRefs(db, collectionName) {
  const refs = new Map();
  const queries = [
    ["is_mock", true],
    ["demo_data", true],
    ["data_origin", "DEMO"],
    ["data_origin", "TEST"],
  ];
  for (const [field, value] of queries) {
    const snap = await db.collection(collectionName).where(field, "==", value).get();
    snap.docs.forEach((doc) => refs.set(doc.ref.path, doc.ref));
  }
  return refs;
}

async function loadRelatedRefs(db, demoUserIds) {
  const refs = new Map();

  for (const [collectionName, field] of USER_FIELD_COLLECTIONS) {
    const found = await queryRefsByField(db, collectionName, field, demoUserIds);
    found.forEach((ref, path) => refs.set(path, ref));
  }
  for (const [collectionName, field] of OWNER_FIELD_COLLECTIONS) {
    const found = await queryRefsByField(db, collectionName, field, demoUserIds);
    found.forEach((ref, path) => refs.set(path, ref));
  }

  const gamesByPlayers = await queryRefsByArrayField(db, "games", "players", demoUserIds);
  gamesByPlayers.forEach((ref, path) => refs.set(path, ref));

  const groupAdmins = await queryRefsByArrayField(db, "groups", "admin_ids", demoUserIds);
  groupAdmins.forEach((ref, path) => refs.set(path, ref));

  const teamPlayers = await queryRefsByArrayField(db, "teams", "player_ids", demoUserIds);
  teamPlayers.forEach((ref, path) => refs.set(path, ref));

  const gameRefs = [...refs.values()].filter((ref) => ref.parent.id === "games");
  const gameIds = new Set(gameRefs.map((ref) => ref.id));
  for (const [collectionName, field] of GAME_FIELD_COLLECTIONS) {
    const found = await queryRefsByField(db, collectionName, field, gameIds);
    found.forEach((ref, path) => refs.set(path, ref));
  }

  return refs;
}

async function listRecursiveRefs(docRef, output = new Map()) {
  const collections = await docRef.listCollections();
  for (const collectionRef of collections) {
    const snap = await collectionRef.get();
    for (const doc of snap.docs) {
      output.set(doc.ref.path, doc.ref);
      await listRecursiveRefs(doc.ref, output);
    }
  }
  return output;
}

class Writer {
  constructor(db, dryRun) {
    this.db = db;
    this.dryRun = dryRun;
    this.batch = db.batch();
    this.pending = 0;
    this.writes = 0;
    this.deletes = 0;
  }

  async update(ref, data) {
    this.writes += 1;
    if (this.dryRun) return;
    this.batch.set(ref, data, {merge: true});
    this.pending += 1;
    await this.flushIfNeeded();
  }

  async delete(ref) {
    this.deletes += 1;
    if (this.dryRun) return;
    this.batch.delete(ref);
    this.pending += 1;
    await this.flushIfNeeded();
  }

  async flushIfNeeded(force = false) {
    if (this.dryRun) return;
    if (this.pending >= BATCH_LIMIT || (force && this.pending > 0)) {
      await this.batch.commit();
      this.batch = this.db.batch();
      this.pending = 0;
    }
  }
}

async function markMode(db, options) {
  if (options.apply && options.confirm !== MARK_CONFIRMATION) {
    throw new Error(`Use --confirm=${MARK_CONFIRMATION} para aplicar marcacao.`);
  }

  const cutoff = new Date(options.createdBeforeIso);
  if (Number.isNaN(cutoff.getTime())) {
    throw new Error("--created-before deve ser ISO valido.");
  }

  const {rows, realProtected, demoCandidates} = await loadUsers(db, cutoff);
  if (!options.includeUnverified) {
    for (const row of rows) {
      if (!row.existingDemo && !row.likelyTest) demoCandidates.delete(row.id);
    }
  } else {
    for (const row of rows) {
      if (!row.protectedReal && row.createdBeforeCutoff) demoCandidates.add(row.id);
    }
  }

  const writer = new Writer(db, options.dryRun);
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const row of rows) {
    if (realProtected.has(row.id)) {
      await writer.update(row.ref, {
        data_origin: "REAL",
        real_data_protected: true,
        demo_data: false,
        is_mock: false,
        demo_data_reason: admin.firestore.FieldValue.delete(),
        demo_data_marked_at: admin.firestore.FieldValue.delete(),
        updated_at: now,
      });
    } else if (demoCandidates.has(row.id)) {
      await writer.update(row.ref, {
        data_origin: row.likelyTest ? "TEST" : "DEMO",
        demo_data: true,
        is_mock: true,
        seed_id: row.data.seed_id || row.data.seedId || options.seedId,
        demo_data_reason: row.existingDemo || row.likelyTest ?
          "seed_or_test_account" :
          "missing_cpf_or_phone_verification_before_public_beta",
        demo_data_marked_at: now,
        real_data_protected: false,
        updated_at: now,
      });
    }
  }

  const relatedRefs = await loadRelatedRefs(db, demoCandidates);
  const alreadyFlagged = new Map();
  for (const collectionName of ROOT_COLLECTIONS) {
    const found = await queryFlaggedRefs(db, collectionName);
    found.forEach((ref, path) => alreadyFlagged.set(path, ref));
  }
  alreadyFlagged.forEach((ref, path) => relatedRefs.set(path, ref));

  for (const ref of relatedRefs.values()) {
    if (ref.parent.id === "users" && realProtected.has(ref.id)) continue;
    await writer.update(ref, {
      data_origin: "DEMO",
      demo_data: true,
      is_mock: true,
      demo_data_batch_id: options.seedId,
      demo_data_reason: "related_to_demo_or_unverified_pre_beta_data",
      demo_data_marked_at: now,
      updated_at: now,
    });
  }

  if (!options.dryRun) {
    await db.collection("demo_data_registry").doc(options.seedId).set({
      seed_id: options.seedId,
      mode: "mark",
      dry_run: false,
      include_unverified: options.includeUnverified,
      created_before_iso: cutoff.toISOString(),
      demo_user_count: demoCandidates.size,
      protected_real_user_count: realProtected.size,
      related_document_count: relatedRefs.size,
      updated_at: now,
    }, {merge: true});
  }

  await writer.flushIfNeeded(true);
  return {
    mode: "mark",
    dryRun: options.dryRun,
    usersScanned: rows.length,
    demoUsers: demoCandidates.size,
    protectedRealUsers: realProtected.size,
    relatedDocuments: relatedRefs.size,
    plannedWrites: writer.writes,
  };
}

async function inventoryMode(db, options) {
  const {rows, realProtected} = await loadUsers(db, new Date(options.createdBeforeIso));
  const counts = {
    users: rows.length,
    protectedRealUsers: realProtected.size,
    flaggedUsers: rows.filter((row) => hasDemoFlag(row.data) || hasSeedMarker(row.data)).length,
    rootFlaggedDocuments: {},
  };

  for (const collectionName of ROOT_COLLECTIONS) {
    const refs = await queryFlaggedRefs(db, collectionName);
    counts.rootFlaggedDocuments[collectionName] = refs.size;
  }
  return counts;
}

async function purgeMode(db, options) {
  if (options.apply && options.confirm !== DELETE_CONFIRMATION) {
    throw new Error(`Use --confirm=${DELETE_CONFIRMATION} para aplicar limpeza.`);
  }

  const {realProtected} = await loadUsers(db, new Date(options.createdBeforeIso));
  const rootRefs = new Map();
  for (const collectionName of ROOT_COLLECTIONS) {
    const found = await queryFlaggedRefs(db, collectionName);
    found.forEach((ref, path) => rootRefs.set(path, ref));
  }

  for (const uid of realProtected) {
    rootRefs.delete(`users/${uid}`);
  }

  const recursiveRefs = new Map();
  if (!options.dryRun || options.recursiveDryRun) {
    for (const ref of rootRefs.values()) {
      await listRecursiveRefs(ref, recursiveRefs);
    }
  }

  const writer = new Writer(db, options.dryRun);
  for (const ref of recursiveRefs.values()) {
    await writer.delete(ref);
  }
  for (const ref of rootRefs.values()) {
    await writer.delete(ref);
  }

  await writer.flushIfNeeded(true);
  return {
    mode: "purge",
    dryRun: options.dryRun,
    recursiveDryRun: options.recursiveDryRun,
    protectedRealUsers: realProtected.size,
    rootDocuments: rootRefs.size,
    nestedDocuments: recursiveRefs.size,
    plannedDeletes: writer.deletes,
  };
}

async function main() {
  const options = parseArgs();
  init(options.projectId);
  const db = admin.firestore();

  let result;
  if (options.mode === "inventory") {
    result = await inventoryMode(db, options);
  } else if (options.mode === "mark") {
    result = await markMode(db, options);
  } else if (options.mode === "purge") {
    result = await purgeMode(db, options);
  } else {
    throw new Error("--mode deve ser inventory, mark ou purge.");
  }

  console.log(JSON.stringify({
    projectId: options.projectId,
    ...result,
  }, null, 2));
}

main().catch((error) => {
  console.error("[demo-data-governance] erro:", error);
  process.exitCode = 1;
});
