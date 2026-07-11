jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
}));

jest.mock("../../src/_db", () => ({db: jest.fn()}));
jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn(),
}));
jest.mock("../../src/utils/firebase-lazy", () => ({
  getAuth: jest.fn(),
}));

import {
  cpfRelation,
  mergeStatus,
  opaqueRequestId,
} from "../../src/auth/account-merge";

describe("account merge identity decisions", () => {
  it("libera quando os CPFs conferem", () => {
    expect(cpfRelation({cpfHash: "same"}, {cpfHash: "same"})).toBe("matched");
    expect(mergeStatus("matched")).toBe("ready");
  });

  it("libera origem incompleta quando o destino canônico tem CPF", () => {
    expect(cpfRelation({}, {cpfHash: "target"})).toBe("missing_source");
    expect(mergeStatus("missing_source")).toBe("ready");
  });

  it("exige CPF no destino canônico", () => {
    expect(mergeStatus(cpfRelation({cpfHash: "source"}, {}))).toBe("pending_cpf");
    expect(mergeStatus(cpfRelation({}, {}))).toBe("pending_cpf");
  });

  it("bloqueia CPFs divergentes", () => {
    expect(() => cpfRelation(
      {cpfHash: "source"},
      {cpfHash: "target"},
    )).toThrow("CPFs diferentes");
  });

  it("não expõe UIDs no identificador retornado", () => {
    const id = opaqueRequestId("source-secret-uid", "target-secret-uid");
    expect(id).toMatch(/^[a-f0-9]{64}$/);
    expect(id).not.toContain("source-secret-uid");
    expect(id).not.toContain("target-secret-uid");
    expect(opaqueRequestId("source-secret-uid", "target-secret-uid")).toBe(id);
  });
});

