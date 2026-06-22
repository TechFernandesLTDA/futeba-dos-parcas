/**
 * FIX #2497 — weekly-ranking off-by-one de timezone + inconsistência
 * getWeekKey/getWeekRange.
 *
 * Helpers agora usam métodos UTC → determinísticos em qualquer TZ de runner
 * (inclusive BRT self-hosted). Não dependem de process.env.TZ.
 */
import {
  getCompletedWeekKey,
  getWeekKey,
  getWeekRange,
} from "../src/growth/weekly-ranking";

const iso = (d: Date) => d.toISOString().split("T")[0];

describe("weekly-ranking timezone + consistência (#2497)", () => {
  it("invariante: getWeekRange(getWeekKey(d)) sempre contém d", () => {
    // Varre ~14 meses de datas; cada dia deve cair no range da própria chave.
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 430; i++) {
      const d = new Date(start + i * 86400000);
      const {start: s, end: e} = getWeekRange(getWeekKey(d));
      const day = iso(d);
      expect(iso(s) <= day && day <= iso(e)).toBe(true);
    }
  });

  it("FIX #2842: trigger domingo 23:57 BRT rankeia a semana encerrada", () => {
    // nowInBrt() produz Date com campos UTC = horário-parede BRT:
    // domingo 2026-06-14 23:57. A semana encerrada deve ser 2026-06-07
    // a 2026-06-13, incluindo jogos de segunda a sabado.
    const brtNow = new Date(Date.UTC(2026, 5, 14, 23, 57, 0));
    const {start, end} = getWeekRange(getCompletedWeekKey(brtNow));
    expect(iso(start)).toBe("2026-06-07");
    expect(iso(end)).toBe("2026-06-13");
    expect(iso(start) <= "2026-06-13" && "2026-06-13" <= iso(end)).toBe(true);
  });

  it("semana é estável dentro do mesmo intervalo de 7 dias", () => {
    const key = getWeekKey(new Date(Date.UTC(2026, 5, 7, 12, 0, 0)));
    const {start, end} = getWeekRange(key);
    // start e end pertencem à mesma chave
    expect(getWeekKey(start)).toBe(key);
    expect(getWeekKey(end)).toBe(key);
  });
});
