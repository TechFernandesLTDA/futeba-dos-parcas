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

/**
 * FIX #3908: converte a chave YYYY-MM da temporada no instante de início
 * do mês (dia 1º, 00:00 America/Sao_Paulo — 03:00 UTC, sem horário de
 * verão no Brasil desde 2019).
 *
 * Usado como `start_date` da temporada provisionada sob demanda em
 * `group-league.ts`: a chave ali deriva do MÊS DO JOGO
 * (`deriveFallbackSeasonId`), que pode ser retroativo. Usar
 * `FieldValue.serverTimestamp()` (o agora) gravava `start_date` no mês
 * corrente mesmo quando a temporada era de um mês passado — e
 * `useGroupLeague` ordena as temporadas por `start_date`.
 *
 * @param {string} monthKey Chave no formato YYYY-MM.
 * @return {Date} Instante do dia 1º às 00:00 BRT do mês informado.
 */
export function monthKeyToStartDate(monthKey: string): Date {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  return new Date(Date.UTC(year, month - 1, 1, 3, 0, 0));
}
