/**
 * Hook de onboarding — carrossel de boas-vindas e checklist de primeiros passos.
 *
 * Spec: feat-2026-05-16-modern-onboarding-tour §3.3
 *
 * Armazena estado em Firestore (users/{uid}.onboarding) com merge parcial via dot-notation.
 * Fallback para localStorage se o usuário não estiver autenticado.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createLogger } from '../utils/logger';
import { trackEvent } from '../utils/analytics';

const logger = createLogger('useOnboarding');

const CURRENT_ONBOARDING_VERSION = 1;
const LOCALSTORAGE_KEY = 'appGuideShown'; // compatibilidade com flag legado

export interface OnboardingState {
  carouselCompletedAt: number | null;
  carouselSkipped: boolean;
  checklistSteps: Record<string, boolean>;
  checklistCompletedAt: number | null;
  checklistDismissed: boolean;
  rewardGranted: boolean;
  version: number;
}

const DEFAULT_STATE: OnboardingState = {
  carouselCompletedAt: null,
  carouselSkipped: false,
  checklistSteps: {},
  checklistCompletedAt: null,
  checklistDismissed: false,
  rewardGranted: false,
  version: CURRENT_ONBOARDING_VERSION,
};

type FirestoreTimestamp = { toMillis?: () => number };

function toMillis(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && typeof (value as FirestoreTimestamp).toMillis === 'function') {
    return (value as FirestoreTimestamp).toMillis!();
  }
  return null;
}

function mapFromFirestore(data: Record<string, unknown>): OnboardingState {
  return {
    carouselCompletedAt: toMillis(data['carousel_completed_at']),
    carouselSkipped: (data['carousel_skipped'] as boolean) ?? false,
    checklistSteps: (data['checklist_steps'] as Record<string, boolean>) ?? {},
    checklistCompletedAt: toMillis(data['checklist_completed_at']),
    checklistDismissed: (data['checklist_dismissed'] as boolean) ?? false,
    rewardGranted: (data['reward_granted'] as boolean) ?? false,
    version: (data['version'] as number) ?? CURRENT_ONBOARDING_VERSION,
  };
}

export function useOnboarding() {
  const { firebaseUser } = useAuth();
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const carouselStartRef = useRef<number>(0);
  const checklistStartRef = useRef<number>(0);

  // Carrega estado do Firestore
  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid) {
      // Usuário não autenticado — usa localStorage como fallback
      let shown = false;
      try {
        shown = localStorage.getItem(LOCALSTORAGE_KEY) === 'true';
      } catch (error) {
        console.warn('Failed to read onboarding state from localStorage:', error);
      }
      setState(prev => ({ ...prev, carouselSkipped: shown, carouselCompletedAt: shown ? Date.now() : null }));
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (cancelled) return;
        if (userDoc.exists()) {
          const onboardingData = userDoc.get('onboarding') as Record<string, unknown> | undefined;
          if (onboardingData) {
            setState(mapFromFirestore(onboardingData));
          }
        }
      } catch (err) {
        // Não bloqueia o usuário — mantém estado default silenciosamente
        logger.warn('Erro ao carregar estado de onboarding (não-fatal):', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [firebaseUser?.uid]);

  /** Persiste campos específicos no Firestore usando dot-notation (merge parcial). */
  const persistUpdates = useCallback(async (updates: Record<string, unknown>) => {
    const uid = firebaseUser?.uid;
    if (!uid) return;
    try {
      const dotNotation: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        dotNotation[`onboarding.${key}`] = value;
      }
      await updateDoc(doc(db, 'users', uid), dotNotation);
    } catch (err) {
      // Falha silenciosa na persistência — não bloqueia UX
      logger.warn('Erro ao persistir onboarding (não-fatal):', err);
    }
  }, [firebaseUser?.uid]);

  /** Verifica se o carrossel já foi visto nesta versão. */
  const hasSeenCarousel = useCallback((): boolean => {
    let legacyShown = false;
    try {
      legacyShown = localStorage.getItem(LOCALSTORAGE_KEY) === 'true';
    } catch (error) {
      console.warn('Failed to read onboarding state from localStorage:', error);
    }
    return legacyShown ||
      ((state.carouselCompletedAt !== null || state.carouselSkipped) &&
       state.version >= CURRENT_ONBOARDING_VERSION);
  }, [state]);

  // ─── Carrossel ──────────────────────────────────────────────────────────────

  const onCarouselStarted = useCallback(() => {
    carouselStartRef.current = Date.now();
    trackEvent('onboarding_started', {});
  }, []);

  const onSlideViewed = useCallback((slideIndex: number, slideId: string) => {
    trackEvent('onboarding_slide_viewed', { slide_index: slideIndex, slide_id: slideId });
  }, []);

  const onCarouselSkipped = useCallback(async (atSlideIndex: number) => {
    trackEvent('onboarding_skipped', { at_slide_index: atSlideIndex });
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, 'true');
    } catch (error) {
      console.warn('Failed to save onboarding state to localStorage:', error);
    }
    setState(prev => ({ ...prev, carouselSkipped: true, version: CURRENT_ONBOARDING_VERSION }));
    await persistUpdates({
      carousel_skipped: true,
      version: CURRENT_ONBOARDING_VERSION,
    });
  }, [persistUpdates]);

  const onCarouselCompleted = useCallback(async () => {
    const durationMs = Date.now() - carouselStartRef.current;
    trackEvent('onboarding_carousel_completed', { duration_ms: durationMs });
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, 'true');
    } catch (error) {
      console.warn('Failed to save onboarding state to localStorage:', error);
    }
    const now = Date.now();
    setState(prev => ({ ...prev, carouselCompletedAt: now, version: CURRENT_ONBOARDING_VERSION }));
    await persistUpdates({
      carousel_completed_at: serverTimestamp(),
      carousel_skipped: false,
      version: CURRENT_ONBOARDING_VERSION,
    });
  }, [persistUpdates]);

  // ─── Checklist ──────────────────────────────────────────────────────────────

  const onChecklistVisible = useCallback(() => {
    checklistStartRef.current = Date.now();
  }, []);

  const onChecklistStepCompleted = useCallback((stepId: string) => {
    const timeSinceStart = Date.now() - checklistStartRef.current;
    trackEvent('checklist_step_completed', { step_id: stepId, time_since_start_ms: timeSinceStart });
  }, []);

  const onChecklistAllCompleted = useCallback(async (totalDurationMs: number) => {
    trackEvent('checklist_completed', { total_duration_ms: totalDurationMs });
    trackEvent('onboarding_reward_granted', { reward_type: 'badge_welcome' });
    const now = Date.now();
    setState(prev => ({ ...prev, checklistCompletedAt: now, rewardGranted: true }));
    await persistUpdates({
      checklist_completed_at: serverTimestamp(),
      reward_granted: true,
    });
  }, [persistUpdates]);

  const onChecklistDismissed = useCallback(async (stepsDone: number, stepsTotal: number) => {
    trackEvent('checklist_dismissed', { steps_done: stepsDone, steps_total: stepsTotal });
    setState(prev => ({ ...prev, checklistDismissed: true }));
    await persistUpdates({ checklist_dismissed: true });
  }, [persistUpdates]);

  return {
    state,
    loading,
    hasSeenCarousel,
    // Carrossel
    onCarouselStarted,
    onSlideViewed,
    onCarouselSkipped,
    onCarouselCompleted,
    // Checklist
    onChecklistVisible,
    onChecklistStepCompleted,
    onChecklistAllCompleted,
    onChecklistDismissed,
  };
}
