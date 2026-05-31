const DRAFT_PREFIX = 'game_draft_';
const DRAFT_EXPIRY_HOURS = 24;

interface DraftEntry {
  data: Record<string, unknown>;
  savedAt: number;
}

export function saveDraft(key: string, data: Record<string, unknown>): void {
  try {
    const entry: DraftEntry = { data, savedAt: Date.now() };
    localStorage.setItem(`${DRAFT_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // localStorage cheio ou indisponível — falha silenciosa
  }
}

export function loadDraft(key: string): { data: Record<string, unknown>; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${key}`);
    if (!raw) return null;
    const entry: DraftEntry = JSON.parse(raw);
    const hoursSinceSave = (Date.now() - entry.savedAt) / (1000 * 60 * 60);
    if (hoursSinceSave > DRAFT_EXPIRY_HOURS) {
      clearDraft(key);
      return null;
    }
    return { data: entry.data, savedAt: entry.savedAt };
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
  } catch {
    // falha silenciosa
  }
}

export function getDraftSavedAt(key: string): Date | null {
  const draft = loadDraft(key);
  return draft ? new Date(draft.savedAt) : null;
}

export function listDrafts(): string[] {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) {
        keys.push(key.replace(DRAFT_PREFIX, ''));
      }
    }
    return keys;
  } catch {
    return [];
  }
}
