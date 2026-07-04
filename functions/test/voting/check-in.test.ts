let mockDbDocGet = jest.fn();
let mockDbRunTransaction = jest.fn();
let mockDbCollection = jest.fn();
let mockSaveNotificationToFirestore = jest.fn();

jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: new Date(Date.now() + 60000) }),
}));

jest.mock("../../src/middleware/require-profile-complete", () => ({
  requireProfileComplete: jest.fn(),
}));

jest.mock("../../src/_db", () => {
  const docFn = jest.fn((path: string) => ({ get: mockDbDocGet }));
  const dbFn = jest.fn(() => ({
    collection: mockDbCollection,
    doc: docFn,
    runTransaction: mockDbRunTransaction,
    batch: jest.fn(() => ({ update: jest.fn(), set: jest.fn(), commit: jest.fn().mockResolvedValue([]) })),
  }));
  return { db: dbFn };
});

jest.mock("../../src/notifications/helpers", () => ({
  NotificationType: { CHECKIN: "checkin" },
  saveNotificationToFirestore: mockSaveNotificationToFirestore,
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
  onCall: jest.fn((_c: any, h: any) => h || _c),
  HttpsError: MockHttpsError,
}));

jest.mock("firebase-functions/v2", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  setGlobalOptions: jest.fn(),
  https: {
    onCall: jest.fn((_c: any, h: any) => h || _c),
    HttpsError: MockHttpsError,
  },
}));

const ciFieldValue = {
  serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  delete: jest.fn(() => ({ _type: "FieldDelete" })),
  increment: jest.fn((n: number) => ({ _type: "Increment", value: n })),
};
const ciFirestore = jest.fn(() => ({
  collection: jest.fn(),
  doc: jest.fn(),
  runTransaction: jest.fn(),
})) as any;
ciFirestore.FieldValue = ciFieldValue;

jest.mock("firebase-admin", () => ({
  apps: [{ name: "test" }],
  initializeApp: jest.fn(),
  firestore: ciFirestore,
}));

import {
  checkInToGame,
  classifyCheckInTravelSignal,
} from "../../src/voting/check-in";
import { checkRateLimit } from "../../src/middleware/rate-limiter";
import { logger } from "firebase-functions/v2";

