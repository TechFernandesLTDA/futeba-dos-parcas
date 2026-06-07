/**
 * Testes de regressão anti-cheat caps — issue #2525
 *
 * Garante que:
 * 1. clampStat aplica piso 0 + teto MAX corretamente.
 * 2. updateSeasonParticipation persiste valores capeados em AMBOS
 *    o campo plano (combinado) E o mapa by_gender (Fase 4b).
 * 3. updateRankingDeltas persiste valores capeados.
 * 4. Valores negativos são pisados em 0 (nunca decrementam contadores).
 */

// Mock firebase-admin: FieldValue.increment vira sentinel inspecionável.
jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
    increment: jest.fn((n: number) => ({operand: n})),
  };
  const mockAdmin: Record<string, unknown> = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => ({})),
    initializeApp: jest.fn(),
  };
  (mockAdmin.firestore as Record<string, unknown>).FieldValue = mockFieldValue;
  return mockAdmin;
});

// Mock do db(): captura refs usadas em batch.set/batch.update.
const docMock = jest.fn((id: string) => ({_path: id}));
const collectionMock = jest.fn(() => ({doc: docMock}));
jest.mock("../../src/_db", () => ({
  db: jest.fn(() => ({collection: collectionMock})),
}));

import {clampStat} from "../../src/constants";
import {
  updateSeasonParticipation,
  updateRankingDeltas,
} from "../../src/game/helpers";
import {GameConfirmation} from "../../src/models";

type Increment = {operand: number};

/** Cria um batch mock que registra chamadas set() e update(). */
function createBatch() {
  const setCalls: Array<{ref: unknown; data: Record<string, unknown>}> = [];
  const updateCalls: Array<{ref: unknown; data: Record<string, unknown>}> = [];
  const batch = {
    set: jest.fn((ref: unknown, data: Record<string, unknown>) => {
      setCalls.push({ref, data});
    }),
    update: jest.fn((ref: unknown, data: Record<string, unknown>) => {
      updateCalls.push({ref, data});
    }),
  };
  return {batch, setCalls, updateCalls};
}

// ==========================================
// clampStat — unit tests
// ==========================================

describe("clampStat", () => {
  it("retorna valor normal sem alteração", () => {
    expect(clampStat(5, 15)).toBe(5);
    expect(clampStat(0, 15)).toBe(0);
  });

  it("aplica teto máximo (goals=99 → 15)", () => {
    expect(clampStat(99, 15)).toBe(15);
    expect(clampStat(16, 15)).toBe(15);
    expect(clampStat(15, 15)).toBe(15);
  });

  it("pisa negativos em 0 (never decrement counters)", () => {
    expect(clampStat(-1, 15)).toBe(0);
    expect(clampStat(-999, 30)).toBe(0);
  });

  it("trata undefined/null como 0", () => {
    expect(clampStat(undefined, 15)).toBe(0);
    expect(clampStat(null, 15)).toBe(0);
  });

  it("aplica tetos independentes por tipo de stat", () => {
    // MAX_GOALS=15, MAX_ASSISTS=10, MAX_SAVES=30
    expect(clampStat(99, 15)).toBe(15); // goals
    expect(clampStat(99, 10)).toBe(10); // assists
    expect(clampStat(99, 30)).toBe(30); // saves
  });
});

// ==========================================
// updateSeasonParticipation — caps #2525
// ==========================================

