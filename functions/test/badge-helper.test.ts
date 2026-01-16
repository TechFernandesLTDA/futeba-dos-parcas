/**
 * Testes unitarios para badge-helper.ts
 * Cobre toda a logica de concessao de badges.
 */
import {
    getStreakBadges,
    getGoalsBadges,
    getAssistsBadges,
    getBalancedPlayerBadge,
    getMvpBadges,
    getVeteranBadges,
    getLevelBadges,
    getGoalkeeperBadges,
    getWinnerBadges,
    calculateMvpStreak,
    getAllBadgesToAward,
    BadgeContext
} from "../src/badges/badge-helper";

describe("Badge Helper", () => {

    // ==================== STREAK BADGES ====================

    describe("getStreakBadges", () => {
        it("should return streak_30 for 30+ games streak", () => {
            expect(getStreakBadges(30)).toEqual(["streak_30"]);
            expect(getStreakBadges(50)).toEqual(["streak_30"]);
        });

        it("should return iron_man for 10-29 games streak", () => {
            expect(getStreakBadges(10)).toEqual(["iron_man"]);
            expect(getStreakBadges(15)).toEqual(["iron_man"]);
            expect(getStreakBadges(29)).toEqual(["iron_man"]);
        });

        it("should return streak_7 for 7-9 games streak", () => {
            expect(getStreakBadges(7)).toEqual(["streak_7"]);
            expect(getStreakBadges(8)).toEqual(["streak_7"]);
            expect(getStreakBadges(9)).toEqual(["streak_7"]);
        });

        it("should return empty for streak < 7", () => {
            expect(getStreakBadges(0)).toEqual([]);
            expect(getStreakBadges(6)).toEqual([]);
        });
    });

    // ==================== GOALS BADGES ====================

    describe("getGoalsBadges", () => {
        it("should return all goal badges for 5+ goals (manita)", () => {
            const badges = getGoalsBadges(5);
            expect(badges).toContain("hat_trick");
            expect(badges).toContain("poker");
            expect(badges).toContain("manita");
            expect(badges.length).toBe(3);
        });

        it("should return hat_trick and poker for 4 goals", () => {
            const badges = getGoalsBadges(4);
            expect(badges).toContain("hat_trick");
            expect(badges).toContain("poker");
            expect(badges).not.toContain("manita");
            expect(badges.length).toBe(2);
        });

        it("should return only hat_trick for 3 goals", () => {
            expect(getGoalsBadges(3)).toEqual(["hat_trick"]);
        });

        it("should return empty for less than 3 goals", () => {
            expect(getGoalsBadges(0)).toEqual([]);
            expect(getGoalsBadges(2)).toEqual([]);
        });
    });

    // ==================== ASSISTS BADGES ====================

    describe("getAssistsBadges", () => {
        it("should return playmaker for 3+ assists", () => {
            expect(getAssistsBadges(3)).toEqual(["playmaker"]);
            expect(getAssistsBadges(5)).toEqual(["playmaker"]);
        });

        it("should return empty for less than 3 assists", () => {
            expect(getAssistsBadges(0)).toEqual([]);
            expect(getAssistsBadges(2)).toEqual([]);
        });
    });

    // ==================== BALANCED PLAYER BADGE ====================

    describe("getBalancedPlayerBadge", () => {
        it("should return balanced_player for 2+ goals AND 2+ assists", () => {
            expect(getBalancedPlayerBadge(2, 2)).toEqual(["balanced_player"]);
            expect(getBalancedPlayerBadge(3, 3)).toEqual(["balanced_player"]);
        });

        it("should return empty if goals < 2", () => {
            expect(getBalancedPlayerBadge(1, 3)).toEqual([]);
        });

        it("should return empty if assists < 2", () => {
            expect(getBalancedPlayerBadge(3, 1)).toEqual([]);
        });
    });

    // ==================== MVP BADGES ====================

    describe("getMvpBadges", () => {
        it("should return mvp_streak_3 for exactly 3 consecutive MVP games", () => {
            expect(getMvpBadges(true, 3)).toEqual(["mvp_streak_3"]);
        });

        it("should return empty if not MVP", () => {
            expect(getMvpBadges(false, 3)).toEqual([]);
        });

        it("should return empty if MVP streak is not 3", () => {
            expect(getMvpBadges(true, 1)).toEqual([]);
            expect(getMvpBadges(true, 2)).toEqual([]);
            expect(getMvpBadges(true, 4)).toEqual([]);
        });
    });

    describe("calculateMvpStreak", () => {
        it("should increment streak when MVP", () => {
            expect(calculateMvpStreak(0, true)).toBe(1);
            expect(calculateMvpStreak(2, true)).toBe(3);
            expect(calculateMvpStreak(10, true)).toBe(11);
        });

        it("should reset streak to 0 when not MVP", () => {
            expect(calculateMvpStreak(5, false)).toBe(0);
            expect(calculateMvpStreak(0, false)).toBe(0);
        });
    });

    // ==================== VETERAN BADGES ====================

    describe("getVeteranBadges", () => {
        it("should return veteran_100 for exactly 100 games", () => {
            expect(getVeteranBadges(100)).toEqual(["veteran_100"]);
        });

        it("should return veteran_50 for exactly 50 games", () => {
            expect(getVeteranBadges(50)).toEqual(["veteran_50"]);
        });

        it("should return empty for non-milestone values", () => {
            expect(getVeteranBadges(49)).toEqual([]);
            expect(getVeteranBadges(51)).toEqual([]);
            expect(getVeteranBadges(99)).toEqual([]);
            expect(getVeteranBadges(101)).toEqual([]);
        });
    });

    // ==================== LEVEL BADGES ====================

    describe("getLevelBadges", () => {
        it("should return level_10 and level_5 for level >= 10", () => {
            const badges = getLevelBadges(10);
            expect(badges).toContain("level_10");
            expect(badges).toContain("level_5");
            expect(badges.length).toBe(2);
        });

        it("should return only level_5 for level 5-9", () => {
            expect(getLevelBadges(5)).toEqual(["level_5"]);
            expect(getLevelBadges(9)).toEqual(["level_5"]);
        });

        it("should return empty for level < 5", () => {
            expect(getLevelBadges(0)).toEqual([]);
            expect(getLevelBadges(4)).toEqual([]);
        });
    });

    // ==================== GOALKEEPER BADGES ====================

    describe("getGoalkeeperBadges", () => {
        it("should return clean_sheet for 0 goals against goalkeeper", () => {
            const badges = getGoalkeeperBadges("GOALKEEPER", 3, 0);
            expect(badges).toContain("clean_sheet");
        });

        it("should return clean_sheet and paredao for 0 goals + 5 saves", () => {
            const badges = getGoalkeeperBadges("GOALKEEPER", 5, 0);
            expect(badges).toContain("clean_sheet");
            expect(badges).toContain("paredao");
        });

        it("should return defensive_wall for 10+ saves", () => {
            const badges = getGoalkeeperBadges("GOALKEEPER", 10, 2);
            expect(badges).toContain("defensive_wall");
        });

        it("should return multiple badges for exceptional performance", () => {
            // Clean sheet with 10+ saves
            const badges = getGoalkeeperBadges("GOALKEEPER", 10, 0);
            expect(badges).toContain("clean_sheet");
            expect(badges).toContain("paredao");
            expect(badges).toContain("defensive_wall");
        });

        it("should return empty for non-goalkeeper", () => {
            expect(getGoalkeeperBadges("LINE", 10, 0)).toEqual([]);
            expect(getGoalkeeperBadges("DEFENDER", 10, 0)).toEqual([]);
        });

        it("should return empty if opponent score is undefined", () => {
            const badges = getGoalkeeperBadges("GOALKEEPER", 10, undefined);
            // Only defensive_wall should be returned (saves-based)
            expect(badges).toContain("defensive_wall");
            expect(badges).not.toContain("clean_sheet");
        });
    });

    // ==================== WINNER BADGES ====================

    describe("getWinnerBadges", () => {
        it("should return winner_50 for exactly 50 wins", () => {
            expect(getWinnerBadges("WIN", 50)).toEqual(["winner_50"]);
        });

        it("should return winner_25 for exactly 25 wins", () => {
            expect(getWinnerBadges("WIN", 25)).toEqual(["winner_25"]);
        });

        it("should return empty for non-milestone wins", () => {
            expect(getWinnerBadges("WIN", 24)).toEqual([]);
            expect(getWinnerBadges("WIN", 26)).toEqual([]);
            expect(getWinnerBadges("WIN", 49)).toEqual([]);
        });

        it("should return empty for non-win results", () => {
            expect(getWinnerBadges("DRAW", 50)).toEqual([]);
            expect(getWinnerBadges("LOSS", 50)).toEqual([]);
        });
    });

    // ==================== INTEGRATION TEST ====================

    describe("getAllBadgesToAward", () => {
        it("should return all applicable badges for a complete context", () => {
            const context: BadgeContext = {
                confirmation: {
                    goals: 3,
                    assists: 3,
                    saves: 0,
                    position: "LINE",
                    isMvp: true
                },
                newStats: {
                    totalGames: 50,
                    gamesWon: 25,
                    currentMvpStreak: 3
                },
                streak: 10,
                newMvpStreak: 3,
                newLevel: 5,
                result: "WIN"
            };

            const badges = getAllBadgesToAward(context);

            expect(badges).toContain("iron_man");      // streak >= 10
            expect(badges).toContain("hat_trick");     // goals >= 3
            expect(badges).toContain("playmaker");     // assists >= 3
            expect(badges).toContain("balanced_player"); // goals >= 2 AND assists >= 2
            expect(badges).toContain("mvp_streak_3");  // MVP streak = 3
            expect(badges).toContain("veteran_50");    // totalGames = 50
            expect(badges).toContain("level_5");       // level >= 5
            expect(badges).toContain("winner_25");     // gamesWon = 25
        });

        it("should return goalkeeper badges for goalkeeper", () => {
            const context: BadgeContext = {
                confirmation: {
                    goals: 0,
                    assists: 0,
                    saves: 12,
                    position: "GOALKEEPER"
                },
                newStats: {
                    totalGames: 10,
                    gamesWon: 5,
                    currentMvpStreak: 0
                },
                streak: 3,
                newMvpStreak: 0,
                newLevel: 2,
                result: "WIN",
                opponentScore: 0
            };

            const badges = getAllBadgesToAward(context);

            expect(badges).toContain("clean_sheet");
            expect(badges).toContain("paredao");       // saves >= 5 + clean sheet
            expect(badges).toContain("defensive_wall"); // saves >= 10
        });

        it("should return empty array for basic performance", () => {
            const context: BadgeContext = {
                confirmation: {
                    goals: 0,
                    assists: 0,
                    saves: 0,
                    position: "LINE"
                },
                newStats: {
                    totalGames: 5,
                    gamesWon: 2,
                    currentMvpStreak: 0
                },
                streak: 1,
                newMvpStreak: 0,
                newLevel: 1,
                result: "LOSS"
            };

            const badges = getAllBadgesToAward(context);
            expect(badges).toEqual([]);
        });
    });
});
