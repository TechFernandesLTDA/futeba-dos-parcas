const PRODUCTION_LOCAL_STORAGE_PREFIXES_TO_KEEP = [
  'firebase:',
  'offline_write_queue',
  'offline_queue_enc_key',
  'draft:',
  'game_draft_',
];

function clearStoragePreservingPrefixes(storage: Storage, prefixesToKeep: string[]) {
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    const shouldKeep = prefixesToKeep.some((prefix) => key.startsWith(prefix));
    if (!shouldKeep) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
}

export function clearDeveloperCache(
  mode: string,
  local: Storage = localStorage,
  session: Storage = sessionStorage,
) {
  if (mode === 'production') {
    clearStoragePreservingPrefixes(local, PRODUCTION_LOCAL_STORAGE_PREFIXES_TO_KEEP);
    clearStoragePreservingPrefixes(session, ['firebase:']);
    return;
  }

  local.clear();
  session.clear();
}
