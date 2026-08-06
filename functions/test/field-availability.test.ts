const mockGet = jest.fn();
const queryChain: Record<string, unknown> = {};
queryChain.where = jest.fn().mockReturnValue(queryChain);
queryChain.select = jest.fn().mockReturnValue(queryChain);
queryChain.orderBy = jest.fn().mockReturnValue(queryChain);
queryChain.limit = jest.fn().mockReturnValue(queryChain);
queryChain.startAfter = jest.fn().mockReturnValue(queryChain);
queryChain.get = mockGet;

const mockCollection = jest.fn().mockReturnValue(queryChain);

jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({collection: mockCollection})),
}));

class MockHttpsError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "HttpsError";
    this.code = code;
  }
}

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: MockHttpsError,
}));

import {
  getFieldAvailability,
  parseFieldAvailabilityRequest,
  projectGameToBusySlot,
} from "../src/games/field-availability";

describe("field availability projection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryChain.where = jest.fn().mockReturnValue(queryChain);
    queryChain.select = jest.fn().mockReturnValue(queryChain);
    queryChain.orderBy = jest.fn().mockReturnValue(queryChain);
    queryChain.limit = jest.fn().mockReturnValue(queryChain);
    queryChain.startAfter = jest.fn().mockReturnValue(queryChain);
    queryChain.get = mockGet;
    mockCollection.mockReturnValue(queryChain);
    mockGet.mockResolvedValue({docs: [], size: 0});
  });

  test("rejeita usuário anônimo antes de consultar jogos", async () => {
    await expect(getFieldAvailability({
      auth: null,
      data: {
        fieldId: "field-1",
        startDate: "2026-07-14",
        endDate: "2026-07-21",
      },
    })).rejects.toMatchObject({code: "unauthenticated"});

    expect(mockCollection).not.toHaveBeenCalled();
  });

  test("valida fieldId, datas reais e janela máxima", () => {
    expect(() => parseFieldAvailabilityRequest({
      fieldId: "fields/escape",
      startDate: "2026-07-14",
      endDate: "2026-07-21",
    })).toThrow(expect.objectContaining({code: "invalid-argument"}));

    expect(() => parseFieldAvailabilityRequest({
      fieldId: "field-1",
      startDate: "2026-02-31",
      endDate: "2026-03-01",
    })).toThrow(expect.objectContaining({code: "invalid-argument"}));

    expect(() => parseFieldAvailabilityRequest({
      fieldId: "field-1",
      startDate: "2026-07-14",
      endDate: "2026-09-14",
    })).toThrow(expect.objectContaining({code: "invalid-argument"}));
  });

  test("projeta somente status bloqueante e ignora soft-delete", () => {
    expect(projectGameToBusySlot({
      date: "2026-07-15",
      time: "19:00",
      end_time: "20:00",
      status: "CONFIRMED",
    })).toEqual({date: "2026-07-15", startMinutes: 1140, endMinutes: 1200});

    expect(projectGameToBusySlot({
      date: "2026-07-15",
      time: "19:00",
      status: "CANCELLED",
    })).toBeNull();

    expect(projectGameToBusySlot({
      date: "2026-07-15",
      time: "19:00",
      status: "SCHEDULED",
      deleted_at: {seconds: 1},
    })).toBeNull();
  });

  test("retorna PUBLIC e GROUP_ONLY como slots indistinguíveis e sem metadados", async () => {
    mockGet.mockResolvedValue({
      docs: [
        {data: () => ({
          date: "2026-07-15",
          time: "19:00",
          end_time: "20:00",
          status: "SCHEDULED",
          visibility: "PUBLIC_OPEN",
          title: "Jogo público",
          owner_id: "owner-public",
        })},
        {data: () => ({
          date: "2026-07-15",
          time: "20:00",
          end_time: "21:00",
          status: "CONFIRMED",
          visibility: "GROUP_ONLY",
          title: "Treino secreto",
          group_id: "private-group",
          owner_id: "owner-private",
        })},
        {data: () => ({
          date: "2026-07-16",
          time: "19:00",
          status: "SCHEDULED",
          deletedAt: {seconds: 1},
        })},
      ],
      size: 3,
    });

    const result = await getFieldAvailability({
      auth: {uid: "player-1", token: {}},
      data: {
        fieldId: "field-1",
        startDate: "2026-07-14",
        endDate: "2026-07-21",
      },
    });

    expect(result).toEqual({
      slots: [
        {date: "2026-07-15", startMinutes: 1140, endMinutes: 1200},
        {date: "2026-07-15", startMinutes: 1200, endMinutes: 1260},
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /visibility|title|group|owner|gameId|private-group|Treino secreto/
    );
    expect(mockCollection).toHaveBeenCalledWith("games");
    expect(queryChain.where).toHaveBeenCalledWith("field_id", "==", "field-1");
    expect(queryChain.where).toHaveBeenCalledWith("date", ">=", "2026-07-14");
    expect(queryChain.where).toHaveBeenCalledWith("date", "<=", "2026-07-21");
    expect(queryChain.select).toHaveBeenCalledWith(
      "date",
      "time",
      "end_time",
      "status",
      "deleted_at",
      "deletedAt"
    );
  });

  test("normaliza duração padrão e jogo que cruza meia-noite", () => {
    expect(projectGameToBusySlot({
      date: "2026-07-15",
      time: "19:00",
      status: "LIVE",
    })).toEqual({date: "2026-07-15", startMinutes: 1140, endMinutes: 1200});

    expect(projectGameToBusySlot({
      date: "2026-07-15",
      time: "23:30",
      end_time: "00:30",
      status: "SCHEDULED",
    })).toEqual({date: "2026-07-15", startMinutes: 1410, endMinutes: 1470});
  });
});
