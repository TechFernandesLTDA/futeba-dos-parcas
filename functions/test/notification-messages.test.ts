import {
  GAMIFICATION_NUDGES,
  getNotificationBody,
  getNotificationTitle,
} from "../src/notifications/notification-messages";

describe("notification-messages gamification nudges", () => {
  it("formats streak-at-risk with provided streak", () => {
    expect(getNotificationTitle(
      GAMIFICATION_NUDGES.STREAK_AT_RISK,
    )).toBe("Sua sequência está em risco 🔥");
    expect(getNotificationBody(
      GAMIFICATION_NUDGES.STREAK_AT_RISK,
      "pt-BR",
      {streak: "9"},
    )).toBe(
      "Sua sequência de 9 jogos pode acabar " +
      "se você não confirmar a próxima pelada a tempo.",
    );
  });

  it("formats almost-level with fallbacks", () => {
    expect(getNotificationBody(
      GAMIFICATION_NUDGES.ALMOST_LEVEL,
      "pt-BR",
      {xpLeft: "120", levelName: "Lenda"},
    )).toBe("Faltam 120 XP para alcançar Lenda.");

    expect(getNotificationBody(
      GAMIFICATION_NUDGES.ALMOST_LEVEL,
      "pt-BR",
    )).toBe("Faltam 0 XP para alcançar o próximo nível.");
  });

  it("formats almost-badge with provided params and defaults", () => {
    expect(getNotificationBody(
      GAMIFICATION_NUDGES.ALMOST_BADGE,
      "pt-BR",
      {remaining: "2", unit: "vitórias", badgeName: "Imbatível"},
    )).toBe("Faltam 2 vitórias para desbloquear Imbatível.");

    expect(getNotificationBody(
      GAMIFICATION_NUDGES.ALMOST_BADGE,
      "pt-BR",
    )).toBe("Faltam 0 ações para desbloquear sua próxima badge.");
  });
});
