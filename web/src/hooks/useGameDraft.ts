import { useState, useEffect, useCallback, useRef } from 'react';
import { saveDraft, loadDraft, clearDraft as clearDraftUtil } from '../utils/gameDraft';
import { useDebounce } from './useDebounce';

interface UseGameDraftOptions<T> {
  key: string;
  initialData: T;
  debounceMs?: number;
}

interface UseGameDraftReturn<T> {
  draft: T | null;
  hasDraft: boolean;
  draftSavedAt: Date | null;
  showPrompt: boolean;
  saveDraftData: (data: T) => void;
  restoreDraft: () => void;
  discardDraft: () => void;
  clearDraft: () => void;
  dismissPrompt: () => void;
}

export function useGameDraft<T extends Record<string, unknown>>({
  key,
  initialData: _initialData,
  debounceMs = 2000,
}: UseGameDraftOptions<T>): UseGameDraftReturn<T> {
  const [draft, setDraft] = useState<T | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [pendingData, setPendingData] = useState<T | null>(null);
  const isRestoringRef = useRef(false);

  const debouncedData = useDebounce(pendingData, debounceMs);

  const hasDraft = draft !== null;

  useEffect(() => {
    isRestoringRef.current = true;
    const stored = loadDraft(key);
    if (stored && stored.data && Object.keys(stored.data).length > 0) {
      setDraft(stored.data as T);
      setDraftSavedAt(new Date(stored.savedAt));
      setShowPrompt(true);
    }
    const timer = setTimeout(() => {
      isRestoringRef.current = false;
    }, 500);
    return () => clearTimeout(timer);
  }, [key]);

  useEffect(() => {
    if (isRestoringRef.current) return;
    if (debouncedData && Object.keys(debouncedData).length > 0) {
      saveDraft(key, debouncedData as unknown as Record<string, unknown>);
    }
  }, [debouncedData, key]);

  const saveDraftData = useCallback((data: T) => {
    setPendingData(data);
  }, []);

  const restoreDraft = useCallback(() => {
    setShowPrompt(false);
  }, []);

  const discardDraft = useCallback(() => {
    clearDraftUtil(key);
    setDraft(null);
    setDraftSavedAt(null);
    setShowPrompt(false);
    setPendingData(null);
  }, [key]);

  const clearDraft = useCallback(() => {
    clearDraftUtil(key);
    setDraft(null);
    setDraftSavedAt(null);
    setPendingData(null);
  }, [key]);

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
  }, []);

  return {
    draft,
    hasDraft,
    draftSavedAt,
    showPrompt,
    saveDraftData,
    restoreDraft,
    discardDraft,
    clearDraft,
    dismissPrompt,
  };
}
