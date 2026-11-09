/**
 * Contas de revisão da Play: leitura da lista server-only e aplicação das
 * claims usada pelo script apply-review-account-claims.
 * UIDs fictícios; o UID real do revisor nunca entra no repo (público).
 */
const mockSetCustomUserClaims = jest.fn().mockResolvedValue(undefined);
const mockRevokeRefreshTokens = jest.fn().mockResolvedValue(undefined);
const mockGetUser = jest.fn();
const mockConfigDocGet = jest.fn();
const mockConfigDoc = jest.fn().mockReturnValue({get: mockConfigDocGet});

jest.mock("firebase-admin", () => ({
  apps: [{name: "test"}],
  initializeApp: jest.fn(),
  auth: jest.fn(() => ({
    getUser: mockGetUser,
    setCustomUserClaims: mockSetCustomUserClaims,
    revokeRefreshTokens: mockRevokeRefreshTokens,
  })),
  firestore: jest.fn(() => ({
    doc: mockConfigDoc,
  })),
}));

import {
  REVIEW_ACCOUNTS_DOC,
  applyReviewAccountClaims,
  buildReviewAccountClaims,
  isReviewAccount,
  loadReviewAccountUids,
  parseReviewAccountUids,
} from "../../src/auth/review-accounts";

const REVIEW_UID = "review-uid-test";
const OTHER_UID = "player-uid-test";

describe("review-accounts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigDocGet.mockResolvedValue({exists: false, data: () => undefined});
  });

  test("doc de configuração fica em system_config (deny-all nas rules)", () => {
    expect(REVIEW_ACCOUNTS_DOC).toBe("system_config/play_review_accounts");
  });

  describe("parseReviewAccountUids", () => {
    test("aceita só {uids: string[]} e ignora entradas inválidas", () => {
      expect(parseReviewAccountUids({
        uids: [REVIEW_UID, "", "  ", 42, null, {uid: "x"}, ` ${OTHER_UID} `],
      })).toEqual(new Set([REVIEW_UID, OTHER_UID]));
    });

    test.each([
      undefined,
      null,
      "texto",
      {},
      {uids: REVIEW_UID},
      {uids: {0: REVIEW_UID}},
    ])("formato inválido (%p) vira lista vazia", (data) => {
      expect(parseReviewAccountUids(data).size).toBe(0);
    });
  });

  test("documento ausente = ninguém é conta de revisão", async () => {
    expect(await isReviewAccount(REVIEW_UID)).toBe(false);
    expect(mockConfigDoc).toHaveBeenCalledWith(REVIEW_ACCOUNTS_DOC);
  });

  test("UID listado é conta de revisão; não listado não é", async () => {
    mockConfigDocGet.mockResolvedValue({
      exists: true,
      data: () => ({uids: [REVIEW_UID]}),
    });

    expect(await isReviewAccount(REVIEW_UID)).toBe(true);
    expect(await isReviewAccount(OTHER_UID)).toBe(false);
  });

  test("erro de leitura da lista sobe (não vira lista vazia)", async () => {
    const readError = new Error("unavailable");
    mockConfigDocGet.mockRejectedValue(readError);

    await expect(loadReviewAccountUids()).rejects.toBe(readError);
  });

  test("buildReviewAccountClaims preserva role e demais claims", () => {
    expect(buildReviewAccountClaims({
      role: "PLAYER",
      profileComplete: false,
      custom: 1,
    })).toEqual({
      role: "PLAYER",
      custom: 1,
      verified: true,
      profileComplete: true,
    });
  });

  describe("applyReviewAccountClaims", () => {
    const listed = new Set([REVIEW_UID]);

    test("(a) UID listado recebe verified e profileComplete, role preservado", async () => {
      mockGetUser.mockResolvedValue({customClaims: {role: "PLAYER"}});

      await expect(
        applyReviewAccountClaims(REVIEW_UID, listed, true)
      ).resolves.toBe("applied");

      expect(mockSetCustomUserClaims).toHaveBeenCalledWith(REVIEW_UID, {
        role: "PLAYER",
        verified: true,
        profileComplete: true,
      });
      expect(mockRevokeRefreshTokens).not.toHaveBeenCalled();
    });

    test("dry-run não grava nada", async () => {
      mockGetUser.mockResolvedValue({customClaims: {role: "PLAYER"}});

      await expect(
        applyReviewAccountClaims(REVIEW_UID, listed, false)
      ).resolves.toBe("would-apply");
      expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    });

    test("idempotente quando as claims já estão certas", async () => {
      mockGetUser.mockResolvedValue({
        customClaims: {role: "PLAYER", verified: true, profileComplete: true},
      });

      await expect(
        applyReviewAccountClaims(REVIEW_UID, listed, true)
      ).resolves.toBe("already-current");
      expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    });

    test("(c) UID não listado não é tocado", async () => {
      await expect(
        applyReviewAccountClaims(OTHER_UID, listed, true)
      ).resolves.toBe("not-listed");
      expect(mockGetUser).not.toHaveBeenCalled();
      expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    });

    test("usuário inexistente no Auth é reportado, sem gravar", async () => {
      mockGetUser.mockRejectedValue(Object.assign(new Error("not found"), {
        code: "auth/user-not-found",
      }));

      await expect(
        applyReviewAccountClaims(REVIEW_UID, listed, true)
      ).resolves.toBe("user-not-found");
      expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    });

    test("falha transitória do Auth sobe", async () => {
      const authError = Object.assign(new Error("boom"), {
        code: "auth/internal-error",
      });
      mockGetUser.mockRejectedValue(authError);

      await expect(
        applyReviewAccountClaims(REVIEW_UID, listed, true)
      ).rejects.toBe(authError);
    });
  });
});
