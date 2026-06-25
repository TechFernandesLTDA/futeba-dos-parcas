jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(),
}));

jest.mock("../src/notifications/helpers", () => ({
  sendNotificationToUsers: jest.fn(),
  NotificationType: {
    GAME_INVITE: "GAME_INVITE",
  },
}));

import {
  chunkArray,
  toActiveRecurringMemberInvite,
} from "../src/games/recurrence-engine";

describe("toActiveRecurringMemberInvite", () => {
  it("ignora o organizador", () => {
    expect(toActiveRecurringMemberInvite(
      "owner1",
      {status: "ACTIVE", display_name: "Owner"},
      "owner1"
    )).toBeNull();
  });

  it("ignora membros que nao estao ACTIVE", () => {
    for (const status of ["INACTIVE", "REMOVED", "BANNED", "PENDING", undefined]) {
      expect(toActiveRecurringMemberInvite(
        `member-${status}`,
        {status, display_name: "Membro"},
        "owner1"
      )).toBeNull();
    }
  });

  it("normaliza convite de membro ativo", () => {
    expect(toActiveRecurringMemberInvite(
      "member1",
      {status: "ACTIVE", display_name: "Caio"},
      "owner1"
    )).toEqual({
      memberId: "member1",
      userName: "Caio",
    });
  });

  it("usa fallback de nome para membro ativo", () => {
    expect(toActiveRecurringMemberInvite(
      "member1",
      {status: "ACTIVE"},
      "owner1"
    )).toEqual({
      memberId: "member1",
      userName: "Membro",
    });
  });
});

describe("chunkArray", () => {
  it("divide lista em blocos do tamanho informado", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("mantem lista vazia como lista de blocos vazia", () => {
    expect(chunkArray([], 2)).toEqual([]);
  });
});
