/**
 * Formatação de datas para a feature "Novidades" (release notes).
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase F.
 */

/** Formata a data do release (epoch millis UTC) para o locale ativo; vazio se inválida. */
export function formatReleaseDate(epochMillis: number, locale: string): string {
  if (epochMillis <= 0) return '';
  try {
    return new Intl.DateTimeFormat(locale || 'pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(epochMillis));
  } catch {
    return '';
  }
}
