/**
 * FIX #2494 — pontuação multi-time da liga de grupo (modelo "ranking por
 * placar"). Testa as funções puras de resultado/saldo, garantindo que o caso
 * de 2 times reduz EXATAMENTE ao comportamento clássico.
 */
import {rankResult, opponentAverage} from "../src/group-league";

describe("group-league multi-team scoring (#2494)", () => {
  describe("rankResult", () => {
    it("2 times: vence quem fez mais gols", () => {
      expect(rankResult(3, 3, 1)).toBe("WIN");
      expect(rankResult(1, 3, 1)).toBe("LOSS");
    });
    it("2 times empatados: DRAW para ambos", () => {
      expect(rankResult(2, 2, 2)).toBe("DRAW");
    });
    it("3 times com placares distintos: WIN/DRAW/LOSS", () => {
      // placares 5,4,3 → max=5 min=3
      expect(rankResult(5, 5, 3)).toBe("WIN");
      expect(rankResult(4, 5, 3)).toBe("DRAW");
      expect(rankResult(3, 5, 3)).toBe("LOSS");
    });
    it("3 times com empate no topo: ambos WIN, último LOSS", () => {
      expect(rankResult(5, 5, 3)).toBe("WIN"); // os dois de 5
      expect(rankResult(3, 5, 3)).toBe("LOSS");
    });
  });

  describe("opponentAverage", () => {
    it("2 times: média = placar do único oponente (comportamento antigo)", () => {
      const scores = [{id: "a", score: 5}, {id: "b", score: 2}];
      expect(opponentAverage("a", scores)).toBe(2);
      expect(opponentAverage("b", scores)).toBe(5);
    });
    it("3 times: média (arredondada) dos demais", () => {
      const scores = [
        {id: "a", score: 5},
        {id: "b", score: 3},
        {id: "c", score: 1},
      ];
      expect(opponentAverage("a", scores)).toBe(2); // (3+1)/2
      expect(opponentAverage("b", scores)).toBe(3); // (5+1)/2
      expect(opponentAverage("c", scores)).toBe(4); // (5+3)/2
    });
    it("time único: 0", () => {
      expect(opponentAverage("a", [{id: "a", score: 5}])).toBe(0);
    });
  });

  it("saldo do campeão é positivo e do lanterna negativo (3 times)", () => {
    const scores = [
      {id: "a", score: 5},
      {id: "b", score: 3},
      {id: "c", score: 1},
    ];
    expect(5 - opponentAverage("a", scores)).toBeGreaterThan(0);
    expect(1 - opponentAverage("c", scores)).toBeLessThan(0);
  });
});
