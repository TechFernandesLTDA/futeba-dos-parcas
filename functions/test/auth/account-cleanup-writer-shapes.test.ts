/**
 * #4113 — onUserDeleted contra o PAYLOAD REAL dos escritores.
 *
 * O #1965 foi testado (e "passava") com fixtures escritas à mão em forma
 * camelCase (`{ownerId, members: [{userId, userName}]}`) que nenhum escritor
 * grava — o código morto passava no teste e a PII sobrevivia em produção.
 * Aqui os documentos espelham os escritores:
 * - groups/{id}: web/src/hooks/useGroups.ts:396-411
 *   (`owner_id`, `owner_name`, `members: [uid]` — array de STRINGS);
 * - groups/{id}/members/{uid}: useGroups.ts:419-429
 *   (`id`, `user_id`, `user_name`, `user_photo_url`, `role`, `status`) e KMP
 *   FirebaseDataSource.kt:2064 (`user_photo` em vez de `user_photo_url`);
 * - users/{uid}/groups/{groupId}: useGroups.ts:432 / FirebaseDataSource.kt:2080;
 * - group_invites: web/src/pages/groups/InvitePlayersScreen.tsx:229-240;
 * - statistics/{uid}: functions/src/index.ts onGameFinished (SEM `user_id`);
 * - locations/{id}/reviews/{uid}: web LocationDetailScreen.tsx:376-393;
 * - groups/{id}/cashbox/{id}: functions/src/cashbox/callable.ts:434-436.
 *
 * O Firestore é um fake em memória: as asserções são sobre o ESTADO FINAL,
 * não sobre quais mocks foram chamados.
 */

type Data = Record<string, unknown>;

const state = new Map<string, Data>();

const idOf = (path: string): string => path.split("/").pop() ?? "";
const parentCollectionOf = (path: string): string =>
  path.split("/").slice(0, -1).join("/");

interface FakeSnap {
  id: string;
  ref: FakeRef;
  exists: boolean;
  data: () => Data | undefined;
}

interface FakeRef {
  id: string;
  path: string;
  get: () => Promise<FakeSnap>;
  delete: () => Promise<void>;
}

function makeRef(path: string): FakeRef {
  return {
    id: idOf(path),
    path,
    get: async () => makeSnap(path),
    delete: async () => {
      state.delete(path);
    },
  };
}

function makeSnap(path: string): FakeSnap {
  return {
    id: idOf(path),
    ref: makeRef(path),
    exists: state.has(path),
    data: () => state.get(path),
  };
}

function makeQuery(
  matchesPath: (path: string) => boolean,
  filters: Array<{field: string; value: unknown}> = [],
  limitValue?: number,
  afterPath?: string,
): Record<string, unknown> {
  return {
    where: (field: string, op: string, value: unknown) => {
      if (op !== "==") throw new Error(`operador não suportado no fake: ${op}`);
      return makeQuery(matchesPath, [...filters, {field, value}], limitValue, afterPath);
    },
    limit: (value: number) => makeQuery(matchesPath, filters, value, afterPath),
    startAfter: (snap: FakeSnap) =>
      makeQuery(matchesPath, filters, limitValue, snap.ref.path),
    get: async () => {
      // Ordem por path completo em code units (= ordem por __name__ do
      // Firestore real, inclusive em collectionGroup).
      let paths = [...state.keys()]
        .filter(matchesPath)
        .filter((path) => filters.every(({field, value}) =>
          (state.get(path) ?? {})[field] === value))
        .sort();
      if (afterPath !== undefined) paths = paths.filter((path) => path > afterPath);
      if (limitValue !== undefined) paths = paths.slice(0, limitValue);
      const docs = paths.map(makeSnap);
      return {
        docs,
        size: docs.length,
        empty: docs.length === 0,
        forEach: (cb: (doc: FakeSnap) => void) => docs.forEach(cb),
      };
    },
  };
}

function makeBatch() {
  const ops: Array<() => void> = [];
  return {
    delete: (ref: FakeRef) => {
      ops.push(() => state.delete(ref.path));
    },
    update: (ref: FakeRef, data: Data) => {
      ops.push(() => {
        // Como no Firestore real: update() em doc inexistente falha
        // (NOT_FOUND). Protege contra "membro fantasma".
        if (!state.has(ref.path)) {
          throw Object.assign(new Error(`NOT_FOUND ${ref.path}`), {code: 5});
        }
        state.set(ref.path, {...state.get(ref.path), ...data});
      });
    },
    commit: async () => {
      for (const op of ops) op();
    },
  };
}

