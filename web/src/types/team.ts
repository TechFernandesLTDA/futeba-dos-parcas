/** Time de futebol profissional que o usuario torce (ex: Corinthians, Flamengo) */
export interface FavoriteTeam {
  id: string;
  name: string;
  badgeUrl: string | null;
  shortName?: string;
  category?: string;
  state?: string;
}
