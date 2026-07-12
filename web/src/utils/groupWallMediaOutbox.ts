const OUTBOX_DATABASE_NAME = 'futeba-group-wall-media-outbox';
const OUTBOX_DATABASE_VERSION = 1;
const OUTBOX_STORE_NAME = 'pending-media';
const OUTBOX_OWNER_INDEX = 'owner-uid';
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GROUP_WALL_MEDIA_OUTBOX_SCHEMA_VERSION = 1;
export const GROUP_WALL_MEDIA_OUTBOX_DEFAULT_TTL_MS = 60 * 60 * 1000;

export interface GroupWallMediaOutboxHighlightRef {
  gameId: string;
  highlightId: string;
}
export interface GroupWallMediaOutboxFingerprintInput {
  groupId: string;
  text: string;
  file: File;
  mediaType?: string | null;
  highlightRef?: GroupWallMediaOutboxHighlightRef | null;
}

export interface PutGroupWallMediaOutboxEntry {
  ownerUid: string;
  groupId: string;
  text: string;
  file: File;
  fingerprint: string;
  clientRequestId: string;
  highlightRef?: GroupWallMediaOutboxHighlightRef | null;
  /** Epoch milliseconds returned by the server. The local TTL remains an upper bound. */
  expiresAt?: number;
}

export interface GroupWallMediaOutboxEntry {
  schemaVersion: typeof GROUP_WALL_MEDIA_OUTBOX_SCHEMA_VERSION;
  ownerUid: string;
  groupId: string;
  text: string;
  file: File;
  fingerprint: string;
  clientRequestId: string;
  highlightRef: GroupWallMediaOutboxHighlightRef | null;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface GroupWallMediaOutboxReconciliation {
  entries: GroupWallMediaOutboxEntry[];
  expiredOrInvalidRemoved: number;
}

interface StoredGroupWallMediaOutboxEntry {
  key: string;
  schemaVersion: number;
  ownerUid: string;
  groupId: string;
  text: string;
  fileBlob: Blob;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileLastModified: number;
  fingerprint: string;
  clientRequestId: string;
  highlightRef: GroupWallMediaOutboxHighlightRef | null;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface GroupWallMediaOutboxOptions {
  indexedDBFactory?: IDBFactory | null;
  databaseName?: string;
  defaultTtlMs?: number;
  now?: () => number;
}

export class GroupWallMediaOutboxUnavailableError extends Error {
  readonly code = 'group-wall-outbox/unavailable';

  constructor() {
    super('O armazenamento local durável não está disponível neste navegador.');
    this.name = 'GroupWallMediaOutboxUnavailableError';
  }
}

function requireIdentifier(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 256) {
    throw new Error(`${field} inválido para a outbox do mural.`);
  }
  return normalized;
}

function outboxKey(ownerUid: string, groupId: string) {
  return JSON.stringify([ownerUid, groupId]);
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isValidStoredIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && value.trim() === value;
}

function isBlob(value: unknown): value is Blob {
  if (!value || typeof value !== 'object') return false;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  return Object.prototype.toString.call(value) === '[object Blob]';
}

function isHighlightRef(value: unknown): value is GroupWallMediaOutboxHighlightRef | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const highlight = value as Partial<GroupWallMediaOutboxHighlightRef>;
  return isValidStoredIdentifier(highlight.gameId) && isValidStoredIdentifier(highlight.highlightId);
}

function isStoredEntry(value: unknown): value is StoredGroupWallMediaOutboxEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<StoredGroupWallMediaOutboxEntry>;
  return entry.schemaVersion === GROUP_WALL_MEDIA_OUTBOX_SCHEMA_VERSION &&
    typeof entry.key === 'string' &&
    isValidStoredIdentifier(entry.ownerUid) &&
    isValidStoredIdentifier(entry.groupId) &&
    entry.key === outboxKey(entry.ownerUid, entry.groupId) &&
    typeof entry.text === 'string' &&
    isBlob(entry.fileBlob) &&
    typeof entry.fileName === 'string' && entry.fileName.length > 0 && entry.fileName.length <= 1024 &&
    typeof entry.fileType === 'string' && entry.fileType.length <= 256 &&
    typeof entry.fileSize === 'number' && Number.isFinite(entry.fileSize) && entry.fileSize >= 0 &&
    entry.fileBlob.size === entry.fileSize &&
    typeof entry.fileLastModified === 'number' && Number.isFinite(entry.fileLastModified) &&
    entry.fileLastModified >= 0 &&
    typeof entry.fingerprint === 'string' && entry.fingerprint.length > 0 && entry.fingerprint.length <= 4096 &&
    typeof entry.clientRequestId === 'string' && UUID_V4_PATTERN.test(entry.clientRequestId) &&
    isHighlightRef(entry.highlightRef) &&
    isFiniteTimestamp(entry.createdAt) &&
    isFiniteTimestamp(entry.updatedAt) &&
    isFiniteTimestamp(entry.expiresAt) &&
    entry.createdAt <= entry.updatedAt &&
    entry.updatedAt < entry.expiresAt;
}

