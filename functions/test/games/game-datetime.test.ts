/**
 * dateTime do jogo a partir de date/time (spec bugfix-2026-11-23-jogo-do-web-sem-datetime).
 * Só as funções puras; o trigger é uma casca em volta delas.
 */
jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: (_opts: unknown, handler: unknown) => handler,
}));

import {
  isValidTimeZone,
  shouldComputeDateTime,
  zonedDateTime,
} from "../../src/games/game-datetime";

const ts = (iso: string) => ({toDate: () => new Date(iso)});

describe("zonedDateTime", () => {
  it("monta a hora de parede no fuso da quadra", () => {
    expect(zonedDateTime("2026-03-20", "19:00", "America/Sao_Paulo")?.toISOString())
      .toBe("2026-03-20T22:00:00.000Z");
    expect(zonedDateTime("2026-03-20", "19:00", "America/Manaus")?.toISOString())
      .toBe("2026-03-20T23:00:00.000Z");
    expect(zonedDateTime("2026-03-20", "19:00", "America/Noronha")?.toISOString())
      .toBe("2026-03-20T21:00:00.000Z");
  });

  it("sem hora usa meia-noite local", () => {
    expect(zonedDateTime("2026-03-20", "", "America/Sao_Paulo")?.toISOString())
      .toBe("2026-03-20T03:00:00.000Z");
  });

  it("recusa formato inesperado", () => {
    expect(zonedDateTime("20/03/2026", "19:00", "America/Sao_Paulo")).toBeNull();
    expect(zonedDateTime("2026-02-31", "19:00", "America/Sao_Paulo")).toBeNull();
    expect(zonedDateTime("2026-03-20", "24:00", "America/Sao_Paulo")).toBeNull();
    expect(zonedDateTime(undefined, "19:00", "America/Sao_Paulo")).toBeNull();
  });

  it("isValidTimeZone", () => {
    expect(isValidTimeZone("America/Cuiaba")).toBe(true);
    expect(isValidTimeZone("Lua/Base")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });
});

describe("shouldComputeDateTime", () => {
  const base = {date: "2026-03-20", time: "19:00"};

  it("jogo criado sem dateTime (web e Android) é preenchido", () => {
    expect(shouldComputeDateTime(undefined, base)).toBe(true);
  });

  it("jogo criado com dateTime (iOS, duplicar do web) não é tocado", () => {
    expect(shouldComputeDateTime(undefined, {...base, dateTime: ts("2026-03-20T22:00:00Z")})).toBe(false);
  });

  it("documento antigo com date_time não é tocado", () => {
    expect(shouldComputeDateTime(undefined, {...base, date_time: ts("2026-03-20T22:00:00Z")})).toBe(false);
  });

  it("edição que muda date ou time sem dateTime recalcula (Android)", () => {
    const antes = {...base, dateTime: ts("2026-03-20T22:00:00Z")};
    expect(shouldComputeDateTime(antes, {...antes, time: "20:30"})).toBe(true);
    expect(shouldComputeDateTime(antes, {...antes, date: "2026-03-27"})).toBe(true);
  });

  it("edição que muda date e dateTime juntos fica como o cliente gravou", () => {
    const antes = {...base, dateTime: ts("2026-03-20T22:00:00Z")};
    expect(shouldComputeDateTime(antes, {...base, date: "2026-03-27", dateTime: ts("2026-03-27T22:00:00Z")})).toBe(false);
  });

  it("escrita do próprio trigger não volta a disparar", () => {
    const antes = {...base};
    const depois = {...base, dateTime: ts("2026-03-20T22:00:00Z")};
    expect(shouldComputeDateTime(antes, depois)).toBe(false);
  });

  it("escrita que não mexe na data não faz nada", () => {
    const antes = {...base, dateTime: ts("2026-03-20T22:00:00Z"), players_count: 3};
    expect(shouldComputeDateTime(antes, {...antes, players_count: 4})).toBe(false);
  });
});
