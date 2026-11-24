/**
 * FAKE DO FIRESTORE PARA OS TESTES DE PERMISSÕES (functions/test/permissions)
 *
 * Armazena documentos em memória, com caminhos completos ("groups/g1/members/u1").
 * Suporta o subconjunto usado pelos callables testados: doc/collection/get/set/
 * update/create/delete, queries com where (==, in, <, <=, >, >=, !=), limit,
 * orderBy, collectionGroup, runTransaction (escritas aplicadas no commit) e batch.
 *
 * Sentinelas do FieldValue (serverTimestamp, increment, delete, arrayUnion,
 * arrayRemove) são resolvidas na escrita, como o Admin SDK faz.
 *
 * Não é um emulador: não modela contenção de transação, índices nem regras.
 * Os testes continuam sendo de Cloud Functions (lógica + checagem de permissão).
 */

type Data = Record<string, any>;

const docs = new Map<string, Data>();

/** Erro com o mesmo `code` numérico do gRPC que o Admin SDK expõe. */
export class FirestoreError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

/** Timestamp mínimo com a mesma superfície usada pelo código (toMillis/toDate). */
export function tsOf(ms: number) {
  return {
    _ms: ms,
    seconds: Math.floor(ms / 1000),
    nanoseconds: 0,
    toMillis: () => ms,
    toDate: () => new Date(ms),
  };
}

type Sentinel = {__fv: string; [k: string]: unknown};
const isSentinel = (v: unknown): v is Sentinel =>
  typeof v === "object" && v !== null && "__fv" in (v as object);

export const FieldValue = {
  serverTimestamp: (): Sentinel => ({__fv: "serverTimestamp"}),
  increment: (n: number): Sentinel => ({__fv: "increment", n}),
  delete: (): Sentinel => ({__fv: "delete"}),
  arrayUnion: (...items: unknown[]): Sentinel => ({__fv: "arrayUnion", items}),
  arrayRemove: (...items: unknown[]): Sentinel => ({__fv: "arrayRemove", items}),
};

export const Timestamp = {
  fromMillis: (ms: number) => tsOf(ms),
  fromDate: (d: Date) => tsOf(d.getTime()),
  now: () => tsOf(Date.now()),
};

export const FieldPath = {documentId: () => "__name__"};

