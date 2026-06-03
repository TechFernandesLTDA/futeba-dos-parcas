/**
 * TESTES DOS LIMITES DE RECORRÊNCIA (spec #2398)
 *
 * Lógica pura de parada da série recorrente: count XOR end_date,
 * sempre sob o hard cap de 52. Também cobre getNextDate por tipo.
 */

import {
  recurrenceStopReason,
  getNextDate,
  RECURRENCE_HARD_CAP,
} from "../src/games/recurrence-limits";

const base = {
  currentIndex: 1,
  childCount: 0,
  recurrenceCount: null as number | null,
  recurrenceEndDate: null as string | null,
  nextDate: "2026-06-10",
};

describe("recurrenceStopReason", () => {
  it("continua (null) sem limites quando dentro do cap", () => {
    expect(recurrenceStopReason(base)).toBeNull();
  });

  it("hard cap por índice: para quando nextIndex > 52", () => {
    expect(
      recurrenceStopReason({...base, currentIndex: RECURRENCE_HARD_CAP})
    ).toBe("hard_cap");
  });

  it("hard cap por childCount: para quando já há 52 filhos", () => {
    expect(
      recurrenceStopReason({...base, childCount: RECURRENCE_HARD_CAP})
    ).toBe("hard_cap");
  });

  it("modo count: para quando nextIndex ultrapassa recurrenceCount", () => {
    // currentIndex=4 → nextIndex=5 > count 4 → para
    expect(
      recurrenceStopReason({...base, currentIndex: 4, recurrenceCount: 4})
    ).toBe("count");
  });

  it("modo count: continua enquanto nextIndex <= recurrenceCount", () => {
    // currentIndex=3 → nextIndex=4 <= count 4 → continua
    expect(
      recurrenceStopReason({...base, currentIndex: 3, recurrenceCount: 4})
    ).toBeNull();
  });

  it("modo end_date: para quando a próxima data passa do fim", () => {
    expect(
      recurrenceStopReason({
        ...base,
        nextDate: "2026-07-01",
        recurrenceEndDate: "2026-06-30",
      })
    ).toBe("end_date");
  });

  it("modo end_date: continua quando a próxima data é <= fim", () => {
    expect(
      recurrenceStopReason({
        ...base,
        nextDate: "2026-06-30",
        recurrenceEndDate: "2026-06-30",
      })
    ).toBeNull();
  });

  it("hard cap tem prioridade sobre count e end_date", () => {
    expect(
      recurrenceStopReason({
        ...base,
        currentIndex: RECURRENCE_HARD_CAP,
        recurrenceCount: 99,
        recurrenceEndDate: "2099-01-01",
      })
    ).toBe("hard_cap");
  });
});

describe("getNextDate", () => {
  it("weekly: +7 dias", () => {
    expect(getNextDate("2026-06-03", "weekly")).toBe("2026-06-10");
  });

  it("biweekly: +14 dias", () => {
    expect(getNextDate("2026-06-03", "biweekly")).toBe("2026-06-17");
  });

  it("monthly: +1 mês", () => {
    expect(getNextDate("2026-06-03", "monthly")).toBe("2026-07-03");
  });

  it("weekly atravessa virada de mês", () => {
    expect(getNextDate("2026-06-28", "weekly")).toBe("2026-07-05");
  });
});
