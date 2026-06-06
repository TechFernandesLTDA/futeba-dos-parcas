/**
 * FIX #2528 — collectDailyMetrics delimita o dia em BRT, não UTC.
 *
 * O cron dispara às 23:59 BRT = 02:59 UTC do dia seguinte.
 * Com `new Date().setHours(0,0,0,0)` (UTC), "hoje" referia-se ao dia UTC,
 * deslocando o snapshot 3h. O fix usa toLocaleDateString("en-CA", {timeZone:
 * "America/Sao_Paulo"}) para obter a data-parede BRT e reconstrói a meia-
 * noite BRT em UTC (BRT+3). Mesmo padrão de season/index.ts (FIX #790) e
 * growth/season-cycle.ts.
 *
 * Estes testes são puramente algébricos (sem acesso a Firestore/Functions) e
 * rodam com TZ=UTC (padrão do runner CI), provando que a lógica de derivação
 * de fuso é correta independente do TZ do processo.
 */

/** Replica a lógica de derivação de BRT midnight do fix. */
function getBrtDayRange(nowUtc: Date): { todayStr: string; todayTs: Date; tomorrowTs: Date } {
  const todayStr = nowUtc.toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const [tyear, tmonth, tday] = todayStr.split("-").map(Number);
  // Meia-noite BRT = 03:00 UTC (BRT é UTC-3).
  const todayTs = new Date(Date.UTC(tyear, tmonth - 1, tday, 3, 0, 0, 0));
  const tomorrowTs = new Date(Date.UTC(tyear, tmonth - 1, tday + 1, 3, 0, 0, 0));
  return {todayStr, todayTs, tomorrowTs};
}

describe("collectDailyMetrics — delimitação de dia em BRT (#2528)", () => {
  it("disparo às 23:59 BRT (= 02:59 UTC+1d): todayStr deve ser o dia BRT, não UTC", () => {
    // Disparo: 2026-06-07 23:59 BRT = 2026-06-08T02:59:00Z (segunda em UTC).
    // Antes do fix: today UTC = 2026-06-08 → snapshot rotulado errado.
    // Após o fix: todayStr deve ser "2026-06-07" (domingo BRT).
    const nowUtc = new Date("2026-06-08T02:59:00.000Z");
    const {todayStr} = getBrtDayRange(nowUtc);
    expect(todayStr).toBe("2026-06-07");
  });

  it("todayTs é exatamente a meia-noite BRT do dia BRT (03:00 UTC)", () => {
    const nowUtc = new Date("2026-06-08T02:59:00.000Z");
    const {todayTs} = getBrtDayRange(nowUtc);
    // Meia-noite BRT de 2026-06-07 = 2026-06-07T03:00:00.000Z
    expect(todayTs.toISOString()).toBe("2026-06-07T03:00:00.000Z");
  });

  it("tomorrowTs é a meia-noite BRT do dia seguinte (24h depois de todayTs)", () => {
    const nowUtc = new Date("2026-06-08T02:59:00.000Z");
    const {todayTs, tomorrowTs} = getBrtDayRange(nowUtc);
    const diffMs = tomorrowTs.getTime() - todayTs.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000); // exatamente 24h
  });

  it("evento às 21:30 BRT (= 00:30 UTC+1d) está dentro da janela todayTs–tomorrowTs", () => {
    // 2026-06-07 21:30 BRT = 2026-06-08T00:30:00Z
    const nowUtc = new Date("2026-06-08T02:59:00.000Z");
    const {todayTs, tomorrowTs} = getBrtDayRange(nowUtc);

    // Um jogo criado às 21:30 BRT do mesmo dia deve ser incluído no snapshot.
    const gameCreatedAt = new Date("2026-06-08T00:30:00.000Z"); // 21:30 BRT
    expect(gameCreatedAt >= todayTs && gameCreatedAt < tomorrowTs).toBe(true);
  });

  it("evento às 00:01 BRT do dia seguinte está FORA da janela (não conta no dia atual)", () => {
    const nowUtc = new Date("2026-06-08T02:59:00.000Z");
    const {todayTs, tomorrowTs} = getBrtDayRange(nowUtc);

    // 2026-06-08 00:01 BRT = 2026-06-08T03:01:00Z (já é amanhã BRT)
    const gameNextDay = new Date("2026-06-08T03:01:00.000Z");
    expect(gameNextDay >= todayTs && gameNextDay < tomorrowTs).toBe(false);
  });

  it("virada de mês: tomorrowTs normaliza corretamente (ex.: 31 Jan → 1 Fev)", () => {
    // 2026-01-31 23:59 BRT = 2026-02-01T02:59:00Z
    const nowUtc = new Date("2026-02-01T02:59:00.000Z");
    const {todayStr, tomorrowTs} = getBrtDayRange(nowUtc);
    expect(todayStr).toBe("2026-01-31");
    // tomorrowTs deve ser 2026-02-01 03:00 UTC (= meia-noite BRT de fev/1)
    expect(tomorrowTs.toISOString()).toBe("2026-02-01T03:00:00.000Z");
  });

  it("disparo no horário normal (12:00 BRT = 15:00 UTC): todayStr é o mesmo dia", () => {
    const nowUtc = new Date("2026-06-07T15:00:00.000Z"); // 12:00 BRT
    const {todayStr} = getBrtDayRange(nowUtc);
    expect(todayStr).toBe("2026-06-07");
  });
});
