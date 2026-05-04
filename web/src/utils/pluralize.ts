/**
 * Retorna singular ou plural baseado em count.
 * @example pluralize(1, 'jogo', 'jogos') → 'jogo'
 * @example pluralize(2, 'jogo', 'jogos') → 'jogos'
 * @example pluralize(0, 'jogo', 'jogos') → 'jogos'
 */
export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * Formato "N item(s)" — count + palavra com pluralização correta.
 * @example pluralizeCount(1, 'jogo', 'jogos') → '1 jogo'
 * @example pluralizeCount(5, 'membro', 'membros') → '5 membros'
 */
export function pluralizeCount(count: number, singular: string, plural: string): string {
  return `${count} ${pluralize(count, singular, plural)}`;
}
