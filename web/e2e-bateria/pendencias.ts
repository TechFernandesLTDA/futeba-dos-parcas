/**
 * Bateria — defeitos conhecidos que a bateria encontrou na master.
 *
 * Cada teste ligado a uma pendência usa `test.fail(true, PENDENCIAS.x)`: fica
 * verde enquanto o defeito existe e fica VERMELHO quando o defeito some, para
 * lembrar de tirar o `fail` e transformar o teste em guarda permanente.
 */
const ISSUE = 'https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues';

export const PENDENCIAS = {
  filaDeRevisaoDoAdmin: `${ISSUE}/4571 fila de revisão de jogos negada para ADMIN`,
  jogosForaDaAbaJogos: `${ISSUE}/4572 jogos sem deleted_at não aparecem na aba Jogos`,
  confirmadosParaQuemNaoConfirmou: `${ISSUE}/4573 lista de confirmados vazia para membro que não confirmou`,
  jogadorNaoCriaGrupoNoWeb: `${ISSUE}/4574 web só deixa FIELD_OWNER e ADMIN criarem grupo`,
} as const;
