import {
  getPublicCapacityStatuses,
} from "../src/games/join-public-game";

describe("join public game capacity", () => {
  test("conta somente CONFIRMED em jogo publico recorrente", () => {
    expect(getPublicCapacityStatuses({
      visibility: "PUBLIC_OPEN",
      recurrence: "weekly",
    })).toEqual(["CONFIRMED"]);
  });

  test("mantem PENDING reservado em jogo publico nao recorrente", () => {
    expect(getPublicCapacityStatuses({
      visibility: "PUBLIC_OPEN",
      recurrence: "none",
    })).toEqual(["CONFIRMED", "PENDING"]);
  });

  test("mantem PENDING reservado em jogo legado publico sem recorrencia", () => {
    expect(getPublicCapacityStatuses({
      is_public: true,
      recurrence: "none",
    })).toEqual(["CONFIRMED", "PENDING"]);
  });
});
