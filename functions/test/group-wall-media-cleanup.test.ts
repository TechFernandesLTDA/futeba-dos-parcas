jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
}));

jest.mock("firebase-admin/storage", () => ({
  getStorage: jest.fn(() => ({
    bucket: jest.fn(),
  })),
}));

import {isManagedWallMediaPath} from "../src/groups/wall-media-cleanup";

describe("group wall media cleanup helper", () => {
  test("aceita path legado do web dentro do grupo", () => {
    expect(
      isManagedWallMediaPath(
        "group-1",
        "groups/group-1/wall_media/__draft__/1710000000000-file.jpg"
      )
    ).toBe(true);
  });

  test("aceita path Android com uid intermediário", () => {
    expect(
      isManagedWallMediaPath(
        "group-1",
        "groups/group-1/wall_media/__draft__/uid-player-a-001/file.webp"
      )
    ).toBe(true);
  });

  test("rejeita path fora do prefixo do grupo", () => {
    expect(
      isManagedWallMediaPath(
        "group-1",
        "groups/group-2/wall_media/__draft__/file.jpg"
      )
    ).toBe(false);
  });

  test("rejeita path com traversal ou extensão não permitida", () => {
    expect(
      isManagedWallMediaPath(
        "group-1",
        "groups/group-1/wall_media/__draft__/../secrets.txt"
      )
    ).toBe(false);
    expect(
      isManagedWallMediaPath(
        "group-1",
        "groups/group-1/wall_media/__draft__/file.gif"
      )
    ).toBe(false);
  });
});
