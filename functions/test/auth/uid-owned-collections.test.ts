/**
 * #4112 / #4113 — lista canônica de coleções pertencentes a um uid,
 * compartilhada por account-merge.ts e account-cleanup.ts.
 */
import {
  CASHBOX,
  MONTHLY_PAYERS,
  UID_OWNED_COLLECTIONS,
  sumNumericCounters,
} from "../../src/auth/uid-owned-collections";

describe("UID_OWNED_COLLECTIONS", () => {
  const byName = new Map(UID_OWNED_COLLECTIONS.map((entry) => [entry.collection, entry]));

  test("não tem coleções duplicadas", () => {
    expect(byName.size).toBe(UID_OWNED_COLLECTIONS.length);
  });

  test.each([
    "statistics",
    "xp_logs",
    "user_badges",
    "season_participation",
    "mvp_votes",
    "activities",
  ])("gamificação %s é tratada pelo merge E pelo cleanup (#4112)", (name) => {
    const entry = byName.get(name);
    expect(entry).toBeDefined();
    expect(entry?.merge).not.toBe("none");
    expect(entry?.cleanup).not.toBe("none");
  });

  test.each([
    ["groups", ["owner_name"]],
    ["groups/{groupId}/members", ["user_name", "user_photo_url", "user_photo"]],
    ["group_invites", ["invited_by_name"]],
    // cashbox/callable.ts:430-436 (quem lançou + jogador pagador).
    ["groups/{groupId}/cashbox", ["created_by_name", "player_name"]],
    // cashbox/monthly.ts:1286-1296.
    [
      "groups/{groupId}/monthly_finance_periods/{periodKey}/payers",
      ["user_name", "user_photo_url"],
    ],
  ])("%s declara a PII real do escritor (#4113)", (name, pii) => {
    expect(byName.get(name)?.piiFields).toEqual(expect.arrayContaining(pii));
  });

  test("financeiro do pagador: cashbox (player_id) e payers são anonimizados no cleanup", () => {
    const cashbox = byName.get("groups/{groupId}/cashbox");
    expect(cashbox?.uidFields).toEqual(expect.arrayContaining(["created_by", "player_id"]));
    expect(cashbox?.cleanup).toBe("anonymize");

    const payers = byName.get("groups/{groupId}/monthly_finance_periods/{periodKey}/payers");
    expect(payers?.uidFields).toEqual(["user_id"]);
    expect(payers?.docIdScheme).toBe("{uid}");
    expect(payers?.cleanup).toBe("anonymize");
  });

  test("helpers de caminho do financeiro batem com os escritores (escopo COLLECTION)", () => {
    expect(CASHBOX.path("g1")).toBe("groups/g1/cashbox");
    expect(MONTHLY_PAYERS.periodsPath("g1")).toBe("groups/g1/monthly_finance_periods");
    expect(MONTHLY_PAYERS.path("g1", "2026-08", "u1"))
      .toBe("groups/g1/monthly_finance_periods/2026-08/payers/u1");
  });

  test("activities não declara campos de alvo sem escritor (#1968)", () => {
    expect(byName.get("activities")?.uidFields).toEqual(["user_id"]);
  });

  test("todo registro aponta o escritor verificado", () => {
    for (const entry of UID_OWNED_COLLECTIONS) {
      expect(entry.writer.length).toBeGreaterThan(0);
    }
  });
});

describe("sumNumericCounters", () => {
  test("soma presentes nos dois lados e copia os de um lado só", () => {
    expect(sumNumericCounters(
      {points: 9, wins: 3, goals_scored: 5},
      {points: 3, wins: 1, assists: 2},
      ["points", "wins", "goals_scored", "assists", "mvp_count"],
    )).toEqual({points: 12, wins: 4, goals_scored: 5, assists: 2});
  });

  test("ignora valores não numéricos (sentinels, NaN, strings)", () => {
    expect(sumNumericCounters(
      {points: Number.NaN, wins: "3"},
      {points: 4, wins: {increment: 1}},
      ["points", "wins"],
    )).toEqual({points: 4});
  });
});
