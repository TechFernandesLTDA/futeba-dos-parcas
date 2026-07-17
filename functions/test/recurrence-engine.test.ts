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

function hasUndefined(value: unknown): boolean {
  if (value === undefined) return true
  if (!value || typeof value !== "object") return false
  return Object.values(value as Record<string, unknown>).some(hasUndefined)
}

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
    const notificationQueueDoc = jest.fn((id: string) => ({
      id,
      path: `notification_queue/${id}`,
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

        if (name === "notification_queue") {
          return {
            doc: notificationQueueDoc,
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
    const currentGame = {
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
      next_game_created: true,
      next_game_id: "recurring_game-1_2",
      next_game_confirmations_created: false,
      next_game_notification_enqueued: false,
    }
    let childReads = 0
    const txGet = jest.fn((ref: any) => {
      if (ref === afterRef) {
        return Promise.resolve({
          exists: true,
          data: () => currentGame,
          get: (field: string) => (currentGame as any)[field],
        })
      }

      if (ref?.id === "recurring_game-1_2") {
        childReads += 1
        if (childReads === 1) return Promise.resolve({exists: false})
        return Promise.resolve({
          exists: true,
          id: "recurring_game-1_2",
          data: () => ({
            recurrence_parent_id: "game-1",
            recurrence_index: 2,
            owner_id: "owner-1",
            group_id: "group-1",
            status: "SCHEDULED",
          }),
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
          data: () => currentGame,
          ref: afterRef,
        },
      },
      params: {gameId: "game-1"},
    })

    expect(txSet).toHaveBeenCalledTimes(5)
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
      next_game_confirmations_created: false,
      next_game_notification_enqueued: false,
    }))
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({path: "confirmations/recurring_game-1_2_owner-1"}),
      expect.objectContaining({status: "CONFIRMED"})
    )
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({path: "confirmations/recurring_game-1_2_member-1"}),
      expect.objectContaining({status: "PENDING"})
    )
    expect(txUpdate).toHaveBeenCalledWith(afterRef, expect.objectContaining({
      next_game_confirmations_created: true,
    }))
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "notification_queue/recurrence_recurring_game-1_2",
      }),
      expect.objectContaining({
        userIds: ["member-1", "member-2"],
        type: "GAME_INVITE",
        data: expect.objectContaining({gameId: "recurring_game-1_2"}),
      })
    )
    expect(mockSendNotificationToUsers).not.toHaveBeenCalled()
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
    const notificationQueueDoc = jest.fn((id: string) => ({
      id,
      path: `notification_queue/${id}`,
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

        if (name === "notification_queue") {
          return {
            doc: notificationQueueDoc,
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
    const currentGame = {
      status: "FINISHED",
      recurrence: "weekly",
      owner_id: "owner-1",
      owner_name: "Owner",
      group_id: "group-1",
      next_game_created: true,
      next_game_id: "recurring_game-1_2",
      next_game_confirmations_created: false,
      next_game_notification_enqueued: false,
      date: "2026-06-20",
      time: "20:00",
      location_name: "Arena Central",
      visibility: "GROUP",
    }
    const txSet = jest.fn()
    const txUpdate = jest.fn()
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn((ref: any) => {
        if (ref === afterRef) {
          return Promise.resolve({
            exists: true,
            data: () => currentGame,
            get: (field: string) => (currentGame as any)[field],
          })
        }
        if (ref?.id === "recurring_game-1_2") {
          return Promise.resolve({
            exists: true,
            id: "recurring_game-1_2",
            data: () => ({
              recurrence_parent_id: "game-1",
              recurrence_index: 2,
              owner_id: "owner-1",
              group_id: "group-1",
              status: "SCHEDULED",
            }),
          })
        }
        return Promise.resolve({exists: false})
      }),
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
          data: () => currentGame,
          ref: afterRef,
        },
      },
      params: {gameId: "game-1"},
    })

    expect(mockBatchSet).not.toHaveBeenCalled()
    expect(mockBatchCommit).not.toHaveBeenCalled()
    expect(txUpdate).toHaveBeenCalledWith(afterRef, expect.objectContaining({
      next_game_confirmations_created: true,
    }))
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "notification_queue/recurrence_recurring_game-1_2",
      }),
      expect.objectContaining({
        userIds: ["member-1"],
        data: expect.objectContaining({gameId: "recurring_game-1_2"}),
      })
    )
    expect(mockSendNotificationToUsers).not.toHaveBeenCalled()
  })

  it("remove campos undefined ao criar filho de jogo legado", async () => {
    const gamesDoc = jest.fn((id: string) => ({
      id,
      path: `games/${id}`,
    }))
    const notificationQueueDoc = jest.fn((id: string) => ({
      id,
      path: `notification_queue/${id}`,
    }))
    const fakeDb: any = {
      collection: jest.fn((name: string) => {
        if (name === "games") {
          return {
            where: jest.fn(() => ({
              count: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({data: () => ({count: 0})}),
              })),
            })),
            doc: gamesDoc,
          }
        }

        if (name === "confirmations") {
          return {
            doc: jest.fn((id: string) => ({
              id,
              path: `confirmations/${id}`,
            })),
          }
        }

        if (name === "notification_queue") {
          return {
            doc: notificationQueueDoc,
          }
        }

        throw new Error(`Unexpected collection ${name}`)
      }),
      runTransaction: mockRunTransaction,
      batch: mockBatch,
    }

    mockFirestore.mockReturnValue(fakeDb)

    const afterRef = {path: "games/game-legacy"}
    const currentGame = {
      status: "FINISHED",
      recurrence: "weekly",
      owner_id: "owner-legacy",
      owner_name: "Owner",
      date: "2026-06-20",
      time: "20:00",
      next_game_created: true,
      next_game_id: "recurring_game-legacy_2",
      next_game_confirmations_created: false,
      next_game_notification_enqueued: false,
    }
    let childReads = 0
    const txSet = jest.fn()
    const txUpdate = jest.fn()
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn((ref: any) => {
        if (ref === afterRef) {
          return Promise.resolve({
            exists: true,
            data: () => currentGame,
            get: (field: string) => (currentGame as any)[field],
          })
        }

        if (ref?.id === "recurring_game-legacy_2") {
          childReads += 1
          if (childReads === 1) return Promise.resolve({exists: false})
          return Promise.resolve({
            exists: true,
            data: () => ({
              recurrence_parent_id: "game-legacy",
              recurrence_index: 2,
              owner_id: "owner-legacy",
              status: "SCHEDULED",
            }),
          })
        }

        return Promise.resolve({exists: false})
      }),
      set: txSet,
      update: txUpdate,
    }))

    await expect(onGameFinishedCreateRecurrence({
      data: {
        before: {data: () => ({status: "SCHEDULED"})},
        after: {
          data: () => currentGame,
          ref: afterRef,
        },
      },
      params: {gameId: "game-legacy"},
    })).resolves.toBeUndefined()

    const childWrite = txSet.mock.calls.find(
      ([ref]: [{id?: string}]) => ref.id === "recurring_game-legacy_2"
    )
    expect(childWrite).toBeDefined()
    const childPayload = childWrite?.[1]
    expect(childPayload).not.toHaveProperty("visibility")
    expect(childPayload).not.toHaveProperty("location_name")
    expect(childPayload).not.toHaveProperty("location_address")
    expect(childPayload).not.toHaveProperty("field_type")
    expect(hasUndefined(childPayload)).toBe(false)
    expect(txUpdate).toHaveBeenCalledWith(afterRef, expect.objectContaining({
      next_game_confirmations_created: true,
    }))
    expect(txUpdate).toHaveBeenCalledWith(afterRef, expect.objectContaining({
      next_game_notification_enqueued: true,
    }))
  })

  it("não relança erro permanente de invariante para evitar retry infinito", async () => {
    const fakeDb: any = {
      collection: jest.fn((name: string) => {
        if (name === "games") {
          return {
            where: jest.fn(() => ({
              count: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({data: () => ({count: 0})}),
              })),
            })),
            doc: jest.fn((id: string) => ({id, path: `games/${id}`})),
          }
        }
        throw new Error(`Unexpected collection ${name}`)
      }),
      runTransaction: mockRunTransaction,
      batch: mockBatch,
    }
    mockFirestore.mockReturnValue(fakeDb)

    const afterRef = {path: "games/game-bad"}
    const invalidCurrentGame = {
      status: "FINISHED",
      recurrence: "weekly",
      date: "2026-06-20",
    }

    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn((ref: any) => {
        if (ref === afterRef) {
          return Promise.resolve({
            exists: true,
            data: () => invalidCurrentGame,
            get: (field: string) => (invalidCurrentGame as any)[field],
          })
        }
        return Promise.resolve({exists: false})
      }),
      set: jest.fn(),
      update: jest.fn(),
    }))

    await expect(onGameFinishedCreateRecurrence({
      data: {
        before: {data: () => ({status: "SCHEDULED"})},
        after: {
          data: () => invalidCurrentGame,
          ref: afterRef,
        },
      },
      params: {gameId: "game-bad"},
    })).resolves.toBeUndefined()

    expect(
      jest.mocked(require("firebase-functions/v2").logger.error)
    ).toHaveBeenCalled()
    expect(
      jest.mocked(require("firebase-functions/v2").logger.info)
    ).toHaveBeenCalledWith(
      expect.stringContaining("Suppressing retry for non-retryable recurrence error on game-bad")
    )
  })
})
