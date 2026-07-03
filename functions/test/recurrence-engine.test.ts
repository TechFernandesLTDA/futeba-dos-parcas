const mockSendNotificationToUsers = jest.fn()
const mockFirestore = jest.fn()
const mockRunTransaction = jest.fn()
const mockBatchSet = jest.fn()
const mockBatchCommit = jest.fn().mockResolvedValue(undefined)
const mockBatch = jest.fn(() => ({
  set: mockBatchSet,
  commit: mockBatchCommit,
}))

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((_config: unknown, handler: unknown) => handler),
}))

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock("firebase-admin", () => ({
  firestore: mockFirestore,
}))

jest.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
    })),
  },
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
}))

jest.mock("../src/notifications/helpers", () => ({
  sendNotificationToUsers: mockSendNotificationToUsers,
  NotificationType: {
    GAME_INVITE: "GAME_INVITE",
  },
}))

import {
  chunkArray,
  fetchActiveRecurringMemberInvites,
  onGameFinishedCreateRecurrence,
  toActiveRecurringMemberInvite,
} from "../src/games/recurrence-engine"

describe("toActiveRecurringMemberInvite", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("ignora o organizador", () => {
    expect(toActiveRecurringMemberInvite(
      "owner1",
      {status: "ACTIVE", display_name: "Owner"},
      "owner1"
    )).toBeNull()
  })

  it("ignora membros que nao estao ACTIVE", () => {
    for (const status of ["INACTIVE", "REMOVED", "BANNED", "PENDING", undefined]) {
      expect(toActiveRecurringMemberInvite(
        `member-${status}`,
        {status, display_name: "Membro"},
        "owner1"
      )).toBeNull()
    }
  })

  it("normaliza convite de membro ativo", () => {
    expect(toActiveRecurringMemberInvite(
      "member1",
      {status: "ACTIVE", display_name: "Caio"},
      "owner1"
    )).toEqual({
      memberId: "member1",
      userName: "Caio",
    })
  })

  it("usa fallback de nome para membro ativo", () => {
    expect(toActiveRecurringMemberInvite(
      "member1",
      {status: "ACTIVE"},
      "owner1"
    )).toEqual({
      memberId: "member1",
      userName: "Membro",
    })
  })
})

describe("chunkArray", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("divide lista em blocos do tamanho informado", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it("mantem lista vazia como lista de blocos vazia", () => {
    expect(chunkArray([], 2)).toEqual([])
  })
})

describe("fetchActiveRecurringMemberInvites", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("retorna vazio quando a primeira pagina ja vem vazia", async () => {
    const query: any = {
      limit: jest.fn(() => query),
      startAfter: jest.fn(() => query),
      get: jest.fn().mockResolvedValue({
        empty: true,
        size: 0,
        docs: [],
      }),
    }
    const fakeDb: any = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => query),
        })),
      })),
    }

    await expect(
      fetchActiveRecurringMemberInvites(fakeDb, "group1", "owner1")
    ).resolves.toEqual([])

    expect(query.startAfter).not.toHaveBeenCalled()
  })

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
    )
    const page2Docs = [
      {
        id: "member2",
        data: () => ({status: "INACTIVE", display_name: "Bia"}),
      },
      {
        id: "member3",
        data: () => ({status: "ACTIVE", name: "Duda"}),
      },
    ]

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

    const query: any = {
      limit: jest.fn(() => query),
      startAfter: jest.fn(() => query),
      get,
    }
    const fakeDb: any = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => query),
        })),
      })),
    }

    const invites = await fetchActiveRecurringMemberInvites(
      fakeDb,
      "group1",
      "owner1"
    )

    expect(invites).toEqual([
      {memberId: "member-page1-1", userName: "Membro 1"},
      {memberId: "member3", userName: "Duda"},
    ])
    expect(query.limit).toHaveBeenCalledTimes(2)
    expect(query.startAfter).toHaveBeenCalledTimes(1)
    expect(query.startAfter).toHaveBeenCalledWith(page1Docs[page1Docs.length - 1])
  })
})

