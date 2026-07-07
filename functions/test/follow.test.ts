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
  toggleFollowUser,
  TOGGLE_FOLLOW_RATE_LIMIT,
} from "../src/social/follow";
import {checkRateLimit} from "../src/middleware/rate-limiter";

describe("follow mutation decision", () => {
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
});