const fakeDb = {
  doc: (path: string) => makeRef(path),
  collection: (path: string) =>
    makeQuery((docPath) => parentCollectionOf(docPath) === path),
  collectionGroup: (name: string) =>
    makeQuery((docPath) => {
      const parts = docPath.split("/");
      return parts.length >= 2 && parts[parts.length - 2] === name;
    }),
  batch: () => makeBatch(),
};

jest.mock("firebase-admin", () => {
  const mockAdmin: Record<string, unknown> = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => fakeDb),
    auth: jest.fn(() => ({})),
    initializeApp: jest.fn(),
  };
  return mockAdmin;
});

jest.mock("firebase-functions/v1", () => ({
  runWith: jest.fn(() => ({
    auth: {user: () => ({onDelete: (handler: unknown) => handler})},
  })),
}));

const mockLoggerInfo = jest.fn();
jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@google-cloud/storage", () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({
      getFiles: jest.fn().mockResolvedValue([[]]),
      file: jest.fn(() => ({delete: jest.fn().mockResolvedValue(undefined)})),
    }),
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {onUserDeleted} = require("../../src/auth/account-cleanup");

const UID = "deleted-user";
const OTHER = "other-user";
const ANON = "Usuário removido";

const runCleanup = (): Promise<void> => onUserDeleted(
  {uid: UID},
  {timestamp: new Date().toISOString()},
);

/**
 * Semeia o Firestore com os documentos exatamente como os escritores reais
 * os gravam (ver cabeçalho).
 */
function seedWriterShapes(): void {
  state.clear();
  state.set(`users/${UID}`, {name: "Fulano da Silva"});

  // Grupo criado pelo usuário excluído (useGroups.ts:396-411).
  state.set("groups/g-owned", {
    name: "Pelada de Quinta",
    type: "PRIVATE",
    is_public: false,
    owner_id: UID,
    owner_name: "Fulano da Silva",
    member_count: 2,
    members: [UID],
    status: "ACTIVE",
  });
  state.set(`groups/g-owned/members/${UID}`, {
    id: UID,
    user_id: UID,
    user_name: "Fulano da Silva",
    user_photo_url: "https://cdn.example/fulano.jpg",
    role: "OWNER",
    status: "ACTIVE",
  });
  state.set(`groups/g-owned/members/${OTHER}`, {
    id: OTHER,
    user_id: OTHER,
    user_name: "Outro Jogador",
    user_photo_url: "https://cdn.example/outro.jpg",
    role: "MEMBER",
    status: "ACTIVE",
  });
  state.set(`users/${UID}/groups/g-owned`, {
    group_id: "g-owned",
    group_name: "Pelada de Quinta",
    role: "OWNER",
  });

  // Grupo de outro dono em que o usuário entrou pelo app (KMP:
  // FirebaseDataSource.kt:2064 grava `user_photo`).
  state.set("groups/g-member", {
    name: "Fut de Domingo",
    owner_id: OTHER,
    owner_name: "Outro Jogador",
    members: [OTHER, UID],
    status: "ACTIVE",
  });
  state.set(`groups/g-member/members/${UID}`, {
    user_id: UID,
    user_name: "Fulano da Silva",
    user_photo: "https://cdn.example/fulano-kmp.jpg",
    role: "MEMBER",
    status: "ACTIVE",
  });
  state.set(`users/${UID}/groups/g-member`, {
    group_id: "g-member",
    group_name: "Fut de Domingo",
    role: "MEMBER",
  });
  // Link órfão (grupo cujo doc de membro já não existe).
  state.set(`users/${UID}/groups/g-gone`, {group_id: "g-gone", role: "MEMBER"});

  // group_invites (InvitePlayersScreen.tsx:229-240).
  state.set("group_invites/inv-to-user", {
    group_id: "g-member",
    group_name: "Fut de Domingo",
    invited_by_id: OTHER,
    invited_by_name: "Outro Jogador",
    invited_user_id: UID,
    invited_user_name: "Fulano da Silva",
    invited_user_photo: "https://cdn.example/fulano.jpg",
    status: "PENDING",
  });
  state.set("group_invites/inv-legacy", {
    group_id: "g-member",
    invitedUserId: UID,
    invitedUserName: "Fulano da Silva",
  });
  state.set("group_invites/inv-from-user", {
    group_id: "g-owned",
    invited_by_id: UID,
    invited_by_name: "Fulano da Silva",
    invited_user_id: OTHER,
    invited_user_name: "Outro Jogador",
    status: "PENDING",
  });

  // statistics/{uid} do escritor das Functions: sem campo user_id.
  state.set(`statistics/${UID}`, {totalGames: 12, totalGoals: 4, gamesWon: 7});

  // Review web (LocationDetailScreen.tsx:376-393): foto em `user_photo`.
  state.set(`locations/loc-1/reviews/${UID}`, {
    user_id: UID,
    user_name: "Fulano da Silva",
    user_photo: "https://cdn.example/fulano.jpg",
    rating: 5,
    comment: "Quadra boa",
  });

  // Cashbox (cashbox/callable.ts:434-436).
  state.set("groups/g-owned/cashbox/entry-1", {
    created_by: UID,
    created_by_name: "Fulano da Silva",
    amount: 30,
  });
}

