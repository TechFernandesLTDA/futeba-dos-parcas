/**
 * Testes do trigger onInviteRedeemed (issue #2517 / regressão #2153).
 *
 * Cobre:
 * - used: false -> true cria member (status ACTIVE) + users/{uid}/groups
 * - NÃO incrementa member_count nem seta _counted_by_join_request
 *   (onMemberWritten é o dono do counter)
 * - Funciona p/ grupo PRIVADO (a function bypassa rules via admin SDK)
 * - Transição sem mudança (used já true / continua false) não faz nada
 * - Convite expirado não cria membership
 * - Member já existente é idempotente (skip)
 * - group_id / used_by ausentes abortam com warn
 */

const mockTxSet = jest.fn();

const mockMemberGet = jest.fn().mockResolvedValue({exists: false});
const mockGroupGet = jest.fn().mockResolvedValue({
  exists: true,
  data: () => ({
    name: "Grupo Privado",
    photo_url: "https://example.com/g.jpg",
    status: "ACTIVE",
    is_public: false,
    owner_id: "owner-uid",
  }),
});
const mockUserGet = jest.fn().mockResolvedValue({
  exists: true,
  data: () => ({
    name: "Joiner Name",
    photo_url: "https://example.com/u.jpg",
  }),
});

const mockRunTransaction = jest.fn(
  async (callback: (tx: Record<string, unknown>) => Promise<void>) => {
    const tx = {
      get: jest.fn((ref: {get: () => Promise<unknown>}) => ref.get()),
      set: mockTxSet,
    };
    await callback(tx);
  }
);

const mockDoc = jest.fn((path: string) => {
  if (path?.includes("/members/")) {
    return {get: mockMemberGet};
  }
  if (path?.startsWith("users/")) {
    return {get: mockUserGet};
  }
  return {get: mockGroupGet};
});

jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
    increment: jest.fn((n: number) => ({_type: "Increment", value: n})),
  };
  const mockAdmin: Record<string, unknown> = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => ({
      doc: mockDoc,
      runTransaction: mockRunTransaction,
    })),
    initializeApp: jest.fn(),
  };
  (mockAdmin.firestore as Record<string, unknown>).FieldValue = mockFieldValue;
  return mockAdmin;
});

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../src/constants", () => ({
  FUNCTION_REGION: "us-central1",
}));

import {onInviteRedeemed} from "../src/groups/invite-redeemed";

interface MockEvent {
  data: {
    before: {data: () => unknown};
    after: {data: () => unknown};
  };
  params: {code: string};
}

function makeEvent(beforeData: unknown, afterData: unknown): MockEvent {
  return {
    data: {
      before: {data: () => beforeData},
      after: {data: () => afterData},
    },
    params: {code: "PRV001"},
  };
}

const futureExpiry = {toMillis: () => Date.now() + 86400000};
const pastExpiry = {toMillis: () => Date.now() - 86400000};

describe("onInviteRedeemed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMemberGet.mockResolvedValue({exists: false});
    mockGroupGet.mockResolvedValue({
      exists: true,
      data: () => ({
        name: "Grupo Privado",
        photo_url: "https://example.com/g.jpg",
        status: "ACTIVE",
        is_public: false,
        owner_id: "owner-uid",
      }),
    });
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({
        name: "Joiner Name",
        photo_url: "https://example.com/u.jpg",
      }),
    });
    mockRunTransaction.mockImplementation(
      async (callback: (tx: Record<string, unknown>) => Promise<void>) => {
        const tx = {
          get: jest.fn((ref: {get: () => Promise<unknown>}) => ref.get()),
          set: mockTxSet,
        };
        await callback(tx);
      }
    );
  });

  it(
    "used:false->true cria member ACTIVE em grupo PRIVADO via trigger",
    async () => {
      const event = makeEvent(
        {used: false, group_id: "g1", used_by: "joiner-uid"},
        {
          used: true,
          group_id: "g1",
          used_by: "joiner-uid",
          expires_at: futureExpiry,
        }
      );

      await (onInviteRedeemed as unknown as
        (e: MockEvent) => Promise<void>)(event);

      expect(mockRunTransaction).toHaveBeenCalled();
      // 1 set member + 1 set users/{uid}/groups = 2 sets
      expect(mockTxSet).toHaveBeenCalledTimes(2);
      const memberCall = mockTxSet.mock.calls.find(
        (c) => (c[1] as Record<string, unknown>).role === "MEMBER" &&
          (c[1] as Record<string, unknown>).status === "ACTIVE"
      );
      expect(memberCall).toBeDefined();
      const memberData = memberCall?.[1] as Record<string, unknown>;
      // NÃO seta _counted_by_join_request (onMemberWritten faz o +1)
      expect(memberData._counted_by_join_request).toBeUndefined();
      expect(memberData.user_name).toBe("Joiner Name");
    }
  );

  it("NÃO incrementa member_count (sem tx.update)", async () => {
    // tx só expõe get/set neste trigger; um tx.update lançaria.
    const event = makeEvent(
      {used: false, group_id: "g1", used_by: "joiner-uid"},
      {used: true, group_id: "g1", used_by: "joiner-uid",
        expires_at: futureExpiry}
    );
    await (onInviteRedeemed as unknown as
      (e: MockEvent) => Promise<void>)(event);
    // 2 sets, nenhuma chamada de update no tx (não existe mockTxUpdate).
    expect(mockTxSet).toHaveBeenCalledTimes(2);
  });

  it("transição sem redenção (used continua false) não faz nada", async () => {
    const event = makeEvent(
      {used: false, group_id: "g1", used_by: undefined},
      {used: false, group_id: "g1"}
    );
    await (onInviteRedeemed as unknown as
      (e: MockEvent) => Promise<void>)(event);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("convite expirado não cria membership", async () => {
    const event = makeEvent(
      {used: false, group_id: "g1", used_by: "joiner-uid"},
      {used: true, group_id: "g1", used_by: "joiner-uid",
        expires_at: pastExpiry}
    );
    await (onInviteRedeemed as unknown as
      (e: MockEvent) => Promise<void>)(event);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("member já existente é idempotente (skip)", async () => {
    mockMemberGet.mockResolvedValue({exists: true});
    const event = makeEvent(
      {used: false, group_id: "g1", used_by: "joiner-uid"},
      {used: true, group_id: "g1", used_by: "joiner-uid",
        expires_at: futureExpiry}
    );
    await (onInviteRedeemed as unknown as
      (e: MockEvent) => Promise<void>)(event);
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it("used_by ausente aborta sem criar membership", async () => {
    const event = makeEvent(
      {used: false, group_id: "g1"},
      {used: true, group_id: "g1", expires_at: futureExpiry}
    );
    await (onInviteRedeemed as unknown as
      (e: MockEvent) => Promise<void>)(event);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("group_id ausente aborta sem criar membership", async () => {
    const event = makeEvent(
      {used: false, used_by: "joiner-uid"},
      {used: true, used_by: "joiner-uid", expires_at: futureExpiry}
    );
    await (onInviteRedeemed as unknown as
      (e: MockEvent) => Promise<void>)(event);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("grupo inativo aborta sem criar membership", async () => {
    mockGroupGet.mockResolvedValue({
      exists: true,
      data: () => ({name: "G", status: "DELETED"}),
    });
    const event = makeEvent(
      {used: false, group_id: "g1", used_by: "joiner-uid"},
      {used: true, group_id: "g1", used_by: "joiner-uid",
        expires_at: futureExpiry}
    );
    await (onInviteRedeemed as unknown as
      (e: MockEvent) => Promise<void>)(event);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});
