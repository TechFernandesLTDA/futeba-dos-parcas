/**
 * Hooks da feature "Novidades" (release notes) no web.
 *
 * - [useReleaseNotes]: histórico completo de notas (tela "Novidades").
 * - [useWhatsNewPopup]: decide se o pop-up automático pós-update deve aparecer.
 * - [decideWhatsNewPopup]: lógica pura de decisão do pop-up (testável sem React).
 *
 * Espelha `WhatsNewViewModel` + `GetUnseenReleaseNotesUseCase` do Android. Como
 * o web não tem `buildNumber`, o "último visto" é a **string de versão** (SemVer)
 * persistida por dispositivo no `localStorage`.
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase F, tasks #20/#22.
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchReleaseNotes, WEB_PLATFORM } from '../services/releaseNotes';
import { ReleaseNote } from '../types/releaseNotes';
import { compareVersions, isNewerVersion } from '../utils/semver';
import { useLocalStorage } from './useLocalStorage';

/** Versão do web app rodando agora (injetada pelo Vite a partir de versions.json). */
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.0.0';

/** Chave do `localStorage` — "última versão de Novidades vista neste dispositivo". */
export const LAST_SEEN_VERSION_KEY = 'whats_new_last_seen_version';

const RELEASE_NOTES_QUERY_KEY = ['releaseNotes', WEB_PLATFORM] as const;

/**
 * Histórico de notas de versão, mais recente primeiro.
 *
 * O serviço já combina Firestore + fallback embarcado; offline ainda retorna a
 * lista embarcada. `error` só é preenchido se ambas as fontes falharem.
 */
export function useReleaseNotes() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: RELEASE_NOTES_QUERY_KEY,
    queryFn: () => fetchReleaseNotes(WEB_PLATFORM),
    staleTime: 30 * 60 * 1000, // 30 min — notas mudam só em corte de release
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    notes: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}

/**
 * Lógica pura: escolhe a nota que dispara o pop-up automático, ou `null`.
 *
 * O pop-up exibe a nota mais recente que:
 * - tem `showPopup = true`;
 * - é mais nova que [lastSeenVersion] (ainda não vista neste dispositivo);
 * - não é mais nova que [currentVersion] (não anuncia uma versão que o
 *   navegador ainda não está rodando).
 */
export function decideWhatsNewPopup(
  notes: ReleaseNote[],
  lastSeenVersion: string,
  currentVersion: string,
): ReleaseNote | null {
  const sorted = [...notes].sort((a, b) => compareVersions(b.version, a.version));
  return (
    sorted.find(
      (note) =>
        note.showPopup &&
        isNewerVersion(note.version, lastSeenVersion) &&
        compareVersions(note.version, currentVersion) <= 0,
    ) ?? null
  );
}

/**
 * Estado do pop-up automático "Novidades".
 *
 * @returns `popupNote` — nota a exibir, ou `null`; `dismiss` — fecha o pop-up e
 *          marca a versão atual como vista (não reaparece no próximo boot).
 */
export function useWhatsNewPopup() {
  const { notes } = useReleaseNotes();
  const [lastSeenVersion, setLastSeenVersion] = useLocalStorage<string>(
    LAST_SEEN_VERSION_KEY,
    '',
  );

  const popupNote = useMemo(
    () => decideWhatsNewPopup(notes, lastSeenVersion, CURRENT_VERSION),
    [notes, lastSeenVersion],
  );

  // Marca a versão ATUAL como vista (espelha o Android marcar `currentBuild`):
  // um pop-up por atualização, independente de qual nota foi exibida.
  const dismiss = useCallback(() => {
    setLastSeenVersion(CURRENT_VERSION);
  }, [setLastSeenVersion]);

  return { popupNote, dismiss };
}
