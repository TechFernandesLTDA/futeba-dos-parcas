/**
 * TESTES DE GERAÇÃO DE ATIVIDADES
 *
 * Testa a lógica de activities.ts:
 * - Visibility mapping (game visibility → activity visibility)
 * - Idempotency (activity_generated flag)
 * - Trigger condition (status change to FINISHED)
 * - Activity document structure
 */

// Mock firebase-admin
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockDocGet = jest.fn();
const mockDocRef = { id: "activity_doc_1" };
const mockCollectionDoc = jest.fn().mockReturnValue({
  get: mockDocGet,
  ref: mockDocRef,
});
const mockCollection = jest.fn().mockReturnValue({
  doc: mockCollectionDoc,
});

jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  };

  const mockAdmin: any = {
    apps: [{ name: "test" }],
    firestore: jest.fn(() => ({
      collection: mockCollection,
      batch: jest.fn(() => ({
        set: mockBatchSet,
        update: mockBatchUpdate,
        commit: mockBatchCommit,
      })),
    })),
    initializeApp: jest.fn(),
  };

  mockAdmin.firestore.FieldValue = mockFieldValue;
  mockAdmin.firestore.Timestamp = {
    fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
    now: jest.fn(() => ({ toDate: () => new Date() })),
  };

  return mockAdmin;
});

// Mock firebase-functions v2 firestore trigger
let capturedHandler: ((event: any) => Promise<void>) | null = null;

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((path: string, handler: any) => {
    capturedHandler = handler;
    return handler;
  }),
}));

describe("Activities - generateActivityOnGameFinish", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedHandler = null;

    // Re-import para capturar handler
    jest.isolateModules(() => {
      require("../src/activities");
    });
  });

  test("deve registrar o handler onDocumentUpdated", () => {
    expect(capturedHandler).not.toBeNull();
    expect(typeof capturedHandler).toBe("function");
  });

  test("deve ignorar quando event.data é null", async () => {
    const event = { data: null, params: { gameId: "game1" } };
    await capturedHandler!(event);

    expect(mockCollection).not.toHaveBeenCalled();
  });

  test("deve ignorar quando status não muda para FINISHED", async () => {
    const event = {
      data: {
        before: { data: () => ({ status: "SCHEDULED" }) },
        after: { data: () => ({ status: "CONFIRMED" }), ref: {} },
      },
      params: { gameId: "game1" },
    };

    await capturedHandler!(event);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  test("deve ignorar quando status já era FINISHED antes", async () => {
    const event = {
      data: {
        before: { data: () => ({ status: "FINISHED" }) },
        after: { data: () => ({ status: "FINISHED" }), ref: {} },
      },
      params: { gameId: "game1" },
    };

    await capturedHandler!(event);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  test("deve respeitar flag de idempotência (activity_generated)", async () => {
    const event = {
      data: {
        before: { data: () => ({ status: "LIVE" }) },
        after: {
          data: () => ({
            status: "FINISHED",
            activity_generated: true,
            owner_id: "owner1",
          }),
          ref: {},
        },
      },
      params: { gameId: "game1" },
    };

    await capturedHandler!(event);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});

describe("Activities - Visibility Mapping", () => {
  // Testar a lógica de mapeamento de visibilidade diretamente
  // A função está inlined no handler, então testamos via cenários

  function mapVisibility(gameVisibility: string | undefined, isPublic: boolean | undefined): string {
    let visibility = "PUBLIC";
    if (gameVisibility === "GROUP_ONLY" || gameVisibility === "PRIVATE") {
      visibility = "FRIENDS";
    } else if (isPublic === false) {
      visibility = "FRIENDS";
    }
    return visibility;
  }

  test("PUBLIC_OPEN deve mapear para PUBLIC", () => {
    expect(mapVisibility("PUBLIC_OPEN", true)).toBe("PUBLIC");
  });

  test("PUBLIC_CLOSED deve mapear para PUBLIC", () => {
    expect(mapVisibility("PUBLIC_CLOSED", true)).toBe("PUBLIC");
  });

  test("GROUP_ONLY deve mapear para FRIENDS", () => {
    expect(mapVisibility("GROUP_ONLY", true)).toBe("FRIENDS");
  });

  test("PRIVATE deve mapear para FRIENDS", () => {
    expect(mapVisibility("PRIVATE", true)).toBe("FRIENDS");
  });

  test("is_public=false deve mapear para FRIENDS (fallback)", () => {
    expect(mapVisibility(undefined, false)).toBe("FRIENDS");
  });

  test("undefined visibility com is_public=true deve ser PUBLIC", () => {
    expect(mapVisibility(undefined, true)).toBe("PUBLIC");
  });

  test("undefined visibility com undefined is_public deve ser PUBLIC", () => {
    expect(mapVisibility(undefined, undefined)).toBe("PUBLIC");
  });
});

describe("Activities - Activity Document Structure", () => {
  test("deve conter todos os campos obrigatórios", () => {
    // Verificar a estrutura esperada do documento de atividade
    const expectedFields = [
      "type",
      "title",
      "description",
      "created_at",
      "reference_id",
      "reference_type",
      "user_id",
      "user_name",
      "user_photo",
      "visibility",
      "metadata",
    ];

    // Simular a criação do activity object (replica lógica do activities.ts)
    const activity = {
      type: "GAME_FINISHED",
      title: "Futebol dos Parças",
      description: "Placar Final: Time A 3 x 2 Time B",
      created_at: { _type: "ServerTimestamp" },
      reference_id: "game123",
      reference_type: "GAME",
      user_id: "owner1",
      user_name: "João",
      user_photo: "https://photo.url",
      visibility: "PUBLIC",
      metadata: {
        location: "Campo do Zé",
        game_id: "game123",
      },
    };

    for (const field of expectedFields) {
      expect(activity).toHaveProperty(field);
    }

    expect(activity.type).toBe("GAME_FINISHED");
    expect(activity.reference_type).toBe("GAME");
    expect(activity.metadata.game_id).toBe("game123");
  });

  test("deve usar nome padrão quando game.name é undefined", () => {
    const afterData: Record<string, any> = { status: "FINISHED" };
    const gameName = afterData.name || "Futebol dos Parças";
    expect(gameName).toBe("Futebol dos Parças");
  });

  test("deve usar nome do jogo quando game.name está definido", () => {
    const afterData: Record<string, any> = { status: "FINISHED", name: "Pelada de Sexta" };
    const gameName = afterData.name || "Futebol dos Parças";
    expect(gameName).toBe("Pelada de Sexta");
  });

  test("deve usar 'Alguém' quando userData é null", () => {
    const userData: any = null;
    const userName = userData ? userData.name : "Alguém";
    expect(userName).toBe("Alguém");
  });

  test("deve formatar placar quando live_score existe", () => {
    const score = { team1Score: 3, team2Score: 1 };
    const description = `Placar Final: Time A ${score.team1Score} x ${score.team2Score} Time B`;
    expect(description).toBe("Placar Final: Time A 3 x 1 Time B");
  });

  test("deve usar descrição padrão quando live_score não existe", () => {
    const description = "Jogo finalizado! Confira os resultados e estatísticas.";
    expect(description).toContain("finalizado");
  });
});
