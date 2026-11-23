/**
 * Data e hora do jogo como instante (`dateTime`), a partir do que o formulário guarda:
 * `date` em "AAAA-MM-DD" e `time` em "HH:MM", na hora local de quem cria o jogo.
 *
 * É a mesma convenção do duplicar do web (useDuplicateGameCopy) e do app (o
 * módulo compartilhado converte pelo fuso do aparelho). As listas, lembretes e
 * regras ordenam e filtram por `dateTime`; jogo sem esse campo some das consultas.
 *
 * Devolve null quando a data é inválida, para o jogo não ser gravado com uma data errada.
 */
export function gameDateTimeFromLocal(date: unknown, time: unknown): Date | null {
  if (typeof date !== 'string') return null;
  const dataMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!dataMatch) return null;
  const [, ano, mes, dia] = dataMatch.map(Number);

  let hora = 0;
  let minuto = 0;
  if (typeof time === 'string' && time.trim()) {
    const horaMatch = /^(\d{1,2}):(\d{2})/.exec(time.trim());
    if (!horaMatch) return null;
    hora = Number(horaMatch[1]);
    minuto = Number(horaMatch[2]);
    if (hora > 23 || minuto > 59) return null;
  }

  const resultado = new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
  // Rejeita datas que o Date "corrige" (ex.: 2026-02-31 viraria 3 de março).
  if (resultado.getFullYear() !== ano || resultado.getMonth() !== mes - 1 || resultado.getDate() !== dia) {
    return null;
  }
  return resultado;
}
