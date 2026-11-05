/**
 * FAKE FIRESTORE EM MEMORIA PARA OS TESTES DE OURO DO XP (A1)
 *
 * Implementa apenas o subconjunto da API do firebase-admin usado pelo
 * trigger onGameStatusUpdate: collection/doc/where/limit/orderBy/get,
 * set/update/delete/create, runTransaction, batch, FieldValue, Timestamp
 * e FieldPath.documentId(). Escritas são gravadas no mapa interno, para
 * que o teste possa congelar o estado final do banco.
 *
 * Não é um emulador: não valida índices, regras nem tipos. Serve para
 * capturar o que o CÓDIGO ATUAL grava, sem usar nenhum valor esperado
 * de xp_logs como gabarito.
 */

type Data = Record<string, any>;

const DOCUMENT_ID = "__name__";

/** Sentinela de FieldValue (serverTimestamp, increment, arrayUnion...). */
class Sentinel {
  constructor(public readonly kind: string, public readonly args: unknown[]) {}
}

/** Timestamp mínimo compatível com o uso do código (toDate/toMillis). */
export class FakeTimestamp {
  constructor(private readonly ms: number) {}
  toDate(): Date {
    return new Date(this.ms);
  }
  toMillis(): number {
    return this.ms;
  }
  get seconds(): number {
    return Math.floor(this.ms / 1000);
  }
  get nanoseconds(): number {
    return 0;
  }
  static fromDate(d: Date): FakeTimestamp {
    return new FakeTimestamp(d.getTime());
  }
  static fromMillis(ms: number): FakeTimestamp {
    return new FakeTimestamp(ms);
  }
  static now(): FakeTimestamp {
    return new FakeTimestamp(Date.now());
  }
}

const FieldValue = {
  serverTimestamp: () => new Sentinel("serverTimestamp", []),
  increment: (n: number) => new Sentinel("increment", [n]),
  delete: () => new Sentinel("delete", []),
  arrayUnion: (...items: unknown[]) => new Sentinel("arrayUnion", items),
  arrayRemove: (...items: unknown[]) => new Sentinel("arrayRemove", items),
};

const FieldPath = {
  documentId: () => DOCUMENT_ID,
};

/** Store global: chave "colecao/id[/sub/id]" -> dados. */
export class FakeStore {
  readonly docs = new Map<string, Data>();
  private autoId = 0;

  nextAutoId(): string {
    this.autoId += 1;
    return `auto${String(this.autoId).padStart(4, "0")}`;
  }

  seed(path: string, data: Data): void {
    this.docs.set(path, clone(data));
  }

  reset(): void {
    this.docs.clear();
    this.autoId = 0;
  }
}

function clone<T>(value: T): T {
  if (value instanceof FakeTimestamp) return value;
  if (value instanceof Sentinel) return value;
  if (Array.isArray(value)) return value.map((v) => clone(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Data = {};
    for (const [k, v] of Object.entries(value as Data)) out[k] = clone(v);
    return out as T;
  }
  return value;
}

function getField(data: Data | undefined, field: string): unknown {
  if (!data) return undefined;
  if (field === DOCUMENT_ID) return undefined;
  return field.split(".").reduce<any>(
    (acc, key) => (acc == null ? undefined : acc[key]),
    data,
  );
}

function setNested(target: Data, field: string, value: unknown): void {
  const parts = field.split(".");
  let cursor: Data = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cursor[key] == null || typeof cursor[key] !== "object") cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

function deleteNested(target: Data, field: string): void {
  const parts = field.split(".");
  let cursor: any = target;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor = cursor?.[parts[i]];
    if (cursor == null) return;
  }
  delete cursor[parts[parts.length - 1]];
}

/** Resolve sentinelas e aplica um patch (merge por campo, com dot-path). */
function applyPatch(base: Data, patch: Data, store: FakeStore): Data {
  const next: Data = clone(base);
  for (const [field, raw] of Object.entries(patch)) {
    if (raw instanceof Sentinel) {
      if (raw.kind === "delete") {
        deleteNested(next, field);
      } else if (raw.kind === "serverTimestamp") {
        setNested(next, field, FakeTimestamp.fromMillis(Date.now()));
      } else if (raw.kind === "increment") {
        const current = Number(getField(next, field) ?? 0);
        setNested(next, field, current + Number(raw.args[0]));
      } else if (raw.kind === "arrayUnion") {
        const current = (getField(next, field) as unknown[]) ?? [];
        const merged = [...current];
        for (const item of raw.args) {
          if (!merged.some((m) => JSON.stringify(m) === JSON.stringify(item))) {
            merged.push(item);
          }
        }
        setNested(next, field, merged);
      } else if (raw.kind === "arrayRemove") {
        const current = (getField(next, field) as unknown[]) ?? [];
        setNested(
          next,
          field,
          current.filter(
            (m) => !raw.args.some((a) => JSON.stringify(a) === JSON.stringify(m)),
          ),
        );
      }
    } else {
      setNested(next, field, applyNested(raw, store));
    }
  }
  return next;
}