describe("onGameFinishedCreateRecurrence", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("auto-invita membros ativos do grupo e envia notificacao", async () => {
    const memberDocs = [
      {
        id: "member-1",
        data: () => ({status: "ACTIVE", display_name: "Bia"}),
      },
      {
        id: "member-2",
        data: () => ({status: "ACTIVE", name: "Duda"}),
      },
    ]

    const membersQueryGet = jest.fn().mockResolvedValue({
      empty: false,
      size: memberDocs.length,
      docs: memberDocs,
    })
    const membersQuery: any = {
      limit: jest.fn(() => membersQuery),
      startAfter: jest.fn(() => membersQuery),
      get: membersQueryGet,
    }

    const gamesCountGet = jest.fn().mockResolvedValue({
      data: () => ({count: 0}),
    })
    const gamesWhereChain: any = {
      count: jest.fn(() => ({
        get: gamesCountGet,
      })),
    }

    const gamesDoc = jest.fn((id: string) => ({
      id,
      path: `games/${id}`,
    }))
    const confirmationsDoc = jest.fn((id: string) => ({
      id,
      path: `confirmations/${id}`,
    }))

    const fakeDb: any = {
      collection: jest.fn((name: string) => {
        if (name === "groups") {
          return {
            doc: jest.fn(() => ({
              collection: jest.fn(() => membersQuery),
            })),
          }
        }

        if (name === "games") {
          return {
            where: jest.fn(() => gamesWhereChain),
            doc: gamesDoc,
          }
        }

        if (name === "confirmations") {
          return {
            doc: confirmationsDoc,
          }
        }

        throw new Error(`Unexpected collection ${name}`)
      }),
      runTransaction: mockRunTransaction,
      batch: mockBatch,
    }

    mockFirestore.mockReturnValue(fakeDb)

    const afterRef = {
      path: "games/game-1",
      update: jest.fn().mockResolvedValue(undefined),
    }
    const txGet = jest.fn((ref: any) => {
      if (ref === afterRef) {
        return Promise.resolve({
          get: (field: string) => field === "next_game_created" ? false : undefined,
        })
      }

      if (ref?.id === "recurring_game-1_2") {
        return Promise.resolve({
          exists: false,
        })
      }

      return Promise.resolve({exists: false})
    })

    const txSet = jest.fn()
    const txUpdate = jest.fn()

    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: txGet,
      set: txSet,
      update: txUpdate,
    }))

    await onGameFinishedCreateRecurrence({
      data: {
        before: {
          data: () => ({
            status: "SCHEDULED",
          }),
        },
        after: {
          data: () => ({
            status: "FINISHED",
            recurrence: "weekly",
            owner_id: "owner-1",
            owner_name: "Owner",
            group_id: "group-1",
            date: "2026-06-20",
            time: "20:00",
            field_type: "SOCIETY",
            game_type: "CASUAL",
            max_players: 14,
            max_goalkeepers: 2,
            number_of_teams: 2,
            daily_price: 0,
            total_cost: 0,
            location_name: "Arena Central",
            location_address: "Rua A",
            location_lat: -23.5505,
            location_lng: -46.6333,
            location_lat_approx: -23.551,
            location_lng_approx: -46.633,
            visibility: "GROUP",
          }),
          ref: afterRef,
        },
      },
      params: {gameId: "game-1"},
    })

    expect(txSet).toHaveBeenCalledTimes(1)
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({id: "recurring_game-1_2"}),
      expect.objectContaining({
        location_lat: -23.5505,
        location_lng: -46.6333,
        location_lat_approx: -23.551,
        location_lng_approx: -46.633,
      })
    )
    expect(txUpdate).toHaveBeenCalledWith(afterRef, expect.objectContaining({
      next_game_created: true,
      next_game_id: "recurring_game-1_2",
      next_game_confirmations_created: false,
    }))
    expect(mockBatchSet).toHaveBeenCalledTimes(3)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    expect(afterRef.update).toHaveBeenCalledWith(expect.objectContaining({
      next_game_confirmations_created: true,
    }))
    expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
      ["member-1", "member-2"],
      expect.objectContaining({
        type: "GAME_INVITE",
        data: {gameId: "recurring_game-1_2"},
      }),
      "group-1"
    )
  })

  it("retoma confirmações pendentes quando o próximo jogo já existe", async () => {
    const memberDocs = [
      {
        id: "member-1",
        data: () => ({status: "ACTIVE", display_name: "Bia"}),
      },
    ]

    const membersQueryGet = jest.fn().mockResolvedValue({
      empty: false,
      size: memberDocs.length,
      docs: memberDocs,
    })
    const membersQuery: any = {
      limit: jest.fn(() => membersQuery),
      startAfter: jest.fn(() => membersQuery),
      get: membersQueryGet,
    }

    const gamesCountGet = jest.fn().mockResolvedValue({
      data: () => ({count: 1}),
    })
    const gamesWhereChain: any = {
      count: jest.fn(() => ({
        get: gamesCountGet,
      })),
    }

    const gamesDoc = jest.fn((id: string) => ({
      id,
      path: `games/${id}`,
    }))
    const confirmationsDoc = jest.fn((id: string) => ({
      id,
      path: `confirmations/${id}`,
    }))

    const fakeDb: any = {
      collection: jest.fn((name: string) => {
        if (name === "groups") {
          return {
            doc: jest.fn(() => ({
              collection: jest.fn(() => membersQuery),
            })),
          }
        }

        if (name === "games") {
          return {
            where: jest.fn(() => gamesWhereChain),
            doc: gamesDoc,
          }
        }

        if (name === "confirmations") {
          return {
            doc: confirmationsDoc,
          }
        }

        throw new Error(`Unexpected collection ${name}`)
      }),
      runTransaction: mockRunTransaction,
      batch: mockBatch,
    }

    mockFirestore.mockReturnValue(fakeDb)

    const afterRef = {
      path: "games/game-1",
      update: jest.fn().mockResolvedValue(undefined),
    }

    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn((ref: any) => {
        if (ref === afterRef) {
          return Promise.resolve({
            get: (field: string) => {
              if (field === "next_game_created") return true
              if (field === "next_game_id") return "recurring_game-1_2"
              if (field === "next_game_confirmations_created") return false
              return undefined
            },
          })
        }

        return Promise.resolve({exists: true})
      }),
      set: jest.fn(),
      update: jest.fn(),
    }))

    await onGameFinishedCreateRecurrence({
      data: {
        before: {
          data: () => ({
            status: "SCHEDULED",
          }),
        },
        after: {
          data: () => ({
            status: "FINISHED",
            recurrence: "weekly",
            owner_id: "owner-1",
            owner_name: "Owner",
            group_id: "group-1",
            next_game_created: true,
            next_game_id: "recurring_game-1_2",
            next_game_confirmations_created: false,
            date: "2026-06-20",
            time: "20:00",
            location_name: "Arena Central",
            visibility: "GROUP",
          }),
          ref: afterRef,
        },
      },
      params: {gameId: "game-1"},
    })

    expect(mockBatchSet).toHaveBeenCalledTimes(2)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    expect(afterRef.update).toHaveBeenCalledWith(expect.objectContaining({
      next_game_confirmations_created: true,
    }))
    expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
      ["member-1"],
      expect.objectContaining({
        data: {gameId: "recurring_game-1_2"},
      }),
      "group-1"
    )
  })
})
