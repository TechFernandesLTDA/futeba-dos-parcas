/**
 * Nomenclatura de temporadas da Liga por grupo.
 *
 * Extraido de season-cycle.ts (#3896) para que o provisionamento sob
 * demanda em group-league.ts use exatamente o mesmo nome dos crons, sem
 * importar o modulo de scheduler — que registraria onSchedule no load e
 * obrigaria toda suite que toca group-league a mockar o scheduler.
 */

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * Retorna o nome do mes em portugues.
 *
 * @param {string} monthKey Chave no formato YYYY-MM.
 * @return {string} Nome do mes.
 */
export function getMonthName(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const m = parseInt(month, 10) - 1;
  return `${MONTH_NAMES[m]} de ${year}`;
}

/**
 * Nome exibido do documento de temporada.
 *
 * @param {string} monthKey Chave no formato YYYY-MM.
 * @return {string} Nome da temporada.
 */
export function buildSeasonName(monthKey: string): string {
  return `Temporada ${getMonthName(monthKey)}`;
}