describe("checkInToGame", () => {
  const makeRequest = (overrides: any = {}) => ({
    auth: { uid: "user1", token: {} },
    data: { gameId: "game1", lat: -23.5505, lng: -46.6333, accuracy: 10 },
    rawRequest: { ip: "127.0.0.1" },
    ...overrides,
  });

  const makeGameSnap = (overrides: any = {}) => ({
    exists: true,
    data: () => ({
      status: "CONFIRMED",
      location_lat: -23.5505,
      location_lng: -46.6333,
      checkin_radius_meters: 200,
      dateTime: { toDate: () => new Date(Date.now() - 60000) },
      ...overrides,
    }),
  });

  const makeConfSnap = (overrides: any = {}) => ({
    exists: true,
    data: () => ({
      status: "CONFIRMED",
      user_id: "user1",
      checked_in: false,
      ...overrides,
    }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDbCollection.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    });
    mockSaveNotificationToFirestore.mockResolvedValue(undefined);
  });

  it("rejeita sem autenticacao", async () => {
    await expect(
      checkInToGame(makeRequest({ auth: null })),
    ).rejects.toThrow();
  });

  it("rejeita gameId/lat/lng invalidos", async () => {
    await expect(
      checkInToGame(makeRequest({ data: { gameId: 123 } })),
    ).rejects.toThrow();
  });

  it("rejeita precisao GPS insuficiente", async () => {
    await expect(
      checkInToGame(makeRequest({ data: { gameId: "g1", lat: -23, lng: -46, accuracy: 200 } })),
    ).rejects.toThrow();
  });

  it("rejeita jogo nao encontrado", async () => {
    mockDbDocGet.mockResolvedValueOnce({ exists: false, data: () => null });

    await expect(checkInToGame(makeRequest())).rejects.toThrow();
  });

  it("rejeita jogo em status invalido", async () => {
    mockDbDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "SCHEDULED" }),
    });

    await expect(checkInToGame(makeRequest())).rejects.toThrow();
  });

  it("rejeita quando ha rate limiting", async () => {
    (checkRateLimit as jest.Mock).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60000),
    });

    await expect(checkInToGame(makeRequest())).rejects.toThrow();
  });

  it("rejeita fora da janela de check-in (mais de 30 min antes)", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    mockDbDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: "CONFIRMED",
        location_lat: -23.55,
        location_lng: -46.63,
        dateTime: { toDate: () => futureDate },
      }),
    });

    await expect(checkInToGame(makeRequest())).rejects.toThrow();
  });

  it("rejeita fora do raio de check-in", async () => {
    mockDbDocGet.mockResolvedValueOnce(makeGameSnap({ location_lat: -23.0, location_lng: -46.0 }));

    await expect(checkInToGame(makeRequest())).rejects.toThrow();
  });

  it("rejeita quando usuario nao esta confirmado", async () => {
    mockDbDocGet.mockResolvedValueOnce(makeGameSnap());
    mockDbRunTransaction.mockImplementationOnce(async (cb: any) => {
      const tx = { get: jest.fn().mockResolvedValue({ exists: false }), set: jest.fn() };
      await cb(tx);
    });

    await expect(checkInToGame(makeRequest())).rejects.toThrow();
  });

  it("rejeita quando confirmacao nao esta em status CONFIRMED", async () => {
    mockDbDocGet.mockResolvedValueOnce(makeGameSnap());
    mockDbRunTransaction.mockImplementationOnce(async (cb: any) => {
      const tx = { get: jest.fn().mockResolvedValue(makeConfSnap({ status: "WAITLISTED" })), set: jest.fn() };
      return cb(tx);
    });

    await expect(checkInToGame(makeRequest())).rejects.toThrow("Confirmacao precisa estar em status CONFIRMED");
  });

  it("retorna sucesso quando ja fez check-in", async () => {
    mockDbDocGet.mockResolvedValueOnce(makeGameSnap());
    mockDbRunTransaction.mockImplementationOnce(async (cb: any) => {
      const tx = { get: jest.fn().mockResolvedValue(makeConfSnap({ checked_in: true })), set: jest.fn() };
      return cb(tx);
    });

    const result = await checkInToGame(makeRequest());
    expect(result.success).toBe(true);
    expect(result.distance_m).toBeDefined();
  });

  it("check-in bem sucedido retorna distance", async () => {
    mockDbDocGet.mockResolvedValueOnce(makeGameSnap());
    const setMock = jest.fn();
    mockDbRunTransaction.mockImplementationOnce(async (cb: any) => {
      const tx = { get: jest.fn().mockResolvedValue(makeConfSnap()), set: setMock };
      return cb(tx);
    });

    const result = await checkInToGame(makeRequest());
    expect(result.success).toBe(true);
    expect(result.distance_m).toBeDefined();
    expect(setMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        checked_in: true,
        check_in_method: "gps",
        check_in_radius_m: 200,
        presence_confidence: 90,
        presence_status: "VALIDATED",
        presence_reasons: [],
        check_in_evidence_version: 1,
      }),
      { merge: true },
    );
  });

  it("aceita payload legado do web com latitude/longitude", async () => {
    mockDbDocGet.mockResolvedValueOnce(makeGameSnap());
    const setMock = jest.fn();
    mockDbRunTransaction.mockImplementationOnce(async (cb: any) => {
      const tx = { get: jest.fn().mockResolvedValue(makeConfSnap()), set: setMock };
      return cb(tx);
    });

    const result = await checkInToGame(makeRequest({
      data: {
        gameId: "game1",
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 10,
      },
    }));

    expect(result.success).toBe(true);
    expect(result.distance_m).toBeDefined();
    expect(result.distanceMeters).toBe(result.distance_m);
    expect(setMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        checked_in: true,
        check_in_lat_approx: -23.55,
        check_in_lng_approx: -46.633,
      }),
      { merge: true },
    );
  });

  it("aceita qr_token legado quando GPS tambem e enviado", async () => {
    mockDbDocGet.mockResolvedValueOnce(makeGameSnap({
      checkin_qr_token: "qr-test",
      checkin_qr_token_expires_at: {
        toDate: () => new Date(Date.now() + 60 * 60 * 1000),
      },
    }));
    mockDbRunTransaction.mockImplementationOnce(async (cb: any) => {
      const tx = { get: jest.fn().mockResolvedValue(makeConfSnap()), set: jest.fn() };
      return cb(tx);
    });

    const result = await checkInToGame(makeRequest({
      data: {
        gameId: "game1",
        lat: -23.5505,
        lng: -46.6333,
        qr_token: "qr-test",
      },
    }));

    expect(result.success).toBe(true);
    expect(result.method).toBe("qr");
  });

  it("notifica outros jogadores confirmados apos check-in bem sucedido", async () => {
    const confirmationsQuery = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [
          { data: () => ({ user_id: "user1" }) },
          { data: () => ({ user_id: "user2" }) },
          { data: () => ({ user_id: "" }) },
          { data: () => ({ user_id: "user3" }) },
        ],
      }),
    };
    mockDbCollection.mockReturnValue(confirmationsQuery);
    mockDbDocGet.mockResolvedValueOnce(makeGameSnap({ location_name: "Arena Teste" }));
    mockDbRunTransaction.mockImplementationOnce(async (cb: any) => {
      const tx = { get: jest.fn().mockResolvedValue(makeConfSnap({ user_name: "Renan" })), set: jest.fn() };
      return cb(tx);
    });

    const result = await checkInToGame(makeRequest());

    expect(result.success).toBe(true);
    expect(confirmationsQuery.where).toHaveBeenCalledWith("game_id", "==", "game1");
    expect(confirmationsQuery.where).toHaveBeenCalledWith("status", "==", "CONFIRMED");
    expect(confirmationsQuery.limit).toHaveBeenCalledWith(50);
    expect(mockSaveNotificationToFirestore).toHaveBeenCalledTimes(2);
    expect(mockSaveNotificationToFirestore).toHaveBeenCalledWith(
      "user2",
      expect.objectContaining({
        userId: "user2",
        title: "Renan chegou no jogo",
        body: "Check-in confirmado em Arena Teste.",
        type: "checkin",
        gameId: "game1",
        senderId: "user1",
        senderName: "Renan",
        action: "/game/game1",
      }),
      "checkin_game1_user1_user2",
    );
    expect(mockSaveNotificationToFirestore).toHaveBeenCalledWith(
      "user3",
      expect.objectContaining({ userId: "user3" }),
      "checkin_game1_user1_user3",
    );
  });

  it("nao bloqueia check-in quando notificacao social falha", async () => {
    const confirmationsQuery = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockRejectedValue(new Error("Firestore unavailable")),
    };
    mockDbCollection.mockReturnValue(confirmationsQuery);
    mockDbDocGet.mockResolvedValueOnce(makeGameSnap({ location_name: undefined }));
    mockDbRunTransaction.mockImplementationOnce(async (cb: any) => {
      const tx = { get: jest.fn().mockResolvedValue(makeConfSnap({ user_name: undefined })), set: jest.fn() };
      return cb(tx);
    });

    const result = await checkInToGame(makeRequest());

    expect(result.success).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      "check-in social notification failed",
      expect.objectContaining({
        gameId: "game1",
        checkedInUserId: "user1",
      }),
    );
  });

  it("rejeita coordenadas proximas de null island (0,0)", async () => {
    await expect(
      checkInToGame(makeRequest({ data: { gameId: "g1", lat: 0.001, lng: 0.001 } })),
    ).rejects.toThrow();
  });
});

