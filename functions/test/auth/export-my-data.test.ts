/**
 * #4482 — callable exportMyData (LGPD art. 18, V).
 *
 * Três camadas:
 * 1. COBERTURA: toda coleção/campo do mapa canônico (uid-owned-collections)
 *    e todo literal de coleção dos irmãos (onUserDeleted, cascata, merge)
 *    está na exportação ou em EXPORT_EXCLUSIONS com motivo. É o teste que
 *    impede "cada irmão ser o ponto cego do outro" (#4112/#4113).
 * 2. CONTEÚDO: Firestore fake em memória com dados de terceiros; o arquivo
 *    não pode carregar nome/foto/uid de outra pessoa nem credenciais.
 * 3. CALLABLE: secureCallable REAL (onCall é identidade): App Check, login,
 *    limite diário e auditoria.
 */

import * as fs from "fs";
import * as path from "path";

type Data = Record<string, unknown>;

const state = new Map<string, Data>();
const addedDocs: Array<{collection: string; data: Data}> = [];
/** collectionGroup que o fake faz falhar (índice ausente em produção). */
const failingCollectionGroups = new Map<string, number>();

const mockCheckRateLimit = jest.fn();

const segmentsOf = (p: string): string[] => p.split("/");
const idOf = (p: string): string => segmentsOf(p).pop() ?? "";
const parentOf = (p: string): string => segmentsOf(p).slice(0, -1).join("/");

interface FakeSnap {
  id: string;
  ref: {id: string; path: string};
  exists: boolean;
  data: () => Data | undefined;
}

function makeSnap(p: string): FakeSnap {
  return {
    id: idOf(p),
    ref: {id: idOf(p), path: p},
    exists: state.has(p),
    data: () => state.get(p),
  };
}

interface Filter {
  field: string;
  op: string;
  value: unknown;
}

function matches(data: Data, filter: Filter): boolean {
  const current = data[filter.field];
  if (filter.op === "==") return current === filter.value;
  if (filter.op === "array-contains") return Array.isArray(current) && current.includes(filter.value);
  throw new Error(`operador não suportado no fake: ${filter.op}`);
}

function makeQuery(
  scope: {collectionPath?: string; groupId?: string},
  filters: Filter[] = [],
  limitValue?: number,
  afterPath?: string,
): Record<string, unknown> {
  const next = (patch: {filters?: Filter[]; limit?: number; after?: string}) =>
    makeQuery(scope, patch.filters ?? filters, patch.limit ?? limitValue, patch.after ?? afterPath);
  return {
    id: scope.collectionPath ? idOf(scope.collectionPath) : scope.groupId,
    where: (field: string, op: string, value: unknown) => next({filters: [...filters, {field, op, value}]}),
    limit: (value: number) => next({limit: value}),
    startAfter: (snap: FakeSnap) => next({after: snap.ref.path}),
    select: () => next({}),
    get: async () => {
      if (scope.groupId && failingCollectionGroups.has(scope.groupId)) {
        throw Object.assign(new Error("The query requires an index"), {
          code: failingCollectionGroups.get(scope.groupId),
        });
      }
      let paths = [...state.keys()]
        .filter((p) => scope.collectionPath ?
          parentOf(p) === scope.collectionPath :
          segmentsOf(p).length % 2 === 0 && segmentsOf(p).slice(-2)[0] === scope.groupId)
        .filter((p) => filters.every((filter) => matches(state.get(p) ?? {}, filter)))
        .sort();
      if (afterPath !== undefined) paths = paths.filter((p) => p > afterPath);
      if (limitValue !== undefined) paths = paths.slice(0, limitValue);
      const docs = paths.map(makeSnap);
      return {docs, size: docs.length, empty: docs.length === 0};
    },
    add: async (data: Data) => {
      addedDocs.push({collection: scope.collectionPath ?? "", data});
      return {id: `auto-${addedDocs.length}`};
    },
  };
}

const fakeDb = {
  collection: (p: string) => makeQuery({collectionPath: p}),
  collectionGroup: (id: string) => makeQuery({groupId: id}),
  doc: (p: string) => ({
    id: idOf(p),
    path: p,
    get: async () => makeSnap(p),
    listCollections: async () => {
      const prefix = `${p}/`;
      const ids = new Set<string>();
      for (const key of state.keys()) {
        if (key.startsWith(prefix)) ids.add(segmentsOf(key.slice(prefix.length))[0]);
      }
      return [...ids].map((sub) => makeQuery({collectionPath: `${p}/${sub}`}));
    },
  }),
};

