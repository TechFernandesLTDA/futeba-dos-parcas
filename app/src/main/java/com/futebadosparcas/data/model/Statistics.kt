package com.futebadosparcas.data.model

import com.futebadosparcas.domain.validation.ValidationErrorCode
import com.futebadosparcas.domain.validation.ValidationHelper
import com.futebadosparcas.domain.validation.ValidationResult
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Estatisticas do usuario.
 *
 * IMPORTANTE: Os nomes dos campos NO FIRESTORE devem ser em camelCase
 * para que as queries orderBy funcionem corretamente.
 * Ex: orderBy("totalGoals") requer campo "totalGoals" no documento.
 */
@IgnoreExtraProperties
data class UserStatistics(
    @DocumentId
    val id: String = "", // mesmo ID do usuario

    // Campos presentes no Firestore para consistência
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",

    var totalGames: Int = 0,
    var totalGoals: Int = 0,
    var totalAssists: Int = 0,
    var totalSaves: Int = 0,
    var totalYellowCards: Int = 0,
    var totalRedCards: Int = 0,
    var bestPlayerCount: Int = 0,
    var worstPlayerCount: Int = 0,
    var bestGoalCount: Int = 0,
    var gamesWon: Int = 0,
    var gamesLost: Int = 0,
    var gamesDraw: Int = 0,
    // MVP Streak - sequencia atual de jogos como MVP
    var currentMvpStreak: Int = 0,
    // Contadores para calculo de presenca
    @get:PropertyName("games_invited")
    @set:PropertyName("games_invited")
    var gamesInvited: Int = 0, // Total de jogos para os quais foi convidado
    @get:PropertyName("games_attended")
    @set:PropertyName("games_attended")
    var gamesAttended: Int = 0, // Total de jogos que compareceu (confirmou e jogou)

    // Data do último cálculo de estatísticas (#12 - Validação Firebase)
    @ServerTimestamp
    @get:PropertyName("last_calculated_at")
    @set:PropertyName("last_calculated_at")
    var lastCalculatedAt: Date? = null,

    // Última atualização do documento no Firestore
    @get:PropertyName("updated_at")
    @set:PropertyName("updated_at")
    var updatedAt: Date? = null
) {
    constructor() : this(id = "")

    /**
     * Taxa de presenca do jogador.
     * Calculado como: jogos que compareceu / jogos convidados.
     * Se nao houver jogos convidados registrados, usa totalGames como fallback.
     * Retorna valor entre 0.0 e 1.0 (ou 100% se quiser exibir como porcentagem).
     */
    val presenceRate: Double
        get() {
            // Se temos dados de convites, usar formula correta
            if (gamesInvited > 0) {
                return (gamesAttended.toDouble() / gamesInvited).coerceIn(0.0, 1.0)
            }
            // Fallback: se jogou pelo menos 1 jogo, assume 100% de presenca nos jogos registrados
            // Isso e temporario ate termos dados de convites
            return if (totalGames > 0) 1.0 else 0.0
        }

    /**
     * Taxa de vitorias do jogador.
     */
    val winRate: Double
        get() = if (totalGames > 0) gamesWon.toDouble() / totalGames else 0.0

    /**
     * Media de gols por jogo.
     */
    val avgGoalsPerGame: Double
        get() = if (totalGames > 0) totalGoals.toDouble() / totalGames else 0.0

    /**
     * Media de assistencias por jogo.
     */
    val avgAssistsPerGame: Double
        get() = if (totalGames > 0) totalAssists.toDouble() / totalGames else 0.0

    /**
     * Media de defesas por jogo.
     */
    val avgSavesPerGame: Double
        get() = if (totalGames > 0) totalSaves.toDouble() / totalGames else 0.0

    /**
     * Total de cartoes (amarelos + vermelhos).
     */
    val totalCards: Int
        get() = totalYellowCards + totalRedCards

    /**
     * Media de cartoes por jogo.
     */
    val avgCardsPerGame: Double
        get() = if (totalGames > 0) totalCards.toDouble() / totalGames else 0.0

    /**
     * Saldo de gols (considerando jogos de goleiro vs linha).
     * Para jogadores de linha: gols marcados.
     * Para goleiros: defesas - gols sofridos (aproximado pelo saves).
     */
    val goalsBalance: Int
        get() = totalGoals

    /**
     * Porcentagem de jogos como MVP.
     */
    val mvpRate: Double
        get() = if (totalGames > 0) bestPlayerCount.toDouble() / totalGames else 0.0

    // ==================== VALIDAÇÃO ====================

    /**
     * Valida todos os campos das estatísticas.
     *
     * @return Lista de erros de validação (vazia se tudo válido)
     */
    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()

        // Campos inteiros não podem ser negativos
        if (totalGames < 0) errors.add(ValidationResult.Invalid(
            "totalGames", "Total de jogos não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (totalGoals < 0) errors.add(ValidationResult.Invalid(
            "totalGoals", "Total de gols não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (totalAssists < 0) errors.add(ValidationResult.Invalid(
            "totalAssists", "Total de assistências não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (totalSaves < 0) errors.add(ValidationResult.Invalid(
            "totalSaves", "Total de defesas não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (totalYellowCards < 0) errors.add(ValidationResult.Invalid(
            "totalYellowCards", "Cartões amarelos não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (totalRedCards < 0) errors.add(ValidationResult.Invalid(
            "totalRedCards", "Cartões vermelhos não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (bestPlayerCount < 0) errors.add(ValidationResult.Invalid(
            "bestPlayerCount", "Contagem MVP não pode ser negativa", ValidationErrorCode.NEGATIVE_VALUE))
        if (worstPlayerCount < 0) errors.add(ValidationResult.Invalid(
            "worstPlayerCount", "Contagem Bola Murcha não pode ser negativa", ValidationErrorCode.NEGATIVE_VALUE))
        if (gamesWon < 0) errors.add(ValidationResult.Invalid(
            "gamesWon", "Vitórias não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (gamesLost < 0) errors.add(ValidationResult.Invalid(
            "gamesLost", "Derrotas não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (gamesDraw < 0) errors.add(ValidationResult.Invalid(
            "gamesDraw", "Empates não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))

        // Consistência lógica: won + lost + draw <= totalGames
        val totalResults = gamesWon + gamesLost + gamesDraw
        if (totalResults > totalGames && totalGames >= 0) {
            errors.add(ValidationResult.Invalid(
                "totalGames",
                "Soma de resultados ($totalResults) excede total de jogos ($totalGames)",
                ValidationErrorCode.LOGICAL_INCONSISTENCY
            ))
        }

        return errors
    }

    /**
     * Verifica se as estatísticas são válidas.
     */
    @Exclude
    fun isValid(): Boolean = validate().isEmpty()
}

data class RankingEntry(
    val userId: String = "",
    val userName: String = "",
    val userPhoto: String? = null,
    val value: Int = 0,
    val totalGames: Int = 0,
    val average: Double = 0.0
) {
    constructor() : this(userId = "")
}

data class AutoRatings(
    val striker: Double,
    val mid: Double,
    val defender: Double,
    val gk: Double,
    val sampleSize: Int,
    val confidence: Double
)

object PerformanceRatingCalculator {
    private const val SAMPLE_TARGET = 20.0
    private const val MAX_GOALS_PER_GAME = 1.5
    private const val MAX_ASSISTS_PER_GAME = 1.2
    private const val MAX_SAVES_PER_GAME = 4.0

    fun fromStats(stats: UserStatistics): AutoRatings {
        val sampleSize = stats.totalGames
        val confidence = (sampleSize / SAMPLE_TARGET).coerceIn(0.0, 1.0)

        val striker = scale(stats.avgGoalsPerGame, MAX_GOALS_PER_GAME)
        val mid = scale(stats.avgAssistsPerGame, MAX_ASSISTS_PER_GAME)
        val gk = scale(stats.avgSavesPerGame, MAX_SAVES_PER_GAME)

        val discipline = (1.0 - (stats.avgCardsPerGame / 2.0)).coerceIn(0.0, 1.0)
        val defenderScore = (stats.winRate * 0.6) + (discipline * 0.4)
        val defender = (defenderScore * 5.0).coerceIn(0.0, 5.0)

        return AutoRatings(
            striker = striker,
            mid = mid,
            defender = defender,
            gk = gk,
            sampleSize = sampleSize,
            confidence = confidence
        )
    }

    private fun scale(value: Double, max: Double): Double {
        if (max <= 0.0) return 0.0
        return (value / max * 5.0).coerceIn(0.0, 5.0)
    }
}
