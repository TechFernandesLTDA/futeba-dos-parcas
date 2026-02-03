/**
 * TESTES DE GERENCIAMENTO DE USUÁRIOS
 *
 * Testa a Cloud Function onUserCreate (user-management.ts):
 * - Criação de documento do usuário com campos obrigatórios
 * - Idempotência (não recria se já existir)
 * - Valores padrão corretos
 * - Tratamento de campos do Firebase Auth
 */

// Mock firebase-admin
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn();
const mockDoc = jest.fn().mockReturnValue({
  get: mockGet,
  set: mockSet,
});
const mockCollection = jest.fn().mockReturnValue({
  doc: mockDoc,
});

const mockFieldValue = {
  serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  arrayUnion: jest.fn((...args: any[]) => ({ _type: "ArrayUnion", elements: args })),
};

jest.mock("firebase-admin", () => {
  const mockAdmin: any = {
    apps: [{ name: "test" }],
    firestore: jest.fn(() => ({
      collection: mockCollection,
    })),
    initializeApp: jest.fn(),
  };

  mockAdmin.firestore.FieldValue = mockFieldValue;
  mockAdmin.firestore.Timestamp = {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
    })),
    now: jest.fn(() => ({
      toDate: () => new Date(),
    })),
  };

  return mockAdmin;
});

// Mock firebase-functions v1 auth trigger
let capturedHandler: ((user: any) => Promise<void>) | null = null;

jest.mock("firebase-functions/v1", () => ({
  auth: {
    user: () => ({
      onCreate: (handler: (user: any) => Promise<void>) => {
        capturedHandler = handler;
        return handler;
      },
    }),
  },
}));

