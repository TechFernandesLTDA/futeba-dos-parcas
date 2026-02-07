package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// NOTA: CancellationReason nao usa @Serializable para evitar bug do
// compilador Kotlin 2.2.x com enums + companion object.
// O campo 'reason' e serializado como String no modelo GameCancellation.

/**
 * Motivos pre-definidos para cancelamento de presenca em um jogo.
 */
enum class CancellationReason(val displayName: String) {
    UNEXPECTED("Imprevisto"),
    INJURY("Lesao"),
    WORK("Trabalho"),
    FAMILY("Familia"),
    WEATHER("Clima"),
    TRANSPORT("Transporte"),
    FINANCIAL("Financeiro"),
    OTHER("Outro");

    companion object {
        fun fromString(value: String?): CancellationReason {
            return entries.find { it.name == value } ?: OTHER
        }
    }
}

/**
 * Representa um registro de cancelamento de presenca em um jogo (versao KMP).
 *
 * Armazena o motivo do cancelamento para fins de historico e confiabilidade.
 * Colecao Firestore: games/{gameId}/cancellations
 */
@Serializable
data class GameCancellation(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("user_name") val userName: String = "",
    val reason: String = CancellationReason.OTHER.name,
    @SerialName("reason_text") val reasonText: String? = null,
    @SerialName("cancelled_at") val cancelledAt: Long? = null,
    @SerialName("hours_before_game") val hoursBeforeGame: Double = 0.0
) {
    /**
     * Retorna o enum do motivo do cancelamento.
     */
    fun getReasonEnum(): CancellationReason = CancellationReason.fromString(reason)

    /**
     * Retorna o texto de exibicao do motivo.
     * Usa o texto personalizado se o motivo for OTHER e houver texto.
     */
    fun getDisplayReason(): String {
        return if (reason == CancellationReason.OTHER.name && !reasonText.isNullOrBlank()) {
            reasonText
        } else {
            getReasonEnum().displayName
        }
    }

    /**
     * Retorna true se o cancelamento foi feito em cima da hora (< 2h antes do jogo).
     */
    fun isLastMinute(): Boolean = hoursBeforeGame < 2.0
}
