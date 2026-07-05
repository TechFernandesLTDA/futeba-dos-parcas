import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { initTestEnv, asAnon, asUser } from "./helpers.js";

let testEnv: RulesTestEnvironment;

const UID_FEEDBACK_EMAIL = "uid-feedback-email-001";
const UID_FEEDBACK_PHONE = "uid-feedback-phone-001";

beforeAll(async () => {
  testEnv = await initTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

function feedbackPayload(uid: string, email: string) {
  return {
    user_id: uid,
    user_email: email,
    type: "bug",
    title: "Erro inesperado em /game",
    description: "Falha reportada pela tela global de erro.",
    severity: "high",
    status: "open",
    context: {
      platform: "web",
      source: "error_boundary",
    },
    created_at: new Date(),
    updated_at: new Date(),
  };
}

describe("user_feedback — criação", () => {
  it("usuário com e-mail pode criar feedback próprio usando o e-mail do token", async () => {
    const db = asUser(testEnv, UID_FEEDBACK_EMAIL, { email: "jogador@test.com" });

    await assertSucceeds(
      db.doc("user_feedback/email-user-report").set(
        feedbackPayload(UID_FEEDBACK_EMAIL, "jogador@test.com"),
      ),
    );
  });

  it("usuário sem e-mail no token pode criar feedback próprio com user_email vazio", async () => {
    const db = asUser(testEnv, UID_FEEDBACK_PHONE);

    await assertSucceeds(
      db.doc("user_feedback/phone-user-report").set(
        feedbackPayload(UID_FEEDBACK_PHONE, ""),
      ),
    );
  });

  it("usuário não pode criar feedback com e-mail diferente do token", async () => {
    const db = asUser(testEnv, UID_FEEDBACK_EMAIL, { email: "jogador@test.com" });

    await assertFails(
      db.doc("user_feedback/spoofed-email-report").set(
        feedbackPayload(UID_FEEDBACK_EMAIL, "outro@test.com"),
      ),
    );
  });

  it("usuário deslogado não pode criar feedback", async () => {
    const db = asAnon(testEnv);

    await assertFails(
      db.doc("user_feedback/anon-report").set(
        feedbackPayload(UID_FEEDBACK_PHONE, ""),
      ),
    );
  });
});