describe("User Management - onUserCreate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedHandler = null;
    // Re-import para capturar o handler
    jest.isolateModules(() => {
      require("../src/user-management");
    });
  });

  test("deve registrar o handler onCreate", () => {
    expect(capturedHandler).not.toBeNull();
    expect(typeof capturedHandler).toBe("function");
  });

  test("deve criar documento com todos os campos obrigatórios", async () => {
    // Simular usuário não existente
    mockGet.mockResolvedValueOnce({ exists: false });

    const mockUser = {
      uid: "user123",
      email: "test@example.com",
      displayName: "João Silva",
      photoURL: "https://photo.url/test.jpg",
    };

    await capturedHandler!(mockUser);

    expect(mockCollection).toHaveBeenCalledWith("users");
    expect(mockDoc).toHaveBeenCalledWith("user123");
    expect(mockSet).toHaveBeenCalledTimes(1);

    // Verificar campos do documento criado
    const createdDoc = mockSet.mock.calls[0][0];

    // Campos básicos do Auth
    expect(createdDoc.id).toBe("user123");
    expect(createdDoc.email).toBe("test@example.com");
    expect(createdDoc.name).toBe("João Silva");
    expect(createdDoc.photo_url).toBe("https://photo.url/test.jpg");
  });

  test("deve usar valores padrão para campos de perfil", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    const mockUser = {
      uid: "user456",
      email: "player@test.com",
      displayName: "Maria",
      photoURL: null,
    };

    await capturedHandler!(mockUser);

    const createdDoc = mockSet.mock.calls[0][0];

    // Perfil
    expect(createdDoc.nickname).toBeNull();
    expect(createdDoc.phone).toBeNull();
    expect(createdDoc.is_searchable).toBe(true);
    expect(createdDoc.is_profile_public).toBe(true);

    // Role e gamificação
    expect(createdDoc.role).toBe("PLAYER");
    expect(createdDoc.level).toBe(1);
    expect(createdDoc.experience_points).toBe(0);
    expect(createdDoc.milestones_achieved).toEqual([]);
  });

  test("deve inicializar ratings manuais com 0", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    await capturedHandler!({
      uid: "user789",
      email: "test@test.com",
      displayName: "Test",
      photoURL: null,
    });

    const createdDoc = mockSet.mock.calls[0][0];

    expect(createdDoc.striker_rating).toBe(0.0);
    expect(createdDoc.mid_rating).toBe(0.0);
    expect(createdDoc.defender_rating).toBe(0.0);
    expect(createdDoc.gk_rating).toBe(0.0);
  });

  test("deve inicializar ratings automáticos com 0", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    await capturedHandler!({
      uid: "user789",
      email: "test@test.com",
      displayName: "Test",
      photoURL: null,
    });

    const createdDoc = mockSet.mock.calls[0][0];

    expect(createdDoc.auto_striker_rating).toBe(0.0);
    expect(createdDoc.auto_mid_rating).toBe(0.0);
    expect(createdDoc.auto_defender_rating).toBe(0.0);
    expect(createdDoc.auto_gk_rating).toBe(0.0);
    expect(createdDoc.auto_rating_samples).toBe(0);
    expect(createdDoc.auto_rating_updated_at).toBeNull();
  });

  test("deve inicializar preferências com valores padrão", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    await capturedHandler!({
      uid: "user789",
      email: "test@test.com",
      displayName: "Test",
      photoURL: null,
    });

    const createdDoc = mockSet.mock.calls[0][0];

    expect(createdDoc.preferred_field_types).toEqual(["SOCIETY"]);
    expect(createdDoc.preferred_position).toBeNull();
  });

  test("deve inicializar informações pessoais como null", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    await capturedHandler!({
      uid: "user789",
      email: "test@test.com",
      displayName: "Test",
      photoURL: null,
    });

    const createdDoc = mockSet.mock.calls[0][0];

    expect(createdDoc.birth_date).toBeNull();
    expect(createdDoc.gender).toBeNull();
    expect(createdDoc.height_cm).toBeNull();
    expect(createdDoc.weight_kg).toBeNull();
    expect(createdDoc.dominant_foot).toBeNull();
    expect(createdDoc.primary_position).toBeNull();
    expect(createdDoc.secondary_position).toBeNull();
    expect(createdDoc.play_style).toBeNull();
    expect(createdDoc.experience_years).toBeNull();
  });

  test("deve inicializar campo fcm_token como null", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    await capturedHandler!({
      uid: "user789",
      email: "test@test.com",
      displayName: "Test",
      photoURL: null,
    });

    const createdDoc = mockSet.mock.calls[0][0];
    expect(createdDoc.fcm_token).toBeNull();
  });

  test("deve incluir timestamps de criação", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    await capturedHandler!({
      uid: "user789",
      email: "test@test.com",
      displayName: "Test",
      photoURL: null,
    });

    const createdDoc = mockSet.mock.calls[0][0];
    expect(createdDoc.created_at).toEqual({ _type: "ServerTimestamp" });
    expect(createdDoc.updated_at).toEqual({ _type: "ServerTimestamp" });
  });

  test("NÃO deve criar documento se usuário já existir (idempotência)", async () => {
    // Simular documento já existente
    mockGet.mockResolvedValueOnce({ exists: true });

    await capturedHandler!({
      uid: "existing_user",
      email: "existing@test.com",
      displayName: "Existing User",
      photoURL: null,
    });

    expect(mockSet).not.toHaveBeenCalled();
  });

  test("deve tratar campos ausentes do Auth com valores padrão", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    // Usuário sem email, displayName, e photoURL
    await capturedHandler!({
      uid: "minimal_user",
      email: undefined,
      displayName: undefined,
      photoURL: undefined,
    });

    const createdDoc = mockSet.mock.calls[0][0];

    expect(createdDoc.email).toBe("");
    expect(createdDoc.name).toBe("");
    expect(createdDoc.photo_url).toBeNull();
  });

  test("deve propagar erros do Firestore", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });
    mockSet.mockRejectedValueOnce(new Error("Firestore write error"));

    await expect(
      capturedHandler!({
        uid: "error_user",
        email: "error@test.com",
        displayName: "Error User",
        photoURL: null,
      })
    ).rejects.toThrow("Firestore write error");
  });
});
