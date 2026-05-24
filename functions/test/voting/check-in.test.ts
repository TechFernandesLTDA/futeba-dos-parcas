let mockDbDocGet = jest.fn();
let mockDbRunTransaction = jest.fn();

jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: new Date(Date.now() + 60000) }),
}));

jest.mock("../../src/middleware/require-profile-complete", () => ({
  requireProfileComplete: jest.fn(),
}));

jest.mock("../../src/_db", () => {
  const docFn = jest.fn((path: string) => ({ get: mockDbDocGet }));
  const dbFn = jest.fn(() => ({
    collection: jest.fn(() => ({ doc: docFn })),
    doc: docFn,
    runTransaction: mockDbRunTransaction,
    batch: jest.fn(() => ({ update: jest.fn(), set: jest.fn(), commit: jest.fn().mockResolvedValue([]) })),
  }));
  return { db: dbFn };
});

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

import { checkInToGame } from "../../src/voting/check-in";
import { checkRateLimit } from "../../src/middleware/rate-limiter";

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
    mockDbRunTransaction.mockImplementationOnce(async (cb: any) => {
      const tx = { get: jest.fn().mockResolvedValue(makeConfSnap()), set: jest.fn() };
      return cb(tx);
    });

    const result = await checkInToGame(makeRequest());
    expect(result.success).toBe(true);
    expect(result.distance_m).toBeDefined();
  });

  it("rejeita coordenadas proximas de null island (0,0)", async () => {
    await expect(
      checkInToGame(makeRequest({ data: { gameId: "g1", lat: 0.001, lng: 0.001 } })),
    ).rejects.toThrow();
  });
});
