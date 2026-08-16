/**
 * Cobertura dos ramos de falha do getUserFcmTokens (#3941 F2).
 *
 * As duas leituras (registro canônico + doc legado) são paralelizadas com
 * `Promise.all` e cada uma tem um `.catch` próprio que degrada para null.
 * Estes testes exercitam exatamente esses handlers de erro — as linhas que o
 * diff-coverage gate apontou como descobertas.
 */

const mockGetRegisteredPushTokens = jest.fn();
const mockFilterPushTokensByCanonicalOwner = jest.fn();

jest.mock("../../src/notifications/push-token-registry", () => ({
  getRegisteredPushTokens: mockGetRegisteredPushTokens,
  filterPushTokensByCanonicalOwner: mockFilterPushTokensByCanonicalOwner,
  removeRegisteredPushToken: jest.fn(),
}));

const mockUserDocGet = jest.fn();
const mockDoc = jest.fn(() => ({get: mockUserDocGet}));
const mockCollection = jest.fn(() => ({doc: mockDoc}));
const mockDb = jest.fn(() => ({collection: mockCollection}));

jest.mock("../../src/_db", () => ({db: mockDb}));

jest.mock("firebase-admin", () => ({
  messaging: jest.fn(() => ({send: jest.fn()})),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(),
    delete: jest.fn(),
    arrayRemove: jest.fn(),
  },
  FieldPath: {documentId: jest.fn(() => "__name__")},
}));

jest.mock("../../src/constants", () => ({
  FCM_TTL_SECONDS: 3600,
  FIRESTORE_WHERE_IN_LIMIT: 10,
}));

jest.mock("../../src/notifications/preferences", () => ({
  getNotificationSettings: jest.fn(),
  getNotificationSettingsBatch: jest.fn(),
  isMuted: jest.fn(),
  isGroupMuted: jest.fn(),
  isNotificationTypeEnabled: jest.fn(),
}));

jest.mock("firebase-functions", () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
}));

import {__testing} from "../../src/notifications/helpers";

describe("getUserFcmTokens — leituras paralelas (#3941 F2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("degrada para null quando o registro canônico falha e o doc legado também falha", async () => {
    mockGetRegisteredPushTokens.mockRejectedValue(new Error("registry down"));
    mockUserDocGet.mockRejectedValue(new Error("firestore down"));
    mockFilterPushTokensByCanonicalOwner.mockResolvedValue(new Map());

    await expect(__testing.getUserFcmTokens("user-1")).resolves.toEqual([]);

    const logger = jest.requireMock("firebase-functions").logger;
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it("merge tokens canônicos e legados no caminho de sucesso", async () => {
    mockGetRegisteredPushTokens.mockResolvedValue(
      new Map([["user-1", ["canonical-token"]]])
    );
    mockUserDocGet.mockResolvedValue({
      exists: true,
      data: () => ({fcm_token: "legacy-token"}),
    });
    mockFilterPushTokensByCanonicalOwner.mockImplementation(
      async (owners: Map<string, string>) => owners
    );

    await expect(__testing.getUserFcmTokens("user-1")).resolves.toEqual(
      expect.arrayContaining(["canonical-token", "legacy-token"])
    );
  });
});