function applyNested(value: unknown, store: FakeStore): unknown {
  if (value instanceof Sentinel) {
    return applyPatch({}, {v: value}, store).v;
  }
  if (Array.isArray(value)) return value.map((v) => applyNested(v, store));
  if (value && typeof value === "object" && !(value instanceof FakeTimestamp)) {
    const out: Data = {};
    for (const [k, v] of Object.entries(value as Data)) {
      out[k] = applyNested(v, store);
    }
    return out;
  }
  return value;
}

export interface FakeSnapshot {
  id: string;
  exists: boolean;
  ref: FakeDocRef;
  data(): Data | undefined;
  get(field: string): unknown;
}

function makeSnapshot(store: FakeStore, path: string, ref: FakeDocRef): FakeSnapshot {
  const data = store.docs.get(path);
  const id = path.split("/").pop() as string;
  return {
    id,
    exists: data !== undefined,
    ref,
    data: () => (data === undefined ? undefined : clone(data)),
    get: (field: string) => getField(data, field),
  };
}

type Op = "==" | "!=" | "in" | "not-in" | "array-contains" | "<" | "<=" | ">" | ">=";

interface Filter {
  field: string;
  op: Op;
  value: unknown;
}

function matches(id: string, data: Data, f: Filter): boolean {
  const actual = f.field === DOCUMENT_ID ? id : getField(data, f.field);
  const cmp = (a: unknown, b: unknown): number => {
    const av = a instanceof FakeTimestamp ? a.toMillis() : (a as any);
    const bv = b instanceof FakeTimestamp ? b.toMillis() : (b as any);
    return av < bv ? -1 : av > bv ? 1 : 0;
  };
  switch (f.op) {
    case "==":
      return JSON.stringify(actual) === JSON.stringify(f.value) ||
        actual === f.value;
    case "!=":
      return actual !== f.value;
    case "in":
      return (f.value as unknown[]).some((v) => v === actual);
    case "not-in":
      return !(f.value as unknown[]).some((v) => v === actual);
    case "array-contains":
      return Array.isArray(actual) && actual.includes(f.value);
    case "<":
      return actual !== undefined && cmp(actual, f.value) < 0;
    case "<=":
      return actual !== undefined && cmp(actual, f.value) <= 0;
    case ">":
      return actual !== undefined && cmp(actual, f.value) > 0;
    case ">=":
      return actual !== undefined && cmp(actual, f.value) >= 0;
    default:
      return false;
  }
}

export class FakeQuery {
  constructor(
    protected readonly store: FakeStore,
    protected readonly collectionPath: string,
    protected readonly filters: Filter[] = [],
    protected readonly max: number | undefined = undefined,
    protected readonly order: {field: string; desc: boolean} | undefined = undefined,
  ) {}

  where(field: string, op: Op, value: unknown): FakeQuery {
    return new FakeQuery(
      this.store,
      this.collectionPath,
      [...this.filters, {field, op, value}],
      this.max,
      this.order,
    );
  }

  limit(n: number): FakeQuery {
    return new FakeQuery(this.store, this.collectionPath, this.filters, n, this.order);
  }

  orderBy(field: string, direction: "asc" | "desc" = "asc"): FakeQuery {
    return new FakeQuery(this.store, this.collectionPath, this.filters, this.max, {
      field,
      desc: direction === "desc",
    });
  }

  select(..._fields: string[]): FakeQuery {
    return this;
  }

  startAfter(): FakeQuery {
    return this;
  }

  count(): {get: () => Promise<{data: () => {count: number}}>} {
    return {
      get: async () => ({data: () => ({count: this.matchingIds().length})}),
    };
  }

  private matchingIds(): string[] {
    const prefix = `${this.collectionPath}/`;
    const ids: string[] = [];
    for (const [path, data] of this.store.docs) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      if (rest.includes("/")) continue; // subcoleção não entra aqui
      if (this.filters.every((f) => matches(rest, data, f))) ids.push(rest);
    }
    if (this.order) {
      const {field, desc} = this.order;
      ids.sort((a, b) => {
        const av = getField(this.store.docs.get(`${this.collectionPath}/${a}`), field) as any;
        const bv = getField(this.store.docs.get(`${this.collectionPath}/${b}`), field) as any;
        if (av === bv) return 0;
        const r = av < bv ? -1 : 1;
        return desc ? -r : r;
      });
    } else {
      ids.sort();
    }
    return this.max === undefined ? ids : ids.slice(0, this.max);
  }

  async get(): Promise<{docs: FakeSnapshot[]; empty: boolean; size: number; forEach: (cb: (d: FakeSnapshot) => void) => void}> {
    const docs = this.matchingIds().map((id) => {
      const path = `${this.collectionPath}/${id}`;
      return makeSnapshot(this.store, path, new FakeDocRef(this.store, path));
    });
    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      forEach: (cb) => docs.forEach(cb),
    };
  }
}