function lastSegment(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

function resolveValue(prev: unknown, value: unknown): {keep: boolean; value?: unknown} {
  if (!isSentinel(value)) return {keep: true, value};
  switch (value.__fv) {
    case "serverTimestamp":
      return {keep: true, value: tsOf(Date.now())};
    case "increment":
      return {keep: true, value: (typeof prev === "number" ? prev : 0) + (value.n as number)};
    case "delete":
      return {keep: false};
    case "arrayUnion": {
      const base = Array.isArray(prev) ? [...prev] : [];
      for (const item of value.items as unknown[]) {
        if (!base.includes(item)) base.push(item);
      }
      return {keep: true, value: base};
    }
    case "arrayRemove": {
      const base = Array.isArray(prev) ? prev : [];
      return {keep: true, value: base.filter((x) => !(value.items as unknown[]).includes(x))};
    }
    default:
      return {keep: true, value};
  }
}

function materialize(prev: Data | undefined, incoming: Data, merge: boolean): Data {
  const base: Data = merge && prev ? {...prev} : {};
  for (const [key, raw] of Object.entries(incoming)) {
    if (raw === undefined) continue;
    const res = resolveValue(base[key], raw);
    if (res.keep) base[key] = res.value;
    else delete base[key];
  }
  return base;
}

function applyWrite(
  kind: "set" | "update" | "create" | "delete",
  path: string,
  data?: Data,
  options?: {merge?: boolean}
): void {
  const prev = docs.get(path);
  if (kind === "delete") {
    docs.delete(path);
    return;
  }
  if (kind === "create") {
    if (prev) throw new FirestoreError(6, `ALREADY_EXISTS: ${path}`);
    docs.set(path, materialize(undefined, data ?? {}, false));
    return;
  }
  if (kind === "update") {
    if (!prev) throw new FirestoreError(5, `NOT_FOUND: ${path}`);
    docs.set(path, materialize(prev, data ?? {}, true));
    return;
  }
  // set
  docs.set(path, materialize(prev, data ?? {}, options?.merge === true));
}

class DocSnap {
  readonly id: string;
  readonly ref: DocRef;
  constructor(readonly path: string, private readonly raw: Data | undefined) {
    this.id = lastSegment(path);
    this.ref = new DocRef(path);
  }
  get exists(): boolean {
    return this.raw !== undefined;
  }
  data(): Data | undefined {
    return this.raw === undefined ? undefined : {...this.raw};
  }
  get(field: string): unknown {
    return this.raw?.[field];
  }
}

class QuerySnap {
  readonly docs: DocSnap[];
  constructor(docsIn: DocSnap[]) {
    this.docs = docsIn;
  }
  get size(): number {
    return this.docs.length;
  }
  get empty(): boolean {
    return this.docs.length === 0;
  }
  forEach(fn: (d: DocSnap) => void): void {
    this.docs.forEach(fn);
  }
}

type Filter = {field: string; op: string; value: unknown};

function fieldValueOf(snap: DocSnap, field: string): unknown {
  if (field === "__name__") return snap.id;
  return snap.data()?.[field];
}

function matches(snap: DocSnap, f: Filter): boolean {
  const v = fieldValueOf(snap, f.field);
  switch (f.op) {
    case "==": return v === f.value;
    case "!=": return v !== f.value;
    case "in": return Array.isArray(f.value) && f.value.includes(v);
    case "not-in": return Array.isArray(f.value) && !f.value.includes(v);
    case "array-contains": return Array.isArray(v) && v.includes(f.value);
    case "<": return (v as number) < (f.value as number);
    case "<=": return (v as number) <= (f.value as number);
    case ">": return (v as number) > (f.value as number);
    case ">=": return (v as number) >= (f.value as number);
    default: throw new Error(`operador não suportado no fake: ${f.op}`);
  }
}

class Query {
  constructor(
    protected readonly parentPath: string,
    protected readonly filters: Filter[] = [],
    protected readonly max: number | null = null,
    protected readonly order: {field: string; dir: "asc" | "desc"} | null = null
  ) {}

  where(field: string, op: string, value: unknown): Query {
    return new Query(this.parentPath, [...this.filters, {field, op, value}], this.max, this.order);
  }
  limit(n: number): Query {
    return new Query(this.parentPath, this.filters, n, this.order);
  }
  orderBy(field: string, dir: "asc" | "desc" = "asc"): Query {
    return new Query(this.parentPath, this.filters, this.max, {field, dir});
  }
  /** Projeção de campos: o fake devolve documentos completos (suficiente para os testes). */
  select(..._fields: string[]): Query {
    return this;
  }

  async get(): Promise<QuerySnap> {
    return new QuerySnap(this.snapshots());
  }

  snapshots(): DocSnap[] {
    const prefix = `${this.parentPath}/`;
    let out: DocSnap[] = [];
    for (const [path, raw] of docs.entries()) {
      if (!path.startsWith(prefix)) continue;
      if (path.slice(prefix.length).includes("/")) continue;
      out.push(new DocSnap(path, raw));
    }
    out = out.filter((s) => this.filters.every((f) => matches(s, f)));
    if (this.order) {
      const {field, dir} = this.order;
      out.sort((a, b) => {
        const av = fieldValueOf(a, field) as number;
        const bv = fieldValueOf(b, field) as number;
        return (av > bv ? 1 : av < bv ? -1 : 0) * (dir === "asc" ? 1 : -1);
      });
    }
    if (this.max !== null) out = out.slice(0, this.max);
    return out;
  }
}

/** collectionGroup: todo documento cuja coleção-mãe tem o nome dado. */
class GroupQuery extends Query {
  constructor(private readonly groupName: string) {
    super("");
  }
  select(..._fields: string[]): GroupQuery {
    return this;
  }
  snapshots(): DocSnap[] {
    const out: DocSnap[] = [];
    for (const [path, raw] of docs.entries()) {
      const parts = path.split("/");
      if (parts.length % 2 === 0 && parts[parts.length - 2] === this.groupName) {
        out.push(new DocSnap(path, raw));
      }
    }
    return out.filter((s) => this.filters.every((f) => matches(s, f)));
  }
}

class CollRef extends Query {
  constructor(readonly path: string) {
    super(path);
  }
  doc(id?: string): DocRef {
    return new DocRef(`${this.path}/${id ?? `auto-${Math.random().toString(36).slice(2, 10)}`}`);
  }
  async add(data: Data): Promise<DocRef> {
    const ref = this.doc();
    applyWrite("create", ref.path, data);
    return ref;
  }
}

class DocRef {
  readonly id: string;
  constructor(readonly path: string) {
    this.id = lastSegment(path);
  }
  collection(name: string): CollRef {
    return new CollRef(`${this.path}/${name}`);
  }
  async get(): Promise<DocSnap> {
    return new DocSnap(this.path, docs.get(this.path));
  }
  async set(data: Data, options?: {merge?: boolean}): Promise<void> {
    applyWrite("set", this.path, data, options);
  }
  async create(data: Data): Promise<void> {
    applyWrite("create", this.path, data);
  }
  async update(data: Data): Promise<void> {
    applyWrite("update", this.path, data);
  }
  async delete(): Promise<void> {
    applyWrite("delete", this.path);
  }
}

type PendingWrite = () => void;

function toPath(ref: DocRef | string): string {
  return typeof ref === "string" ? ref : ref.path;
}

function queued(
  buffer: PendingWrite[],
  kind: "set" | "update" | "create" | "delete",
  ref: DocRef,
  data?: Data,
  options?: {merge?: boolean}
): void {
  buffer.push(() => applyWrite(kind, toPath(ref), data, options));
}

const fakeDb = {
  collection(path: string): CollRef {
    return new CollRef(path);
  },
  doc(path: string): DocRef {
    return new DocRef(path);
  },
  collectionGroup(name: string): GroupQuery {
    return new GroupQuery(name);
  },
  async runTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const buffer: PendingWrite[] = [];
    const tx = {
      get: (target: DocRef | Query) => target.get(),
      set: (ref: DocRef, data: Data, options?: {merge?: boolean}) =>
        queued(buffer, "set", ref, data, options),
      update: (ref: DocRef, data: Data) => queued(buffer, "update", ref, data),
      create: (ref: DocRef, data: Data) => queued(buffer, "create", ref, data),
      delete: (ref: DocRef) => queued(buffer, "delete", ref),
    };
    const result = await fn(tx);
    buffer.forEach((w) => w());
    return result;
  },
  batch() {
    const buffer: PendingWrite[] = [];
    return {
      set: (ref: DocRef, data: Data, options?: {merge?: boolean}) =>
        queued(buffer, "set", ref, data, options),
      update: (ref: DocRef, data: Data) => queued(buffer, "update", ref, data),
      create: (ref: DocRef, data: Data) => queued(buffer, "create", ref, data),
      delete: (ref: DocRef) => queued(buffer, "delete", ref),
      commit: async () => {
        buffer.forEach((w) => w());
      },
    };
  },
};

/** Grava um documento de teste diretamente, sem passar por regras. */
export function seed(path: string, data: Data): void {
  docs.set(path, {...data});
}

/** Lê o documento atual (cópia rasa) ou undefined. */
export function read(path: string): Data | undefined {
  const raw = docs.get(path);
  return raw === undefined ? undefined : {...raw};
}

/** Caminhos existentes que começam com o prefixo (para asserir criações). */
export function pathsWithPrefix(prefix: string): string[] {
  return [...docs.keys()].filter((p) => p.startsWith(prefix));
}

export function resetFakeDb(): void {
  docs.clear();
}

export const db = () => fakeDb;
