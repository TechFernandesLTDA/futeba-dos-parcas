const mockDb = jest.fn();
const mockGetStorage = jest.fn();
const mockInfo = jest.fn();
const mockError = jest.fn();
const mockCheckRateLimit = jest.fn();

class MockHttpsError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

jest.mock("firebase-functions/v2", () => ({
  logger: {info: mockInfo, warn: jest.fn(), error: mockError},
  https: {
    onCall: jest.fn((_config: unknown, handler: unknown) => handler),
    HttpsError: MockHttpsError,
  },
  storage: {
    onObjectFinalized: jest.fn((_config: unknown, handler: unknown) => handler),
  },
  scheduler: {
    onSchedule: jest.fn((_config: unknown, handler: unknown) => handler),
  },
}));
jest.mock("../src/_db", () => ({db: mockDb}));
jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));
jest.mock("firebase-admin/storage", () => ({getStorage: mockGetStorage}));

import {Timestamp} from "firebase-admin/firestore";
import {writeFile} from "fs/promises";
import {
  createGroupWallMediaDraft,
  claimDraftForProcessing,
  cleanupExpiredWallMediaDraft,
  cleanupExpiredGroupWallMediaDrafts,
  finalizeReadyPost,
  onGroupWallMediaStaged,
  uploadImmutableWallMediaObject,
  wallMediaReadyCommitState,
} from "../src/groups/wall-media-pipeline";
import {
  WALL_MEDIA_MAX_IMAGE_BYTES,
  wallMediaIntentHash,
  wallMediaPostId,
  wallMediaUploadPath,
} from "../src/groups/wall-media-contract";

type Data = Record<string, unknown>;

interface FakeRef {
  id: string;
  path: string;
  firestore: FakeFirestore;
}

interface FakeSnapshot {
  id: string;
  ref: FakeRef;
  exists: boolean;
  data: () => Data | undefined;
}

interface FakeFirestore {
  doc: (path: string) => FakeRef;
  runTransaction: (
    handler: (tx: ReturnType<typeof transactionFor>) => Promise<unknown>
  ) => Promise<unknown>;
  collection: (name: string) => {add: (data: Data) => Promise<void>};
  collectionGroup: (name: string) => FakeQuery;
  getAll: (...refs: FakeRef[]) => Promise<FakeSnapshot[]>;
}

interface FakeQuery {
  where: (field: string, operator: string, value: unknown) => FakeQuery;
  orderBy: (field: string, direction: string) => FakeQuery;
  limit: (value: number) => FakeQuery;
  startAfter: (snapshot: FakeSnapshot) => FakeQuery;
  get: () => Promise<{
    docs: FakeSnapshot[];
    empty: boolean;
    size: number;
  }>;
}

function fakeDatabase(initial: Record<string, Data>) {
  const state = new Map(Object.entries(initial));
  const writes: Array<{operation: string; path: string}> = [];
  let database: FakeFirestore;
  const ref = (path: string): FakeRef => ({
    id: path.split("/").pop() ?? "",
    path,
    firestore: database,
  });
  const snap = (target: FakeRef): FakeSnapshot => ({
    id: target.id,
    ref: target,
    exists: state.has(target.path),
    data: () => state.get(target.path),
  });
  database = {
    doc: ref,
    runTransaction: async (handler) => handler(transactionFor(
      state,
      writes,
      snap
    )),
    collection: (name) => ({
      add: async (data) => {
        state.set(`${name}/metric-${state.size}`, data);
      },
    }),
    collectionGroup: (name) => fakeCollectionGroupQuery(name, state, snap),
    getAll: async (...refs) => refs.map(snap),
  };
  return {database, state, writes};
}

function fakeCollectionGroupQuery(
  name: string,
  state: Map<string, Data>,
  snap: (ref: FakeRef) => FakeSnapshot
): FakeQuery {
  const filters: Array<{field: string; operator: string; value: unknown}> = [];
  let pageSize = Number.MAX_SAFE_INTEGER;
  let afterPath: string | null = null;
  const query: FakeQuery = {
    where: (field, operator, value) => {
      filters.push({field, operator, value});
      return query;
    },
    orderBy: () => query,
    limit: (value) => {
      pageSize = value;
      return query;
    },
    startAfter: (snapshot) => {
      afterPath = snapshot.ref.path;
      return query;
    },
    get: async () => {
      const marker = `/${name}/`;
      const documents = [...state.entries()]
        .filter(([docPath, data]) =>
          docPath.includes(marker) &&
          (afterPath == null || docPath > afterPath) &&
          filters.every(({field, operator, value}) => {
            if (operator === "in") return (value as unknown[]).includes(data[field]);
            if (operator === "<=") {
              return data[field] instanceof Timestamp &&
                (data[field] as Timestamp).toMillis() <=
                (value as Timestamp).toMillis();
            }
            return true;
          })
        )
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(0, pageSize)
        .map(([docPath]) => snap({
          id: docPath.split("/").pop() ?? "",
          path: docPath,
          firestore: null as never,
        }));
      return {docs: documents, empty: documents.length === 0, size: documents.length};
    },
  };
  return query;
}