function hydrateEntry(entry: StoredGroupWallMediaOutboxEntry): GroupWallMediaOutboxEntry {
  return {
    schemaVersion: GROUP_WALL_MEDIA_OUTBOX_SCHEMA_VERSION,
    ownerUid: entry.ownerUid,
    groupId: entry.groupId,
    text: entry.text,
    file: new File([entry.fileBlob], entry.fileName, {
      type: entry.fileType,
      lastModified: entry.fileLastModified,
    }),
    fingerprint: entry.fingerprint,
    clientRequestId: entry.clientRequestId,
    highlightRef: entry.highlightRef,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    expiresAt: entry.expiresAt,
  };
}

/**
 * Matches the existing in-memory intent identity without reading the full file.
 * The request UUID remains the authoritative idempotency key on the server.
 */
export function createGroupWallMediaOutboxFingerprint(input: GroupWallMediaOutboxFingerprintInput) {
  return JSON.stringify({
    groupId: input.groupId,
    text: input.text.trim(),
    name: input.file.name,
    type: input.mediaType ?? input.file.type,
    size: input.file.size,
    lastModified: input.file.lastModified,
    highlightRef: input.highlightRef ?? null,
  });
}

/**
 * Durable, best-effort storage for one pending media intent per user and group.
 * Server state remains authoritative; this class only restores the local draft.
 */
export class GroupWallMediaOutbox {
  private readonly factory: IDBFactory | null;
  private readonly databaseName: string;
  private readonly defaultTtlMs: number;
  private readonly now: () => number;
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(options: GroupWallMediaOutboxOptions = {}) {
    this.factory = options.indexedDBFactory === undefined
      ? (globalThis.indexedDB ?? null)
      : options.indexedDBFactory;
    this.databaseName = options.databaseName ?? OUTBOX_DATABASE_NAME;
    this.defaultTtlMs = options.defaultTtlMs ?? GROUP_WALL_MEDIA_OUTBOX_DEFAULT_TTL_MS;
    this.now = options.now ?? Date.now;

    if (!Number.isFinite(this.defaultTtlMs) || this.defaultTtlMs <= 0) {
      throw new Error('TTL inválido para a outbox do mural.');
    }
  }

  async put(input: PutGroupWallMediaOutboxEntry): Promise<GroupWallMediaOutboxEntry> {
    const ownerUid = requireIdentifier(input.ownerUid, 'ownerUid');
    const groupId = requireIdentifier(input.groupId, 'groupId');
    if (!(input.file instanceof File) || !input.file.name || input.file.name.length > 1024) {
      throw new Error('Arquivo inválido para a outbox do mural.');
    }
    const fingerprint = input.fingerprint.trim();
    if (!fingerprint || fingerprint.length > 4096) {
      throw new Error('Fingerprint inválido para a outbox do mural.');
    }
    if (!UUID_V4_PATTERN.test(input.clientRequestId)) {
      throw new Error('clientRequestId inválido para a outbox do mural.');
    }

    const highlightRef = input.highlightRef ?? null;
    if (!isHighlightRef(highlightRef)) {
      throw new Error('Destaque inválido para a outbox do mural.');
    }

    const now = this.now();
    if (!isFiniteTimestamp(now)) {
      throw new Error('Relógio inválido para a outbox do mural.');
    }
    const localExpiry = now + this.defaultTtlMs;
    const requestedExpiry = input.expiresAt ?? localExpiry;
    if (!isFiniteTimestamp(requestedExpiry) || requestedExpiry <= now) {
      throw new Error('Expiração inválida para a outbox do mural.');
    }
    const expiresAt = Math.min(requestedExpiry, localExpiry);
    const record: StoredGroupWallMediaOutboxEntry = {
      key: outboxKey(ownerUid, groupId),
      schemaVersion: GROUP_WALL_MEDIA_OUTBOX_SCHEMA_VERSION,
      ownerUid,
      groupId,
      text: input.text,
      fileBlob: input.file.slice(0, input.file.size, input.file.type),
      fileName: input.file.name,
      fileType: input.file.type,
      fileSize: input.file.size,
      fileLastModified: input.file.lastModified,
      fingerprint,
      clientRequestId: input.clientRequestId,
      highlightRef,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };

    const database = await this.openDatabase();
    await this.runWriteTransaction((store) => store.put(record), database);
    return hydrateEntry(record);
  }

