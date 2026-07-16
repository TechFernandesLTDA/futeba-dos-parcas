const records = new Map<string, Record<string, unknown>>();
const deletedUsers = new Set<string>();
let refreshOnNextDeletePath: string | undefined;

class Snapshot {
  constructor(
    readonly ref: DocumentRef,
    private readonly value?: Record<string, unknown>
  ) {}
  get exists() { return this.value != null; }
  get(field: string) { return this.value?.[field]; }
  data() { return this.value; }
  get id() { return this.ref.id; }
  get updateTime() { return this.value?.updateTime as never; }
}

class DocumentRef {
  constructor(readonly path: string) {}
  get id() { return this.path.split("/").pop()!; }
}

class Query {
  constructor(
    private readonly collectionName: string,
    private readonly predicates: Array<(value: Record<string, unknown>) => boolean>,
    private readonly max = Number.MAX_SAFE_INTEGER
  ) {}
  where(field: string, operator: string, expected: unknown) {
    return new Query(
      this.collectionName,
      [...this.predicates, queryPredicate(field, operator, expected)],
      this.max
    );
  }
  limit(max: number) {
    return new Query(this.collectionName, this.predicates, max);
  }
  async get() {
    const prefix = `${this.collectionName}/`;
    const docs = [...records.entries()]
      .filter(([path, value]) =>
        path.startsWith(prefix) &&
        this.predicates.every((predicate) => predicate(value))
      )
      .map(([path, value]) => new Snapshot(new DocumentRef(path), value))
      .slice(0, this.max);
    return {docs, empty: docs.length === 0, size: docs.length};
  }
}

class CollectionRef {
  constructor(private readonly name: string) {}
  doc(id: string) { return new DocumentRef(`${this.name}/${id}`); }
  where(field: string, operator: string, expected: unknown) {
    return new Query(this.name, [queryPredicate(field, operator, expected)]);
  }
}

function queryPredicate(field: string, operator: string, expected: unknown) {
  return (value: Record<string, unknown>) => {
    if (operator === "in") return (expected as unknown[]).includes(value[field]);
    if (operator === "==") return value[field] === expected;
    const actualMillis = (value[field] as {toMillis?: () => number})
      ?.toMillis?.();
    const expectedMillis = (expected as {toMillis?: () => number})
      ?.toMillis?.();
    if (operator === "<=") return (actualMillis ?? Infinity) <=
      (expectedMillis ?? -Infinity);
    return false;
  };
}

const firestore = {
  collection: (name: string) => new CollectionRef(name),
  runTransaction: async (
    handler: (transaction: {
      get: (ref: DocumentRef | Query) => Promise<Snapshot | {docs: Snapshot[]}>;
      set: (ref: DocumentRef, value: Record<string, unknown>) => void;
      delete: (ref: DocumentRef) => void;
    }) => Promise<unknown>
  ) => {
    const pending: (() => void)[] = [];
    const result = await handler({
      get: async (ref) => ref instanceof Query ? ref.get() :
        new Snapshot(
          ref,
          ref.path.startsWith("users/") && !deletedUsers.has(ref.id) ?
            {status: "ACTIVE"} : records.get(ref.path)
        ),
      set: (ref, value) => pending.push(() => records.set(ref.path, value)),
      delete: (ref) => pending.push(() => records.delete(ref.path)),
    });
    pending.forEach((write) => write());
    return result;
  },
  getAll: async (...refs: DocumentRef[]) => refs.map((ref) =>
    new Snapshot(ref, records.get(ref.path))
  ),
  batch: () => {
    const writes: Array<{
      ref: DocumentRef;
      precondition: {lastUpdateTime: unknown};
      update?: Record<string, unknown>;
    }> = [];
    return {
      delete: (ref: DocumentRef, precondition: {lastUpdateTime: unknown}) => {
        writes.push({ref, precondition});
        if (refreshOnNextDeletePath === ref.path) {
          const current = records.get(ref.path) ?? {};
          records.set(ref.path, {
            ...current,
            expiresAt: {toMillis: () => Date.now() + 60_000},
            updateTime: {version: "new"},
          });
          refreshOnNextDeletePath = undefined;
        }
      },
      update: (
        ref: DocumentRef,
        update: Record<string, unknown>,
        precondition: {lastUpdateTime: unknown}
      ) => {
        writes.push({ref, update, precondition});
        if (refreshOnNextDeletePath === ref.path) {
          const current = records.get(ref.path) ?? {};
          records.set(ref.path, {
            ...current,
            expiresAt: {toMillis: () => Date.now() + 60_000},
            updateTime: {version: "new"},
          });
          refreshOnNextDeletePath = undefined;
        }
      },
      commit: async () => {
        for (const write of writes) {
          if (records.get(write.ref.path)?.updateTime !==
            write.precondition.lastUpdateTime) {
            throw Object.assign(new Error("refreshed"), {code: 9});
          }
        }
        writes.forEach(({ref, update}) => {
          if (!update) {
            records.delete(ref.path);
            return;
          }
          records.set(ref.path, {...records.get(ref.path), ...update});
        });
      },
    };
  },
};

