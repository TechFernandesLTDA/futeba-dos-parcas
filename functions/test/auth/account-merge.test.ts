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
  assertCanonicalPhoneUnchanged,
  assertMergeProofUsable,
  assertMergeRequestRefreshable,
  assertRecentTargetPhoneProof,
  buildVerifiedClaims,
  canonicalMembershipStatus,
  cpfRelation,
  knownPhoneIdentityHashes,
  mergeConfirmationRecords,
  mergeStatus,
  missingCanonicalProfileFields,
  opaqueRequestId,
  replaceIdentityInList,
  resolveLegacyIdentityHash,
  staleIdentityHashes,
  strongestGroupRole,
} from "../../src/auth/account-merge";
import {Timestamp} from "firebase-admin/firestore";
import {hashPhoneIdentity} from "../../src/validation/phone-identity";

describe("account merge identity decisions", () => {
  it("libera quando os CPFs conferem", () => {
    expect(cpfRelation({cpfHash: "same"}, {cpfHash: "same"})).toBe("matched");
    expect(mergeStatus("matched")).toBe("ready");
  });

  it("libera origem incompleta quando o destino canônico tem CPF", () => {
    expect(cpfRelation({}, {cpfHash: "target"})).toBe("missing_source");
    expect(mergeStatus("missing_source")).toBe("ready");
  });

  it("transfere CPF verificado da origem para o destino canônico", () => {
    expect(mergeStatus(cpfRelation({cpfHash: "source"}, {}))).toBe("ready");
    expect(mergeStatus(cpfRelation({}, {}))).toBe("pending_cpf");
  });

  it("recupera identidade legada pelo índice quando users_private está incompleto", () => {
    expect(resolveLegacyIdentityHash(undefined, ["legacy-hash"], "CPF"))
      .toBe("legacy-hash");
    expect(resolveLegacyIdentityHash("private-hash", [], "CPF"))
      .toBe("private-hash");
  });

  it("bloqueia múltiplos índices ou divergência com users_private", () => {
    expect(() => resolveLegacyIdentityHash(
      undefined,
      ["hash-a", "hash-b"],
      "CPF",
    )).toThrow("mais de um índice");
    expect(() => resolveLegacyIdentityHash(
      "private-hash",
      ["index-hash"],
      "telefone",
    )).toThrow("inconsistente");
  });

  it("não permite que nova solicitação atropele lease ativo", () => {
    expect(() => assertMergeRequestRefreshable({
      status: "processing",
      processingLeaseExpiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    })).toThrow("já está sendo processada");
    expect(() => assertMergeRequestRefreshable({
      status: "processing",
      processingLeaseExpiresAt: Timestamp.fromMillis(Date.now() - 1),
    })).not.toThrow();
  });

  it("consolida confirmações duplicadas com a versão mais recente", () => {
    const older = Timestamp.fromMillis(1_000);
    const newer = Timestamp.fromMillis(2_000);
    expect(mergeConfirmationRecords([
      {id: "legacy-b", data: {status: "CONFIRMED", updated_at: newer}},
      {id: "legacy-a", data: {status: "PENDING", updated_at: older, position: "GK"}},
    ])).toMatchObject({
      status: "CONFIRMED",
      position: "GK",
    });
  });

  it("preenche somente campos ainda ausentes no perfil canônico", () => {
    expect(missingCanonicalProfileFields({
      display_name: "Nome antigo",
      photo_url: "source.jpg",
      bio: "Bio da origem",
    }, {
      display_name: "Nome editado agora",
      photo_url: "target.jpg",
    })).toEqual({bio: "Bio da origem"});
  });

  it("preserva o maior privilégio nos mirrors do grupo", () => {
    expect(strongestGroupRole("MEMBER", "OWNER", "ADMIN")).toBe("OWNER");
    expect(strongestGroupRole("MEMBER", "ADMIN")).toBe("ADMIN");
    expect(strongestGroupRole(undefined, "MEMBER")).toBe("MEMBER");
  });

  it("migra membership ativa sem reativar destino explicitamente inativo", () => {
    expect(canonicalMembershipStatus(
      true,
      "ACTIVE",
      false,
      undefined,
      false,
    )).toBe("ACTIVE");
    expect(canonicalMembershipStatus(
      true,
      "ACTIVE",
      true,
      "BANNED",
      false,
    )).toBe("BANNED");
    expect(canonicalMembershipStatus(
      false,
      undefined,
      false,
      undefined,
      true,
    )).toBe("ACTIVE");
    expect(() => canonicalMembershipStatus(
      true,
      "ACTIVE",
      true,
      "BANNED",
      true,
    )).toThrow("conta canônica está inativa");
  });

  it("deduplica delegações ao substituir alias pela identidade canônica", () => {
    expect(replaceIdentityInList(
      ["source", "other", "target", "source"],
      "source",
      "target",
    )).toEqual(["target", "other"]);
    expect(replaceIdentityInList(undefined, "source", "target")).toEqual([]);
  });

  it("exige prova Phone Auth recente no destino", () => {
    const now = 10_000;
    expect(() => assertRecentTargetPhoneProof({
      auth_time: now - 30,
      firebase: {sign_in_provider: "phone"},
    }, now)).not.toThrow();
    expect(() => assertRecentTargetPhoneProof({
      auth_time: now - 30,
      firebase: {sign_in_provider: "google.com"},
    }, now)).toThrow("Confirme novamente o telefone");
    expect(() => assertRecentTargetPhoneProof({
      auth_time: now - (16 * 60),
      firebase: {sign_in_provider: "phone"},
    }, now)).toThrow("Confirme novamente o telefone");
  });

  it("permite recovery de processing mesmo após a prova expirar", () => {
    const expired = Timestamp.fromMillis(1_000);
    expect(() => assertMergeProofUsable(expired, "processing", 2_000))
      .not.toThrow();
    expect(() => assertMergeProofUsable(expired, "ready", 2_000))
      .toThrow("expirou");
  });

  it("preserva claims frescas ao marcar destino verificado", () => {
    expect(buildVerifiedClaims({role: "ADMIN", feature: true}, true))
      .toEqual({role: "ADMIN", feature: true, verified: true, profileComplete: true});
  });

  it("aborta se telefone mudar durante o merge", () => {
    const salt = "0123456789abcdef";
    const expected = hashPhoneIdentity("+5511999999999", salt);
    expect(() => assertCanonicalPhoneUnchanged(
      "+5511999999999",
      expected,
      salt,
    )).not.toThrow();
    expect(() => assertCanonicalPhoneUnchanged(
      "+5511888888888",
      expected,
      salt,
    )).toThrow("mudou durante a união");
  });

  it("deduplica hashes antigos de origem e destino", () => {
    expect(knownPhoneIdentityHashes(
      "old-private",
      ["canonical-index", "old-private"],
    )).toEqual(["old-private", "canonical-index"]);
    expect(staleIdentityHashes(
      "canonical",
      "old-source",
      "old-target",
      "old-source",
      "canonical",
    )).toEqual(["old-source", "old-target"]);
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