describe("updateSeasonParticipation — caps anti-cheat #2525", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("goals=99 persiste como 15 no campo plano E no by_gender (Fase 4b)", () => {
    const {batch, setCalls} = createBatch();
    const conf = {goals: 99, assists: 1} as unknown as GameConfirmation;

    updateSeasonParticipation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch as any,
      "uid1",
      "2026-06",
      "WIN",
      conf,
      false,
      null,
      "MALE"
    );

    expect(setCalls).toHaveLength(1);
    const data = setCalls[0].data;

    // Campo plano capeado em 15
    expect((data.goals_scored as Increment).operand).toBe(15);

    // by_gender também capeado — Fase 4b consistente
    const byGender = data.by_gender as Record<string, Record<string, Increment>>;
    expect(byGender.MALE.goals_scored.operand).toBe(15);
  });

  it("assists=99 persiste como 10 no campo plano E no by_gender", () => {
    const {batch, setCalls} = createBatch();
    const conf = {goals: 2, assists: 99} as unknown as GameConfirmation;

    updateSeasonParticipation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch as any,
      "uid2",
      "2026-06",
      "WIN",
      conf,
      false,
      null,
      "FEMALE"
    );

    const data = setCalls[0].data;
    expect((data.assists as Increment).operand).toBe(10);
    const byGender = data.by_gender as Record<string, Record<string, Increment>>;
    expect(byGender.FEMALE.assists.operand).toBe(10);
  });

  it("goals=-3 persiste como 0 (piso — não decrementa contadores vitalícios)", () => {
    const {batch, setCalls} = createBatch();
    const conf = {goals: -3, assists: -1} as unknown as GameConfirmation;

    updateSeasonParticipation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch as any,
      "uid3",
      "2026-06",
      "DRAW",
      conf,
      false,
      null,
      "MIXED"
    );

    const data = setCalls[0].data;
    expect((data.goals_scored as Increment).operand).toBe(0);
    expect((data.assists as Increment).operand).toBe(0);
    const byGender = data.by_gender as Record<string, Record<string, Increment>>;
    expect(byGender.MIXED.goals_scored.operand).toBe(0);
    expect(byGender.MIXED.assists.operand).toBe(0);
  });

  it("valores normais passam sem alteração", () => {
    const {batch, setCalls} = createBatch();
    const conf = {goals: 2, assists: 1} as unknown as GameConfirmation;

    updateSeasonParticipation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch as any,
      "uid4",
      "2026-06",
      "WIN",
      conf,
      true,
      "grp1",
      "MALE"
    );

    const data = setCalls[0].data;
    expect((data.goals_scored as Increment).operand).toBe(2);
    expect((data.assists as Increment).operand).toBe(1);
    const byGender = data.by_gender as Record<string, Record<string, Increment>>;
    expect(byGender.MALE.goals_scored.operand).toBe(2);
    expect(byGender.MALE.assists.operand).toBe(1);
  });
});

// ==========================================
// updateRankingDeltas — caps #2525
// ==========================================

describe("updateRankingDeltas — caps anti-cheat #2525", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("goals=99 persiste como 15 em goals_added", () => {
    const {batch, setCalls} = createBatch();
    const conf = {goals: 99, assists: 0, saves: 0} as unknown as GameConfirmation;

    updateRankingDeltas(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch as any,
      "uid1",
      conf,
      "WIN",
      100,
      false,
      "2026-W23",
      "2026-06"
    );

    // week + month = 2 writes
    expect(setCalls).toHaveLength(2);
    const weekData = setCalls[0].data;
    expect((weekData.goals_added as Increment).operand).toBe(15);
  });

  it("saves=99 persiste como 30 em saves_added", () => {
    const {batch, setCalls} = createBatch();
    const conf = {goals: 0, assists: 0, saves: 99} as unknown as GameConfirmation;

    updateRankingDeltas(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch as any,
      "uid2",
      conf,
      "WIN",
      100,
      false,
      "2026-W23",
      "2026-06"
    );

    const weekData = setCalls[0].data;
    expect((weekData.saves_added as Increment).operand).toBe(30);
  });

  it("assists=-5 persiste como 0 (piso)", () => {
    const {batch, setCalls} = createBatch();
    const conf = {goals: 0, assists: -5, saves: 0} as unknown as GameConfirmation;

    updateRankingDeltas(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch as any,
      "uid3",
      conf,
      "LOSS",
      0,
      false,
      "2026-W23",
      "2026-06"
    );

    const weekData = setCalls[0].data;
    expect((weekData.assists_added as Increment).operand).toBe(0);
  });
});