jest.mock("../../src/_db", () => ({db: () => firestore}));
jest.mock("../../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: (_options: unknown, handler: unknown) => handler,
}));

import {
  cleanupExpiredPushTokenRecords,
  filterPushTokensByCanonicalOwner,
  getRegisteredPushTokens,
  hashPushToken,
  registerPushTokenForUser,
  removeRegisteredPushToken,
  unregisterPushTokenForUser,
} from "../../src/notifications/push-token-registry";

describe("private push token registry", () => {
  beforeEach(() => {
    records.clear();
    deletedUsers.clear();
    refreshOnNextDeletePath = undefined;
  });

  it("rotates one installation atomically and keeps only the newest token", async () => {
    await registerPushTokenForUser("user-1", {
      token: "token-old",
      deviceId: "device-a",
      platform: "ios",
      sequence: 1,
    });
    await registerPushTokenForUser("user-1", {
      token: "token-new",
      deviceId: "device-a",
      platform: "ios",
      sequence: 2,
    });

    expect(records.get(`push_tokens/${hashPushToken("token-old")}`))
      .toMatchObject({state: "rotated"});
    const grouped = await getRegisteredPushTokens(["user-1"]);
    expect(grouped.get("user-1")).toEqual(["token-new"]);
  });

  it("reassigns a token idempotently without allowing old-owner cleanup", async () => {
    await registerPushTokenForUser("user-1", {
      token: "shared-token",
      deviceId: "device-a",
      platform: "ios",
      sequence: 1,
    });
    await registerPushTokenForUser("user-2", {
      token: "shared-token",
      deviceId: "device-b",
      platform: "android",
      sequence: 1,
    });

    await removeRegisteredPushToken("user-1", "shared-token");

    const grouped = await getRegisteredPushTokens(["user-1", "user-2"]);
    expect(grouped.get("user-1")).toBeUndefined();
    expect(grouped.get("user-2")).toEqual(["shared-token"]);
  });

  it("unregisters only the authenticated installation", async () => {
    await registerPushTokenForUser("user-1", {
      token: "token-a",
      deviceId: "device-a",
      platform: "ios",
      sequence: 1,
    });
    await unregisterPushTokenForUser("user-1", {
      token: "token-a",
      deviceId: "device-a",
      sequence: 2,
    });

    expect(await getRegisteredPushTokens(["user-1"])).toEqual(new Map());
    await expect(filterPushTokensByCanonicalOwner(new Map([
      ["token-a", "user-1"],
    ]))).resolves.toEqual(new Map());
  });

  it("lets logout win when Swift and KMP use the same sequence", async () => {
    await registerPushTokenForUser("user-1", {
      token: "token-a",
      deviceId: "device-a",
      platform: "ios",
      sequence: 2,
    });

    const logout = await unregisterPushTokenForUser("user-1", {
      token: "token-a",
      deviceId: "device-a",
      sequence: 2,
    });
    const delayedRegister = await registerPushTokenForUser("user-1", {
      token: "token-a",
      deviceId: "device-a",
      platform: "ios",
      sequence: 2,
    });

    expect(logout.applied).toBe(true);
    await expect(unregisterPushTokenForUser("user-1", {
      token: "token-a",
      deviceId: "device-a",
      sequence: 2,
    })).resolves.toEqual({applied: false});
    expect(delayedRegister.applied).toBe(false);
    expect(await getRegisteredPushTokens(["user-1"])).toEqual(new Map());
  });

  it("does not let an equal-sequence logout revoke a reassigned account", async () => {
    await registerPushTokenForUser("user-b", {
      token: "token-b",
      deviceId: "shared-device",
      platform: "ios",
      sequence: 2,
    });

    const staleLogout = await unregisterPushTokenForUser("user-a", {
      token: "token-b",
      deviceId: "shared-device",
      sequence: 2,
    });

    expect(staleLogout.applied).toBe(false);
    expect((await getRegisteredPushTokens(["user-b"])).get("user-b"))
      .toEqual(["token-b"]);
  });

  it("rejects malformed platform before writing", async () => {
    await expect(registerPushTokenForUser("user-1", {
      token: "token-a",
      deviceId: "device-a",
      platform: "windows",
      sequence: 1,
    })).rejects.toMatchObject({code: "invalid-argument"});
    expect(records.size).toBe(0);
  });

  it("rejects delayed account registration by persistent device sequence", async () => {
    await registerPushTokenForUser("user-b", {
      token: "token-b",
      deviceId: "shared-device",
      platform: "ios",
      sequence: 2,
    });
    const stale = await registerPushTokenForUser("user-a", {
      token: "token-a",
      deviceId: "shared-device",
      platform: "ios",
      sequence: 1,
    });

    expect(stale.applied).toBe(false);
    expect((await getRegisteredPushTokens(["user-a"])).size).toBe(0);
    expect((await getRegisteredPushTokens(["user-b"])).get("user-b"))
      .toEqual(["token-b"]);
  });

  it("keeps logout tombstone when an old register finishes later", async () => {
    await registerPushTokenForUser("user-a", {
      token: "token-a",
      deviceId: "device-a",
      platform: "ios",
      sequence: 1,
    });
    await unregisterPushTokenForUser("user-a", {
      deviceId: "device-a",
      sequence: 3,
    });
    const stale = await registerPushTokenForUser("user-a", {
      token: "token-old",
      deviceId: "device-a",
      platform: "ios",
      sequence: 2,
    });

    expect(stale.applied).toBe(false);
    expect((await getRegisteredPushTokens(["user-a"])).size).toBe(0);
  });

  it("limits active installations per user", async () => {
    for (let index = 0; index < 10; index++) {
      await registerPushTokenForUser("user-a", {
        token: `token-${index}`,
        deviceId: `device-${index}`,
        platform: "ios",
        sequence: 1,
      });
    }
    for (let index = 0; index < 11; index++) {
      records.set(`push_token_devices/tombstone-${index}`, {
        userId: "user-a",
        state: "unregistered",
      });
    }

    await expect(registerPushTokenForUser("user-a", {
      token: "token-over-limit",
      deviceId: "device-over-limit",
      platform: "ios",
      sequence: 1,
    })).rejects.toMatchObject({code: "resource-exhausted"});
  });

  it("fails closed for legacy tokens when ownership lookup is unavailable", async () => {
    const getAll = firestore.getAll;
    firestore.getAll = async () => {
      throw new Error("registry unavailable");
    };
    try {
      const owners = new Map([
        ["legacy-token", "user-a"],
        ["canonical-token", "user-a"],
      ]);
      await expect(filterPushTokensByCanonicalOwner(
        owners,
        new Set(["canonical-token"])
      )).resolves.toEqual(new Map([["canonical-token", "user-a"]]));
    } finally {
      firestore.getAll = getAll;
    }
  });

  it("does not recreate push data after the account document is deleted", async () => {
    deletedUsers.add("deleted-user");
    await expect(registerPushTokenForUser("deleted-user", {
      token: "late-token",
      deviceId: "device-a",
      platform: "ios",
      sequence: 1,
    })).rejects.toMatchObject({code: "failed-precondition"});
    expect([...records.keys()].some((path) => path.startsWith("push_")))
      .toBe(false);
  });

  it("does not delete a token refreshed between TTL query and batch commit", async () => {
    const path = "push_tokens/refreshed-token";
    records.set(path, {
      userId: "user-a",
      token: "token-a",
      expiresAt: {toMillis: () => Date.now() - 60_000},
      updateTime: {version: "old"},
    });
    refreshOnNextDeletePath = path;

    await expect(cleanupExpiredPushTokenRecords()).resolves.toBe(0);
    expect(records.has(path)).toBe(true);
  });

  it("keeps an expired canonical token revoked from legacy fallback", async () => {
    const token = "expired-token";
    const path = `push_tokens/${hashPushToken(token)}`;
    records.set(path, {
      userId: "user-a",
      token,
      state: "active",
      expiresAt: {toMillis: () => Date.now() - 60_000},
      updateTime: {version: "old"},
    });

    await expect(cleanupExpiredPushTokenRecords()).resolves.toBe(1);
    await expect(filterPushTokensByCanonicalOwner(new Map([
      [token, "user-a"],
    ]))).resolves.toEqual(new Map());
    expect(records.get(path)?.state).toBe("expired");
  });
});
