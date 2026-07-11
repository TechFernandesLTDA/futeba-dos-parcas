import {
  acquireOperationLease,
  completeOperationLease,
  failOperationLease,
} from "../../src/middleware/operation-lock";

function makeDatabase(initial: Record<string, unknown> = {}) {
  let data = {...initial};
  const ref = {path: "system_locks/job"};
  const database = {
    collection: jest.fn(() => ({doc: jest.fn(() => ref)})),
    runTransaction: jest.fn(async (handler) => handler({
      get: jest.fn(async () => ({data: () => data})),
      set: jest.fn((_ref, payload) => {
        data = {...data, ...payload};
      }),
    })),
  };
  return {
    database: database as unknown as FirebaseFirestore.Firestore,
    current: () => data,
  };
}

describe("operation-lock", () => {
  it("bloqueia uma segunda execução enquanto o lease está ativo", async () => {
    const {database} = makeDatabase();
    await acquireOperationLease(database, "job", "admin-1", {
      cooldownMs: 60_000,
      leaseMs: 30_000,
    });

    await expect(acquireOperationLease(database, "job", "admin-2", {
      cooldownMs: 60_000,
      leaseMs: 30_000,
    })).rejects.toMatchObject({code: "resource-exhausted"});
  });

  it("somente o dono do lease altera o estado final", async () => {
    const {database, current} = makeDatabase();
    const lease = await acquireOperationLease(database, "job", "admin-1", {
      cooldownMs: 60_000,
    });

    await failOperationLease(database, {...lease, ownerId: "stale"}, new Error());
    expect(current().status).toBe("running");

    await completeOperationLease(database, lease, {processed: 3});
    expect(current()).toMatchObject({status: "completed", processed: 3});
  });
});