/**
 * Extrai as contagens do log final de observabilidade.
 * @return {Record<string, number>|undefined} Contagens por coleção.
 */
function finalCounts(): Record<string, number> | undefined {
  const call = mockLoggerInfo.mock.calls.find(([message]) =>
    typeof message === "string" && message.includes("Cleanup completo"));
  return (call?.[1] as {counts?: Record<string, number>} | undefined)?.counts;
}

describe("onUserDeleted — #4113 anonimização com payload real do escritor", () => {
  beforeEach(() => {
    mockLoggerInfo.mockClear();
    seedWriterShapes();
  });

  test("groups: anonimiza owner_name (snake) e não reescreve o array members", async () => {
    await expect(runCleanup()).resolves.toBeUndefined();

    expect(state.get("groups/g-owned")).toEqual({
      name: "Pelada de Quinta",
      type: "PRIVATE",
      is_public: false,
      owner_id: UID,
      owner_name: ANON,
      member_count: 2,
      members: [UID],
      status: "ACTIVE",
    });
    // Grupo alheio: nada de PII do excluído no doc raiz → intocado.
    expect(state.get("groups/g-member")).toEqual({
      name: "Fut de Domingo",
      owner_id: OTHER,
      owner_name: "Outro Jogador",
      members: [OTHER, UID],
      status: "ACTIVE",
    });
  });

  test(
    "groups/{id}/members/{uid}: anonimiza user_name e fotos (web e KMP), " +
    "preserva role/status e não toca outros membros",
    async () => {
      await runCleanup();

      expect(state.get(`groups/g-owned/members/${UID}`)).toMatchObject({
        id: UID,
        user_id: UID,
        user_name: ANON,
        user_photo_url: null,
        role: "OWNER",
        status: "ACTIVE",
      });
      expect(state.get(`groups/g-member/members/${UID}`)).toMatchObject({
        user_id: UID,
        user_name: ANON,
        user_photo: null,
        role: "MEMBER",
        status: "ACTIVE",
      });
      expect(state.get(`groups/g-owned/members/${OTHER}`)).toEqual({
        id: OTHER,
        user_id: OTHER,
        user_name: "Outro Jogador",
        user_photo_url: "https://cdn.example/outro.jpg",
        role: "MEMBER",
        status: "ACTIVE",
      });
      // Link órfão não cria membro fantasma; todos os links são removidos.
      expect(state.has(`groups/g-gone/members/${UID}`)).toBe(false);
      const leftoverLinks = [...state.keys()]
        .filter((path) => path.startsWith(`users/${UID}/groups/`));
      expect(leftoverLinks).toEqual([]);
    },
  );

  test(
    "group_invites: apaga convites recebidos (snake e camel legado) e " +
    "anonimiza o nome em convites enviados",
    async () => {
      await runCleanup();

      expect(state.has("group_invites/inv-to-user")).toBe(false);
      expect(state.has("group_invites/inv-legacy")).toBe(false);
      expect(state.get("group_invites/inv-from-user")).toMatchObject({
        invited_by_id: UID,
        invited_by_name: ANON,
        invited_user_id: OTHER,
        invited_user_name: "Outro Jogador",
      });
    },
  );

  test("statistics/{uid} sem user_id (escritor das Functions) é apagado pelo ID", async () => {
    await runCleanup();
    expect(state.has(`statistics/${UID}`)).toBe(false);
  });

  test("reviews e cashbox: anonimiza nome e foto", async () => {
    await runCleanup();

    expect(state.get(`locations/loc-1/reviews/${UID}`)).toMatchObject({
      user_id: UID,
      user_name: ANON,
      user_photo: null,
      rating: 5,
      comment: "Quadra boa",
    });
    expect(state.get("groups/g-owned/cashbox/entry-1")).toMatchObject({
      created_by: UID,
      created_by_name: ANON,
      amount: 30,
    });
  });

  test("nenhum valor de PII do usuário excluído sobrevive no Firestore", async () => {
    await runCleanup();

    const leaked = [...state.entries()].filter(([, data]) =>
      Object.values(data).some((value) =>
        value === "Fulano da Silva" ||
        (typeof value === "string" && value.includes("fulano"))));
    expect(leaked).toEqual([]);
  });

  test("observabilidade: loga contagem por coleção ao final (#4113)", async () => {
    await runCleanup();

    expect(finalCounts()).toMatchObject({
      statistics: 1,
      groups_owner_anonymized: 1,
      group_members_anonymized: 2,
      user_group_links_deleted: 3,
      group_invites_deleted: 2,
      group_invites_anonymized: 1,
      location_reviews_anonymized: 1,
      cashbox_anonymized: 1,
    });
  });

  test("reexecução (retry via failurePolicy) é idempotente e não relança", async () => {
    await runCleanup();
    const afterFirst = new Map(state);
    mockLoggerInfo.mockClear();

    await expect(runCleanup()).resolves.toBeUndefined();

    expect(state).toEqual(afterFirst);
    expect(finalCounts()).toMatchObject({
      groups_owner_anonymized: 0,
      group_members_anonymized: 0,
      user_group_links_deleted: 0,
      group_invites_deleted: 0,
    });
  });

  test(
    "audit_logs: apaga também performed_by, manager_uid e source_user_id " +
    "(campos reais dos escritores)",
    async () => {
      // maintenance/soft-delete.ts:166-168
      state.set("audit_logs/soft-delete", {
        action: "SOFT_DELETE_GAME",
        performed_by: UID,
      });
      // games/confirm-player-as-manager.ts:276-283
      state.set("audit_logs/confirm-manager", {
        type: "CONFIRM_PLAYER_AS_MANAGER",
        target_user_id: OTHER,
        manager_uid: UID,
      });
      // auth/account-merge.ts ACCOUNT_MERGE_COMPLETED
      state.set("audit_logs/merge", {
        type: "ACCOUNT_MERGE_COMPLETED",
        source_user_id: UID,
        target_user_id: OTHER,
      });
      // auth/custom-claims.ts:201-202 (já coberto antes; controle)
      state.set("audit_logs/claims", {
        target_user_id: UID,
        actor_user_id: OTHER,
      });
      state.set("audit_logs/unrelated", {
        target_user_id: OTHER,
        actor_user_id: OTHER,
      });

      await runCleanup();

      const remaining = [...state.keys()].filter((path) =>
        path.startsWith("audit_logs/"));
      expect(remaining).toEqual(["audit_logs/unrelated"]);
      expect(finalCounts()).toMatchObject({
        audit_logs_target: 1,
        audit_logs_other: 3,
      });
    },
  );

  test("user_streaks: apaga o doc {uid} e docs legados localizados por user_id", async () => {
    // index.ts:1252 grava em {uid}; leitores buscam por user_id.
    state.set(`user_streaks/${UID}`, {user_id: UID, current_streak: 3});
    state.set("user_streaks/legacy-auto-id", {user_id: UID, current_streak: 1});
    state.set("user_streaks/other", {user_id: OTHER, current_streak: 5});

    await runCleanup();

    const remaining = [...state.keys()].filter((path) =>
      path.startsWith("user_streaks/"));
    expect(remaining).toEqual(["user_streaks/other"]);
  });

  test("groups legado camelCase (ownerId/ownerName) segue coberto como defesa", async () => {
    state.set("groups/g-legacy", {
      ownerId: UID,
      ownerName: "Fulano da Silva",
      members: [UID],
    });

    await runCleanup();

    expect(state.get("groups/g-legacy")).toEqual({
      ownerId: UID,
      ownerName: ANON,
      members: [UID],
    });
    expect(finalCounts()).toMatchObject({groups_owner_anonymized: 2});
  });
});