describe("classifyCheckInTravelSignal", () => {
  it("sinaliza viagem impossível entre check-ins distantes com intervalo curto", () => {
    const result = classifyCheckInTravelSignal({
      gameStatus: "CONFIRMED",
      gameDateTimeMs: new Date("2026-07-03T21:00:00.000Z").getTime(),
      checkedInAtMs: new Date("2026-07-03T21:10:00.000Z").getTime(),
      lat: -22.9068,
      lng: -43.1729,
      recentCheckIns: [
        {
          confId: "old_conf",
          gameId: "old_game",
          checkedInAtMs: new Date("2026-07-03T20:55:00.000Z").getTime(),
          gameDateTimeMs: new Date("2026-07-03T20:30:00.000Z").getTime(),
          lat: -23.5505,
          lng: -46.6333,
        },
      ],
    });

    expect(result.suspiciousImpossibleTravel).toBe(true);
    expect(result.conflictConfirmationIds).toEqual(["old_conf"]);
    expect(result.distanceBucket).toBe("50KM_PLUS");
    expect(result.timeBucket).toBe("15_TO_59_MIN");
  });

  it("não sinaliza viagem impossível quando a distância é baixa ou o tempo é plausível", () => {
    const result = classifyCheckInTravelSignal({
      gameStatus: "CONFIRMED",
      gameDateTimeMs: new Date("2026-07-03T21:00:00.000Z").getTime(),
      checkedInAtMs: new Date("2026-07-03T23:30:00.000Z").getTime(),
      lat: -23.561,
      lng: -46.655,
      recentCheckIns: [
        {
          confId: "old_conf",
          gameId: "old_game",
          checkedInAtMs: new Date("2026-07-03T21:00:00.000Z").getTime(),
          gameDateTimeMs: new Date("2026-07-03T20:30:00.000Z").getTime(),
          lat: -23.5505,
          lng: -46.6333,
        },
      ],
    });

    expect(result.suspiciousImpossibleTravel).toBe(false);
    expect(result.conflictConfirmationIds).toEqual([]);
  });

  it("marca check-in tardio em jogo ainda não live", () => {
    const result = classifyCheckInTravelSignal({
      gameStatus: "CONFIRMED",
      gameDateTimeMs: new Date("2026-07-03T18:00:00.000Z").getTime(),
      checkedInAtMs: new Date("2026-07-03T22:10:00.000Z").getTime(),
      lat: -23.5505,
      lng: -46.6333,
      recentCheckIns: [],
    });

    expect(result.suspiciousLateCheckIn).toBe(true);
    expect(result.lateCheckInMinutes).toBe(250);
  });
});