function transactionFor(
  state: Map<string, Data>,
  writes: Array<{operation: string; path: string}>,
  snap: (ref: FakeRef) => FakeSnapshot
) {
  return {
    get: jest.fn(async (ref: FakeRef) => snap(ref)),
    create: jest.fn((ref: FakeRef, data: Data) => {
      if (state.has(ref.path)) throw new Error("already exists");
      state.set(ref.path, {...data});
      writes.push({operation: "create", path: ref.path});
    }),
    set: jest.fn((ref: FakeRef, data: Data, options?: {merge?: boolean}) => {
      state.set(ref.path, options?.merge ? {
        ...(state.get(ref.path) ?? {}),
        ...data,
      } : {...data});
      writes.push({operation: "set", path: ref.path});
    }),
    update: jest.fn((ref: FakeRef, data: Data) => {
      state.set(ref.path, {...(state.get(ref.path) ?? {}), ...data});
      writes.push({operation: "update", path: ref.path});
    }),
    delete: jest.fn((ref: FakeRef) => {
      state.delete(ref.path);
      writes.push({operation: "delete", path: ref.path});
    }),
  };
}

describe("group wall media pipeline", () => {
  const groupId = "group-1";
  const ownerId = "user-1";
  const clientRequestId = "0190c2d4-90c2-7b1d-a43d-4f7e05bdb999";

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: new Date(Date.now() + 60_000),
    });
  });

  it("pré-aloca draft e responde retry idêntico sem duplicar", async () => {
    const {database, state, writes} = fakeDatabase({
      [`groups/${groupId}`]: {owner_id: "owner", status: "ACTIVE"},
      [`groups/${groupId}/members/${ownerId}`]: {
        user_id: ownerId,
        status: "ACTIVE",
        role: "MEMBER",
      },
      [`users/${ownerId}`]: {
        display_name: "Jogadora",
        photo_url: "https://example.test/photo.jpg",
      },
    });
    mockDb.mockReturnValue(database);
    const request = {
      auth: {uid: ownerId, token: {}},
      data: {
        groupId,
        clientRequestId,
        text: "Gol da rodada",
        declaredContentType: "image/jpeg",
        sizeBytes: 1234,
        highlightRef: {gameId: "game-1", highlightId: "goal-1"},
      },
    };
    const first = await (createGroupWallMediaDraft as unknown as (
      request: typeof request
    ) => Promise<Data>)(request);
    const postId = wallMediaPostId(groupId, ownerId, clientRequestId);
    const uploadPath = wallMediaUploadPath(
      groupId,
      postId,
      ownerId,
      "image/jpeg"
    );
    expect(first).toMatchObject({
      postId,
      uploadPath,
      maxBytes: WALL_MEDIA_MAX_IMAGE_BYTES,
      pipelineVersion: 1,
      duplicate: false,
    });
    expect(new Date(first.expiresAt as string).toISOString())
      .toBe(first.expiresAt);
    expect(state.get(
      `groups/${groupId}/wall_post_drafts/${postId}`
    )).toMatchObject({
      author_id: ownerId,
      status: "AWAITING_UPLOAD",
      temp_path: uploadPath,
      highlight_ref: {game_id: "game-1", highlight_id: "goal-1"},
      expires_at: expect.any(Timestamp),
    });
    const writesAfterFirst = writes.length;
    const replay = await (createGroupWallMediaDraft as unknown as (
      request: typeof request
    ) => Promise<Data>)(request);
    expect(replay).toMatchObject({postId, uploadPath, duplicate: true});
    expect(writes).toHaveLength(writesAfterFirst);

    state.set(`groups/${groupId}/wall_post_drafts/${postId}`, {
      ...(state.get(`groups/${groupId}/wall_post_drafts/${postId}`) ?? {}),
      status: "REJECTED",
      error_code: "MIME_MISMATCH",
    });
    const terminalReplay = await (createGroupWallMediaDraft as unknown as (
      request: typeof request
    ) => Promise<Data>)(request);
    expect(terminalReplay).toMatchObject({postId, duplicate: true});

    await expect((createGroupWallMediaDraft as unknown as (
      request: typeof request
    ) => Promise<Data>)({
      ...request,
      data: {...request.data, text: "Payload diferente"},
    })).rejects.toMatchObject({code: "already-exists"});
  });

  it("reconstrói tombstone READY sem sobrescrever o post social", async () => {
    const intent = {
      clientRequestId,
      text: "Gol da rodada",
      declaredContentType: "image/jpeg" as const,
      declaredSizeBytes: 1234,
      highlightRef: null,
    };
    const postId = wallMediaPostId(groupId, ownerId, clientRequestId);
    const postPath = `groups/${groupId}/wall_posts/${postId}`;
    const draftPath = `groups/${groupId}/wall_post_drafts/${postId}`;
    const {database, state, writes} = fakeDatabase({
      [`groups/${groupId}`]: {owner_id: "owner", status: "ACTIVE"},
      [`groups/${groupId}/members/${ownerId}`]: {
        user_id: ownerId,
        status: "ACTIVE",
      },
      [`users/${ownerId}`]: {display_name: "Jogador"},
      [postPath]: {
        group_id: groupId,
        author_id: ownerId,
        media_status: "READY",
        media_pipeline_draft_id: postId,
        media_pipeline_intent_hash: wallMediaIntentHash(intent),
        media_path: `groups/${groupId}/wall_media/${postId}/original/${"a".repeat(64)}.webp`,
        thumbnail_path: `groups/${groupId}/wall_media/${postId}/poster/${"a".repeat(64)}.webp`,
        media_sha256: "a".repeat(64),
        reactions: {"⚽": ["friend"]},
        deleted_at: new Date(),
      },
    });
    mockDb.mockReturnValue(database);
    const result = await (createGroupWallMediaDraft as unknown as (
      request: Data
    ) => Promise<Data>)({
      auth: {uid: ownerId, token: {}},
      data: {
        groupId,
        clientRequestId,
        text: intent.text,
        declaredContentType: intent.declaredContentType,
        sizeBytes: intent.declaredSizeBytes,
      },
    });

    expect(result).toMatchObject({postId, duplicate: true});
    expect(state.get(draftPath)).toMatchObject({
      status: "READY",
      intent_hash: wallMediaIntentHash(intent),
      expires_at: null,
    });
    expect(state.get(postPath)).toMatchObject({
      reactions: {"⚽": ["friend"]},
      deleted_at: expect.any(Date),
    });
    expect(writes).toEqual([{operation: "create", path: draftPath}]);
  });

  it("falha fechado se o post determinístico pertence a outra intenção", async () => {
    const postId = wallMediaPostId(groupId, ownerId, clientRequestId);
    const {database, state} = fakeDatabase({
      [`groups/${groupId}`]: {owner_id: "owner", status: "ACTIVE"},
      [`groups/${groupId}/members/${ownerId}`]: {
        user_id: ownerId,
        status: "ACTIVE",
      },
      [`users/${ownerId}`]: {display_name: "Jogador"},
      [`groups/${groupId}/wall_posts/${postId}`]: {
        group_id: groupId,
        author_id: ownerId,
        media_status: "READY",
        media_pipeline_draft_id: postId,
        media_pipeline_intent_hash: "different",
      },
    });
    mockDb.mockReturnValue(database);
    await expect((createGroupWallMediaDraft as unknown as (
      request: Data
    ) => Promise<Data>)({
      auth: {uid: ownerId, token: {}},
      data: {
        groupId,
        clientRequestId,
        text: "Gol da rodada",
        declaredContentType: "image/jpeg",
        sizeBytes: 1234,
      },
    })).rejects.toMatchObject({code: "already-exists"});
    expect(state.has(`groups/${groupId}/wall_post_drafts/${postId}`)).toBe(false);
  });

  it("bloqueia abuso antes de reservar novo staging", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 30_000),
    });
    await expect((createGroupWallMediaDraft as unknown as (
      request: {auth: {uid: string}; data: Data}
    ) => Promise<Data>)({
      auth: {uid: ownerId},
      data: {
        groupId,
        clientRequestId,
        text: "",
        declaredContentType: "image/jpeg",
        sizeBytes: 1234,
      },
    })).rejects.toMatchObject({code: "resource-exhausted"});
    expect(mockDb).not.toHaveBeenCalled();
  });

  it("nega criação fora do grupo ativo", async () => {
    const {database} = fakeDatabase({
      [`groups/${groupId}`]: {owner_id: "other", status: "ACTIVE"},
    });
    mockDb.mockReturnValue(database);
    await expect((createGroupWallMediaDraft as unknown as (
      request: Data
    ) => Promise<Data>)({
      auth: {uid: ownerId, token: {}},
      data: {
        groupId,
        clientRequestId,
        text: "Teste",
        declaredContentType: "image/jpeg",
        sizeBytes: 100,
      },
    })).rejects.toMatchObject({code: "permission-denied"});
  });

  it.each([
    {
      name: "grupo ARCHIVED",
      groupStatus: "ARCHIVED",
      expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
      attempt: 0,
      expectedStatus: "REJECTED",
      expectedCode: "WALL_ACCESS_REVOKED",
    },
    {
      name: "draft expirado",
      groupStatus: "ACTIVE",
      expiresAt: Timestamp.fromMillis(Date.now() - 1),
      attempt: 0,
      expectedStatus: "EXPIRED",
      expectedCode: undefined,
    },
    {
      name: "limite de retries",
      groupStatus: "ACTIVE",
      expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
      attempt: 5,
      expectedStatus: "REJECTED",
      expectedCode: "RETRY_LIMIT_EXCEEDED",
    },
  ])("encerra claim quando $name", async (scenario) => {
    const postId = "d".repeat(40);
    const tempPath =
      `groups/${groupId}/wall_media_staging/${postId}/${ownerId}/source.jpg`;
    const draftPath = `groups/${groupId}/wall_post_drafts/${postId}`;
    const {database, state} = fakeDatabase({
      [`groups/${groupId}`]: {
        owner_id: "owner",
        status: scenario.groupStatus,
      },
      [`groups/${groupId}/members/${ownerId}`]: {
        user_id: ownerId,
        status: "ACTIVE",
      },
      [draftPath]: {
        group_id: groupId,
        post_id: postId,
        author_id: ownerId,
        temp_path: tempPath,
        status: "AWAITING_UPLOAD",
        attempt: scenario.attempt,
        expires_at: scenario.expiresAt,
      },
    });
    const result = await claimDraftForProcessing(
      database as never,
      {groupId, postId, ownerId, fileName: "source.jpg"},
      tempPath,
      "generation-claim"
    );
    expect(result.result).toBe("TERMINAL");
    expect(state.get(draftPath)).toMatchObject({
      status: scenario.expectedStatus,
      ...(scenario.expectedCode ? {error_code: scenario.expectedCode} : {}),
    });
  });

  it("remove objeto órfão e registra métrica sem PII", async () => {
    const {database, state} = fakeDatabase({});
    mockDb.mockReturnValue(database);
    const deleteFile = jest.fn(async () => undefined);
    const file = jest.fn(() => ({delete: deleteFile}));
    mockGetStorage.mockReturnValue({
      bucket: jest.fn(() => ({
        file,
      })),
    });
    const postId = "a".repeat(40);
    await (onGroupWallMediaStaged as unknown as (
      event: Data
    ) => Promise<void>)({
      data: {
        name: `groups/${groupId}/wall_media_staging/${postId}/${ownerId}/source.jpg`,
        bucket: "bucket.test",
        contentType: "image/jpeg",
        size: "123",
        generation: "1",
      },
    });
    expect(deleteFile).toHaveBeenCalledWith({ignoreNotFound: true});
    expect(file).toHaveBeenCalledWith(expect.any(String), {
      generation: "1",
      preconditionOpts: {ifGenerationMatch: "1"},
    });
    const metric = [...state.entries()].find(([key]) =>
      key.startsWith("metrics/"))?.[1];
    expect(metric).toMatchObject({event: "ORPHAN_CLEANED", source_bytes: 123});
    expect(Object.keys(metric ?? {})).not.toEqual(expect.arrayContaining([
      "group_id",
      "user_id",
      "post_id",
      "path",
      "url",
    ]));
    expect(JSON.stringify(metric)).not.toMatch(/group-1|user-1/);
  });

  it("rejeita header divergente com mensagem acionável", async () => {
    const postId = "b".repeat(40);
    const tempPath =
      `groups/${groupId}/wall_media_staging/${postId}/${ownerId}/source.jpg`;
    const draftPath = `groups/${groupId}/wall_post_drafts/${postId}`;
    const {database, state} = fakeDatabase({
      [`groups/${groupId}`]: {owner_id: "owner", status: "ACTIVE"},
      [`groups/${groupId}/members/${ownerId}`]: {
        user_id: ownerId,
        status: "ACTIVE",
      },
      [draftPath]: {
        group_id: groupId,
        post_id: postId,
        author_id: ownerId,
        temp_path: tempPath,
        status: "AWAITING_UPLOAD",
        attempt: 0,
        declared_content_type: "image/jpeg",
        declared_size_bytes: 4,
        media_kind: "IMAGE",
        expires_at: Timestamp.fromMillis(Date.now() + 60_000),
      },
    });
    mockDb.mockReturnValue(database);
    const deleteFile = jest.fn(async () => undefined);
    mockGetStorage.mockReturnValue({
      bucket: jest.fn(() => ({
        file: jest.fn(() => ({delete: deleteFile})),
      })),
    });
    await (onGroupWallMediaStaged as unknown as (
      event: Data
    ) => Promise<void>)({
      data: {
        name: tempPath,
        bucket: "bucket.test",
        contentType: "image/png",
        size: "4",
        generation: "2",
      },
    });
    expect(state.get(draftPath)).toMatchObject({
      status: "REJECTED",
      error_code: "MIME_MISMATCH",
      error_message: expect.stringMatching(/formato informado/),
      attempt: 1,
    });
    expect(deleteFile).toHaveBeenCalledWith({ignoreNotFound: true});
  });

  it("expira lease de falha transitória e permite redelivery imediato", async () => {
    const postId = "c".repeat(40);
    const tempPath =
      `groups/${groupId}/wall_media_staging/${postId}/${ownerId}/source.jpg`;
    const draftPath = `groups/${groupId}/wall_post_drafts/${postId}`;
    const {database, state} = fakeDatabase({
      [`groups/${groupId}`]: {owner_id: "owner", status: "ACTIVE"},
      [`groups/${groupId}/members/${ownerId}`]: {
        user_id: ownerId,
        status: "ACTIVE",
      },
      [draftPath]: {
        group_id: groupId,
        post_id: postId,
        author_id: ownerId,
        temp_path: tempPath,
        status: "AWAITING_UPLOAD",
        attempt: 0,
        declared_content_type: "image/jpeg",
        declared_size_bytes: 4,
        media_kind: "IMAGE",
        expires_at: Timestamp.fromMillis(Date.now() + 60_000),
      },
    });
    mockDb.mockReturnValue(database);
    const download = jest.fn(async () => {
      throw new Error("transient storage failure");
    });
    mockGetStorage.mockReturnValue({
      bucket: jest.fn(() => ({
        file: jest.fn(() => ({download, delete: jest.fn()})),
      })),
    });
    const event = {
      data: {
        name: tempPath,
        bucket: "bucket.test",
        contentType: "image/jpeg",
        size: "4",
        generation: "3",
      },
    };
    await expect((onGroupWallMediaStaged as unknown as (
      event: Data
    ) => Promise<void>)(event)).rejects.toThrow("transient storage failure");
    expect(state.get(draftPath)).toMatchObject({
      status: "PROCESSING",
      attempt: 1,
      error_code: "PROCESSING_ERROR",
      processing_lease_expires_at: expect.any(Timestamp),
    });
    expect((state.get(draftPath)?.processing_lease_expires_at as Timestamp)
      .toMillis()).toBe(0);

    await expect((onGroupWallMediaStaged as unknown as (
      event: Data
    ) => Promise<void>)(event)).rejects.toThrow("transient storage failure");
    expect(state.get(draftPath)).toMatchObject({attempt: 2});
    expect(download).toHaveBeenCalledTimes(2);
  });

  it("processa imagem válida até READY com objetos imutáveis", async () => {
    const postId = "d".repeat(40);
    const tempPath =
      `groups/${groupId}/wall_media_staging/${postId}/${ownerId}/source.png`;
    const draftPath = `groups/${groupId}/wall_post_drafts/${postId}`;
    const postPath = `groups/${groupId}/wall_posts/${postId}`;
    const image = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk" +
      "+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64"
    );
    const {database, state} = fakeDatabase({
      [`groups/${groupId}`]: {owner_id: "owner", status: "ACTIVE"},
      [`groups/${groupId}/members/${ownerId}`]: {
        user_id: ownerId,
        status: "ACTIVE",
      },
      [draftPath]: {
        group_id: groupId,
        post_id: postId,
        author_id: ownerId,
        author_name: "Jogador",
        author_photo_url: null,
        text: "Foto do jogo",
        client_request_id: clientRequestId,
        intent_hash: "intent-image",
        temp_path: tempPath,
        status: "AWAITING_UPLOAD",
        attempt: 0,
        declared_content_type: "image/png",
        declared_size_bytes: image.length,
        media_kind: "IMAGE",
        expires_at: Timestamp.fromMillis(Date.now() + 60_000),
      },
    });
    mockDb.mockReturnValue(database);
    const deleteFile = jest.fn(async () => undefined);
    const download = jest.fn(async ({destination}: {destination: string}) => {
      await writeFile(destination, image);
    });
    let generation = 10;
    const upload = jest.fn(async () => [{
      getMetadata: jest.fn(async () => [{generation: String(generation++)}]),
    }]);
    const file = jest.fn(() => ({delete: deleteFile, download}));
    mockGetStorage.mockReturnValue({
      bucket: jest.fn(() => ({name: "bucket.test", file, upload})),
    });

    await (onGroupWallMediaStaged as unknown as (
      event: Data
    ) => Promise<void>)({
      data: {
        name: tempPath,
        bucket: "bucket.test",
        contentType: "image/png",
        size: String(image.length),
        generation: "4",
      },
    });

    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenNthCalledWith(1, expect.any(String),
      expect.objectContaining({
        destination: expect.stringMatching(/\/original\/[a-f0-9]{64}\.webp$/),
        preconditionOpts: {ifGenerationMatch: 0},
      }));
    expect(upload).toHaveBeenNthCalledWith(2, expect.any(String),
      expect.objectContaining({
        destination: expect.stringMatching(/\/poster\/[a-f0-9]{64}\.webp$/),
        preconditionOpts: {ifGenerationMatch: 0},
      }));
    expect(state.get(postPath)).toMatchObject({
      media_status: "READY",
      media_type: "image/webp",
      media_source_type: "image/png",
      media_width: 1,
      media_height: 1,
      media_url: expect.stringContaining("firebasestorage.googleapis.com"),
      thumbnail_url: expect.stringContaining("firebasestorage.googleapis.com"),
    });
    expect(state.get(draftPath)).toMatchObject({
      status: "READY",
      media_path: expect.stringMatching(/\/original\/[a-f0-9]{64}\.webp$/),
      poster_path: expect.stringMatching(/\/poster\/[a-f0-9]{64}\.webp$/),
      egress_bytes: expect.any(Number),
      attempt: 1,
    });
    expect(deleteFile).toHaveBeenCalledWith({ignoreNotFound: true});
  });

  it("finalize idempotente preserva reações, pin e soft-delete existentes", async () => {
    const postId = "f".repeat(40);
    const draftPath = `groups/${groupId}/wall_post_drafts/${postId}`;
    const postPath = `groups/${groupId}/wall_posts/${postId}`;
    const mediaPath = `groups/${groupId}/wall_media/${postId}/original/${"a".repeat(64)}.mp4`;
    const posterPath = `groups/${groupId}/wall_media/${postId}/poster/${"a".repeat(64)}.webp`;
    const intentHash = "intent-hash";
    const {database, state, writes} = fakeDatabase({
      [`groups/${groupId}`]: {owner_id: "owner", status: "ACTIVE"},
      [`groups/${groupId}/members/${ownerId}`]: {
        user_id: ownerId,
        status: "ACTIVE",
      },
      [draftPath]: {
        status: "PROCESSING",
        processing_generation: "generation-finalize",
        author_id: ownerId,
        author_name: "Jogador",
        author_photo_url: null,
        text: "Gol",
        highlight_ref: null,
        intent_hash: intentHash,
        client_request_id: clientRequestId,
      },
      [postPath]: {
        group_id: groupId,
        author_id: ownerId,
        media_status: "READY",
        media_pipeline_draft_id: postId,
        media_pipeline_intent_hash: intentHash,
        media_sha256: "a".repeat(64),
        media_path: mediaPath,
        thumbnail_path: posterPath,
        reactions: {"⚽": ["friend"]},
        pinned: true,
        deleted_at: new Date(),
      },
    });
    const claim = {
      result: "CLAIMED" as const,
      ref: database.doc(draftPath),
      data: state.get(draftPath) ?? {},
      attempt: 2,
    };
    await finalizeReadyPost(
      database as never,
      claim as never,
      {groupId, postId, ownerId, fileName: "source.mp4"},
      "generation-finalize",
      {
        sourceContentType: "video/mp4",
        finalContentType: "video/mp4",
        mediaKind: "VIDEO",
        sha256: "a".repeat(64),
        finalLocalPath: "/tmp/source.mp4",
        posterLocalPath: "/tmp/poster.webp",
        durationSec: 3,
        videoCodec: "h264",
        audioCodec: "aac",
        container: "mp4",
        width: 160,
        height: 90,
      } as never,
      {
        mediaPath,
        mediaUrl: "https://media.test",
        posterPath,
        posterUrl: "https://poster.test",
        egressBytes: 100,
      }
    );
    expect(state.get(postPath)).toMatchObject({
      reactions: {"⚽": ["friend"]},
      pinned: true,
      deleted_at: expect.any(Date),
    });
    expect(writes.filter(({path}) => path === postPath)).toHaveLength(0);
    expect(state.get(draftPath)).toMatchObject({status: "READY", expires_at: null});
  });

  it("finalize revalida acesso e não publica após archive", async () => {
    const postId = "9".repeat(40);
    const draftPath = `groups/${groupId}/wall_post_drafts/${postId}`;
    const {database} = fakeDatabase({
      [`groups/${groupId}`]: {owner_id: "owner", status: "ARCHIVED"},
      [`groups/${groupId}/members/${ownerId}`]: {
        user_id: ownerId,
        status: "ACTIVE",
      },
      [draftPath]: {
        status: "PROCESSING",
        processing_generation: "generation-archived",
        author_id: ownerId,
      },
    });
    await expect(finalizeReadyPost(
      database as never,
      {
        result: "CLAIMED",
        ref: database.doc(draftPath),
        data: {},
        attempt: 1,
      } as never,
      {groupId, postId, ownerId, fileName: "source.mp4"},
      "generation-archived",
      {} as never,
      {} as never
    )).rejects.toMatchObject({code: "WALL_ACCESS_REVOKED"});
  });

  it("janitor limpa paths exatos sem apagar post conflitante", async () => {
    const postId = "8".repeat(40);
    const draftPath = `groups/${groupId}/wall_post_drafts/${postId}`;
    const postPath = `groups/${groupId}/wall_posts/${postId}`;
    const stagingPath =
      `groups/${groupId}/wall_media_staging/${postId}/${ownerId}/source.jpg`;
    const mediaPath = `groups/${groupId}/wall_media/${postId}/original/${"b".repeat(64)}.webp`;
    const posterPath = `groups/${groupId}/wall_media/${postId}/poster/${"b".repeat(64)}.webp`;
    const {database, state} = fakeDatabase({
      [draftPath]: {
        status: "AWAITING_UPLOAD",
        expires_at: Timestamp.fromMillis(Date.now() - 60_000),
        temp_path: stagingPath,
        pending_media_path: mediaPath,
        pending_poster_path: posterPath,
      },
      [postPath]: {text: "Post de texto preservado"},
    });
    const deletedPaths: string[] = [];
    const bucket = {
      file: (objectPath: string) => ({
        delete: async () => {
          deletedPaths.push(objectPath);
        },
      }),
    };
    const [candidate] = await database.getAll(database.doc(draftPath));
    await expect(cleanupExpiredWallMediaDraft(
      database as never,
      bucket as never,
      candidate as never,
      Timestamp.now()
    )).resolves.toBe("CLEANED");
    expect(deletedPaths).toEqual([stagingPath]);
    expect(state.has(draftPath)).toBe(false);
    expect(state.get(postPath)).toEqual({text: "Post de texto preservado"});
  });

  it("janitor remove staging e objetos pendentes exatos de draft órfão", async () => {
    const postId = "7".repeat(40);
    const draftPath = `groups/${groupId}/wall_post_drafts/${postId}`;
    const stagingPath =
      `groups/${groupId}/wall_media_staging/${postId}/${ownerId}/source.mp4`;
    const mediaPath = `groups/${groupId}/wall_media/${postId}/original/${"c".repeat(64)}.mp4`;
    const posterPath = `groups/${groupId}/wall_media/${postId}/poster/${"c".repeat(64)}.webp`;
    const {database, state} = fakeDatabase({
      [draftPath]: {
        status: "PROCESSING",
        expires_at: Timestamp.fromMillis(Date.now() - 60_000),
        temp_path: stagingPath,
        pending_media_path: mediaPath,
        pending_poster_path: posterPath,
      },
    });
    const deletedPaths: string[] = [];
    const bucket = {
      file: (objectPath: string) => ({
        delete: async () => {
          deletedPaths.push(objectPath);
        },
      }),
    };
    const [candidate] = await database.getAll(database.doc(draftPath));
    await expect(cleanupExpiredWallMediaDraft(
      database as never,
      bucket as never,
      candidate as never,
      Timestamp.now()
    )).resolves.toBe("CLEANED");
    expect(deletedPaths).toEqual([stagingPath, mediaPath, posterPath]);
    expect(state.has(draftPath)).toBe(false);
  });

  it("janitor pagina além de 200 drafts sem starvation", async () => {
    const initial: Record<string, Data> = {};
    for (let index = 0; index < 205; index++) {
      const postId = index.toString(16).padStart(40, "0");
      initial[`groups/${groupId}/wall_post_drafts/${postId}`] = {
        status: "AWAITING_UPLOAD",
        expires_at: Timestamp.fromMillis(Date.now() - 60_000),
        temp_path:
          `groups/${groupId}/wall_media_staging/${postId}/${ownerId}/source.jpg`,
      };
    }
    const {database, state} = fakeDatabase(initial);
    mockDb.mockReturnValue(database);
    mockGetStorage.mockReturnValue({
      bucket: () => ({
        file: () => ({delete: async () => undefined}),
      }),
    });

    await (cleanupExpiredGroupWallMediaDrafts as unknown as () => Promise<void>)();

    const remaining = [...state.keys()].filter((key) =>
      key.includes("/wall_post_drafts/")
    );
    expect(remaining).toHaveLength(0);
    expect(mockInfo).toHaveBeenCalledWith(
      "[GROUP_WALL_MEDIA] Janitor completed",
      expect.objectContaining({
        scanned: 205,
        cleaned: 205,
        cleanupFailures: 0,
        backlogPossible: false,
      })
    );
  });

  it("cria destino imutável com precondition e adota retry pelo hash", async () => {
    const destination = "groups/g/wall_media/p/original/hash.webp";
    const generationFile = {delete: jest.fn()};
    const uploaded = {
      getMetadata: jest.fn(async () => [{generation: "7"}]),
    };
    const upload = jest.fn(async () => [uploaded]);
    const file = jest.fn((_path: string, options?: Data) =>
      options?.generation ? generationFile : uploaded
    );
    const bucket = {upload, file} as never;
    const created = await uploadImmutableWallMediaObject(
      bucket,
      "/tmp/source.webp",
      destination,
      {contentType: "image/webp"},
      "post-1",
      "hash-1",
      "token-1"
    );
    expect(created).toMatchObject({created: true, generation: "7"});
    expect(upload).toHaveBeenCalledWith("/tmp/source.webp", expect.objectContaining({
      destination,
      resumable: false,
      validation: "crc32c",
      preconditionOpts: {ifGenerationMatch: 0},
    }));

    const precondition = Object.assign(new Error("exists"), {code: 412});
    upload.mockRejectedValueOnce(precondition);
    uploaded.getMetadata.mockResolvedValueOnce([{
      generation: "7",
      metadata: {
        postId: "post-1",
        sha256: "hash-1",
        firebaseStorageDownloadTokens: "existing-token,old-token",
      },
    }]);
    const adopted = await uploadImmutableWallMediaObject(
      bucket,
      "/tmp/source.webp",
      destination,
      {contentType: "image/webp"},
      "post-1",
      "hash-1",
      "new-token"
    );
    expect(adopted).toMatchObject({
      created: false,
      generation: "7",
      token: "existing-token",
    });
  });

  it("preserva objetos quando confirma commit READY após resposta ambígua", async () => {
    const postId = wallMediaPostId(groupId, ownerId, clientRequestId);
    const draftPath = `groups/${groupId}/wall_post_drafts/${postId}`;
    const postPath = `groups/${groupId}/wall_posts/${postId}`;
    const mediaPath = `groups/${groupId}/wall_media/${postId}/original/hash.mp4`;
    const posterPath = `groups/${groupId}/wall_media/${postId}/poster/hash.webp`;
    const {database, state} = fakeDatabase({
      [draftPath]: {
        status: "READY",
        processing_generation: "generation-1",
        media_path: mediaPath,
        poster_path: posterPath,
      },
      [postPath]: {
        media_status: "READY",
        media_pipeline_draft_id: postId,
        media_path: mediaPath,
        thumbnail_path: posterPath,
      },
    });
    const claim = {
      result: "CLAIMED",
      ref: database.doc(draftPath),
      data: {},
      attempt: 1,
    };
    const uploads = [
      {path: mediaPath},
      {path: posterPath},
    ];

    await expect(wallMediaReadyCommitState(
      database as never,
      claim as never,
      groupId,
      postId,
      "generation-1",
      uploads as never
    )).resolves.toBe("READY");

    state.delete(postPath);
    await expect(wallMediaReadyCommitState(
      database as never,
      claim as never,
      groupId,
      postId,
      "generation-1",
      uploads as never
    )).resolves.toBe("UNKNOWN");

    state.set(draftPath, {status: "PROCESSING"});
    await expect(wallMediaReadyCommitState(
      database as never,
      claim as never,
      groupId,
      postId,
      "generation-1",
      uploads as never
    )).resolves.toBe("NOT_READY");
  });
});
