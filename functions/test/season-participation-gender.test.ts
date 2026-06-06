/**
 * TESTES — Segmentação de gênero em season_participation (Fase 4)
 *
 * Cobre o modelo ADITIVO: o campo plano (combinado) continua
 * incrementando como antes E o mapa aninhado by_gender.{gender}
 * recebe os mesmos incrementos. partId permanece `${seasonId}_${uid}`
 * (sem migração, sem double-count na visão combinada).
 *
 * Também cobre normalizeGameGender (tolerância a legados/valores
 * desconhecidos → MIXED).
 */

// Mock firebase-admin: FieldValue.increment vira sentinel inspecionável.
jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
    increment: jest.fn((n: number) => ({_type: "Increment", value: n})),
  };
  const mockAdmin: Record<string, unknown> = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => ({})),
    initializeApp: jest.fn(),
  };
  (mockAdmin.firestore as Record<string, unknown>).FieldValue =
    mockFieldValue;
  return mockAdmin;
});

// Mock do db(): captura a doc ref usada no batch.set.
const docMock = jest.fn((id: string) => ({_path: id}));
const collectionMock = jest.fn(() => ({doc: docMock}));
jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({collection: collectionMock})),
}));

import {
  updateSeasonParticipation,
  normalizeGameGender,
} from "../src/game/helpers";
import {GameConfirmation} from "../src/models";

type Increment = {_type: "Increment"; value: number};

/** Cria um batch mock que registra as chamadas set(). */
function createBatch() {
  const calls: Array<{ref: unknown; data: Record<string, unknown>}> = [];
  const batch = {
    set: jest.fn((ref: unknown, data: Record<string, unknown>) => {
      calls.push({ref, data});
    }),
  };
  return {batch, calls};
}

const baseConf = {
  goals: 2,
  assists: 1,
} as unknown as GameConfirmation;

describe("normalizeGameGender", () => {
  it("aceita valores válidos (case-insensitive)", () => {
    expect(normalizeGameGender("MALE")).toBe("MALE");
    expect(normalizeGameGender("female")).toBe("FEMALE");
    expect(normalizeGameGender("Mixed")).toBe("MIXED");
  });

  it("retorna MIXED para ausente/desconhecido/null", () => {
    expect(normalizeGameGender(undefined)).toBe("MIXED");
    expect(normalizeGameGender(null)).toBe("MIXED");
    expect(normalizeGameGender("")).toBe("MIXED");
    expect(normalizeGameGender("OTHER")).toBe("MIXED");
    expect(normalizeGameGender(42)).toBe("MIXED");
  });
});

describe("updateSeasonParticipation — segmentação by_gender", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("escreve campo plano (combinado) E by_gender.MALE numa vitória", () => {
    const {batch, calls} = createBatch();
    updateSeasonParticipation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch as any,
      "uid1",
      "2026-06",
      "WIN",
      baseConf,
      true,
      "grp1",
      "MALE"
    );

    expect(calls).toHaveLength(1);
    const data = calls[0].data;

    // partId combinado: ${seasonId}_${uid} (sem gênero na chave)
    expect(docMock).toHaveBeenCalledWith("2026-06_uid1");

    // Campo plano = combinado (comportamento histórico preservado)
    expect((data.points as Increment).value).toBe(3);
    expect((data.wins as Increment).value).toBe(1);
    expect((data.goals_scored as Increment).value).toBe(2);
    expect((data.assists as Increment).value).toBe(1);
    expect((data.mvp_count as Increment).value).toBe(1);

    // Visão segmentada espelha os mesmos incrementos sob MALE
    const byGender = data.by_gender as Record<string, Record<string, Increment>>;
    expect(byGender.MALE.points.value).toBe(3);
    expect(byGender.MALE.wins.value).toBe(1);
    expect(byGender.MALE.goals_scored.value).toBe(2);
    expect(byGender.MALE.mvp_count.value).toBe(1);
    // NÃO cria buckets de outros gêneros neste write
    expect(byGender.FEMALE).toBeUndefined();
    expect(byGender.MIXED).toBeUndefined();
  });

  it("usa instâncias independentes de increment (sem aliasing)", () => {
    const {batch, calls} = createBatch();
    updateSeasonParticipation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch as any,
      "uid1",
      "2026-06",
      "WIN",
      baseConf,
      false,
      null,
      "FEMALE"
    );
    const data = calls[0].data;
    const byGender = data.by_gender as Record<string, Record<string, Increment>>;
    // Mesmo valor, mas objetos distintos (factory gera novos sentinels)
    expect(data.points).not.toBe(byGender.FEMALE.points);
    expect((data.points as Increment).value).toBe(
      byGender.FEMALE.points.value
    );
  });

  it("cai em MIXED quando gameGender é ausente (jogo legado)", () => {
    const {batch, calls} = createBatch();
    updateSeasonParticipation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch as any,
      "uid2",
      "2026-06",
      "DRAW",
      baseConf,
      false
    );
    const data = calls[0].data;
    const byGender = data.by_gender as Record<string, Record<string, Increment>>;
    expect((data.points as Increment).value).toBe(1); // empate = 1 ponto
    expect(byGender.MIXED.points.value).toBe(1);
    expect(byGender.MIXED.draws.value).toBe(1);
  });

  it("derrota: 0 pontos no plano e no by_gender", () => {
    const {batch, calls} = createBatch();
    updateSeasonParticipation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch as any,
      "uid3",
      "2026-06",
      "LOSS",
      baseConf,
      false,
      null,
      "MALE"
    );
    const data = calls[0].data;
    const byGender = data.by_gender as Record<string, Record<string, Increment>>;
    expect((data.points as Increment).value).toBe(0);
    expect((data.losses as Increment).value).toBe(1);
    expect(byGender.MALE.points.value).toBe(0);
    expect(byGender.MALE.losses.value).toBe(1);
  });
});
