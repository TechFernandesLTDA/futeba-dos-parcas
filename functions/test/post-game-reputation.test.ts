let mockRunTransaction = jest.fn();
let mockDoc = jest.fn();
let mockCollection = jest.fn();

const mockServerTimestamp = jest.fn(() => ({_type: "ServerTimestamp"}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: mockServerTimestamp,
  },
}));

jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({
    doc: mockDoc,
    collection: mockCollection,
    runTransaction: mockRunTransaction,
  })),
}));

jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 19,
    resetAt: new Date(Date.now() + 60000),
  }),
}));

jest.mock("../src/middleware/require-profile-complete", () => ({
  requireProfileComplete: jest.fn(),
}));

class MockHttpsError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpsError";
    this.code = code;
    this.details = details;
  }
}

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: MockHttpsError,
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {submitPostGameReputation} from "../src/reputation/post-game-reputation";
import {checkRateLimit} from "../src/middleware/rate-limiter";
import {requireProfileComplete} from "../src/middleware/require-profile-complete";

type SnapData = Record<string, unknown>;

function makeSnap(data: SnapData | null) {
  return {
    exists: data !== null,
    data: () => data,
  };
}

function makeRequest(data: Record<string, unknown> = {}, uid = "reviewer1") {
  return {
    auth: {uid, token: {profileComplete: true}},
    data: {
      gameId: "game1",
      targetUserId: "target1",
      punctuality: 5,
      respect: 4,
      commitment: 3,
      comment: "  Bom parceiro   de jogo  ",
      ...data,
    },
  };
}

function setupFirestore({
  game = {status: "FINISHED", group_id: "group1"},
  reviewerConfirmation = {
    status: "CONFIRMED",
    user_name: "Reviewer",
    user_photo: "reviewer.png",
  },
  targetConfirmation = {
    status: "CONFIRMED",
    user_name: "Target",
    user_photo: "target.png",
  },
  targetUser = {name: "Target"},
  existingReview = null,
  legacyReviews = [],
}: {
  game?: SnapData | null;
  reviewerConfirmation?: SnapData | null;
  targetConfirmation?: SnapData | null;
  targetUser?: SnapData | null;
  existingReview?: SnapData | null;
  legacyReviews?: Array<{id: string; data: SnapData}>;
} = {}) {
  const snapForPath = (path: string) => {
    switch (path) {
    case "games/game1":
      return makeSnap(game);
    case "confirmations/game1_reviewer1":
      return makeSnap(reviewerConfirmation);
    case "confirmations/game1_target1":
      return makeSnap(targetConfirmation);
    case "users/target1":
      return makeSnap(targetUser);
    case "post_game_reputation/game1_reviewer1_target1":
      return makeSnap(existingReview);
    default:
      return makeSnap(null);
    }
  };
  const refsByPath = new Map<string, {path: string; get: jest.Mock}>();
  const tx = {
    get: jest.fn((ref: any) => {
      return Promise.resolve(snapForPath(ref?.path));
    }),
    set: jest.fn(),
    update: jest.fn(),
  };

  mockDoc.mockImplementation((path: string) => {
    if (!refsByPath.has(path)) {
      refsByPath.set(path, {
        path,
        get: jest.fn(() => Promise.resolve(snapForPath(path))),
      });
    }
    return refsByPath.get(path);
  });
  mockCollection.mockReturnValue({
    where: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({
        docs: legacyReviews.map((review) => ({
          id: review.id,
          data: () => review.data,
        })),
      })),
    })),
  });
  mockRunTransaction.mockImplementation(async (callback: any) => callback(tx));

  return {tx, refsByPath};
}

