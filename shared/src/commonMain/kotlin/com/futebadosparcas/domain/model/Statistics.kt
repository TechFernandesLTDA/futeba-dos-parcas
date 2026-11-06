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
        get() {
            if (totalGames == 0) return 0.0
            val weighted = yellowCards + (redCards * 3)
            return weighted.toDouble() / totalGames.toDouble()
        }

    /**
     * Taxa de MVP (melhor jogador) - mvpCount / totalGames.
     */
    val mvpRate: Double
        get() = if (totalGames == 0) 0.0 else mvpCount.toDouble() / totalGames.toDouble()

    /**
     * Taxa de presenca (jogos jogados / total de convocacoes).
     * Calculada como 1.0 (100%) quando o jogador possui jogos registrados (`totalGames > 0`),
     * ou 0.0 caso contrario, espelhando `UserStatistics.presenceRate` do Android (`data/model/Statistics.kt`).
     * Os contadores `games_invited` e `games_attended` ainda nao sao persistidos pelo backend
     * (`functions/src/models/index.ts`).
     */
    val presenceRate: Double
        get() = if (totalGames > 0) 1.0 else 0.0

    /**
     * Sequencia atual de MVPs consecutivos.
     * Espelha `currentStreak` (hidratado a partir de `currentMvpStreak` / `current_streak` no Firestore).
     */
    val currentMvpStreak: Int
        get() = currentStreak

    /**
     * Melhor quantidade de gols em um unico jogo.
     * NOTA: O backend (`functions/src/models/index.ts`) nao persiste `bestGoalCount` / `best_goal_count`
     * no documento `statistics/{uid}`, portanto permanece 0 ate que o pipeline server-side passe a calcula-lo.
     */
    val bestGoalCount: Int
        get() = 0

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
    @SerialName("level_before") val levelBefore: Int = 0,
    @SerialName("level_after") val levelAfter: Int = 0,

    // Breakdown do XP
    @SerialName("xp_participation") val xpParticipation: Int = 0,
    @SerialName("xp_goals") val xpGoals: Int = 0,
    @SerialName("xp_assists") val xpAssists: Int = 0,
    @SerialName("xp_saves") val xpSaves: Int = 0,
    @SerialName("xp_result") val xpResult: Int = 0,
    @SerialName("xp_mvp") val xpMvp: Int = 0,
    @SerialName("xp_milestones") val xpMilestones: Int = 0,
    @SerialName("xp_streak") val xpStreak: Int = 0,
    @SerialName("xp_top_scorer") val xpTopScorer: Int = 0,
    @SerialName("xp_hat_trick") val xpHatTrick: Int = 0,
    @SerialName("xp_first_goal") val xpFirstGoal: Int = 0,
    @SerialName("xp_goalkeeper_goal") val xpGoalkeeperGoal: Int = 0,
    @SerialName("xp_fair_play") val xpFairPlay: Int = 0,
    @SerialName("xp_comeback") val xpComeback: Int = 0,
    @SerialName("xp_first_game_month") val xpFirstGameMonth: Int = 0,
    @SerialName("xp_monthly_streak") val xpMonthlyStreak: Int = 0,
    @SerialName("xp_recorder") val xpRecorder: Int = 0,
    @SerialName("xp_early_confirmation") val xpEarlyConfirmation: Int = 0,
    @SerialName("xp_on_time_checkin") val xpOnTimeCheckin: Int = 0,
    @SerialName("xp_last_minute_saver") val xpLastMinuteSaver: Int = 0,
    @SerialName("xp_waitlist_promoted") val xpWaitlistPromoted: Int = 0,

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
        require(levelBefore >= 0) { "levelBefore deve ser >= 0: $levelBefore" }
        require(levelAfter >= 0) { "levelAfter deve ser >= 0: $levelAfter" }
        require(goals >= 0) { "goals nao pode ser negativo: $goals" }
        require(assists >= 0) { "assists nao pode ser negativo: $assists" }
        require(saves >= 0) { "saves nao pode ser negativo: $saves" }
    }

    fun didLevelUp(): Boolean = levelAfter > levelBefore

    /**
     * Bônus pós-jogo já calculados e persistidos pelo servidor.
     *
     * O cliente apenas os apresenta; elegibilidade, limites e idempotência pertencem
     * ao pipeline server-authoritative de finalização da partida.
     */
    fun bonusBreakdown(): Map<XpAction, Int> = linkedMapOf(
        XpAction.TOP_SCORER to xpTopScorer,
        XpAction.HAT_TRICK to xpHatTrick,
        XpAction.FIRST_GOAL to xpFirstGoal,
        XpAction.GOALKEEPER_GOAL to xpGoalkeeperGoal,
        XpAction.FAIR_PLAY to xpFairPlay,
        (if (xpComeback >= XpAction.COMEBACK_30D.defaultXp) {
            XpAction.COMEBACK_30D
        } else {
            XpAction.COMEBACK_14D
        }) to xpComeback,
        XpAction.FIRST_GAME_OF_MONTH to xpFirstGameMonth,
        when {
            xpMonthlyStreak >= XpAction.MONTHLY_STREAK_12.defaultXp -> XpAction.MONTHLY_STREAK_12
            xpMonthlyStreak >= XpAction.MONTHLY_STREAK_6.defaultXp -> XpAction.MONTHLY_STREAK_6
            else -> XpAction.MONTHLY_STREAK_3
        } to xpMonthlyStreak,
        XpAction.EVENT_RECORDER to xpRecorder,
        XpAction.EARLY_CONFIRMATION to xpEarlyConfirmation,
        XpAction.ON_TIME_CHECKIN to xpOnTimeCheckin,
        XpAction.LAST_MINUTE_SAVER to xpLastMinuteSaver,
        XpAction.WAITLIST_PROMOTED to xpWaitlistPromoted
    ).filterValues { it != 0 }

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
