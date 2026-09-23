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
 * - groups/{id}/cashbox/{id}: functions/src/cashbox/callable.ts:420-438
 *   (`created_by`/`created_by_name` de quem lançou; `player_id`/`player_name`
 *   do pagador) e a baixa mensal cashbox/monthly.ts:1822-1843 (`player_id`
 *   SEM `player_name`);
 * - groups/{id}/monthly_finance_periods/{p}: cashbox/monthly.ts:1327 e
 *   .../payers/{uid}: cashbox/monthly.ts:1286-1305 (`user_id`, `user_name`,
 *   `user_photo_url`);
 * - groups/{id}/cashbox/{id}.description: a descrição padrão do Android
 *   (RecordPaymentUseCase: "Pagamento de <nome>") gravada por
 *   createCashboxEntry, e texto livre digitado pelo organizador;
 * - post_game_reputation/{gameId}_{reviewer}_{target}:
 *   functions/src/reputation/post-game-reputation.ts:488-493 (`reviewer_*` e
 *   `target_user_*`, foto vazia gravada como "").
 *
 * O Firestore é um fake em memória: as asserções são sobre o ESTADO FINAL,
 * não sobre quais mocks foram chamados.
 */

type Data = Record<string, unknown>;

const state = new Map<string, Data>();

/**
 * Registro das consultas executadas (`scope` = caminho da coleção ou
 * `collectionGroup:<nome>`) — permite afirmar que o cleanup só usa
 * collectionGroup nos campos que têm fieldOverride em firestore.indexes.json.
 */
const queryLog: Array<{scope: string; fields: string[]}> = [];