describe("submitPostGameReputation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: new Date(Date.now() + 60000),
    });
    (requireProfileComplete as jest.Mock).mockImplementation(() => undefined);
  });

  it("exige perfil completo e autenticacao", async () => {
    (requireProfileComplete as jest.Mock).mockImplementationOnce(() => {
      throw new MockHttpsError("failed-precondition", "profile.incomplete");
    });

    await expect(submitPostGameReputation(makeRequest()))
      .rejects.toThrow("profile.incomplete");

    await expect(submitPostGameReputation({...makeRequest(), auth: null}))
      .rejects.toMatchObject({code: "unauthenticated"});
  });

  it("valida ids, autoavaliacao, criterios e comentario", async () => {
    await expect(submitPostGameReputation(makeRequest({gameId: ""})))
      .rejects.toMatchObject({code: "invalid-argument"});
    await expect(submitPostGameReputation(makeRequest({targetUserId: "users/x"})))
      .rejects.toMatchObject({code: "invalid-argument"});
    await expect(submitPostGameReputation(makeRequest({targetUserId: "reviewer1"})))
      .rejects.toMatchObject({code: "failed-precondition"});
    await expect(submitPostGameReputation(makeRequest({punctuality: 6})))
      .rejects.toMatchObject({code: "invalid-argument"});
    await expect(submitPostGameReputation(makeRequest({respect: 2.5})))
      .rejects.toMatchObject({code: "invalid-argument"});
    await expect(submitPostGameReputation(makeRequest({commitment: "5"})))
      .rejects.toMatchObject({code: "invalid-argument"});
    await expect(submitPostGameReputation(makeRequest({comment: 123})))
      .rejects.toMatchObject({code: "invalid-argument"});
    await expect(submitPostGameReputation(makeRequest({comment: "x".repeat(161)})))
      .rejects.toMatchObject({code: "invalid-argument"});
  });

  it("aplica rate limit antes de abrir transacao", async () => {
    (checkRateLimit as jest.Mock).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 45000),
    });

    await expect(submitPostGameReputation(makeRequest()))
      .rejects.toMatchObject({code: "resource-exhausted"});

    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("rejeita quando jogo ou usuario avaliado nao existe", async () => {
    setupFirestore({game: null});
    await expect(submitPostGameReputation(makeRequest()))
      .rejects.toMatchObject({code: "not-found"});

    setupFirestore({targetUser: null});
    await expect(submitPostGameReputation(makeRequest()))
      .rejects.toMatchObject({code: "not-found"});
  });

  it("rejeita jogo nao finalizado e participantes invalidos", async () => {
    setupFirestore({game: {status: "LIVE"}});
    await expect(submitPostGameReputation(makeRequest()))
      .rejects.toMatchObject({code: "failed-precondition"});

    setupFirestore({reviewerConfirmation: null});
    await expect(submitPostGameReputation(makeRequest()))
      .rejects.toMatchObject({code: "permission-denied"});

    setupFirestore({reviewerConfirmation: {status: "WAITLISTED"}});
    await expect(submitPostGameReputation(makeRequest()))
      .rejects.toMatchObject({code: "permission-denied"});

    setupFirestore({targetConfirmation: null});
    await expect(submitPostGameReputation(makeRequest()))
      .rejects.toMatchObject({code: "failed-precondition"});

    setupFirestore({targetConfirmation: {status: "CANCELLED"}});
    await expect(submitPostGameReputation(makeRequest()))
      .rejects.toMatchObject({code: "failed-precondition"});
  });

  it("rejeita submissao fora da janela pos-jogo de 24h", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    setupFirestore({
      game: {
        status: "FINISHED",
        group_id: "group1",
        dateTime: {toDate: () => oldDate},
      },
    });

    await expect(submitPostGameReputation(makeRequest()))
      .rejects.toMatchObject({code: "failed-precondition"});
  });

  it("cria avaliacao e grava agregado inicial no perfil", async () => {
    const {tx, refsByPath} = setupFirestore();

    const result = await submitPostGameReputation(makeRequest());

    expect(result).toEqual({
      success: true,
      updated: false,
      reviewsCount: 1,
      overallAvg: 4,
    });
    expect(tx.set).toHaveBeenCalledWith(
      refsByPath.get("post_game_reputation/game1_reviewer1_target1"),
      expect.objectContaining({
        game_id: "game1",
        group_id: "group1",
        reviewer_id: "reviewer1",
        target_user_id: "target1",
        punctuality: 5,
        respect: 4,
        commitment: 3,
        overall: 4,
        comment: "Bom parceiro de jogo",
        created_at: {_type: "ServerTimestamp"},
        updated_at: {_type: "ServerTimestamp"},
      }),
      {merge: true}
    );
    expect(tx.update).toHaveBeenCalledWith(
      refsByPath.get("users/target1"),
      expect.objectContaining({
        reputation_punctuality_avg: 5,
        reputation_respect_avg: 4,
        reputation_commitment_avg: 3,
        reputation_overall_avg: 4,
        reputation_punctuality_sum: 5,
        reputation_respect_sum: 4,
        reputation_commitment_sum: 3,
        reputation_overall_sum_centi: 400,
        reputation_reviews_count: 1,
      })
    );
    expect(mockCollection).not.toHaveBeenCalled();
  });

  it("atualiza avaliacao existente com agregado incremental sem full-scan", async () => {
    const {tx} = setupFirestore({
      targetUser: {
        reputation_reviews_count: 2,
        reputation_punctuality_sum: 4,
        reputation_respect_sum: 4,
        reputation_commitment_sum: 4,
        reputation_overall_sum_centi: 400,
      },
      existingReview: {
        punctuality: 1,
        respect: 1,
        commitment: 1,
        overall: 1,
      },
    });

    const result = await submitPostGameReputation(makeRequest({
      punctuality: 4,
      respect: 4,
      commitment: 5,
      comment: null,
    }));

    expect(result).toEqual({
      success: true,
      updated: true,
      reviewsCount: 2,
      overallAvg: 3.67,
    });
    expect(tx.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({created_at: expect.anything()}),
      {merge: true}
    );
    expect(tx.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reputation_punctuality_avg: 3.5,
        reputation_respect_avg: 3.5,
        reputation_commitment_avg: 4,
        reputation_overall_avg: 3.67,
        reputation_punctuality_sum: 7,
        reputation_respect_sum: 7,
        reputation_commitment_sum: 8,
        reputation_overall_sum_centi: 733,
        reputation_reviews_count: 2,
      })
    );
    expect(mockCollection).not.toHaveBeenCalled();
    expect(tx.get.mock.calls).not.toEqual(
      expect.arrayContaining([[expect.objectContaining({_query: expect.anything()})]])
    );
  });

  it("faz seed legado fora da transacao quando perfil antigo nao tem somas", async () => {
    const {tx} = setupFirestore({
      targetUser: {
        reputation_reviews_count: 2,
        reputation_overall_avg: 2,
      },
      existingReview: {
        punctuality: 1,
        respect: 1,
        commitment: 1,
        overall: 1,
      },
      legacyReviews: [
        {
          id: "game1_reviewer1_target1",
          data: {punctuality: 1, respect: 1, commitment: 1, overall: 1},
        },
        {
          id: "game0_other_target1",
          data: {punctuality: 3, respect: 3, commitment: 3, overall: 3},
        },
        {
          id: "broken",
          data: {punctuality: 0, respect: 0, commitment: 0, overall: 0},
        },
      ],
    });

    const result = await submitPostGameReputation(makeRequest({
      punctuality: 4,
      respect: 4,
      commitment: 5,
      comment: null,
    }));

    expect(result).toMatchObject({
      success: true,
      updated: true,
      reviewsCount: 2,
      overallAvg: 3.67,
    });
    expect(mockCollection).toHaveBeenCalledWith("post_game_reputation");
    expect(tx.get.mock.calls).not.toEqual(
      expect.arrayContaining([[expect.objectContaining({_query: expect.anything()})]])
    );
  });
});
