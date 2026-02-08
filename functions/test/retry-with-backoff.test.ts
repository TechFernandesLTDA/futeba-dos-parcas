/**
 * Testes para o modulo retry-with-backoff.
 *
 * Verifica:
 * - Sucesso na primeira tentativa
 * - Retry com erros transientes
 * - Fail-fast com erros permanentes
 * - Calculo de backoff exponencial
 * - Classificacao de erros (transiente vs permanente)
 * - Configuracao customizada
 */

import {
  retryWithBackoff,
  defaultIsTransientError,
  RetryConfig,
} from "../src/utils/retry-with-backoff";

// Mock do firebase-admin para evitar inicializacao real
jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      add: jest.fn().mockResolvedValue({ id: "mock-doc-id" }),
    })),
  })),
}));

describe("retry-with-backoff", () => {
  // ==========================================
  // defaultIsTransientError
  // ==========================================

  describe("defaultIsTransientError", () => {
    test("identifica ABORTED (code 10) como transiente", () => {
      expect(defaultIsTransientError({ code: 10 })).toBe(true);
    });

    test("identifica UNAVAILABLE (code 14) como transiente", () => {
      expect(defaultIsTransientError({ code: 14 })).toBe(true);
    });

    test("identifica DEADLINE_EXCEEDED (code 4) como transiente", () => {
      expect(defaultIsTransientError({ code: 4 })).toBe(true);
    });

    test("identifica RESOURCE_EXHAUSTED (code 8) como transiente", () => {
      expect(defaultIsTransientError({ code: 8 })).toBe(true);
    });

    test("identifica INVALID_ARGUMENT (code 3) como permanente", () => {
      expect(defaultIsTransientError({ code: 3 })).toBe(false);
    });

    test("identifica PERMISSION_DENIED (code 7) como permanente", () => {
      expect(defaultIsTransientError({ code: 7 })).toBe(false);
    });

    test("identifica NOT_FOUND (code 5) como permanente", () => {
      expect(defaultIsTransientError({ code: 5 })).toBe(false);
    });

    test("identifica ECONNRESET por mensagem como transiente", () => {
      expect(defaultIsTransientError({ message: "ECONNRESET" })).toBe(true);
    });

    test("identifica ETIMEDOUT por mensagem como transiente", () => {
      expect(defaultIsTransientError({ message: "ETIMEDOUT" })).toBe(true);
    });

    test("identifica socket hang up por mensagem como transiente", () => {
      expect(defaultIsTransientError({ message: "socket hang up" })).toBe(true);
    });

    test("identifica contention por mensagem como transiente", () => {
      expect(defaultIsTransientError({ message: "Transaction contention" })).toBe(true);
    });

    test("identifica mensagem generica como permanente", () => {
      expect(defaultIsTransientError({ message: "User not found" })).toBe(false);
    });

    test("identifica erro sem code nem message como permanente", () => {
      expect(defaultIsTransientError({})).toBe(false);
    });

    test("case-insensitive para mensagens", () => {
      expect(defaultIsTransientError({ message: "econnreset error" })).toBe(true);
    });
  });

  // ==========================================
  // retryWithBackoff
  // ==========================================

  describe("retryWithBackoff", () => {
    // Silenciar logs durante testes
    beforeEach(() => {
      jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("retorna sucesso na primeira tentativa", async () => {
      const operation = jest.fn().mockResolvedValue("resultado");

      const result = await retryWithBackoff(operation, {
        operationName: "testOp",
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe("resultado");
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test("retenta em erro transiente e eventualmente sucede", async () => {
      const transientError = { code: 14, message: "UNAVAILABLE" };
      const operation = jest.fn()
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce("ok");

      const result = await retryWithBackoff(operation, {
        maxRetries: 3,
        initialBackoffMs: 10, // Backoff curto para testes
        jitter: false,
        operationName: "testRetry",
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe("ok");
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test("falha imediatamente em erro permanente", async () => {
      const permanentError = { code: 3, message: "INVALID_ARGUMENT: campo invalido" };
      const operation = jest.fn().mockRejectedValue(permanentError);

      const result = await retryWithBackoff(operation, {
        maxRetries: 3,
        operationName: "testPermanent",
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1); // Apenas 1 tentativa
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test("falha apos max retries com erros transientes", async () => {
      const transientError = { code: 14, message: "UNAVAILABLE" };
      const operation = jest.fn().mockRejectedValue(transientError);

      const result = await retryWithBackoff(operation, {
        maxRetries: 3,
        initialBackoffMs: 10,
        jitter: false,
        operationName: "testMaxRetries",
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test("usa config padrao quando nao fornecida", async () => {
      const operation = jest.fn().mockResolvedValue("ok");

      const result = await retryWithBackoff(operation);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
    });

    test("respeita maxRetries = 1 (sem retry)", async () => {
      const transientError = { code: 14, message: "UNAVAILABLE" };
      const operation = jest.fn().mockRejectedValue(transientError);

      const result = await retryWithBackoff(operation, {
        maxRetries: 1,
        operationName: "noRetry",
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test("inclui totalDurationMs no resultado", async () => {
      const operation = jest.fn().mockResolvedValue("ok");

      const result = await retryWithBackoff(operation, {
        operationName: "testDuration",
      });

      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    test("sentToDeadLetterQueue e false quando DLQ desabilitada", async () => {
      const permanentError = { code: 3, message: "INVALID_ARGUMENT" };
      const operation = jest.fn().mockRejectedValue(permanentError);

      const result = await retryWithBackoff(operation, {
        enableDeadLetterQueue: false,
        operationName: "testNoDLQ",
      });

      expect(result.sentToDeadLetterQueue).toBe(false);
    });

    test("aceita isTransientError customizado", async () => {
      // Tratar todos os erros como transientes
      const customChecker = () => true;
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error("custom error"))
        .mockResolvedValueOnce("ok");

      const result = await retryWithBackoff(operation, {
        maxRetries: 3,
        initialBackoffMs: 10,
        jitter: false,
        isTransientError: customChecker,
        operationName: "testCustomChecker",
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    test("preserva mensagem de erro no resultado", async () => {
      const error = new Error("Falha especifica");
      const operation = jest.fn().mockRejectedValue(error);

      const result = await retryWithBackoff(operation, {
        maxRetries: 1,
        operationName: "testErrorMsg",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Falha especifica");
    });
  });
});
