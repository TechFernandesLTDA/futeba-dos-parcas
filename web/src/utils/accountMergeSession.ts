const ACCOUNT_MERGE_SESSION_KEY = 'futeba.accountMerge';

export type PendingAccountMerge = {
  requestId: string;
  status: 'pending_cpf' | 'ready';
};

// Safari privado/ITP pode bloquear sessionStorage. O fallback mantém o fluxo
// vivo durante a navegação atual sem expor os UIDs que formam o requestId.
let inMemoryPendingMerge: PendingAccountMerge | null = null;

function parsePendingAccountMerge(raw: string | null): PendingAccountMerge | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingAccountMerge>;
    if (
      typeof value.requestId !== 'string' ||
      !/^[a-f0-9]{64}$/.test(value.requestId) ||
      (value.status !== 'pending_cpf' && value.status !== 'ready')
    ) return null;
    return value as PendingAccountMerge;
  } catch {
    return null;
  }
}

export function savePendingAccountMerge(value: PendingAccountMerge): void {
  inMemoryPendingMerge = value;
  try {
    sessionStorage.setItem(ACCOUNT_MERGE_SESSION_KEY, JSON.stringify(value));
  } catch {
    // Safari privado pode bloquear storage; o pedido continua no servidor.
  }
}

export function readPendingAccountMerge(): PendingAccountMerge | null {
  try {
    return parsePendingAccountMerge(sessionStorage.getItem(ACCOUNT_MERGE_SESSION_KEY)) ??
      inMemoryPendingMerge;
  } catch {
    return inMemoryPendingMerge;
  }
}

export function clearPendingAccountMerge(): void {
  inMemoryPendingMerge = null;
  try {
    sessionStorage.removeItem(ACCOUNT_MERGE_SESSION_KEY);
  } catch {
    // No-op: pedido concluído no servidor é idempotente.
  }
}
