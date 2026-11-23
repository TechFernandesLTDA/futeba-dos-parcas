import {
  isRawParticipationEligible,
  rawParticipationIneligibility,
} from "../src/game/helpers";

// #4629 item 11: o motivo bate com a regra de elegibilidade.
describe("rawParticipationIneligibility", () => {
  const cases: Array<[string, Record<string, unknown> | undefined, string | null]> = [
    ["sem confirmação", undefined, "NOT_CONFIRMED"],
    ["lista de espera", {status: "WAITLISTED"}, "NOT_CONFIRMED"],
    ["confirmado legado, sem sinal de presença", {status: "CONFIRMED"}, null],
    ["confirmado com check-in", {status: "CONFIRMED", checked_in: true}, null],
    ["confirmado marcado presente", {status: "CONFIRMED", was_present: true}, null],
    ["confirmado sem presença", {status: "CONFIRMED", checked_in: false}, "NO_PRESENCE"],
    [
      "antifraude vence presença",
      {status: "CONFIRMED", checked_in: true, suspicious_overlap: true},
      "SUSPICIOUS_OVERLAP",
    ],
  ];

  it.each(cases)("%s", (_label, raw, expected) => {
    expect(rawParticipationIneligibility(raw)).toBe(expected);
    expect(isRawParticipationEligible(raw)).toBe(expected === null);
  });
});
