/**
 * #4112 / #4113 — lista canônica de coleções pertencentes a um uid,
 * compartilhada por account-merge.ts e account-cleanup.ts.
 */
import {
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
  ])("%s declara a PII real do escritor (#4113)", (name, pii) => {
    expect(byName.get(name)?.piiFields).toEqual(expect.arrayContaining(pii));
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
