package com.futebadosparcas.widget

import java.util.Date

/**
 * Regras puras do widget "Próximo jogo", separadas para teste no JVM.
 */
internal object ProximoJogoWidget {

    /** Limite de valores de um `whereIn` por ID de documento. */
    const val TAMANHO_BLOCO = 10

    /** Status de jogo que ainda pode acontecer. */
    val STATUS_ATIVOS = listOf("SCHEDULED", "CONFIRMED")

    /** IDs sem repetição e sem vazios, em blocos de até [TAMANHO_BLOCO]. */
    fun blocos(ids: List<String>): List<List<String>> =
        ids.filter { it.isNotBlank() }.distinct().chunked(TAMANHO_BLOCO)

    /**
     * O jogo com a data mais próxima que ainda não passou. Jogos sem data ficam de fora.
     */
    fun <T> escolherProximo(jogos: List<T>, agora: Date, dataDe: (T) -> Date?): T? =
        jogos.mapNotNull { jogo -> dataDe(jogo)?.takeIf { !it.before(agora) }?.let { jogo to it } }
            .minByOrNull { it.second.time }
            ?.first
}
