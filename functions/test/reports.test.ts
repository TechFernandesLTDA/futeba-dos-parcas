const mockDocGet = jest.fn();
const mockDoc = jest.fn((_path: string) => ({get: mockDocGet}));
const mockReportSet = jest.fn();
const mockCheckRateLimit = jest.fn();

jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({
    doc: mockDoc,
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({id: "report-1", set: mockReportSet})),
    })),
  })),
}));

jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

class MockHttpsError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "HttpsError";
    this.code = code;
  }
}

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: MockHttpsError,
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
}));

import {submitContentReport} from "../src/social/reports";

type Handler = (request: unknown) => Promise<{reportId: string}>;
const submit = submitContentReport as unknown as Handler;

function req(data: Record<string, unknown>) {
  return {auth: {uid: "reporter"}, data};
}

describe("submitContentReport (#4332)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: new Date(Date.now() + 60000),
    });
    mockDocGet.mockResolvedValue({exists: true, data: () => ({game_id: "g1"})});
  });

  test.each([
    ["game_photo", "game_photos/p1"],
    ["game_video", "game_videos/p1"],
  ])("%s aponta para colecao top-level %s", async (targetType, path) => {
    const result = await submit(req({
      targetType, gameId: "g1", targetId: "p1", reason: "spam",
    }));
    expect(result).toEqual({reportId: "report-1"});
    expect(mockDoc).toHaveBeenCalledWith(path);
    expect(mockReportSet).toHaveBeenCalledWith(expect.objectContaining({
      target_type: targetType,
      target_path: path,
      game_id: "g1",
      target_id: "p1",
      reporter_id: "reporter",
      status: "OPEN",
    }));
  });

  test("rejeita midia que pertence a outro jogo", async () => {
    mockDocGet.mockResolvedValue({
      exists: true, data: () => ({game_id: "outro-jogo"}),
    });
    await expect(submit(req({
      targetType: "game_photo", gameId: "g1", targetId: "p1", reason: "spam",
    }))).rejects.toMatchObject({code: "not-found"});
    expect(mockReportSet).not.toHaveBeenCalled();
  });

  test("midia inexistente retorna not-found", async () => {
    mockDocGet.mockResolvedValue({exists: false, data: () => undefined});
    await expect(submit(req({
      targetType: "game_video", gameId: "g1", targetId: "p1", reason: "spam",
    }))).rejects.toMatchObject({code: "not-found"});
  });

  test.each([
    ["game_chat_message", "games/g1/chat/p1"],
    ["game_comment", "games/g1/comments/p1"],
  ])("%s continua como subcolecao do jogo", async (targetType, path) => {
    await submit(req({
      targetType, gameId: "g1", targetId: "p1", reason: "spam",
    }));
    expect(mockDoc).toHaveBeenCalledWith(path);
    expect(mockReportSet).toHaveBeenCalledWith(
      expect.objectContaining({target_path: path})
    );
  });

  test("group_wall_post continua inalterado", async () => {
    await submit(req({
      targetType: "group_wall_post", groupId: "grp", postId: "w1", reason: "spam",
    }));
    expect(mockDoc).toHaveBeenCalledWith("groups/grp/wall_posts/w1");
  });
});
