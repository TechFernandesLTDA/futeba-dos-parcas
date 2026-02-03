/**
 * Testes do sistema de League Rating e Promotion/Relegation
 */

import {
  PROMOTION_GAMES_REQUIRED,
  RELEGATION_GAMES_REQUIRED,
  PROTECTION_GAMES,
  LeagueState,
  getNextDivisionThreshold,
  getPreviousDivisionThreshold,
  getNextDivision,
  getPreviousDivision,
  calculateLeaguePromotion,
  calculateLeagueRating,
  getDivisionForRating,
} from "../src/league";

describe("League System", () => {
  // ==========================================
  // CONSTANTES
  // ==========================================

  describe("Constants", () => {
    test("promotion requires 3 games", () => {
      expect(PROMOTION_GAMES_REQUIRED).toBe(3);
    });

    test("relegation requires 3 games", () => {
      expect(RELEGATION_GAMES_REQUIRED).toBe(3);
    });

    test("protection lasts 5 games", () => {
      expect(PROTECTION_GAMES).toBe(5);
    });
  });

  // ==========================================
  // THRESHOLDS
  // ==========================================

  describe("getNextDivisionThreshold", () => {
    test("BRONZE threshold is 30", () => {
      expect(getNextDivisionThreshold("BRONZE")).toBe(30);
    });

    test("PRATA threshold is 50", () => {
      expect(getNextDivisionThreshold("PRATA")).toBe(50);
    });

    test("OURO threshold is 70", () => {
      expect(getNextDivisionThreshold("OURO")).toBe(70);
    });

    test("DIAMANTE threshold is 100", () => {
      expect(getNextDivisionThreshold("DIAMANTE")).toBe(100);
    });

    test("unknown division defaults to 100", () => {
      expect(getNextDivisionThreshold("UNKNOWN")).toBe(100);
    });
  });

  describe("getPreviousDivisionThreshold", () => {
    test("BRONZE has no lower threshold (0)", () => {
      expect(getPreviousDivisionThreshold("BRONZE")).toBe(0);
    });

    test("PRATA lower threshold is 30", () => {
      expect(getPreviousDivisionThreshold("PRATA")).toBe(30);
    });

    test("OURO lower threshold is 50", () => {
      expect(getPreviousDivisionThreshold("OURO")).toBe(50);
    });

    test("DIAMANTE lower threshold is 70", () => {
      expect(getPreviousDivisionThreshold("DIAMANTE")).toBe(70);
    });

    test("unknown division defaults to 0", () => {
      expect(getPreviousDivisionThreshold("UNKNOWN")).toBe(0);
    });
  });

  // ==========================================
  // DIVISION NAVIGATION
  // ==========================================

  describe("getNextDivision", () => {
    test("BRONZE promotes to PRATA", () => {
      expect(getNextDivision("BRONZE")).toBe("PRATA");
    });

    test("PRATA promotes to OURO", () => {
      expect(getNextDivision("PRATA")).toBe("OURO");
    });

    test("OURO promotes to DIAMANTE", () => {
      expect(getNextDivision("OURO")).toBe("DIAMANTE");
    });

    test("DIAMANTE stays DIAMANTE (max)", () => {
      expect(getNextDivision("DIAMANTE")).toBe("DIAMANTE");
    });

    test("unknown division returns itself", () => {
      expect(getNextDivision("UNKNOWN")).toBe("UNKNOWN");
    });
  });

  describe("getPreviousDivision", () => {
    test("BRONZE stays BRONZE (min)", () => {
      expect(getPreviousDivision("BRONZE")).toBe("BRONZE");
    });

    test("PRATA relegates to BRONZE", () => {
      expect(getPreviousDivision("PRATA")).toBe("BRONZE");
    });

    test("OURO relegates to PRATA", () => {
      expect(getPreviousDivision("OURO")).toBe("PRATA");
    });

    test("DIAMANTE relegates to OURO", () => {
      expect(getPreviousDivision("DIAMANTE")).toBe("OURO");
    });

    test("unknown division returns itself", () => {
      expect(getPreviousDivision("UNKNOWN")).toBe("UNKNOWN");
    });
  });

  // ==========================================
  // LEAGUE PROMOTION LOGIC
  // ==========================================

  describe("calculateLeaguePromotion", () => {
    const baseState: LeagueState = {
      division: "BRONZE",
      promotionProgress: 0,
      relegationProgress: 0,
      protectionGames: 0,
    };

    describe("Protection games", () => {
      test("decrements protection counter", () => {
        const state: LeagueState = { ...baseState, protectionGames: 3 };
        const result = calculateLeaguePromotion(state, 50);
        expect(result.protectionGames).toBe(2);
        expect(result.promotionProgress).toBe(0);
        expect(result.relegationProgress).toBe(0);
      });

      test("protection at 1 goes to 0", () => {
        const state: LeagueState = { ...baseState, protectionGames: 1 };
        const result = calculateLeaguePromotion(state, 50);
        expect(result.protectionGames).toBe(0);
      });

      test("protection prevents promotion progress", () => {
        const state: LeagueState = { ...baseState, protectionGames: 2 };
        const result = calculateLeaguePromotion(state, 99);
        expect(result.promotionProgress).toBe(0);
        expect(result.division).toBe("BRONZE");
      });
    });

    describe("Promotion flow", () => {
      test("increments promotion progress when above threshold", () => {
        const state: LeagueState = { ...baseState, division: "BRONZE" };
        const result = calculateLeaguePromotion(state, 35);
        expect(result.promotionProgress).toBe(1);
        expect(result.relegationProgress).toBe(0);
      });

      test("promotes after 3 consecutive games above threshold", () => {
        let state: LeagueState = { ...baseState, division: "BRONZE" };

        // Jogo 1
        state = calculateLeaguePromotion(state, 35);
        expect(state.promotionProgress).toBe(1);
        expect(state.division).toBe("BRONZE");

        // Jogo 2
        state = calculateLeaguePromotion(state, 40);
        expect(state.promotionProgress).toBe(2);
        expect(state.division).toBe("BRONZE");

        // Jogo 3 - PROMOCAO!
        state = calculateLeaguePromotion(state, 32);
        expect(state.division).toBe("PRATA");
        expect(state.promotionProgress).toBe(0);
        expect(state.protectionGames).toBe(PROTECTION_GAMES);
      });

      test("resets promotion progress when below threshold", () => {
        const state: LeagueState = {
          ...baseState,
          division: "BRONZE",
          promotionProgress: 2,
        };
        const result = calculateLeaguePromotion(state, 20);
        expect(result.promotionProgress).toBe(0);
      });

      test("DIAMANTE cannot be promoted further", () => {
        const state: LeagueState = { ...baseState, division: "DIAMANTE" };
        const result = calculateLeaguePromotion(state, 99);
        expect(result.division).toBe("DIAMANTE");
        expect(result.promotionProgress).toBe(0);
      });

      test("full promotion chain BRONZE -> PRATA -> OURO -> DIAMANTE", () => {
        let state: LeagueState = { ...baseState, division: "BRONZE" };

        // Promote to PRATA
        for (let i = 0; i < 3; i++) {
          state = calculateLeaguePromotion(state, 35);
        }
        expect(state.division).toBe("PRATA");

        // Burn protection
        for (let i = 0; i < PROTECTION_GAMES; i++) {
          state = calculateLeaguePromotion(state, 55);
        }

        // Promote to OURO
        for (let i = 0; i < 3; i++) {
          state = calculateLeaguePromotion(state, 55);
        }
        expect(state.division).toBe("OURO");

        // Burn protection
        for (let i = 0; i < PROTECTION_GAMES; i++) {
          state = calculateLeaguePromotion(state, 75);
        }

        // Promote to DIAMANTE
        for (let i = 0; i < 3; i++) {
          state = calculateLeaguePromotion(state, 75);
        }
        expect(state.division).toBe("DIAMANTE");
      });
    });

    describe("Relegation flow", () => {
      test("increments relegation progress when below threshold", () => {
        const state: LeagueState = { ...baseState, division: "PRATA" };
        const result = calculateLeaguePromotion(state, 25);
        expect(result.relegationProgress).toBe(1);
        expect(result.promotionProgress).toBe(0);
      });

      test("relegates after 3 consecutive games below threshold", () => {
        let state: LeagueState = { ...baseState, division: "OURO" };

        for (let i = 0; i < 3; i++) {
          state = calculateLeaguePromotion(state, 40);
        }
        expect(state.division).toBe("PRATA");
        expect(state.relegationProgress).toBe(0);
        expect(state.protectionGames).toBe(PROTECTION_GAMES);
      });

      test("BRONZE cannot be relegated", () => {
        const state: LeagueState = { ...baseState, division: "BRONZE" };
        const result = calculateLeaguePromotion(state, 0);
        expect(result.division).toBe("BRONZE");
        expect(result.relegationProgress).toBe(0);
      });

      test("resets relegation progress when above threshold", () => {
        const state: LeagueState = {
          ...baseState,
          division: "PRATA",
          relegationProgress: 2,
        };
        const result = calculateLeaguePromotion(state, 35);
        expect(result.relegationProgress).toBe(0);
      });
    });

    describe("Status quo (no progress)", () => {
      test("rating in range resets both counters", () => {
        const state: LeagueState = {
          division: "PRATA",
          promotionProgress: 1,
          relegationProgress: 1,
          protectionGames: 0,
        };
        const result = calculateLeaguePromotion(state, 40);
        expect(result.promotionProgress).toBe(0);
        expect(result.relegationProgress).toBe(0);
        expect(result.division).toBe("PRATA");
      });
    });
  });

  // ==========================================
  // LEAGUE RATING CALCULATION
  // ==========================================

  describe("calculateLeagueRating", () => {
    test("returns 0 for empty games array", () => {
      expect(calculateLeagueRating([])).toBe(0);
    });

    test("returns 0 for null/undefined", () => {
      expect(calculateLeagueRating(null as any)).toBe(0);
      expect(calculateLeagueRating(undefined as any)).toBe(0);
    });

    test("calculates rating for single perfect game", () => {
      const games = [
        { xp_earned: 500, won: true, goal_diff: 3, was_mvp: true },
      ];
      const rating = calculateLeagueRating(games);
      // PPJ: min(500/500, 1) * 100 = 100 * 0.4 = 40
      // WR: 100% * 0.3 = 30
      // GD: min(1, (3+3)/6) * 100 = 100 * 0.2 = 20
      // MVP: min(1/0.5, 1) * 100 = 100 * 0.1 = 10
      expect(rating).toBe(100);
    });

    test("calculates rating for single worst game", () => {
      const games = [
        { xp_earned: 0, won: false, goal_diff: -3, was_mvp: false },
      ];
      const rating = calculateLeagueRating(games);
      // PPJ: 0 * 0.4 = 0
      // WR: 0 * 0.3 = 0
      // GD: max(0, min(1, (-3+3)/6)) * 100 = 0 * 0.2 = 0
      // MVP: 0 * 0.1 = 0
      expect(rating).toBe(0);
    });

    test("calculates average across multiple games", () => {
      const games = [
        { xp_earned: 250, won: true, goal_diff: 2, was_mvp: false },
        { xp_earned: 250, won: false, goal_diff: -2, was_mvp: false },
      ];
      const rating = calculateLeagueRating(games);
      // PPJ: (250/500) * 100 = 50 * 0.4 = 20
      // WR: 50% = 50 * 0.3 = 15
      // GD: avg=0, (0+3)/6 = 0.5 * 100 = 50 * 0.2 = 10
      // MVP: 0 * 0.1 = 0
      expect(rating).toBeCloseTo(45, 0);
    });

    test("rating is always between 0 and 100", () => {
      const extremeGames = [
        { xp_earned: 99999, won: true, goal_diff: 999, was_mvp: true },
      ];
      const rating = calculateLeagueRating(extremeGames);
      expect(rating).toBeLessThanOrEqual(100);
      expect(rating).toBeGreaterThanOrEqual(0);
    });

    test("handles missing fields gracefully", () => {
      const games = [{ }];
      const rating = calculateLeagueRating(games);
      expect(rating).toBeGreaterThanOrEqual(0);
      expect(rating).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================
  // DIVISION FOR RATING
  // ==========================================

  describe("getDivisionForRating", () => {
    test("0 rating is BRONZE", () => {
      expect(getDivisionForRating(0)).toBe("BRONZE");
    });

    test("29 rating is BRONZE", () => {
      expect(getDivisionForRating(29)).toBe("BRONZE");
    });

    test("30 rating is PRATA", () => {
      expect(getDivisionForRating(30)).toBe("PRATA");
    });

    test("49 rating is PRATA", () => {
      expect(getDivisionForRating(49)).toBe("PRATA");
    });

    test("50 rating is OURO", () => {
      expect(getDivisionForRating(50)).toBe("OURO");
    });

    test("69 rating is OURO", () => {
      expect(getDivisionForRating(69)).toBe("OURO");
    });

    test("70 rating is DIAMANTE", () => {
      expect(getDivisionForRating(70)).toBe("DIAMANTE");
    });

    test("100 rating is DIAMANTE", () => {
      expect(getDivisionForRating(100)).toBe("DIAMANTE");
    });
  });
});
