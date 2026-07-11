let mockRunTransaction = jest.fn();
let mockDoc = jest.fn();
let mockCheckRateLimit = jest.fn();

jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({
    doc: mockDoc,
    runTransaction: mockRunTransaction,
  })),
}));

jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
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
    error: jest.fn(),
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    increment: jest.fn((value: number) => ({_increment: value})),
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
}));

import {
  decideFollowMutation,
  nonNegativeCounterAfterDelta,
  toggleFollowUser,
  TOGGLE_FOLLOW_RATE_LIMIT,
} from "../src/social/follow";
import {checkRateLimit} from "../src/middleware/rate-limiter";

describe("follow mutation decision", () => {
  test("contador de unfollow nunca fica negativo", () => {
    expect(nonNegativeCounterAfterDelta(undefined, -1)).toBe(0);
    expect(nonNegativeCounterAfterDelta(0, -1)).toBe(0);
    expect(nonNegativeCounterAfterDelta(3, -1)).toBe(2);
  });

  test("follow novo incrementa os dois contadores", () => {
    expect(decideFollowMutation(false, true)).toEqual({
      changed: true,
      followingDelta: 1,
      followersDelta: 1,
    });
  });

  test("follow repetido e idempotente", () => {
    expect(decideFollowMutation(true, true)).toEqual({
      changed: false,
      followingDelta: 0,
      followersDelta: 0,
    });
  });

  test("unfollow existente decrementa os dois contadores", () => {
    expect(decideFollowMutation(true, false)).toEqual({
      changed: true,
      followingDelta: -1,
      followersDelta: -1,
    });
  });

  test("unfollow repetido e idempotente", () => {
    expect(decideFollowMutation(false, false)).toEqual({
      changed: false,
      followingDelta: 0,
      followersDelta: 0,
    });
  });
});

describe("toggleFollowUser rate limit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 29,
      resetAt: new Date(Date.now() + 60000),
    });
  });

  test("bloqueia antes de abrir transacao quando rate limit excede", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 30000),
    });

    await expect(toggleFollowUser({
      auth: {uid: "user1"},
      data: {targetUserId: "target1", follow: true},
    }))
      .rejects.toMatchObject({code: "resource-exhausted"});

    expect(checkRateLimit).toHaveBeenCalledWith(
      "user1",
      TOGGLE_FOLLOW_RATE_LIMIT
    );
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  test("rejeita auto-follow antes de consumir rate limit", async () => {
    await expect(toggleFollowUser({
      auth: {uid: "user1"},
      data: {targetUserId: "user1", follow: true},
    }))
      .rejects.toMatchObject({code: "invalid-argument"});

    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  test("rejeita path injection e coerção implícita de follow", async () => {
    await expect(toggleFollowUser({
      auth: {uid: "user1"},
      data: {targetUserId: "target/nested/doc", follow: true},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(toggleFollowUser({
      auth: {uid: "user1"},
      data: {targetUserId: "target1", follow: "false"},
    })).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  test("bloqueia novo follow em qualquer direção, mas permite unfollow", async () => {
    mockDoc.mockImplementation((path: string) => ({
      path,
      collection: (name: string) => ({
        doc: (id: string) => ({path: `${path}/${name}/${id}`}),
      }),
    }));
    const run = async (follow: boolean) => {
      const tx = {
        get: jest.fn((ref: {path: string}) => {
          if (ref.path === "users/target1/blocked/user1") {
            return Promise.resolve({exists: true, data: () => ({})});
          }
          if (ref.path === "users/user1/following/target1") {
            return Promise.resolve({exists: true, data: () => ({})});
          }
          return Promise.resolve({
            exists: true,
            data: () => ({following_count: 1, followers_count: 1}),
          });
        }),
        set: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      };
      mockRunTransaction.mockImplementationOnce(async (callback: any) => callback(tx));
      const promise = toggleFollowUser({
        auth: {uid: "user1"},
        data: {targetUserId: "target1", follow},
      });
      return {promise, tx};
    };

    const blocked = await run(true);
    await expect(blocked.promise).rejects.toMatchObject({code: "permission-denied"});
    expect(blocked.tx.set).not.toHaveBeenCalled();

    const unfollow = await run(false);
    await expect(unfollow.promise).resolves.toMatchObject({
      success: true,
      following: false,
    });
    expect(unfollow.tx.delete).toHaveBeenCalledTimes(2);
  });
});