/** Injeta erro (código gRPC) na PRÓXIMA leitura de um escopo de consulta. */
const failNextGet = new Map<string, number>();

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
  scope: string,
  matchesPath: (path: string) => boolean,
  filters: Array<{field: string; value: unknown}> = [],
  limitValue?: number,
  afterPath?: string,
): Record<string, unknown> {
  return {
    where: (field: string, op: string, value: unknown) => {
      if (op !== "==") throw new Error(`operador não suportado no fake: ${op}`);
      return makeQuery(scope, matchesPath, [...filters, {field, value}], limitValue, afterPath);
    },
    limit: (value: number) => makeQuery(scope, matchesPath, filters, value, afterPath),
    startAfter: (snap: FakeSnap) =>
      makeQuery(scope, matchesPath, filters, limitValue, snap.ref.path),
    get: async () => {
      queryLog.push({scope, fields: filters.map(({field}) => field)});
      const failureCode = failNextGet.get(scope);
      if (failureCode !== undefined) {
        failNextGet.delete(scope);
        throw Object.assign(new Error(`fake: falha em ${scope}`), {code: failureCode});
      }
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
    makeQuery(path, (docPath) => parentCollectionOf(docPath) === path),
  collectionGroup: (name: string) =>
    makeQuery(`collectionGroup:${name}`, (docPath) => {
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
  queryLog.length = 0;
  failNextGet.clear();
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

  // Cashbox: pagamento lançado pelo dono (OTHER) em que o excluído é o
  // jogador pagador — payload de createCashboxEntry (callable.ts:420-438).
  state.set("groups/g-member/cashbox/pay-user", {
    group_id: "g-member",
    type: "INCOME",
    amount: 25,
    amount_cents: 2500,
    description: "Mensalidade agosto",
    category: "MONTHLY_FEE",
    status: "ACTIVE",
    reference_date: 1785542400000,
    player_id: UID,
    player_name: "Fulano da Silva",
    created_by: OTHER,
    created_by_id: OTHER,
    created_by_name: "Outro Jogador",
    created_at: "2026-08-01T12:00:00Z",
  });
  // Pagamento de OUTRO jogador no mesmo grupo: não pode ser tocado.
  state.set("groups/g-member/cashbox/pay-other", {
    group_id: "g-member",
    type: "INCOME",
    amount: 25,
    amount_cents: 2500,
    description: "Mensalidade agosto",
    category: "MONTHLY_FEE",
    status: "ACTIVE",
    player_id: OTHER,
    player_name: "Outro Jogador",
    created_by: OTHER,
    created_by_id: OTHER,
    created_by_name: "Outro Jogador",
    created_at: "2026-08-01T12:05:00Z",
  });
  // Baixa mensal (monthly.ts:1822-1843): `player_id` SEM `player_name`.
  state.set("groups/g-member/cashbox/monthly_req-1", {
    group_id: "g-member",
    type: "INCOME",
    amount: 25,
    amount_cents: 2500,
    description: "Mensalidade 2026-08",
    category: "MONTHLY_FEE",
    status: "ACTIVE",
    request_id: "req-1",
    player_id: UID,
    reference_period: "2026-08",
    monthly_period_key: "2026-08",
    monthly_payer_id: UID,
    created_by: OTHER,
    created_by_id: OTHER,
    created_by_name: "Outro Jogador",
    created_at: "2026-08-10T12:00:00Z",
  });

  // Descrição padrão do Android (RecordPaymentUseCase, antes do #4113):
  // "Pagamento de <nome>", gravada por createCashboxEntry.
  state.set("groups/g-member/cashbox/pay-default-desc", {
    group_id: "g-member",
    type: "INCOME",
    amount: 30,
    amount_cents: 3000,
    description: "Pagamento de Fulano da Silva",
    category: "SINGLE_PAYMENT",
    status: "ACTIVE",
    reference_date: 1785542400000,
    player_id: UID,
    player_name: "Fulano da Silva",
    created_by: OTHER,
    created_by_id: OTHER,
    created_by_name: "Outro Jogador",
    created_at: "2026-08-02T12:00:00Z",
  });
  // Descrição livre com o nome repetido, em caixa diferente, e palavras que
  // CONTÊM parte do nome (não podem ser tocadas).
  state.set("groups/g-member/cashbox/pay-free-desc", {
    group_id: "g-member",
    type: "INCOME",
    amount: 50,
    amount_cents: 5000,
    description: "Fulano da Silva pagou 2 meses (FULANO DA SILVA traz troco); Fulanos da Silveira não",
    category: "MONTHLY_FEE",
    status: "ACTIVE",
    reference_date: 1785542400000,
    player_id: UID,
    player_name: "Fulano da Silva",
    created_by: OTHER,
    created_by_id: OTHER,
    created_by_name: "Outro Jogador",
    created_at: "2026-08-03T12:00:00Z",
  });

  // post_game_reputation (post-game-reputation.ts:488-493): excluído como
  // AVALIADOR…
  state.set(`post_game_reputation/game-1_${UID}_${OTHER}`, {
    game_id: "game-1",
    group_id: "g-member",
    reviewer_id: UID,
    reviewer_name: "Fulano da Silva",
    reviewer_photo: "https://cdn.example/fulano.jpg",
    target_user_id: OTHER,
    target_user_name: "Outro Jogador",
    target_user_photo: "https://cdn.example/outro.jpg",
    punctuality: 5,
    respect: 4,
    commitment: 5,
    overall: 4.67,
    comment: "Chegou cedo",
    updated_at: "2026-08-05T22:00:00Z",
    created_at: "2026-08-05T22:00:00Z",
  });
  // …como avaliador sem foto (o escritor grava `?? ""`)…
  state.set(`post_game_reputation/game-2_${UID}_${OTHER}`, {
    game_id: "game-2",
    group_id: null,
    reviewer_id: UID,
    reviewer_name: "Fulano da Silva",
    reviewer_photo: "",
    target_user_id: OTHER,
    target_user_name: "Outro Jogador",
    target_user_photo: "",
    punctuality: 3,
    respect: 3,
    commitment: 3,
    overall: 3,
    comment: "",
    updated_at: "2026-08-12T22:00:00Z",
    created_at: "2026-08-12T22:00:00Z",
  });
  // …e como AVALIADO.
  state.set(`post_game_reputation/game-1_${OTHER}_${UID}`, {
    game_id: "game-1",
    group_id: "g-member",
    reviewer_id: OTHER,
    reviewer_name: "Outro Jogador",
    reviewer_photo: "https://cdn.example/outro.jpg",
    target_user_id: UID,
    target_user_name: "Fulano da Silva",
    target_user_photo: "https://cdn.example/fulano.jpg",
    punctuality: 4,
    respect: 5,
    commitment: 4,
    overall: 4.33,
    comment: "Bom de bola",
    updated_at: "2026-08-05T23:00:00Z",
    created_at: "2026-08-05T23:00:00Z",
  });
  // Avaliação entre terceiros: não pode ser tocada.
  state.set(`post_game_reputation/game-1_${OTHER}_third-user`, {
    game_id: "game-1",
    group_id: "g-member",
    reviewer_id: OTHER,
    reviewer_name: "Outro Jogador",
    reviewer_photo: "https://cdn.example/outro.jpg",
    target_user_id: "third-user",
    target_user_name: "Terceiro",
    target_user_photo: "",
    punctuality: 2,
    respect: 3,
    commitment: 2,
    overall: 2.33,
    comment: "Atrasou",
    updated_at: "2026-08-05T23:30:00Z",
    created_at: "2026-08-05T23:30:00Z",
  });

  // Período mensal (monthly.ts:1327) + pagadores (monthly.ts:1286-1305).
  state.set("groups/g-member/monthly_finance_periods/2026-08", {
    period_key: "2026-08",
    status: "FINALIZED",
    revision: 1,
    calculation_hash: "hash-08",
    total_court_cost_cents: 5000,
    received_cents: 2500,
    open_cents: 2500,
  });
  state.set(`groups/g-member/monthly_finance_periods/2026-08/payers/${UID}`, {
    user_id: UID,
    user_name: "Fulano da Silva",
    user_photo_url: "https://cdn.example/fulano.jpg",
    active: true,
    expected_cents: 2500,
    paid_cents: 2500,
    outstanding_cents: 0,
    status: "PAID",
    payment_count: 1,
    period_key: "2026-08",
    revision: 1,
    calculation_hash: "hash-08",
    updated_at: "2026-08-10T12:00:00Z",
    created_at: "2026-08-01T00:00:00Z",
  });
  state.set(`groups/g-member/monthly_finance_periods/2026-08/payers/${OTHER}`, {
    user_id: OTHER,
    user_name: "Outro Jogador",
    user_photo_url: "https://cdn.example/outro.jpg",
    active: true,
    expected_cents: 2500,
    paid_cents: 0,
    outstanding_cents: 2500,
    status: "PENDING",
    payment_count: 0,
    period_key: "2026-08",
    revision: 1,
    calculation_hash: "hash-08",
    updated_at: "2026-08-01T00:00:00Z",
    created_at: "2026-08-01T00:00:00Z",
  });
  // Período sem cobrança do excluído: não pode ganhar pagador fantasma.
  state.set("groups/g-member/monthly_finance_periods/2026-09", {
    period_key: "2026-09",
    status: "DRAFT",
    revision: 1,
    calculation_hash: "hash-09",
  });
  state.set(`groups/g-member/monthly_finance_periods/2026-09/payers/${OTHER}`, {
    user_id: OTHER,
    user_name: "Outro Jogador",
    user_photo_url: null,
    active: true,
    expected_cents: 5000,
    paid_cents: 0,
    outstanding_cents: 5000,
    status: "PENDING",
    period_key: "2026-09",
    revision: 1,
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

  test(
    "cashbox (player_id): anonimiza player_name do pagador excluído, não " +
    "cria o campo na baixa mensal e não toca o pagamento de outro jogador",
    async () => {
      const otherEntryBefore = state.get("groups/g-member/cashbox/pay-other");
      const monthlyEntryBefore = state.get("groups/g-member/cashbox/monthly_req-1");

      await runCleanup();

      expect(state.get("groups/g-member/cashbox/pay-user")).toEqual({
        group_id: "g-member",
        type: "INCOME",
        amount: 25,
        amount_cents: 2500,
        description: "Mensalidade agosto",
        category: "MONTHLY_FEE",
        status: "ACTIVE",
        reference_date: 1785542400000,
        player_id: UID,
        player_name: ANON,
        created_by: OTHER,
        created_by_id: OTHER,
        created_by_name: "Outro Jogador",
        created_at: "2026-08-01T12:00:00Z",
      });
      expect(state.get("groups/g-member/cashbox/pay-other")).toEqual(otherEntryBefore);
      expect(state.get("groups/g-member/cashbox/monthly_req-1")).toEqual(monthlyEntryBefore);
      expect(state.get("groups/g-member/cashbox/monthly_req-1")).not.toHaveProperty("player_name");
    },
  );

  test(
    "cashbox description: substitui o player_name original no MESMO update " +
    "(padrão \"Pagamento de <nome>\" e texto livre); outros campos intactos",
    async () => {
      const defaultBefore = state.get("groups/g-member/cashbox/pay-default-desc");
      const freeBefore = state.get("groups/g-member/cashbox/pay-free-desc");

      await runCleanup();

      expect(state.get("groups/g-member/cashbox/pay-default-desc")).toEqual({
        ...defaultBefore,
        player_name: ANON,
        description: `Pagamento de ${ANON}`,
      });
      expect(state.get("groups/g-member/cashbox/pay-free-desc")).toEqual({
        ...freeBefore,
        player_name: ANON,
        description: `${ANON} pagou 2 meses (${ANON} traz troco); Fulanos da Silveira não`,
      });
      // Descrição sem o nome não é reescrita.
      expect(state.get("groups/g-member/cashbox/pay-user")).toMatchObject({
        player_name: ANON,
        description: "Mensalidade agosto",
      });
      expect(finalCounts()).toMatchObject({
        cashbox_player_anonymized: 3,
        cashbox_description_redacted: 2,
      });
    },
  );

  test(
    "post_game_reputation: anonimiza nome/foto do excluído como avaliador E " +
    "como avaliado; notas, comentário e o outro lado intactos",
    async () => {
      const unrelatedBefore = state.get(`post_game_reputation/game-1_${OTHER}_third-user`);
      const asReviewerBefore = state.get(`post_game_reputation/game-1_${UID}_${OTHER}`);
      const asReviewerNoPhotoBefore = state.get(`post_game_reputation/game-2_${UID}_${OTHER}`);
      const asTargetBefore = state.get(`post_game_reputation/game-1_${OTHER}_${UID}`);

      await runCleanup();

      expect(state.get(`post_game_reputation/game-1_${UID}_${OTHER}`)).toEqual({
        ...asReviewerBefore,
        reviewer_name: ANON,
        reviewer_photo: "",
      });
      expect(state.get(`post_game_reputation/game-2_${UID}_${OTHER}`)).toEqual({
        ...asReviewerNoPhotoBefore,
        reviewer_name: ANON,
        reviewer_photo: "",
      });
      expect(state.get(`post_game_reputation/game-1_${OTHER}_${UID}`)).toEqual({
        ...asTargetBefore,
        target_user_name: ANON,
        target_user_photo: "",
      });
      expect(state.get(`post_game_reputation/game-1_${OTHER}_third-user`)).toEqual(unrelatedBefore);
      expect(finalCounts()).toMatchObject({
        post_game_reputation_reviewer_anonymized: 2,
        post_game_reputation_target_anonymized: 1,
      });
      // Escopo COLLECTION por igualdade (índice single-field automático).
      expect(queryLog).toContainEqual({scope: "post_game_reputation", fields: ["reviewer_id"]});
      expect(queryLog).toContainEqual({scope: "post_game_reputation", fields: ["target_user_id"]});
    },
  );

  test(
    "post_game_reputation: falha transitória num lado não impede o outro e " +
    "o retry completa",
    async () => {
      // A 1ª leitura do escopo é a do lado avaliador (reviewer_id).
      failNextGet.set("post_game_reputation", 14); // UNAVAILABLE

      await expect(runCleanup()).rejects.toThrow("PII anonymization incomplete");

      expect(state.get(`post_game_reputation/game-1_${UID}_${OTHER}`))
        .toMatchObject({reviewer_name: "Fulano da Silva"});
      expect(state.get(`post_game_reputation/game-1_${OTHER}_${UID}`))
        .toMatchObject({target_user_name: ANON, target_user_photo: ""});

      mockLoggerInfo.mockClear();
      await expect(runCleanup()).resolves.toBeUndefined();

      expect(state.get(`post_game_reputation/game-1_${UID}_${OTHER}`))
        .toMatchObject({reviewer_name: ANON, reviewer_photo: ""});
      expect(finalCounts()).toMatchObject({
        post_game_reputation_reviewer_anonymized: 2,
        // Já anonimizado na 1ª tentativa: não é reescrito.
        post_game_reputation_target_anonymized: 0,
      });
    },
  );

  test(
    "monthly_finance_periods/{p}/payers/{uid}: anonimiza user_name e anula " +
    "user_photo_url do excluído; outros pagadores e períodos intocados",
    async () => {
      const periodPath = "groups/g-member/monthly_finance_periods";
      const otherPayerBefore = state.get(`${periodPath}/2026-08/payers/${OTHER}`);
      const otherPayerSeptBefore = state.get(`${periodPath}/2026-09/payers/${OTHER}`);
      const periodBefore = state.get(`${periodPath}/2026-08`);

      await runCleanup();

      expect(state.get(`${periodPath}/2026-08/payers/${UID}`)).toEqual({
        user_id: UID,
        user_name: ANON,
        user_photo_url: null,
        active: true,
        expected_cents: 2500,
        paid_cents: 2500,
        outstanding_cents: 0,
        status: "PAID",
        payment_count: 1,
        period_key: "2026-08",
        revision: 1,
        calculation_hash: "hash-08",
        updated_at: "2026-08-10T12:00:00Z",
        created_at: "2026-08-01T00:00:00Z",
      });
      expect(state.get(`${periodPath}/2026-08/payers/${OTHER}`)).toEqual(otherPayerBefore);
      expect(state.get(`${periodPath}/2026-09/payers/${OTHER}`)).toEqual(otherPayerSeptBefore);
      expect(state.get(`${periodPath}/2026-08`)).toEqual(periodBefore);
      // Período sem cobrança do excluído: nenhum pagador fantasma criado.
      expect(state.has(`${periodPath}/2026-09/payers/${UID}`)).toBe(false);
    },
  );

  test(
    "financeiro: falha transitória mantém o link users/{uid}/groups do grupo " +
    "e o retry (failurePolicy) completa a anonimização",
    async () => {
      const payerPath = `groups/g-member/monthly_finance_periods/2026-08/payers/${UID}`;
      failNextGet.set("groups/g-member/monthly_finance_periods", 14); // UNAVAILABLE

      await expect(runCleanup()).rejects.toThrow("PII anonymization incomplete");

      // O link do grupo com falha sobrevive (é o ponteiro do retry); os
      // demais grupos seguem o fluxo normal.
      expect(state.has(`users/${UID}/groups/g-member`)).toBe(true);
      expect(state.has(`users/${UID}/groups/g-owned`)).toBe(false);
      expect(state.get(payerPath)).toMatchObject({user_name: "Fulano da Silva"});
      // Etapas independentes: cashbox e membro do mesmo grupo já anonimizados.
      expect(state.get("groups/g-member/cashbox/pay-user")).toMatchObject({player_name: ANON});
      expect(state.get(`groups/g-member/members/${UID}`)).toMatchObject({user_name: ANON});
      expect(finalCounts()).toMatchObject({
        user_group_links_deleted: 2,
        user_group_links_kept: 1,
      });

      mockLoggerInfo.mockClear();
      await expect(runCleanup()).resolves.toBeUndefined();

      expect(state.get(payerPath)).toMatchObject({user_name: ANON, user_photo_url: null});
      expect(state.has(`users/${UID}/groups/g-member`)).toBe(false);
      expect(finalCounts()).toMatchObject({
        // player_name já anonimizado na 1ª tentativa: não é reescrito.
        cashbox_player_anonymized: 0,
        monthly_payers_anonymized: 1,
        user_group_links_deleted: 1,
        user_group_links_kept: 0,
      });
    },
  );

  test(
    "sem índice novo: collectionGroup só em cashbox.created_by e " +
    "reviews.user_id (fieldOverrides existentes); nada em activities (#1968)",
    async () => {
      await runCleanup();

      const collectionGroupQueries = new Set(queryLog
        .filter(({scope}) => scope.startsWith("collectionGroup:"))
        .map(({scope, fields}) =>
          `${scope.slice("collectionGroup:".length)}.${fields.join("+")}`));
      expect([...collectionGroupQueries].sort()).toEqual([
        "cashbox.created_by",
        "reviews.user_id",
      ]);
      // Financeiro do pagador: escopo COLLECTION, grupo a grupo.
      expect(queryLog).toContainEqual({
        scope: "groups/g-member/cashbox",
        fields: ["player_id"],
      });
      expect(queryLog).toContainEqual({
        scope: "groups/g-member/monthly_finance_periods",
        fields: [],
      });
    },
  );

  test("nenhum valor de PII do usuário excluído sobrevive no Firestore", async () => {
    await runCleanup();

    // Substring (não só igualdade): pega o nome dentro de descrições livres.
    const leaked = [...state.entries()].filter(([, data]) =>
      Object.values(data).some((value) =>
        typeof value === "string" &&
        (value.includes("Fulano da Silva") || value.includes("fulano"))));
    expect(leaked).toEqual([]);
  });

  test("observabilidade: loga contagem por coleção ao final (#4113)", async () => {
    await runCleanup();

    expect(finalCounts()).toMatchObject({
      statistics: 1,
      groups_owner_anonymized: 1,
      group_members_anonymized: 2,
      user_group_links_deleted: 3,
      user_group_links_kept: 0,
      group_invites_deleted: 2,
      group_invites_anonymized: 1,
      location_reviews_anonymized: 1,
      cashbox_anonymized: 1,
      cashbox_player_anonymized: 3,
      cashbox_description_redacted: 2,
      monthly_payers_anonymized: 1,
      post_game_reputation_reviewer_anonymized: 2,
      post_game_reputation_target_anonymized: 1,
    });
    // #1968: contador do bloco morto de activities "alvo" removido.
    expect(finalCounts()).not.toHaveProperty("activities_target_anonymized");
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
      cashbox_player_anonymized: 0,
      cashbox_description_redacted: 0,
      monthly_payers_anonymized: 0,
      post_game_reputation_reviewer_anonymized: 0,
      post_game_reputation_target_anonymized: 0,
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
