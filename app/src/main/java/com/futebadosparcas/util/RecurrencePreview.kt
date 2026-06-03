package com.futebadosparcas.util

import java.time.LocalDate

/**
 * Calculo puro das proximas datas de uma serie recorrente (spec #2398).
 *
 * Espelha o `getNextRecurrenceDates` do web (web/src/utils/recurrencePreview.ts):
 * weekly +7 dias, biweekly +14 dias, monthly +1 mes. Usado pelo preview da tela
 * de criacao de jogo. Mantido em :app (fora de commonMain) para evitar a
 * complexidade de build KMP neste slice.
 *
 * IMPORTANTE: aqui `count` representa a quantidade de datas FUTURAS desejadas
 * (NAO o total da serie). Quem chama deve passar o numero correto:
 * - modo "count" (total de N jogos): passar `total - 1` (a 1a ocorrencia ja e a base).
 * - modo "until"/"forever": passar um teto de preview (ex.: 12) e filtrar depois.
 *
 * @param baseDate Data da 1a ocorrencia (a base, nao incluida no resultado).
 * @param recurrence Tipo: "weekly" | "biweekly" | "monthly". Outros valores -> lista vazia.
 * @param count Quantas datas futuras gerar (clamp >= 0).
 * @return Lista de datas futuras, em ordem cronologica.
 */
fun nextRecurrenceDates(
    baseDate: LocalDate,
    recurrence: String,
    count: Int,
): List<LocalDate> {
    if (count <= 0) return emptyList()

    return (1..count).map { i ->
        when (recurrence) {
            "weekly" -> baseDate.plusDays(7L * i)
            "biweekly" -> baseDate.plusDays(14L * i)
            "monthly" -> baseDate.plusMonths(i.toLong())
            else -> return emptyList()
        }
    }
}
