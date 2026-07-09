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
  const pendingDraftRef = useRef<T | null>(null);

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
    } catch (error) {
      console.warn('Failed to read form draft from localStorage:', error);
      return null;
    }
  });

  const persistDraft = useCallback((data: T, updateState = true) => {
    const entry: DraftEntry<T> = { data, savedAt: Date.now() };
    try {
      localStorage.setItem(storageKey, JSON.stringify(entry));
    } catch (error) {
      console.warn('Failed to save form draft to localStorage:', error);
    }
    if (updateState) {
      setDraft(data);
    }
  }, [storageKey]);

  const saveDraft = useCallback(
    (data: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const sanitized = sanitize(data);
      pendingDraftRef.current = sanitized;
      timerRef.current = setTimeout(() => {
        persistDraft(sanitized);
        pendingDraftRef.current = null;
      }, DEBOUNCE_MS);
    },
    [persistDraft],
  );

  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingDraftRef.current = null;
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear form draft from localStorage:', error);
    }
    setDraft(null);
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (pendingDraftRef.current) {
        persistDraft(pendingDraftRef.current, false);
        pendingDraftRef.current = null;
      }
    };
  }, [persistDraft]);

  return { draft, saveDraft, clearDraft, hasDraft: draft !== null };
}