jest.mock("firebase-functions", () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;
    details?: unknown;

    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
      this.name = "HttpsError";
    }
  },
}));

jest.mock("firebase-admin", () => ({
  apps: [{name: "test"}],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => fakeDb),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {serverTimestamp: () => "SERVER_TIMESTAMP"},
}));

jest.mock("../../src/_db", () => ({db: () => fakeDb}));
jest.mock("../../src/utils/firebase-lazy", () => ({
  getStorage: () => ({
    bucket: () => ({getFiles: async () => [[]]}),
  }),
}));
jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));
jest.mock("../../src/auth/anti-abuse", () => ({
  clientIp: jest.fn(() => "203.0.113.1"),
  rateLimitForRequest: jest.fn(),
}));

import {AUDIT_LOGS, UID_OWNED_COLLECTIONS} from "../../src/auth/uid-owned-collections";
import {
  EXPORT_EXCLUSIONS,
  EXPORT_RATE_LIMIT,
  EXPORT_SOURCES,
  MAX_EXPORT_BYTES,
  OTHER_PERSON_PLACEHOLDER,
  buildExport,
  enforceSizeCap,
  opaqueRef,
  exportMyData,
  stripCredentials,
  toJsonSafe,
  type ExportPayload,
} from "../../src/auth/export-my-data";

const UID = "titular-uid";
const OTHER = "terceiro-uid";
const OTHER_NAME = "Terceiro Silva";
const OTHER_PHOTO = "https://example.test/terceiro.jpg";

// ---------------------------------------------------------------------------
// 1. Cobertura contra o mapa e contra os irmãos
// ---------------------------------------------------------------------------

const SRC = path.join(__dirname, "../../src/auth");
const SIBLINGS = ["account-cleanup.ts", "account-deletion-cascade.ts", "account-merge.ts"];

const isPlaceholder = (segment: string): boolean => segment.startsWith("{") || segment === "*";

/** Nomes de coleção que a exportação cobre (todos os segmentos literais). */
function coveredNames(): Set<string> {
  const names = new Set<string>();
  for (const spec of EXPORT_SOURCES) {
    const target = spec.collection.startsWith("storage:") ?
      spec.collection.slice("storage:".length).split(/[|/.]/) :
      spec.collection.split("/");
    for (const segment of target) {
      if (segment && !isPlaceholder(segment)) names.add(segment);
    }
    for (const discovery of spec.discovery ?? []) names.add(discovery.collection);
    for (const sub of spec.knownSubcollections ?? []) names.add(sub);
  }
  return names;
}

/** Fontes cuja coleção termina no segmento `name`. */
function sourcesEndingWith(name: string) {
  return EXPORT_SOURCES.filter((spec) => {
    const segments = spec.collection.split("/").filter((s) => !isPlaceholder(s));
    return segments[segments.length - 1] === name ||
      (spec.collection === "users/{uid}/*" && (spec.knownSubcollections ?? []).includes(name));
  });
}

