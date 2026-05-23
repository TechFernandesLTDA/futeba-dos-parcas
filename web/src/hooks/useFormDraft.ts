import { useState, useEffect, useCallback, useRef } from 'react';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const DEBOUNCE_MS = 500;
const SENSITIVE_KEYS = ['cpf', 'password', 'senha', 'credit_card', 'card_number'];

interface DraftEntry<T> {
  data: T;
  savedAt: number;
}

function isSensitive(key: string): boolean {
  return SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk));
}

function sanitize<T extends Record<string, unknown>>(data: T): T {
  const result = { ...data };
  for (const key of Object.keys(result)) {
    if (isSensitive(key)) {
      delete result[key];
    }
  }
  return result;
}

export function useFormDraft<T extends Record<string, unknown>>(
  formKey: string,
): {
  draft: T | null;
  saveDraft: (data: T) => void;
  clearDraft: () => void;
  hasDraft: boolean;
} {
  const storageKey = `draft:${formKey}`;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [draft, setDraft] = useState<T | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const entry: DraftEntry<T> = JSON.parse(raw);
      if (Date.now() - entry.savedAt > SEVEN_DAYS_MS) {
        localStorage.removeItem(storageKey);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  });

  const saveDraft = useCallback(
    (data: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const sanitized = sanitize(data);
        const entry: DraftEntry<T> = { data: sanitized, savedAt: Date.now() };
        try {
          localStorage.setItem(storageKey, JSON.stringify(entry));
        } catch {
          // quota exceeded — ignore silently
        }
        setDraft(sanitized);
      }, DEBOUNCE_MS);
    },
    [storageKey],
  );

  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.removeItem(storageKey);
    setDraft(null);
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { draft, saveDraft, clearDraft, hasDraft: draft !== null };
}
