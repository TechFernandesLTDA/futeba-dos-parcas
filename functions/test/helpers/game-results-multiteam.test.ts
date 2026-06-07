/**
 * Testes de regressão multi-time — issue #2526
 *
 * Garante que:
 * 1. determineGameResults atribui WIN/DRAW/LOSS correto para N >= 2 times.
 * 2. getOpponentScore retorna a média dos demais times (não -1 nem placar
 *    arbitrário) para N >= 2.
 * 3. Com 2 times, o comportamento é idêntico ao pré-fix (sem regressão).
 */

// Mocks mínimos necessários para importar helpers.ts sem Firebase real.
jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-admin", () => {
  const mockAdmin: Record<string, unknown> = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => ({})),
    initializeApp: jest.fn(),
  };
  (mockAdmin.firestore as Record<string, unknown>).FieldValue = {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
    increment: jest.fn((n: number) => ({_type: "Increment", value: n})),
  };
  return mockAdmin;
});

jest.mock("../../src/_db", () => ({
  db: jest.fn(() => ({})),
}));

jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn(),
}));

import {
  determineGameResults,
  getOpponentScore,
} from "../../src/game/helpers";
import {Team, LiveGameScore} from "../../src/models";

// ---------------------------------------------------------------------------
// Helpers de construção de fixtures
// ---------------------------------------------------------------------------

function makeTeam(id: string, score: number): Team {
  return {
    id,
    name: `Time ${id}`,
    score,
    playerIds: [],
  } as unknown as Team;
}

function makeLiveScore(
  team1Id: string,
  team2Id: string,
  team1Score: number,
  team2Score: number,
): LiveGameScore {
  return {team1Id, team2Id, team1Score, team2Score} as LiveGameScore;
}

// ---------------------------------------------------------------------------
// determineGameResults — 2 times (regressão)
// ---------------------------------------------------------------------------

describe("determineGameResults — 2 times (regressão)", () => {
  it("vencedor correto sem liveScore", () => {
    const teams = [makeTeam("A", 3), makeTeam("B", 1)];
    const res = determineGameResults(teams, null);
    expect(res["A"]).toBe("WIN");
    expect(res["B"]).toBe("LOSS");
  });

  it("empate sem liveScore", () => {
    const teams = [makeTeam("A", 2), makeTeam("B", 2)];
    const res = determineGameResults(teams, null);
    expect(res["A"]).toBe("DRAW");
    expect(res["B"]).toBe("DRAW");
  });

  it("liveScore sobrescreve team.score para team1/team2", () => {
    const teams = [makeTeam("A", 0), makeTeam("B", 0)];
    const live = makeLiveScore("A", "B", 2, 1);
    const res = determineGameResults(teams, live);
    expect(res["A"]).toBe("WIN");
    expect(res["B"]).toBe("LOSS");
  });
});

// ---------------------------------------------------------------------------
// determineGameResults — 3+ times (fix #2526)
// ---------------------------------------------------------------------------

describe("determineGameResults — 3 times (fix #2526)", () => {
  it("maior placar = WIN, menor = LOSS, intermediário = DRAW", () => {
    const teams = [
      makeTeam("A", 5),
      makeTeam("B", 3),
      makeTeam("C", 1),
    ];
    const res = determineGameResults(teams, null);
    expect(res["A"]).toBe("WIN");
    expect(res["B"]).toBe("DRAW");
    expect(res["C"]).toBe("LOSS");
  });

  it("todos empatados = DRAW para todos", () => {
    const teams = [
      makeTeam("A", 2),
      makeTeam("B", 2),
      makeTeam("C", 2),
    ];
    const res = determineGameResults(teams, null);
    expect(res["A"]).toBe("DRAW");
    expect(res["B"]).toBe("DRAW");
    expect(res["C"]).toBe("DRAW");
  });

  it("dois times empatados no topo, um abaixo", () => {
    const teams = [
      makeTeam("A", 3),
      makeTeam("B", 3),
      makeTeam("C", 1),
    ];
    const res = determineGameResults(teams, null);
    // A e B empatam no topo → ambos WIN (score === maxScore, igual ao
    // rankResult de group-league.ts #2494); C perde
    expect(res["A"]).toBe("WIN");
    expect(res["B"]).toBe("WIN");
    expect(res["C"]).toBe("LOSS");
  });

  it("liveScore correto para time3 (usa team.score, não team2Score)", () => {
    const teams = [
      makeTeam("A", 4),
      makeTeam("B", 2),
      makeTeam("C", 0),
    ];
    // liveScore reflete A vs B; C usa team.score=0
    const live = makeLiveScore("A", "B", 4, 2);
    const res = determineGameResults(teams, live);
    expect(res["A"]).toBe("WIN");
    expect(res["B"]).toBe("DRAW"); // intermediário entre 4 e 0
    expect(res["C"]).toBe("LOSS");
  });
});

// ---------------------------------------------------------------------------
// getOpponentScore — 2 times (regressão)
// ---------------------------------------------------------------------------

describe("getOpponentScore — 2 times (regressão)", () => {
  it("retorna placar do único adversário (sem liveScore)", () => {
    const teams = [makeTeam("A", 3), makeTeam("B", 1)];
    expect(getOpponentScore(teams[0], null, teams)).toBe(1);
    expect(getOpponentScore(teams[1], null, teams)).toBe(3);
  });

  it("liveScore: team1 recebe team2Score, vice-versa", () => {
    const teams = [makeTeam("A", 0), makeTeam("B", 0)];
    const live = makeLiveScore("A", "B", 4, 2);
    expect(getOpponentScore(teams[0], live, teams)).toBe(2);
    expect(getOpponentScore(teams[1], live, teams)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// getOpponentScore — 3+ times (fix #2526): média dos demais, nunca -1
// ---------------------------------------------------------------------------

describe("getOpponentScore — 3 times (fix #2526)", () => {
  it("retorna média arredondada dos outros 2 times (sem liveScore)", () => {
    const teams = [
      makeTeam("A", 5),
      makeTeam("B", 3),
      makeTeam("C", 1),
    ];
    // Para A: média de B(3) e C(1) = 2
    expect(getOpponentScore(teams[0], null, teams)).toBe(2);
    // Para B: média de A(5) e C(1) = 3
    expect(getOpponentScore(teams[1], null, teams)).toBe(3);
    // Para C: média de A(5) e B(3) = 4
    expect(getOpponentScore(teams[2], null, teams)).toBe(4);
  });

  it("nunca retorna -1 para time3 em liveScore (era -1 antes do fix)", () => {
    const teams = [
      makeTeam("A", 4),
      makeTeam("B", 2),
      makeTeam("C", 0),
    ];
    const live = makeLiveScore("A", "B", 4, 2);
    // C usa team.score=0; opponentScore(C) = média de A(4) e B(2) = 3
    const score = getOpponentScore(teams[2], live, teams);
    expect(score).not.toBe(-1);
    expect(score).toBe(3);
  });

  it("retorna -1 se team for undefined", () => {
    const teams = [makeTeam("A", 3), makeTeam("B", 1)];
    expect(getOpponentScore(undefined, null, teams)).toBe(-1);
  });
});