describe("exportMyData — cobertura (irmãos não podem divergir)", () => {
  test("toda coleção do mapa canônico é exportada com TODOS os campos de uid", () => {
    for (const entry of UID_OWNED_COLLECTIONS) {
      const sources = entry.collection.startsWith("users/{uid}/") ?
        EXPORT_SOURCES.filter((spec) => spec.collection === "users/{uid}/*") :
        EXPORT_SOURCES.filter((spec) => spec.collection === entry.collection);
      expect({collection: entry.collection, covered: sources.length > 0})
        .toEqual({collection: entry.collection, covered: true});

      const exportedFields = new Set(sources.flatMap((spec) => spec.uidFields));
      for (const field of entry.uidFields) {
        expect({collection: entry.collection, field, covered: exportedFields.has(field)})
          .toEqual({collection: entry.collection, field, covered: true});
      }
      // ID = uid em coleção raiz (users, users_private, statistics,
      // user_streaks): o escritor pode não gravar o campo de uid.
      if (/^\{uid\}(\s|$)/.test(entry.docIdScheme ?? "") && !entry.collection.includes("{")) {
        expect({collection: entry.collection, byDocId: sources.some((spec) => spec.byDocId)})
          .toEqual({collection: entry.collection, byDocId: true});
      }
    }
  });

  test("o mapa não tem entrada que a exportação declare como exclusão", () => {
    for (const entry of UID_OWNED_COLLECTIONS) {
      expect(EXPORT_EXCLUSIONS[entry.collection]).toBeUndefined();
    }
  });

  test("todo literal de coleção do cleanup, da cascata e do merge é exportado ou excluído com motivo", () => {
    const covered = coveredNames();
    const found = new Map<string, string>();
    for (const file of SIBLINGS) {
      const source = fs.readFileSync(path.join(SRC, file), "utf8");
      const patterns = [
        /(?:collection|collectionGroup)\(\s*"([a-z_]+)"/g,
        /([a-z_]+)\/\$\{/g,
      ];
      for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) found.set(match[1], file);
      }
      for (const loop of source.matchAll(/for \(const collectionName of \[([^\]]*)\]/g)) {
        for (const name of loop[1].matchAll(/"([a-z_]+)"/g)) found.set(name[1], file);
      }
    }
    // Sanidade do scanner: se o regex parar de casar, o teste não pode passar vazio.
    expect(found.size).toBeGreaterThan(20);
    for (const [name, file] of found) {
      const decided = covered.has(name) || name in EXPORT_EXCLUSIONS;
      expect({name, file, decided}).toEqual({name, file, decided: true});
    }
  });

  test("os pares coleção/campo dos irmãos usam o mesmo campo na exportação", () => {
    for (const file of SIBLINGS) {
      const source = fs.readFileSync(path.join(SRC, file), "utf8");
      const pairs = source.matchAll(
        /(?:collection|collectionGroup)\(\s*"([a-z_]+)"\s*\)\s*\.where\(\s*"([a-zA-Z_]+)"/g,
      );
      for (const [, collection, field] of pairs) {
        if (collection in EXPORT_EXCLUSIONS) continue;
        const sources = sourcesEndingWith(collection);
        const fields = new Set(sources.flatMap((spec) => spec.uidFields));
        const discoveryFields = new Set(EXPORT_SOURCES.flatMap((spec) =>
          (spec.discovery ?? []).filter((d) => d.collection === collection).map((d) => d.field)));
        const ok = fields.has(field) || discoveryFields.has(field);
        expect({file, collection, field, ok}).toEqual({file, collection, field, ok: true});
      }
    }
  });

  test("laços do cleanup por nome de coleção: push (userId) e mídia (uploaded_by)", () => {
    const cleanup = fs.readFileSync(path.join(SRC, "account-cleanup.ts"), "utf8");
    expect(cleanup).toMatch(/\["push_tokens", "push_token_devices"\][\s\S]{0,300}\.where\("userId"/);
    expect(cleanup).toMatch(/\["game_photos", "game_videos"\][\s\S]{0,1200}\.where\("uploaded_by"/);
    for (const key of ["push_tokens", "push_token_devices"]) {
      expect(EXPORT_SOURCES.find((spec) => spec.key === key)?.uidFields).toEqual(["userId"]);
    }
    for (const key of ["game_photos", "game_videos"]) {
      expect(EXPORT_SOURCES.find((spec) => spec.key === key)?.uidFields).toEqual(["uploaded_by"]);
    }
  });

  test("formas legadas de campo dos escritores estão presentes", () => {
    const fieldsOf = (key: string) => EXPORT_SOURCES.find((spec) => spec.key === key)?.uidFields;
    expect(fieldsOf("confirmations")).toEqual(expect.arrayContaining(["user_id", "userId"]));
    expect(fieldsOf("group_invites_received")).toEqual(expect.arrayContaining(["invited_user_id", "invitedUserId"]));
    expect(fieldsOf("owned_groups")).toEqual(expect.arrayContaining(["owner_id", "ownerId"]));
    expect(fieldsOf("audit_logs")).toEqual(expect.arrayContaining([
      "target_user_id", "actor_user_id", "performed_by", "manager_uid", "source_user_id", "userId",
    ]));
  });

  test("paridade (#4487): todo campo de uid de audit_logs exportado também é apagado na exclusão", () => {
    const cleanupFields = new Set<string>([
      AUDIT_LOGS.targetField, AUDIT_LOGS.actorField, ...AUDIT_LOGS.otherUidFields,
    ]);
    const exportFields = EXPORT_SOURCES
      .filter((spec) => spec.collection === AUDIT_LOGS.collection)
      .flatMap((spec) => [...spec.uidFields]);
    expect(exportFields.length).toBeGreaterThan(0);
    expect(exportFields.filter((field) => !cleanupFields.has(field))).toEqual([]);
    // O campo do wrapper (secureCallable/logAudit) tem de estar nos dois lados.
    expect(exportFields).toContain("userId");
    expect(cleanupFields.has("userId")).toBe(true);
  });

  test("toda exclusão tem motivo e não é exportada ao mesmo tempo", () => {
    const covered = coveredNames();
    for (const [name, reason] of Object.entries(EXPORT_EXCLUSIONS)) {
      expect(reason.trim().length).toBeGreaterThan(10);
      expect({name, exported: covered.has(name)}).toEqual({name, exported: false});
    }
  });

  test("chaves de fonte são únicas", () => {
    const keys = EXPORT_SOURCES.map((spec) => spec.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ---------------------------------------------------------------------------
// 2. Serialização e credenciais
// ---------------------------------------------------------------------------

class FakeTimestamp {
  constructor(private readonly ms: number) {}
  toDate(): Date {
    return new Date(this.ms);
  }
  toMillis(): number {
    return this.ms;
  }
}

class FakeGeoPoint {
  constructor(readonly latitude: number, readonly longitude: number) {}
  isEqual(): boolean {
    return false;
  }
}

class FakeRef {
  readonly firestore = {};
  readonly parent = {};
  constructor(readonly path: string) {}
}

const ISO = "2026-10-31T15:30:00.000Z";
const ts = () => new FakeTimestamp(Date.parse(ISO));

describe("toJsonSafe / stripCredentials", () => {
  test("Timestamp, GeoPoint, DocumentReference e bytes, aninhados em map e array", () => {
    const value = toJsonSafe({
      at: ts(),
      list: [ts(), {where: new FakeGeoPoint(-23.5, -46.6)}, new FakeRef("groups/g1")],
      nested: {ref: new FakeRef("games/x"), bytes: new Uint8Array([1, 2, 3]), date: new Date(ISO)},
      bad: Number.NaN,
      empty: undefined,
    });
    expect(value).toEqual({
      at: ISO,
      list: [ISO, {where: {latitude: -23.5, longitude: -46.6}}, "groups/g1"],
      nested: {ref: "games/x", bytes: "AQID", date: ISO},
      bad: null,
      empty: null,
    });
    expect(() => JSON.stringify(value)).not.toThrow();
  });

  test("remove tokens, hashes e segredos em qualquer nível", () => {
    expect(stripCredentials({
      name: "Eu",
      fcm_token: "x",
      cpfHash: "h",
      phoneHash: "h",
      prefs: {pushToken: "y", theme: "dark"},
      list: [{tokenHash: "z", ok: true}],
    })).toEqual({name: "Eu", prefs: {theme: "dark"}, list: [{ok: true}]});
  });
});

// ---------------------------------------------------------------------------
// 3. Conteúdo do arquivo
// ---------------------------------------------------------------------------

function seed(): void {
  state.set(`users/${UID}`, {name: "Titular", email: "titular@example.test", fcm_token: "TOKEN", created_at: ts()});
  state.set(`users_private/${UID}`, {email: "titular@example.test", cpfHash: "HASH", phoneHash: "HASH2"});
  state.set(`users/${UID}/groups/g1`, {group_id: "g1", group_name: "Pelada de Quinta"});
  state.set(`users/${UID}/followers/${OTHER}`, {follower_user_id: OTHER, follower_name: OTHER_NAME});
  state.set(`users/${UID}/following/${OTHER}`, {target_user_id: OTHER});
  state.set(`users/${OTHER}`, {name: OTHER_NAME});

  // Confirmação legada (userId camel) e atual.
  state.set(`confirmations/game1_${UID}`, {game_id: "game1", user_id: UID, user_name: "Titular", status: "CONFIRMED"});
  state.set("confirmations/legacy1", {gameId: "game0", userId: UID, status: "CONFIRMED"});
  state.set(`confirmations/game1_${OTHER}`, {game_id: "game1", user_id: OTHER, user_name: OTHER_NAME});

  // statistics: escritor das Functions grava pelo ID, sem user_id.
  state.set(`statistics/${UID}`, {totalGames: 12, totalGoals: 5});
  state.set(`statistics/${OTHER}`, {totalGames: 99});

  state.set("notifications/n1", {
    user_id: UID, title: "Convocação", body: "Você foi convocado", type: "GAME_SUMMON",
    sender_id: OTHER, sender_name: OTHER_NAME, created_at: ts(),
  });
  state.set("game_summons/s1", {
    game_id: "game1", group_id: "g1", user_id: UID, user_name: "Titular", status: "PENDING",
    summoned_by: OTHER, summoned_by_name: OTHER_NAME, summoned_at: ts(),
  });
  state.set("group_invites/i1", {
    group_id: "g2", group_name: "Racha", invitedUserId: UID, invited_user_name: "Titular",
    invited_by_id: OTHER, invited_by_name: OTHER_NAME, status: "PENDING",
  });

  state.set("groups/g1", {name: "Pelada de Quinta", owner_id: UID, owner_name: "Titular", members: [UID, OTHER]});
  state.set(`groups/g1/members/${UID}`, {user_id: UID, user_name: "Titular", role: "OWNER", status: "ACTIVE"});
  state.set(`groups/g1/members/${OTHER}`, {user_id: OTHER, user_name: OTHER_NAME, role: "MEMBER"});
  // Grupo que o titular DEIXOU: some do espelho, aparece no collectionGroup.
  state.set(`groups/g9/members/${UID}`, {user_id: UID, user_name: "Titular", status: "INACTIVE"});

  state.set("mvp_votes/game1_titular_MVP", {game_id: "game1", voter_id: UID, voted_player_id: OTHER, category: "MVP"});
  state.set("mvp_votes/game1_terceiro_MVP", {game_id: "game1", voter_id: OTHER, voted_player_id: UID, category: "MVP"});

  state.set("post_game_reputation/game1_t_o", {
    game_id: "game1", reviewer_id: UID, reviewer_name: "Titular", target_user_id: OTHER,
    target_user_name: OTHER_NAME, target_user_photo: OTHER_PHOTO, overall: 5, comment: "Jogou bem",
  });
  state.set("post_game_reputation/game1_o_t", {
    game_id: "game1", reviewer_id: OTHER, reviewer_name: OTHER_NAME, reviewer_photo: OTHER_PHOTO,
    target_user_id: UID, target_user_name: "Titular", overall: 3, comment: "assinado: Terceiro",
  });

  // Caixa: titular lançou o pagamento de outra pessoa (descrição com o nome).
  state.set("groups/g1/cashbox/c1", {
    group_id: "g1", type: "INCOME", amount: 30, description: `Pagamento de ${OTHER_NAME}`,
    created_by: UID, created_by_name: "Titular", player_id: OTHER, player_name: OTHER_NAME,
    receipt_url: "https://storage.test/r?token=abc",
  });
  // Titular pagou; quem lançou foi outra pessoa.
  state.set("groups/g1/cashbox/c2", {
    group_id: "g1", type: "INCOME", amount: 30, description: "Pagamento de Titular",
    created_by: OTHER, created_by_name: OTHER_NAME, player_id: UID, player_name: "Titular",
  });

  state.set("groups/g1/monthly_finance_periods/2026-10", {status: "OPEN"});
  state.set(`groups/g1/monthly_finance_periods/2026-10/payers/${UID}`, {user_id: UID, user_name: "Titular", expected: 50});

  state.set("games/game1", {
    group_id: "g1", owner_id: UID, owner_name: "Titular", status: "FINISHED", players: [UID, OTHER],
    co_organizers: [OTHER], date: "2026-10-30",
  });
  state.set("games/game2", {
    group_id: "g1", owner_id: OTHER, owner_name: OTHER_NAME, status: "SCHEDULED", co_organizers: [UID],
  });
  state.set(`games/game2/waitlist/${UID}`, {user_id: UID, user_name: "Titular", position: 1});

  state.set("locations/l1/reviews/r1", {user_id: UID, user_name: "Titular", rating: 4, comment: "Boa quadra"});
  state.set("chats/chat1", {participants: [UID, OTHER]});
  state.set("chats/chat1/messages/m1", {sender_id: UID, sender_name: "Titular", text: "Bora jogar?", created_at: ts()});
  state.set("chats/chat1/messages/m2", {sender_id: OTHER, sender_name: OTHER_NAME, text: "Mensagem do terceiro"});

  state.set("push_token_devices/d1", {userId: UID, platform: "web", token: "SECRET", tokenHash: "H", created_at: ts()});
  state.set("audit_logs/a1", {action: "ROLE_CHANGED", target_user_id: UID, actor_user_id: OTHER, created_at: ts()});
  state.set("audit_logs/a2", {type: "RATE_LIMIT_EXCEEDED", userId: UID, ip: "203.0.113.9", status: "DENIED"});
  state.set(`user_locations/${UID}`, {location: new FakeGeoPoint(-23.5, -46.6), updated_at: ts()});
  state.set("xp_logs/game_game1_user_titular", {user_id: UID, xp_earned: 40, ref: new FakeRef("games/game1")});
}

const storageFiles = async (prefix: string) =>
  prefix === `users/${UID}/` ?
    [{name: `users/${UID}/profile.jpg`, contentType: "image/jpeg", size: 1234}] :
    [];

async function exportFor(uid = UID): Promise<ExportPayload> {
  const {payload} = await buildExport(fakeDb as never, uid, {
    listStorageFiles: storageFiles,
    now: new Date(ISO),
  });
  return payload;
}

describe("exportMyData — conteúdo", () => {
  beforeEach(() => {
    state.clear();
    failingCollectionGroups.clear();
    seed();
  });

  test("todas as fontes têm leitor e o arquivo sai completo", async () => {
    const payload = await exportFor();
    expect(payload.incomplete_sources).toEqual([]);
    expect(payload.complete).toBe(true);
    expect(Object.keys(payload.data).sort()).toEqual(EXPORT_SOURCES.map((spec) => spec.key).sort());
    expect(payload.generated_at).toBe(ISO);
    expect(payload.schema_version).toBe(1);
  });

  test("nenhum nome, foto ou uid de terceiro e nenhuma credencial no arquivo", async () => {
    const json = JSON.stringify(await exportFor());
    expect(json).not.toContain(OTHER_NAME);
    expect(json).not.toContain(OTHER_PHOTO);
    expect(json).not.toContain(OTHER);
    expect(json).not.toContain("Terceiro");
    expect(json).not.toContain("TOKEN");
    expect(json).not.toContain("SECRET");
    expect(json).not.toContain("HASH");
    expect(json).not.toContain("receipt_url");
  });

  test("perfil sem fcm_token e perfil privado sem hashes", async () => {
    const {data} = await exportFor();
    expect(data.profile).toEqual(expect.objectContaining({name: "Titular", created_at: ISO}));
    expect(data.profile).not.toHaveProperty("fcm_token");
    expect(data.private_profile).toEqual(expect.objectContaining({email: "titular@example.test"}));
    expect(data.private_profile).not.toHaveProperty("cpfHash");
  });

  test("subcoleções de users/{uid}: seguidores só como contagem", async () => {
    const {data} = await exportFor();
    const subs = data.user_subcollections as Record<string, unknown>;
    expect(subs.followers).toEqual({count: 1});
    expect(subs.following).toEqual({count: 1});
    expect(subs.groups).toEqual([expect.objectContaining({group_name: "Pelada de Quinta"})]);
  });

  test("confirmações: forma atual e legada (userId), sem as de terceiros", async () => {
    const {data} = await exportFor();
    const items = data.confirmations as Data[];
    expect(items.map((item) => item.document_id).sort()).toEqual([`game1_${UID}`, "legacy1"]);
  });

  test("statistics lida pelo ID (escritor das Functions não grava user_id)", async () => {
    const {data} = await exportFor();
    expect(data.statistics).toEqual([expect.objectContaining({totalGames: 12, document_id: UID})]);
  });

  test("votos e avaliações recebidos não revelam quem votou/avaliou", async () => {
    const {data} = await exportFor();
    // O id do voto embute o uid de quem votou: só sai a referência opaca.
    expect(data.mvp_votes_received).toEqual([
      {game_id: "game1", category: "MVP", document_ref: opaqueRef(UID, "mvp_votes/game1_terceiro_MVP")},
    ]);
    expect(JSON.stringify(data.mvp_votes_received)).not.toContain(OTHER);
    expect(JSON.stringify(data.mvp_votes_received)).not.toContain("terceiro");
    expect(opaqueRef(UID, "x")).not.toEqual(opaqueRef("outro-titular", "x"));
    expect((data.mvp_votes_cast as Data[])[0]).not.toHaveProperty("voted_player_id");
    const received = (data.reputation_received as Data[])[0];
    expect(received).toEqual(expect.objectContaining({overall: 3}));
    expect(received).not.toHaveProperty("comment");
    expect(received).not.toHaveProperty("reviewer_id");
    const given = (data.reputation_given as Data[])[0];
    expect(given).toEqual(expect.objectContaining({overall: 5, comment: "Jogou bem"}));
    expect(given).not.toHaveProperty("target_user_id");
  });

  test("jogos: papel do titular, owner_name só quando ele é o dono, sem players", async () => {
    const {data} = await exportFor();
    const games = data.games as Data[];
    const owned = games.find((game) => game.document_id === "game1");
    const coOrganized = games.find((game) => game.document_id === "game2");
    expect(owned).toEqual(expect.objectContaining({owner_name: "Titular", matched_by: ["owner_id"]}));
    expect(owned).not.toHaveProperty("players");
    expect(owned).not.toHaveProperty("co_organizers");
    expect(coOrganized).toEqual(expect.objectContaining({matched_by: ["co_organizers"]}));
    expect(coOrganized).not.toHaveProperty("owner_name");
  });

  test("caixa: os dois papéis e o nome do outro pagador apagado da descrição", async () => {
    const {data} = await exportFor();
    const entries = data.cashbox_entries as Data[];
    const launched = entries.find((entry) => entry.document_ref === opaqueRef(UID, "groups/g1/cashbox/c1"));
    const paid = entries.find((entry) => entry.document_ref === opaqueRef(UID, "groups/g1/cashbox/c2"));
    expect(launched).toEqual(expect.objectContaining({
      matched_by: ["created_by"],
      description: `Pagamento de ${OTHER_PERSON_PLACEHOLDER}`,
    }));
    expect(paid).toEqual(expect.objectContaining({matched_by: ["player_id"], description: "Pagamento de Titular"}));
  });

  test("grupos: membership inclusive de grupo deixado, pagador mensal e fila de espera", async () => {
    const {data} = await exportFor();
    expect((data.group_memberships as Data[]).map((item) => item.document_path).sort())
      .toEqual([`groups/g1/members/${UID}`, `groups/g9/members/${UID}`]);
    expect(data.monthly_finance_payers).toEqual([expect.objectContaining({expected: 50})]);
    expect(data.game_waitlist).toEqual([expect.objectContaining({position: 1})]);
    expect(data.owned_groups).toEqual([expect.objectContaining({name: "Pelada de Quinta"})]);
    expect(data.owned_groups as Data[]).not.toContainEqual(expect.objectContaining({members: expect.anything()}));
  });

  test("convites, notificações, convocações e mensagens sem o outro lado", async () => {
    const {data} = await exportFor();
    expect(data.group_invites_received).toEqual([expect.objectContaining({group_name: "Racha", status: "PENDING"})]);
    expect((data.notifications as Data[])[0]).not.toHaveProperty("sender_name");
    expect((data.game_summons as Data[])[0]).not.toHaveProperty("summoned_by_name");
    expect(data.direct_messages_sent).toEqual([
      expect.objectContaining({text: "Bora jogar?", chat_ref: opaqueRef(UID, "chat:chat1"), created_at: ISO}),
    ]);
    expect(data.direct_messages_sent as Data[]).not.toContainEqual(expect.objectContaining({chat_id: expect.anything()}));
  });

  test("auditoria pelos campos do mapa e pelo userId do wrapper, sem IP", async () => {
    const {data} = await exportFor();
    const logs = data.audit_logs as Data[];
    expect(logs.map((log) => log.matched_by)).toEqual([["target_user_id"], ["userId"]]);
    expect(JSON.stringify(logs)).not.toContain("203.0.113.9");
  });

  test("datas em ISO, GeoPoint e referência serializados; Storage só metadados", async () => {
    const {data} = await exportFor();
    expect(data.user_location).toEqual(expect.objectContaining({
      location: {latitude: -23.5, longitude: -46.6},
      updated_at: ISO,
    }));
    expect((data.xp_logs as Data[])[0]).toEqual(expect.objectContaining({ref: "games/game1"}));
    expect(data.push_token_devices).toEqual([expect.objectContaining({platform: "web", created_at: ISO})]);
    expect(data.storage_files).toEqual([{name: `users/${UID}/profile.jpg`, contentType: "image/jpeg", size: 1234}]);
  });

  test("índice COLLECTION_GROUP ausente: fonte em incomplete_sources, resto exportado", async () => {
    failingCollectionGroups.set("reviews", 9);
    failingCollectionGroups.set("members", 9);
    const payload = await exportFor();
    expect(payload.complete).toBe(false);
    expect(payload.incomplete_sources).toEqual(expect.arrayContaining([
      {source: "location_reviews", reason: "FAILED_PRECONDITION"},
      {source: "group_discovery:members_collection_group", reason: "FAILED_PRECONDITION"},
    ]));
    expect(payload.data.location_reviews).toBeNull();
    // Sem o collectionGroup, o espelho users/{uid}/groups ainda acha g1.
    expect((payload.data.group_memberships as Data[]).map((item) => item.document_path))
      .toEqual([`groups/g1/members/${UID}`]);
    expect(payload.data.confirmations).toHaveLength(2);
  });

  test("usuário sem dados: arquivo válido com perfil nulo e listas vazias", async () => {
    state.clear();
    const payload = await exportFor("ninguem");
    expect(payload.complete).toBe(true);
    expect(payload.data.profile).toBeNull();
    expect(payload.data.confirmations).toEqual([]);
  });
});

describe("enforceSizeCap", () => {
  test("corta a maior lista até caber e marca truncated_sources", () => {
    const payload: ExportPayload = {
      schema_version: 1,
      format: "x",
      generated_at: ISO,
      user_id: UID,
      complete: true,
      incomplete_sources: [],
      truncated_sources: [],
      counts: {},
      data: {
        big: Array.from({length: 200}, (_, i) => ({i, pad: "x".repeat(50)})),
        nested: {inner: Array.from({length: 10}, (_, i) => ({i}))},
        small: [{a: 1}],
      },
    };
    const bytes = enforceSizeCap(payload, 4000);
    expect(bytes).toBeLessThanOrEqual(4000);
    expect(payload.truncated_sources).toContain("big");
    expect(payload.complete).toBe(false);
    expect(payload.data.small).toEqual([{a: 1}]);
  });

  test("teto padrão fica abaixo do limite de resposta HTTP (32 MiB)", () => {
    expect(MAX_EXPORT_BYTES).toBeLessThan(32 * 1024 * 1024);
  });
});

// ---------------------------------------------------------------------------
// 4. Callable (secureCallable real)
// ---------------------------------------------------------------------------

type Handler = (request: unknown) => Promise<unknown>;
const callExport = exportMyData as unknown as Handler;

function makeRequest(options: {uid?: string | null; appCheck?: boolean} = {}): Record<string, unknown> {
  const uid = options.uid === undefined ? UID : options.uid;
  return {
    data: undefined,
    rawRequest: {ip: "203.0.113.1"},
    app: options.appCheck === false ? undefined : {alreadyConsumed: false},
    auth: uid === null ? undefined : {uid, token: {}},
  };
}

async function expectHttpsError(promise: Promise<unknown>, code: string): Promise<void> {
  const error = await promise.then(
    () => {
      throw new Error("esperava HttpsError");
    },
    (err: unknown) => err as {code: string},
  );
  expect(error.code).toBe(code);
}

describe("exportMyData — callable", () => {
  beforeEach(() => {
    state.clear();
    addedDocs.length = 0;
    failingCollectionGroups.clear();
    seed();
    mockCheckRateLimit.mockReset().mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetAt: new Date(Date.now() + 3_600_000),
    });
  });

  test("exige login", async () => {
    await expectHttpsError(callExport(makeRequest({uid: null})), "unauthenticated");
  });

  test("exige App Check", async () => {
    await expectHttpsError(callExport(makeRequest({appCheck: false})), "failed-precondition");
  });

  test("limite diário com prefixo próprio, por uid", async () => {
    await callExport(makeRequest());
    expect(mockCheckRateLimit).toHaveBeenCalledWith(UID, expect.objectContaining({
      maxRequests: EXPORT_RATE_LIMIT.maxRequests,
      windowMs: 24 * 60 * 60 * 1000,
      keyPrefix: "export_my_data",
    }));
    mockCheckRateLimit.mockResolvedValueOnce({allowed: false, remaining: 0, resetAt: new Date(Date.now() + 60_000)});
    await expectHttpsError(callExport(makeRequest()), "resource-exhausted");
  });

  test("devolve o arquivo do PRÓPRIO uid, ignora payload e grava auditoria apagável", async () => {
    const result = await callExport({...makeRequest(), data: {uid: OTHER}}) as ExportPayload;
    expect(result.user_id).toBe(UID);
    expect(addedDocs).toEqual([{
      collection: "audit_logs",
      data: expect.objectContaining({
        action: "DATA_EXPORTED",
        actor_user_id: UID,
        target_user_id: UID,
        complete: true,
      }),
    }]);
  });

  test("falha da auditoria não derruba a exportação", async () => {
    const original = fakeDb.collection;
    fakeDb.collection = (p: string) => {
      const query = original(p);
      if (p === "audit_logs") query.add = async () => Promise.reject(new Error("quota"));
      return query;
    };
    try {
      const result = await callExport(makeRequest()) as ExportPayload;
      expect(result.user_id).toBe(UID);
    } finally {
      fakeDb.collection = original;
    }
  });
});
