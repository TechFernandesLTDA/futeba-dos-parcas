const mockRunTransaction = jest.fn();
const mockDoc = jest.fn();
const mockServerTimestamp = jest.fn(() => ({_type: "ServerTimestamp"}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: mockServerTimestamp,
    increment: jest.fn((value: number) => ({_type: "Increment", value})),
  },
}));

jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({
    doc: mockDoc,
    runTransaction: mockRunTransaction,
  })),
}));

jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 19,
    resetAt: new Date(Date.now() + 60000),
  }),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import {submitDirectMessage} from "../src/social/direct-messages";

function makeDocRef(path: string) {
  return {
    path,
    get: jest.fn().mockImplementation(() => {
      switch (path) {
      case "users/user-1":
        return Promise.resolve({
          exists: true,
          data: () => ({name: "Novo Nome", photo_url: "new-photo.png"}),
        });
      case "users/user-2":
        return Promise.resolve({
          exists: true,
          data: () => ({name: "Outro Nome", photo_url: "other-photo.png"}),
        });
      default:
        return Promise.resolve({exists: false, data: () => ({})});
      }
    }),
    collection: (name: string) => ({
      doc: () => ({path: `${path}/${name}/message-1`}),
    }),
  };
}

describe("direct messages metadata refresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockImplementation((path: string) => makeDocRef(path));
  });

  it("atualiza participant_names e participant_photos com os dados atuais no envio", async () => {
    const tx = {
      get: jest.fn((ref: {path: string}) => {
        switch (ref.path) {
        case "chats/chat-1":
          return Promise.resolve({
            exists: true,
            data: () => ({participants: ["user-1", "user-2"]}),
          });
        case "users/user-1":
          return Promise.resolve({
            exists: true,
            data: () => ({name: "Novo Nome", photo_url: "new-photo.png"}),
          });
        case "users/user-2":
          return Promise.resolve({
            exists: true,
            data: () => ({name: "Outro Nome", photo_url: "other-photo.png"}),
          });
        default:
          return Promise.resolve({exists: false, data: () => ({})});
        }
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    mockRunTransaction.mockImplementation(async (callback: any) => callback(tx));

    await submitDirectMessage({
      auth: {uid: "user-1"},
      data: {chatId: "chat-1", text: "Oi"},
    } as any);

    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({path: "chats/chat-1"}),
      expect.objectContaining({
        participant_names: {
          "user-1": "Novo Nome",
          "user-2": "Outro Nome",
        },
        participant_photos: {
          "user-1": "new-photo.png",
          "user-2": "other-photo.png",
        },
      })
    );
  });
});
