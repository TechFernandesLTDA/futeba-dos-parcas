package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Divisoes da liga com suas configuracoes.
 */
@Serializable
enum class LeagueDivision(
    val displayName: String,
    val emoji: String,
    val minRating: Int,
    val maxRating: Int
) {
    @SerialName("BRONZE")
    BRONZE("Bronze", "🥉", 0, 999),

    @SerialName("SILVER")
    SILVER("Prata", "🥈", 1000, 1499),

    @SerialName("GOLD")
    GOLD("Ouro", "🥇", 1500, 1999),

    @SerialName("DIAMOND")
    DIAMOND("Diamante", "💎", 2000, Int.MAX_VALUE);

    companion object {
        /**
         * Retorna a divisao baseada no rating.
         */
        fun fromRating(rating: Int): LeagueDivision {
            return entries.findLast { rating >= it.minRating } ?: BRONZE
        }

        /**
         * Retorna a divisao a partir do nome.
         */
        fun fromString(value: String?): LeagueDivision {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: BRONZE
        }
    }
}
