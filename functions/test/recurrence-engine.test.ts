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
  fetchActiveRecurringMemberInvites,
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

describe("fetchActiveRecurringMemberInvites", () => {
  it("pagina membros e retorna apenas convites ativos elegíveis", async () => {
    const page1Docs = Array.from(
      {length: 100},
      (_, index) => ({
        id: index === 0 ? "owner1" : `member-page1-${index}`,
        data: () => ({
          status: index === 1 ? "ACTIVE" : "INACTIVE",
          display_name: index === 0 ? "Owner" : `Membro ${index}`,
        }),
      })
    );
    const page2Docs = [
      {
        id: "member2",
        data: () => ({status: "INACTIVE", display_name: "Bia"}),
      },
      {
        id: "member3",
        data: () => ({status: "ACTIVE", name: "Duda"}),
      },
    ];

    const get = jest.fn()
      .mockResolvedValueOnce({
        empty: false,
        size: page1Docs.length,
        docs: page1Docs,
      })
      .mockResolvedValueOnce({
        empty: false,
        size: page2Docs.length,
        docs: page2Docs,
      })
      .mockResolvedValueOnce({
        empty: true,
        size: 0,
        docs: [],
      });

    const query: any = {
      limit: jest.fn(() => query),
      startAfter: jest.fn(() => query),
      get,
    };
    const fakeDb: any = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => query),
        })),
      })),
    };

    const invites = await fetchActiveRecurringMemberInvites(
      fakeDb,
      "group1",
      "owner1"
    );

    expect(invites).toEqual([
      {memberId: "member-page1-1", userName: "Membro 1"},
      {memberId: "member3", userName: "Duda"},
    ]);
    expect(query.limit).toHaveBeenCalledTimes(2);
    expect(query.startAfter).toHaveBeenCalledTimes(1);
    expect(query.startAfter).toHaveBeenCalledWith(page1Docs[page1Docs.length - 1]);
  });
});