export class FakeDocRef {
  readonly id: string;
  readonly path: string;

  constructor(private readonly store: FakeStore, path: string) {
    this.path = path;
    this.id = path.split("/").pop() as string;
  }

  collection(name: string): FakeCollection {
    return new FakeCollection(this.store, `${this.path}/${name}`);
  }

  async get(): Promise<FakeSnapshot> {
    return makeSnapshot(this.store, this.path, this);
  }

  async set(data: Data, options?: {merge?: boolean}): Promise<void> {
    writeSet(this.store, this.path, data, options?.merge === true);
  }

  async create(data: Data): Promise<void> {
    if (this.store.docs.has(this.path)) {
      throw new Error(`ALREADY_EXISTS: ${this.path}`);
    }
    writeSet(this.store, this.path, data, false);
  }

  async update(data: Data): Promise<void> {
    if (!this.store.docs.has(this.path)) {
      throw new Error(`NOT_FOUND: ${this.path}`);
    }
    writeUpdate(this.store, this.path, data);
  }

  async delete(): Promise<void> {
    this.store.docs.delete(this.path);
  }
}

function writeSet(store: FakeStore, path: string, data: Data, merge: boolean): void {
  const base = merge && store.docs.get(path) ? store.docs.get(path) as Data : {};
  store.docs.set(path, applyPatch(base, data, store));
}

function writeUpdate(store: FakeStore, path: string, data: Data): void {
  store.docs.set(path, applyPatch(store.docs.get(path) as Data, data, store));
}

export class FakeCollection extends FakeQuery {
  constructor(store: FakeStore, collectionPath: string) {
    super(store, collectionPath);
  }

  doc(id?: string): FakeDocRef {
    const finalId = id ?? this.store.nextAutoId();
    return new FakeDocRef(this.store, `${this.collectionPath}/${finalId}`);
  }

  async add(data: Data): Promise<FakeDocRef> {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

export class FakeFirestore {
  constructor(public readonly store: FakeStore) {}

  collection(name: string): FakeCollection {
    return new FakeCollection(this.store, name);
  }

  doc(path: string): FakeDocRef {
    return new FakeDocRef(this.store, path);
  }

  async runTransaction<T>(cb: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    return cb(new FakeTransaction(this.store));
  }

  batch(): FakeBatch {
    return new FakeBatch(this.store);
  }
}

export class FakeTransaction {
  constructor(private readonly store: FakeStore) {}

  async get(target: FakeDocRef | FakeQuery): Promise<any> {
    if (target instanceof FakeDocRef) return target.get();
    return target.get();
  }

  set(ref: FakeDocRef, data: Data, options?: {merge?: boolean}): this {
    writeSet(this.store, ref.path, data, options?.merge === true);
    return this;
  }

  update(ref: FakeDocRef, data: Data): this {
    writeUpdate(this.store, ref.path, data);
    return this;
  }

  delete(ref: FakeDocRef): this {
    this.store.docs.delete(ref.path);
    return this;
  }

  create(ref: FakeDocRef, data: Data): this {
    writeSet(this.store, ref.path, data, false);
    return this;
  }
}

export class FakeBatch {
  private readonly ops: Array<() => void> = [];

  constructor(private readonly store: FakeStore) {}

  set(ref: FakeDocRef, data: Data, options?: {merge?: boolean}): this {
    this.ops.push(() => writeSet(this.store, ref.path, data, options?.merge === true));
    return this;
  }

  update(ref: FakeDocRef, data: Data): this {
    this.ops.push(() => writeUpdate(this.store, ref.path, data));
    return this;
  }

  delete(ref: FakeDocRef): this {
    this.ops.push(() => this.store.docs.delete(ref.path));
    return this;
  }

  create(ref: FakeDocRef, data: Data): this {
    this.ops.push(() => writeSet(this.store, ref.path, data, false));
    return this;
  }

  async commit(): Promise<unknown[]> {
    for (const op of this.ops) op();
    return [];
  }
}

/** Objeto que substitui `firebase-admin` nos testes. */
export function createFakeAdmin(store: FakeStore) {
  const firestoreInstance = new FakeFirestore(store);
  const firestoreFn: any = () => firestoreInstance;
  firestoreFn.FieldValue = FieldValue;
  firestoreFn.Timestamp = FakeTimestamp;
  firestoreFn.FieldPath = FieldPath;
  return {
    apps: [{name: "test"}],
    initializeApp: () => undefined,
    firestore: firestoreFn,
    auth: () => ({
      setCustomUserClaims: async () => undefined,
      getUser: async () => ({customClaims: {}}),
    }),
  };
}

export {FieldValue, FieldPath};
