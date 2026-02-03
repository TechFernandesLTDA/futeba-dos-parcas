/**
 * Testes das funcoes auxiliares de notificacoes
 * Testa funcoes puras (sem dependencia do Firebase)
 */

import { NotificationType, STREAK_MILESTONES } from "../src/notifications";

describe("Notifications Helpers", () => {
  // ==========================================
  // NOTIFICATION TYPES
  // ==========================================

  describe("NotificationType enum", () => {
    test("GAME_INVITE exists", () => {
      expect(NotificationType.GAME_INVITE).toBe("GAME_INVITE");
    });

    test("GAME_CONFIRMED exists", () => {
      expect(NotificationType.GAME_CONFIRMED).toBe("GAME_CONFIRMED");
    });

    test("GAME_CANCELLED exists", () => {
      expect(NotificationType.GAME_CANCELLED).toBe("GAME_CANCELLED");
    });

    test("GAME_SUMMON exists", () => {
      expect(NotificationType.GAME_SUMMON).toBe("GAME_SUMMON");
    });

    test("GAME_REMINDER exists", () => {
      expect(NotificationType.GAME_REMINDER).toBe("GAME_REMINDER");
    });

    test("GAME_UPDATED exists", () => {
      expect(NotificationType.GAME_UPDATED).toBe("GAME_UPDATED");
    });

    test("GAME_VACANCY exists", () => {
      expect(NotificationType.GAME_VACANCY).toBe("GAME_VACANCY");
    });

    test("GROUP_INVITE exists", () => {
      expect(NotificationType.GROUP_INVITE).toBe("GROUP_INVITE");
    });

    test("GROUP_INVITE_ACCEPTED exists", () => {
      expect(NotificationType.GROUP_INVITE_ACCEPTED).toBe("GROUP_INVITE_ACCEPTED");
    });

    test("GROUP_INVITE_DECLINED exists", () => {
      expect(NotificationType.GROUP_INVITE_DECLINED).toBe("GROUP_INVITE_DECLINED");
    });

    test("MEMBER_JOINED exists", () => {
      expect(NotificationType.MEMBER_JOINED).toBe("MEMBER_JOINED");
    });

    test("MEMBER_LEFT exists", () => {
      expect(NotificationType.MEMBER_LEFT).toBe("MEMBER_LEFT");
    });

    test("CASHBOX_ENTRY exists", () => {
      expect(NotificationType.CASHBOX_ENTRY).toBe("CASHBOX_ENTRY");
    });

    test("CASHBOX_EXIT exists", () => {
      expect(NotificationType.CASHBOX_EXIT).toBe("CASHBOX_EXIT");
    });

    test("ACHIEVEMENT exists", () => {
      expect(NotificationType.ACHIEVEMENT).toBe("ACHIEVEMENT");
    });

    test("LEVEL_UP exists", () => {
      expect(NotificationType.LEVEL_UP).toBe("LEVEL_UP");
    });

    test("RANKING_CHANGED exists", () => {
      expect(NotificationType.RANKING_CHANGED).toBe("RANKING_CHANGED");
    });

    test("MVP_RECEIVED exists", () => {
      expect(NotificationType.MVP_RECEIVED).toBe("MVP_RECEIVED");
    });
  });

  // ==========================================
  // STREAK MILESTONES
  // ==========================================

  describe("STREAK_MILESTONES", () => {
    test("has 4 milestones", () => {
      expect(STREAK_MILESTONES).toHaveLength(4);
    });

    test("milestones are in descending order", () => {
      for (let i = 0; i < STREAK_MILESTONES.length - 1; i++) {
        expect(STREAK_MILESTONES[i].streak).toBeGreaterThan(
          STREAK_MILESTONES[i + 1].streak
        );
      }
    });

    test("highest milestone is 30 games", () => {
      expect(STREAK_MILESTONES[0].streak).toBe(30);
    });

    test("lowest milestone is 3 games", () => {
      expect(STREAK_MILESTONES[STREAK_MILESTONES.length - 1].streak).toBe(3);
    });

    test("all milestones have title and body", () => {
      STREAK_MILESTONES.forEach((m) => {
        expect(m.title).toBeTruthy();
        expect(m.body).toBeTruthy();
        expect(typeof m.title).toBe("string");
        expect(typeof m.body).toBe("string");
      });
    });

    test("milestone 3 is the starting milestone", () => {
      const m3 = STREAK_MILESTONES.find((m) => m.streak === 3);
      expect(m3).toBeDefined();
      expect(m3!.title).toContain("Iniciada");
    });

    test("milestone 7 exists", () => {
      const m7 = STREAK_MILESTONES.find((m) => m.streak === 7);
      expect(m7).toBeDefined();
    });

    test("milestone 10 exists", () => {
      const m10 = STREAK_MILESTONES.find((m) => m.streak === 10);
      expect(m10).toBeDefined();
    });

    test("milestone 30 is the epic one", () => {
      const m30 = STREAK_MILESTONES.find((m) => m.streak === 30);
      expect(m30).toBeDefined();
      expect(m30!.title).toContain("Epica");
    });

    test("finding milestone for exact streak value works", () => {
      const milestone = STREAK_MILESTONES.find((m) => 10 === m.streak);
      expect(milestone).toBeDefined();
      expect(milestone!.streak).toBe(10);
    });

    test("finding milestone for non-milestone value returns undefined", () => {
      const milestone = STREAK_MILESTONES.find((m) => 5 === m.streak);
      expect(milestone).toBeUndefined();
    });
  });
});
