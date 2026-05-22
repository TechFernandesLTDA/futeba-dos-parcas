/**
 * Monta o pop-up automático "Novidades" quando há uma nota de versão ainda não
 * vista neste dispositivo.
 *
 * Deve ser montado apenas em telas-raiz (ex.: HomeScreen) — espelha o gating
 * por `showNavigation` do Android, evitando que o pop-up cubra telas de detalhe.
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase F, task #22.
 */

import React from 'react';
import { useWhatsNewPopup } from '../../hooks/useReleaseNotes';
import { WhatsNewDialog } from './WhatsNewDialog';

export const WhatsNewPopupHost: React.FC = () => {
  const { popupNote, dismiss } = useWhatsNewPopup();
  if (!popupNote) return null;
  return <WhatsNewDialog note={popupNote} open onClose={dismiss} />;
};
