jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(),
}));

import {buildSeasonArchivePayload} from "../src/growth/season-cycle";

describe("buildSeasonArchivePayload", () => {
  it("nao gera campos undefined quando standings esta vazio", () => {
    const payload = buildSeasonArchivePayload("2026-06", [], "archived-at");

    expect(payload).toMatchObject({
      month_key: "2026-06",
      name: "Temporada Junho de 2026",
      standings: [],
      mvp_user_id: null,
      mvp_user_name: null,
      mvp_points: null,
      lanterninha_user_id: null,
      lanterninha_user_name: null,
      archived_at: "archived-at",
    });
    expect(Object.values(payload)).not.toContain(undefined);
  });

  it("nao marca lanterninha quando existe apenas um jogador", () => {
    const payload = buildSeasonArchivePayload("2026-06", [
      {user_id: "u1", user_name: "Renan", points: 42},
    ], "archived-at");

    expect(payload).toMatchObject({
      mvp_user_id: "u1",
      mvp_user_name: "Renan",
      mvp_points: 42,
      lanterninha_user_id: null,
      lanterninha_user_name: null,
    });
    expect(Object.values(payload)).not.toContain(undefined);
  });

  it("marca lanterninha somente quando ha pelo menos dois jogadores", () => {
    const payload = buildSeasonArchivePayload("2026-06", [
      {user_id: "u1", user_name: "Renan", points: 42},
      {user_id: "u2", user_name: "Caio", points: 5},
    ], "archived-at");

    expect(payload).toMatchObject({
      mvp_user_id: "u1",
      lanterninha_user_id: "u2",
      lanterninha_user_name: "Caio",
    });
  });
});
