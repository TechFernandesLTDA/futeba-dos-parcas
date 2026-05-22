/**
 * Comparador de versão semântica (`MAJOR.MINOR.PATCH`).
 *
 * Port TypeScript de `SemVer.kt` (KMP) — mantém o mesmo comportamento tolerante:
 * - prefixo `v` opcional (`v1.2.3`);
 * - sufixos de pré-release / build são ignorados (`1.2.3-beta`, `1.2.3+42`);
 * - componentes ausentes contam como `0` (`1.2` == `1.2.0`);
 * - componentes não numéricos contam como `0` (degradação segura, sem exceção).
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase F, task #20.
 */

function parse(version: string): number[] {
  return version
    .trim()
    .replace(/^[vV]/, '')
    .split('-')[0]
    .split('+')[0]
    .split('.')
    .map((part) => {
      const n = Number.parseInt(part.trim(), 10);
      return Number.isNaN(n) ? 0 : n;
    });
}

/**
 * Retorna `< 0` se [a] for anterior a [b], `0` se iguais, `> 0` se [a] for posterior.
 */
export function compareVersions(a: string, b: string): number {
  const partsA = parse(a);
  const partsB = parse(b);
  const size = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < size; i += 1) {
    const x = partsA[i] ?? 0;
    const y = partsB[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** `true` se [a] for estritamente mais nova que [b]. */
export function isNewerVersion(a: string, b: string): boolean {
  return compareVersions(a, b) > 0;
}
