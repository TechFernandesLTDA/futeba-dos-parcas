/**
 * Classifica o erro da callable `deleteAccount` (#4391).
 *
 * Contrato do backend (functions/src/auth/delete-account.ts):
 * - failed-precondition + details.reason 'requires-recent-login'
 * - failed-precondition + details.reason 'sole-owner-groups' + details.groups [{id, name}]
 * - resource-exhausted (3 por hora)
 */

export interface OwnedGroupRef {
  id: string;
  name: string;
}

export type DeleteAccountFailure =
  | { kind: 'requires-recent-login' }
  | { kind: 'sole-owner-groups'; groups: OwnedGroupRef[] }
  | { kind: 'rate-limited' }
  | { kind: 'other'; code: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Aceita só entradas com `id` string; o nome cai para o id se vier vazio. */
function parseGroups(raw: unknown): OwnedGroupRef[] {
  if (!Array.isArray(raw)) return [];
  const groups: OwnedGroupRef[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id === '') continue;
    const name = typeof item.name === 'string' && item.name.trim() !== '' ? item.name : item.id;
    groups.push({ id: item.id, name });
  }
  return groups;
}

export function classifyDeleteAccountError(error: unknown): DeleteAccountFailure {
  const rawCode = isRecord(error) && typeof error.code === 'string' ? error.code : '';
  // Alguns SDKs devolvem o código com prefixo 'functions/'
  const code = rawCode.replace(/^functions\//, '');
  const details = isRecord(error) && isRecord(error.details) ? error.details : undefined;

  if (code === 'failed-precondition' && details) {
    if (details.reason === 'requires-recent-login') {
      return { kind: 'requires-recent-login' };
    }
    if (details.reason === 'sole-owner-groups') {
      return { kind: 'sole-owner-groups', groups: parseGroups(details.groups) };
    }
  }
  if (code === 'resource-exhausted') {
    return { kind: 'rate-limited' };
  }
  return { kind: 'other', code };
}
