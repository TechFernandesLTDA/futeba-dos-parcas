package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Estatisticas gerais de um jogador.
 */
@Serializable
data class Statistics(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("total_games") val totalGames: Int = 0,
    @SerialName("total_goals") val totalGoals: Int = 0,
    @SerialName("total_assists") val totalAssists: Int = 0,
    @SerialName("total_saves") val totalSaves: Int = 0,
    @SerialName("total_wins") val totalWins: Int = 0,
    @SerialName("total_draws") val totalDraws: Int = 0,
    @SerialName("total_losses") val totalLosses: Int = 0,
    @SerialName("mvp_count") val mvpCount: Int = 0,
    @SerialName("best_gk_count") val bestGkCount: Int = 0,
    @SerialName("worst_player_count") val worstPlayerCount: Int = 0,
    @SerialName("current_streak") val currentStreak: Int = 0,
    @SerialName("best_streak") val bestStreak: Int = 0,
    @SerialName("yellow_cards") val yellowCards: Int = 0,
    @SerialName("red_cards") val redCards: Int = 0,
    @SerialName("last_game_date") val lastGameDate: Long? = null,
    @SerialName("updated_at") val updatedAt: Long? = null
) : HasGameStats {
    // Implementacao de HasGameStats - permite usar extension functions compartilhadas
    override val statGamesPlayed: Int get() = totalGames
    override val statGoals: Int get() = totalGoals
    override val statAssists: Int get() = totalAssists
    override val statWins: Int get() = totalWins

    init {
        require(totalGames >= 0) { "totalGames nao pode ser negativo: $totalGames" }
        require(totalGoals >= 0) { "totalGoals nao pode ser negativo: $totalGoals" }
        require(totalAssists >= 0) { "totalAssists nao pode ser negativo: $totalAssists" }
        require(totalSaves >= 0) { "totalSaves nao pode ser negativo: $totalSaves" }
        require(totalWins >= 0) { "totalWins nao pode ser negativo: $totalWins" }
        require(totalDraws >= 0) { "totalDraws nao pode ser negativo: $totalDraws" }
        require(totalLosses >= 0) { "totalLosses nao pode ser negativo: $totalLosses" }
        require(mvpCount >= 0) { "mvpCount nao pode ser negativo: $mvpCount" }
        require(currentStreak >= 0) { "currentStreak nao pode ser negativo: $currentStreak" }
        require(bestStreak >= 0) { "bestStreak nao pode ser negativo: $bestStreak" }
        require(yellowCards >= 0) { "yellowCards nao pode ser negativo: $yellowCards" }
        require(redCards >= 0) { "redCards nao pode ser negativo: $redCards" }
    }

    // ========== Computed Properties (compat com codigo legado Android) ==========

    /**
     * Total de cartoes (amarelos + vermelhos).
     */
    val totalCards: Int
        get() = yellowCards + redCards

    /**
     * Numero de vezes que foi melhor jogador (MVP).
     * Alias para mvpCount para compatibilidade.
     */
    val bestPlayerCount: Int
        get() = mvpCount

    /**
     * Numero de vitorias.
     * Alias para totalWins para compatibilidade.
     */
    val gamesWon: Int
        get() = totalWins

    /**
     * Numero de vitorias.
     * Alias para totalWins para compatibilidade.
     */
    val wins: Int
        get() = totalWins

    /**
     * Taxa de vitoria (0.0 - 1.0).
     * Computed property usando extension function winRate().
     */
    val winRate: Double
        get() = winRate().toDouble()

    /**
     * Media de gols por jogo.
     * Computed property usando extension function goalsPerGame().
     */
    val avgGoalsPerGame: Double
        get() = goalsPerGame().toDouble()

    /**
     * Media de assistencias por jogo.
     * Computed property usando extension function assistsPerGame().
     */
    val avgAssistsPerGame: Double
        get() = assistsPerGame().toDouble()

    /**
     * Media de defesas por jogo.
     */
    val avgSavesPerGame: Double
        get() = if (totalGames == 0) 0.0 else totalSaves.toDouble() / totalGames.toDouble()

    /**
     * Media de cartoes por jogo.
     */
    val avgCardsPerGame: Double
        get() = if (totalGames == 0) 0.0 else totalCards.toDouble() / totalGames.toDouble()

    /**
     * Taxa de MVP (melhor jogador) - mvpCount / totalGames.
     */
    val mvpRate: Double
        get() = if (totalGames == 0) 0.0 else mvpCount.toDouble() / totalGames.toDouble()

    /**
     * Taxa de presenca (jogos jogados / total de convocacoes).
     * Como nao temos convocacoes aqui, retorna 0.0 como fallback.
     */
    val presenceRate: Double
        get() = 0.0 // TODO: Implementar quando tivermos dados de convocacoes

    /**
     * Sequencia atual de MVPs consecutivos.
     * Como nao temos historico aqui, retorna 0 como fallback.
     */
    val currentMvpStreak: Int
        get() = 0 // TODO: Implementar quando tivermos historico de jogos

    /**
     * Melhor quantidade de gols em um unico jogo.
     * Como nao temos historico aqui, retorna 0 como fallback.
     */
    val bestGoalCount: Int
        get() = 0 // TODO: Implementar quando tivermos historico de jogos

    // Nota: Metodos get*() removidos para evitar clash com computed properties.
    // Use as computed properties ou extension functions diretas.
}

/**
 * Log de XP ganho em um jogo.
 */
@Serializable
data class XpLog(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("xp_earned") val xpEarned: Long = 0,
    @SerialName("xp_before") val xpBefore: Long = 0,
    @SerialName("xp_after") val xpAfter: Long = 0,
    @SerialName("level_before") val levelBefore: Int = 1,
    @SerialName("level_after") val levelAfter: Int = 1,

    // Breakdown do XP
    @SerialName("xp_participation") val xpParticipation: Int = 0,
    @SerialName("xp_goals") val xpGoals: Int = 0,
    @SerialName("xp_assists") val xpAssists: Int = 0,
    @SerialName("xp_saves") val xpSaves: Int = 0,
    @SerialName("xp_result") val xpResult: Int = 0,
    @SerialName("xp_mvp") val xpMvp: Int = 0,
    @SerialName("xp_milestones") val xpMilestones: Int = 0,
    @SerialName("xp_streak") val xpStreak: Int = 0,

    // Dados do jogo
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0,
    @SerialName("was_mvp") val wasMvp: Boolean = false,
    @SerialName("game_result") val gameResult: String = "",
    @SerialName("milestones_unlocked") val milestonesUnlocked: List<String> = emptyList(),
    @SerialName("created_at") val createdAt: Long? = null
) {
    init {
        require(levelBefore >= 1) { "levelBefore deve ser >= 1: $levelBefore" }
        require(levelAfter >= 1) { "levelAfter deve ser >= 1: $levelAfter" }
        require(goals >= 0) { "goals nao pode ser negativo: $goals" }
        require(assists >= 0) { "assists nao pode ser negativo: $assists" }
        require(saves >= 0) { "saves nao pode ser negativo: $saves" }
    }

    fun didLevelUp(): Boolean = levelAfter > levelBefore

    /**
     * Retorna o GameResult correspondente ao campo gameResult string.
     * Util para evitar comparacoes manuais de string.
     */
    fun getGameResultEnum(): GameResult? {
        return when (gameResult.uppercase()) {
            "WIN" -> GameResult.WIN
            "DRAW" -> GameResult.DRAW
            "LOSS" -> GameResult.LOSS
            else -> null
        }
    }
}