  async restore(ownerUidValue: string, groupIdValue: string): Promise<GroupWallMediaOutboxEntry | null> {
    const ownerUid = requireIdentifier(ownerUidValue, 'ownerUid');
    const groupId = requireIdentifier(groupIdValue, 'groupId');
    const key = outboxKey(ownerUid, groupId);
    const now = this.now();
    const database = await this.openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(OUTBOX_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(OUTBOX_STORE_NAME);
      const request = store.get(key);
      let restored: GroupWallMediaOutboxEntry | null = null;

      request.onsuccess = () => {
        const value: unknown = request.result;
        if (!isStoredEntry(value) || value.expiresAt <= now) {
          if (value !== undefined) store.delete(key);
          return;
        }
        restored = hydrateEntry(value);
      };
      request.onerror = () => reject(request.error ?? new Error('Falha ao ler a outbox do mural.'));
      transaction.oncomplete = () => resolve(restored);
      transaction.onabort = () => reject(transaction.error ?? new Error('Leitura da outbox abortada.'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Falha na transação da outbox.'));
    });
  }

  /** Prunes expired/corrupt records and returns resumable local intents after reload. */
  async reconcile(ownerUidValue: string): Promise<GroupWallMediaOutboxReconciliation> {
    const ownerUid = requireIdentifier(ownerUidValue, 'ownerUid');
    const now = this.now();
    const database = await this.openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(OUTBOX_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(OUTBOX_STORE_NAME);
      const request = store.index(OUTBOX_OWNER_INDEX).getAll(ownerUid);
      const entries: GroupWallMediaOutboxEntry[] = [];
      let removed = 0;

      request.onsuccess = () => {
        const records = request.result as unknown[];
        for (const value of records) {
          if (!isStoredEntry(value) || value.expiresAt <= now) {
            if (value && typeof value === 'object' && 'key' in value && typeof value.key === 'string') {
              store.delete(value.key);
            }
            removed += 1;
            continue;
          }
          entries.push(hydrateEntry(value));
        }
      };
      request.onerror = () => reject(request.error ?? new Error('Falha ao reconciliar a outbox do mural.'));
      transaction.oncomplete = () => resolve({
        entries: entries.sort((left, right) => right.updatedAt - left.updatedAt),
        expiredOrInvalidRemoved: removed,
      });
      transaction.onabort = () => reject(transaction.error ?? new Error('Reconciliação da outbox abortada.'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Falha na transação da outbox.'));
    });
  }

  async remove(ownerUidValue: string, groupIdValue: string): Promise<void> {
    const ownerUid = requireIdentifier(ownerUidValue, 'ownerUid');
    const groupId = requireIdentifier(groupIdValue, 'groupId');
    const database = await this.openDatabase();
    await this.runWriteTransaction(
      (store) => store.delete(outboxKey(ownerUid, groupId)),
      database,
    );
  }

  async clearOwner(ownerUidValue: string): Promise<void> {
    const ownerUid = requireIdentifier(ownerUidValue, 'ownerUid');
    const database = await this.openDatabase();

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(OUTBOX_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(OUTBOX_STORE_NAME);
      const request = store.index(OUTBOX_OWNER_INDEX).getAllKeys(ownerUid);

      request.onsuccess = () => {
        for (const key of request.result) store.delete(key);
      };
      request.onerror = () => reject(request.error ?? new Error('Falha ao limpar a outbox do usuário.'));
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Limpeza da outbox abortada.'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Falha na transação da outbox.'));
    });
  }

  async close(): Promise<void> {
    const pending = this.databasePromise;
    this.databasePromise = null;
    if (!pending) return;
    try {
      const database = await pending;
      database.close();
    } catch {
      // Opening already failed; there is no handle to close.
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.factory) return Promise.reject(new GroupWallMediaOutboxUnavailableError());
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory!.open(this.databaseName, OUTBOX_DATABASE_VERSION);
      let abandoned = false;
      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.objectStoreNames.contains(OUTBOX_STORE_NAME)
          ? request.transaction!.objectStore(OUTBOX_STORE_NAME)
          : database.createObjectStore(OUTBOX_STORE_NAME, { keyPath: 'key' });
        if (!store.indexNames.contains(OUTBOX_OWNER_INDEX)) {
          store.createIndex(OUTBOX_OWNER_INDEX, 'ownerUid', { unique: false });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (abandoned) {
          database.close();
          return;
        }
        database.onversionchange = () => {
          database.close();
          this.databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () => reject(request.error ?? new Error('Falha ao abrir a outbox do mural.'));
      request.onblocked = () => {
        abandoned = true;
        reject(new Error('A atualização da outbox foi bloqueada por outra aba.'));
      };
    }).catch((error) => {
      this.databasePromise = null;
      throw error;
    });

    return this.databasePromise;
  }

  private runWriteTransaction(
    operation: (store: IDBObjectStore) => IDBRequest,
    database: IDBDatabase,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(OUTBOX_STORE_NAME, 'readwrite');
      let request: IDBRequest;
      try {
        request = operation(transaction.objectStore(OUTBOX_STORE_NAME));
      } catch (error) {
        transaction.abort();
        reject(error);
        return;
      }
      request.onerror = () => reject(request.error ?? new Error('Falha ao gravar a outbox do mural.'));
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Gravação da outbox abortada.'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Falha na transação da outbox.'));
    });
  }
}

/** Removes private pending blobs when an authenticated identity leaves. */
export async function clearGroupWallMediaOutboxOwner(ownerUid: string): Promise<void> {
  const outbox = new GroupWallMediaOutbox();
  try {
    await outbox.clearOwner(ownerUid);
  } finally {
    await outbox.close();
  }
}
