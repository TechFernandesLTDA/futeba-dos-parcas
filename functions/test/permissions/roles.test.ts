/**
 * Matriz de papéis para ações de gestão do grupo (UC4).
 * isActiveGroupManager é a regra compartilhada que decide quem movimenta o caixa
 * e estorna lançamentos: dono (owner_id), OWNER ou ADMIN com vínculo ATIVO.
 */

jest.mock("firebase-functions/v2", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions/v2/https", () => require("./_fake-runtime").httpsModule);
jest.mock("firebase-admin/firestore", () => require("./_fake-firestore"));
jest.mock("../../src/_db", () => ({db: () => require("./_fake-firestore").db()}));
jest.mock("../../src/middleware/rate-limiter");
jest.mock("../../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: (_options: unknown, handler: unknown) => handler,
}));

const {isActiveGroupManager} = require("../../src/cashbox/callable");

const GROUP = {owner_id: "owner-1", status: "ACTIVE"};
const ME = "user-x";

describe("isActiveGroupManager - papéis que gerem o grupo (UC4)", () => {
  it.each([
    ["dono pelo owner_id, sem documento de vínculo", {...GROUP, owner_id: ME}, undefined, true],
    ["ADMIN com vínculo ativo", GROUP, {user_id: ME, role: "ADMIN", status: "ACTIVE"}, true],
    ["OWNER com vínculo ativo", GROUP, {user_id: ME, role: "OWNER", status: "ACTIVE"}, true],
    ["MEMBER comum com vínculo ativo", GROUP, {user_id: ME, role: "MEMBER", status: "ACTIVE"}, false],
    ["ADMIN com vínculo pendente", GROUP, {user_id: ME, role: "ADMIN", status: "PENDING"}, false],
    ["ADMIN com vínculo inativo", GROUP, {user_id: ME, role: "ADMIN", status: "INACTIVE"}, false],
    ["ADMIN com vínculo removido", GROUP, {user_id: ME, role: "ADMIN", status: "REMOVED"}, false],
    ["visitante sem vínculo nem dono", GROUP, undefined, false],
  ])("%s -> %s", (_label, group, membership, expected) => {
    expect(isActiveGroupManager(membership, group, ME)).toBe(expected);
  });
});
