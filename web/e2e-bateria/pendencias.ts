/**
 * Bateria — defeitos conhecidos que a bateria encontrou na master.
 *
 * Cada teste ligado a uma pendência usa `test.fail(true, PENDENCIAS.x)`: fica
 * verde enquanto o defeito existe e fica VERMELHO quando o defeito some, para
 * lembrar de tirar o `fail` e transformar o teste em guarda permanente.
 *
 * Formato de uma entrada: `chave: \`${ISSUE}/1234 resumo do defeito\``, com
 * `const ISSUE = 'https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues'`.
 *
 * Sem pendências abertas no web: #4571, #4572, #4573 e #4574 foram corrigidas
 * e os testes viraram regressão permanente.
 */
export const PENDENCIAS: Record<string, string> = {};
