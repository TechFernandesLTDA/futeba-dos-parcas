/**
 * Tipos do domínio "Novidades" (release notes) — espelham o modelo KMP
 * (`ReleaseNote.kt` em `shared/commonMain`).
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase F, task #20.
 */

/** Tipo de release, alinhado ao versionamento semântico. */
export type ReleaseType = 'major' | 'minor' | 'patch';

/** Card de destaque de um release — ícone + título + descrição curta. */
export interface ReleaseHighlight {
  icon: string;
  title: string;
  description: string;
}

/**
 * Nota de versão já achatada para consumo da UI.
 *
 * `buildNumber` é `null` na plataforma web (web versiona só por SemVer); os apps
 * nativos preenchem com o número de build. A lógica de pop-up no web usa o
 * comparador SemVer sobre `version`, não `buildNumber`.
 */
export interface ReleaseNote {
  platform: string;
  version: string;
  buildNumber: number | null;
  /** Data do release em epoch millis (UTC). */
  releaseDate: number;
  type: ReleaseType;
  headline: string;
  highlights: ReleaseHighlight[];
  added: string[];
  improved: string[];
  fixed: string[];
  issueRefs: number[];
  /** Se `true`, esta nota dispara o pop-up automático pós-atualização. */
  showPopup: boolean;
}

/** Converte uma string (qualquer caixa) em [ReleaseType]; fallback `minor`. */
export function normalizeReleaseType(value: unknown): ReleaseType {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'major' || v === 'patch' ? v : 'minor';
}
