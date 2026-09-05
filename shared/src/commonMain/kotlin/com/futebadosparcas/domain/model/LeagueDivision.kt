package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Divisoes da liga com suas configuracoes.
 *
 * SISTEMA DE RATING: Escala 0-100 (media ponderada)
 * -------------------------------------------------
 * O sistema usa uma formula ponderada baseada nos ultimos 10 jogos:
 * LR = (PPJ * 40%) + (WR * 30%) + (GD * 20%) + (MVP_Rate * 10%)
 *
 * Onde:
 * - PPJ = Pontos (XP) por Jogo (max 200 XP = 100 pontos)
 * - WR = Win Rate (100% = 100 pontos)
 * - GD = Goal Difference medio (+3 = 100, -3 = 0)
 * - MVP_Rate = Taxa de MVP (50% = 100 pontos, cap)
 *
 * DECISAO DE ARQUITETURA:
 * Este sistema 0-100 foi mantido em detrimento do sistema Elo (100-3000)
 * porque ja esta em producao e todos os thresholds estao definidos baseados nele.
 * O sistema Elo foi removido para evitar duplicidade e confusao.
 *
 * Thresholds de Divisao:
 * - Bronze: 0-29
 * - Prata: 30-49
 * - Ouro: 50-69
 * - Diamante: 70-100
 */
@Serializable
enum class LeagueDivision(
    val displayName: String,
    val emoji: String,
    val colorHex: String,
    /** Rating minimo para esta divisao (escala 0-100) */
    val minRating: Double,
    /** Rating maximo para esta divisao (escala 0-100) */
    val maxRating: Double
) {
    @SerialName("BRONZE")
    BRONZE("Bronze", "🥉", "#5D4037", 0.0, 29.99),

    @SerialName("PRATA")
    PRATA("Prata", "🥈", "#757575", 30.0, 49.99),

    @SerialName("OURO")
    OURO("Ouro", "🥇", "#FFD700", 50.0, 69.99),

    @SerialName("DIAMANTE")
    DIAMANTE("Diamante", "💎", "#00BCD4", 70.0, 100.0);

    companion object {
        /**
         * Retorna a divisao baseada no rating (escala 0-100).
         * Este e o sistema em producao.
         */
        fun fromRating(rating: Double): LeagueDivision {
            return when {
                rating >= DIAMANTE.minRating -> DIAMANTE
                rating >= OURO.minRating -> OURO
                rating >= PRATA.minRating -> PRATA
                else -> BRONZE
            }
        }

        /**
         * Retorna a divisao a partir do nome.
         * Suporta ambos os nomes: OURO/GOLD e PRATA/SILVER
         */
        fun fromString(value: String?): LeagueDivision {
            return when (value?.uppercase()) {
                "DIAMANTE", "DIAMOND" -> DIAMANTE
                "OURO", "GOLD" -> OURO
                "PRATA", "SILVER" -> PRATA
                "BRONZE" -> BRONZE
                else -> BRONZE
            }
        }

        /**
         * Retorna a proxima divisao (para promocao).
         */
        fun getNextDivision(current: LeagueDivision): LeagueDivision {
            return when (current) {
                BRONZE -> PRATA
                PRATA -> OURO
                OURO -> DIAMANTE
                DIAMANTE -> DIAMANTE
            }
        }

        /**
         * Retorna a divisao anterior (para rebaixamento).
         */
        fun getPreviousDivision(current: LeagueDivision): LeagueDivision {
            return when (current) {
                BRONZE -> BRONZE
                PRATA -> BRONZE
                OURO -> PRATA
                DIAMANTE -> OURO
            }
        }

        /**
         * Retorna o threshold de rating para a proxima divisao.
         */
        fun getNextDivisionThreshold(division: LeagueDivision): Double {
            return when (division) {
                BRONZE -> PRATA.minRating
                PRATA -> OURO.minRating
                OURO -> DIAMANTE.minRating
                DIAMANTE -> 100.0
            }
        }

        /**
         * Retorna o threshold de rating para a divisao anterior.
         */
        fun getPreviousDivisionThreshold(division: LeagueDivision): Double {
            return when (division) {
                BRONZE -> 0.0
                PRATA -> BRONZE.minRating
                OURO -> PRATA.minRating
                DIAMANTE -> OURO.minRating
            }
        }
    }
}
