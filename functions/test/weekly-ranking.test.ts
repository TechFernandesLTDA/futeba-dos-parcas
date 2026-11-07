/**
 * FIX #2497 — weekly-ranking off-by-one de timezone + inconsistência
 * getWeekKey/getWeekRange.
 *
 * Helpers agora usam métodos UTC → determinísticos em qualquer TZ de runner
 * (inclusive BRT self-hosted). Não dependem de process.env.TZ.
 */
import {
  applyConfirmationToWeeklyScore,
  clampWeeklyStats,
  getCompletedWeekKey,
  getWeekKey,
  getWeekRange,
  sortScoutRankings,
  sortWeeklyRankings,
  WeeklyPlayerScore,
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

describe("D5: weekly ranking anti-cheat caps (clampWeeklyStats)", () => {
  it("clampa gols acima do limite de 15 para 15", () => {
    const stats = clampWeeklyStats(50, 5, 10);
    expect(stats.goals).toBe(15);
    expect(stats.assists).toBe(5);
    expect(stats.saves).toBe(10);
  });

  it("clampa assistências acima de 10 e defesas acima de 30", () => {
    const stats = clampWeeklyStats(10, 25, 99);
    expect(stats.goals).toBe(10);
    expect(stats.assists).toBe(10);
    expect(stats.saves).toBe(30);
  });

  it("não permite valores negativos", () => {
    const stats = clampWeeklyStats(-5, -2, -10);
    expect(stats.goals).toBe(0);
    expect(stats.assists).toBe(0);
    expect(stats.saves).toBe(0);
  });
});

describe("D7: desempate determinístico no ranking semanal (sortWeeklyRankings)", () => {
  it("ordena primariamente por pontos descendente", () => {
    const items = [
      {userId: "u1", points: 10},
      {userId: "u2", points: 25},
      {userId: "u3", points: 15},
    ];
    const sorted = sortWeeklyRankings(items);
    expect(sorted.map((i) => i.userId)).toEqual(["u2", "u3", "u1"]);
  });

  it("desempata por gols quando pontos são iguais", () => {
    const items = [
      {userId: "u1", points: 20, goals: 2},
      {userId: "u2", points: 20, goals: 5},
    ];
    const sorted = sortWeeklyRankings(items);
    expect(sorted[0].userId).toBe("u2");
  });

  it("desempata por assistências quando pontos e gols são iguais", () => {
    const items = [
      {userId: "u1", points: 20, goals: 2, assists: 3},
      {userId: "u2", points: 20, goals: 2, assists: 4},
    ];
    const sorted = sortWeeklyRankings(items);
    expect(sorted[0].userId).toBe("u2");
  });

  it("desempata por vitórias quando pontos, gols e assistências são iguais", () => {
    const items = [
      {userId: "u1", points: 20, goals: 2, assists: 2, wins: 1},
      {userId: "u2", points: 20, goals: 2, assists: 2, wins: 3},
    ];
    const sorted = sortWeeklyRankings(items);
    expect(sorted[0].userId).toBe("u2");
  });

  it("desempata por nome de usuário e depois userId", () => {
    const items = [
      {userId: "u2", points: 20, goals: 2, assists: 2, wins: 1, userName: "Zico"},
      {userId: "u1", points: 20, goals: 2, assists: 2, wins: 1, userName: "Arthur"},
    ];
    const sorted = sortWeeklyRankings(items);
    expect(sorted[0].userId).toBe("u1");
  });

  it("desempata por userId quando nomes de usuário são iguais", () => {
    const items = [
      {userId: "u2", points: 20, goals: 2, assists: 2, wins: 1, userName: "Arthur"},
      {userId: "u1", points: 20, goals: 2, assists: 2, wins: 1, userName: "Arthur"},
    ];
    const sorted = sortWeeklyRankings(items);
    expect(sorted[0].userId).toBe("u1");
  });
});

describe("D7: desempate determinístico no scout ranking (sortScoutRankings)", () => {
  it("ordena primariamente por pontos descendente", () => {
    const items = [
      {userId: "u1", userName: "Arthur", points: 15},
      {userId: "u2", userName: "Zico", points: 40},
    ];
    const sorted = sortScoutRankings(items);
    expect(sorted[0].userId).toBe("u2");
  });

  it("desempata por nome de usuário quando pontos são iguais", () => {
    const items = [
      {userId: "u1", userName: "Zico", points: 30},
      {userId: "u2", userName: "Arthur", points: 30},
    ];
    const sorted = sortScoutRankings(items);
    expect(sorted[0].userId).toBe("u2");
  });

  it("desempata por userId quando nomes de usuário são iguais", () => {
    const items = [
      {userId: "u2", userName: "Arthur", points: 30},
      {userId: "u1", userName: "Arthur", points: 30},
    ];
    const sorted = sortScoutRankings(items);
    expect(sorted[0].userId).toBe("u1");
  });
});

describe("D5: acúmulo de estatísticas com anti-cheat (applyConfirmationToWeeklyScore)", () => {
  function makeInitialScore(uid = "u1"): WeeklyPlayerScore {
    return {
      userId: uid,
      userName: "Jogador",
      points: 0,
      goals: 0,
      assists: 0,
      saves: 0,
      presence: 0,
      mvp: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      bolaMurcha: 0,
    };
  }

  it("acumula presença e pontos normais de jogo", () => {
    const score = makeInitialScore();
    applyConfirmationToWeeklyScore(score, {
      goals: 2,
      assists: 1,
      saves: 3,
    });
    expect(score.presence).toBe(1);
    expect(score.goals).toBe(2);
    expect(score.assists).toBe(1);
    expect(score.saves).toBe(3);
    // presença: 3, gols: 2 * 5 = 10, assistências: 1 * 3 = 3 => 16 pontos
    expect(score.points).toBe(16);
  });

  it("clampa gols e assistências inflados pelo anti-cheat", () => {
    const score = makeInitialScore();
    applyConfirmationToWeeklyScore(score, {
      goals: 99,
      assists: 50,
      saves: 100,
    });
    expect(score.goals).toBe(15);
    expect(score.assists).toBe(10);
    expect(score.saves).toBe(30);
    // presença: 3, gols: 15 * 5 = 75, assistências: 10 * 3 = 30 => 108 pontos
    expect(score.points).toBe(108);
  });

  it("aplica bônus de MVP e penalidade de Bola Murcha", () => {
    const scoreMvp = makeInitialScore();
    applyConfirmationToWeeklyScore(scoreMvp, {
      goals: 1,
      is_mvp: true,
    });
    expect(scoreMvp.mvp).toBe(1);
    // presença 3 + gol 5 + MVP 8 = 16
    expect(scoreMvp.points).toBe(16);

    const scoreWorst = makeInitialScore();
    applyConfirmationToWeeklyScore(scoreWorst, {
      is_worst_player: true,
    });
    expect(scoreWorst.bolaMurcha).toBe(1);
    // presença 3 - Bola Murcha 3 = 0
    expect(scoreWorst.points).toBe(0);
  });
});
