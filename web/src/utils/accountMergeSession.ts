const ACCOUNT_MERGE_SESSION_KEY = 'futeba.accountMerge';

export type PendingAccountMerge = {
  requestId: string;
  status: 'pending_cpf' | 'ready';
};

export function savePendingAccountMerge(value: PendingAccountMerge): void {
  try {
    sessionStorage.setItem(ACCOUNT_MERGE_SESSION_KEY, JSON.stringify(value));
  } catch {
    // Safari privado pode bloquear storage; o pedido continua no servidor.
  }
}

export function readPendingAccountMerge(): PendingAccountMerge | null {
  try {
    const raw = sessionStorage.getItem(ACCOUNT_MERGE_SESSION_KEY);
    if (!raw) return null;
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

export function clearPendingAccountMerge(): void {
  try {
    sessionStorage.removeItem(ACCOUNT_MERGE_SESSION_KEY);
  } catch {
    // No-op: pedido concluído no servidor é idempotente.
  }
}

