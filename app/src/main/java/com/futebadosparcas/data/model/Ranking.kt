package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

// ========== LOG DE XP ==========

/**
 * Registro de XP ganho por um jogador em uma partida.
 * Usado para auditoria e historico de evolucao.
 */
data class XpLog(
    @DocumentId
    val id: String = "",
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",
    @get:PropertyName("xp_earned")
    @set:PropertyName("xp_earned")
    var xpEarned: Long = 0L,
    @get:PropertyName("xp_before")
    @set:PropertyName("xp_before")
    var xpBefore: Long = 0L,
    @get:PropertyName("xp_after")
    @set:PropertyName("xp_after")
    var xpAfter: Long = 0L,
    @get:PropertyName("level_before")
    @set:PropertyName("level_before")
    var levelBefore: Int = 1,
    @get:PropertyName("level_after")
    @set:PropertyName("level_after")
    var levelAfter: Int = 1,
    // Breakdown detalhado do XP
    @get:PropertyName("xp_participation")
    @set:PropertyName("xp_participation")
    var xpParticipation: Int = 0,
    @get:PropertyName("xp_goals")
    @set:PropertyName("xp_goals")
    var xpGoals: Int = 0,
    @get:PropertyName("xp_assists")
    @set:PropertyName("xp_assists")
    var xpAssists: Int = 0,
    @get:PropertyName("xp_saves")
    @set:PropertyName("xp_saves")
    var xpSaves: Int = 0,
    @get:PropertyName("xp_result")
    @set:PropertyName("xp_result")
    var xpResult: Int = 0,
    @get:PropertyName("xp_mvp")
    @set:PropertyName("xp_mvp")
    var xpMvp: Int = 0,
    @get:PropertyName("xp_milestones")
    @set:PropertyName("xp_milestones")
    var xpMilestones: Int = 0,
    @get:PropertyName("xp_streak")
    @set:PropertyName("xp_streak")
    var xpStreak: Int = 0,
    // Dados do jogo para contexto
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0,
    @get:PropertyName("was_mvp")
    @set:PropertyName("was_mvp")
    var wasMvp: Boolean = false,
    @get:PropertyName("game_result")
    @set:PropertyName("game_result")
    var gameResult: String = "DRAW", // WIN, LOSS, DRAW
    @get:PropertyName("milestones_unlocked")
    @set:PropertyName("milestones_unlocked")
    var milestonesUnlocked: List<String> = emptyList(),
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null
) {
    constructor() : this(id = "")

    val leveledUp: Boolean
        get() = levelAfter > levelBefore

    /**
     * Descricao resumida do XP ganho para exibicao.
     */
    val source: String
        get() {
            val parts = mutableListOf<String>()
            if (xpParticipation > 0) parts.add("Participacao")
            if (xpGoals > 0) parts.add("$goals gol(s)")
            if (xpAssists > 0) parts.add("$assists assist(s)")
            if (xpSaves > 0) parts.add("$saves defesa(s)")
            if (xpMvp > 0) parts.add("MVP")
            if (xpResult > 0) {
                when (gameResult) {
                    "WIN" -> parts.add("Vitoria")
                    "DRAW" -> parts.add("Empate")
                }
            }
            return parts.joinToString(" + ").ifEmpty { "Jogo" }
        }
}

// ========== MILESTONES ==========

/**
 * Marcos historicos que concedem XP bonus (one-time).
 */
// Milestones are now defined in Gamification.kt


// ========== RANKING ==========

/**
 * Entrada em um ranking.
 */
data class RankingEntryV2(
    val rank: Int = 0,
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    @get:PropertyName("user_name")
    @set:PropertyName("user_name")
    var userName: String = "",
    @get:PropertyName("user_photo")
    @set:PropertyName("user_photo")
    var userPhoto: String? = null,
    val value: Int = 0,
    @get:PropertyName("games_played")
    @set:PropertyName("games_played")
    var gamesPlayed: Int = 0,
    val average: Double = 0.0,
    @get:PropertyName("nickname")
    @set:PropertyName("nickname")
    var nickname: String? = null
) {
    constructor() : this(rank = 0)
}

/**
 * Documento de ranking para um periodo/categoria.
 */
data class RankingDocument(
    @DocumentId
    val id: String = "", // Ex: "week_2024-W52_goals"
    val period: String = "", // week, month, year, alltime
    @get:PropertyName("period_key")
    @set:PropertyName("period_key")
    var periodKey: String = "", // 2024-W52, 2024-12, 2024
    val category: String = "", // goals, assists, saves, xp, mvp, winrate
    val entries: List<RankingEntryV2> = emptyList(),
    @get:PropertyName("min_games")
    @set:PropertyName("min_games")
    var minGames: Int = 2,
    @ServerTimestamp
    @get:PropertyName("updated_at")
    @set:PropertyName("updated_at")
    var updatedAt: Date? = null
) {
    constructor() : this(id = "")
}

/**
 * Delta de ranking (incrementos por periodo).
 */
data class RankingDelta(
    @DocumentId
    val id: String = "", // Ex: "week_2024-W52_user123"
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    val period: String = "",
    @get:PropertyName("period_key")
    @set:PropertyName("period_key")
    var periodKey: String = "",
    @get:PropertyName("goals_added")
    @set:PropertyName("goals_added")
    var goalsAdded: Int = 0,
    @get:PropertyName("assists_added")
    @set:PropertyName("assists_added")
    var assistsAdded: Int = 0,
    @get:PropertyName("saves_added")
    @set:PropertyName("saves_added")
    var savesAdded: Int = 0,
    @get:PropertyName("xp_added")
    @set:PropertyName("xp_added")
    var xpAdded: Long = 0L,
    @get:PropertyName("games_added")
    @set:PropertyName("games_added")
    var gamesAdded: Int = 0,
    @get:PropertyName("wins_added")
    @set:PropertyName("wins_added")
    var winsAdded: Int = 0,
    @get:PropertyName("mvp_added")
    @set:PropertyName("mvp_added")
    var mvpAdded: Int = 0,
    @ServerTimestamp
    @get:PropertyName("updated_at")
    @set:PropertyName("updated_at")
    var updatedAt: Date? = null
) {
    constructor() : this(id = "")
}

// LevelTable is now defined in its own file


// ========== SEASON PARTICIPATION EXTENDIDO ==========

/**
 * Dados recentes para calculo de liga (janela movel).
 */
data class RecentGameData(
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",
    @get:PropertyName("xp_earned")
    @set:PropertyName("xp_earned")
    var xpEarned: Long = 0L,
    val won: Boolean = false,
    val drew: Boolean = false,
    @get:PropertyName("goal_diff")
    @set:PropertyName("goal_diff")
    var goalDiff: Int = 0,
    @get:PropertyName("was_mvp")
    @set:PropertyName("was_mvp")
    var wasMvp: Boolean = false,
    @get:PropertyName("played_at")
    @set:PropertyName("played_at")
    var playedAt: Date? = null
) {
    constructor() : this(gameId = "")
}

/**
 * Participacao em temporada com dados de liga.
 */
data class SeasonParticipationV2(
    @DocumentId
    val id: String = "",
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    @get:PropertyName("season_id")
    @set:PropertyName("season_id")
    var seasonId: String = "",
    val division: LeagueDivision = LeagueDivision.BRONZE,
    val points: Int = 0,
    @get:PropertyName("games_played")
    @set:PropertyName("games_played")
    var gamesPlayed: Int = 0,
    val wins: Int = 0,
    val draws: Int = 0,
    val losses: Int = 0,
    @get:PropertyName("goals_scored")
    @set:PropertyName("goals_scored")
    var goalsScored: Int = 0,
    @get:PropertyName("goals_conceded")
    @set:PropertyName("goals_conceded")
    var goalsConceded: Int = 0,
    @get:PropertyName("assists")
    @set:PropertyName("assists")
    var assists: Int = 0,
    @get:PropertyName("mvp_count")
    @set:PropertyName("mvp_count")
    var mvpCount: Int = 0,
    // Novos campos para sistema de ligas
    @get:PropertyName("league_rating")
    @set:PropertyName("league_rating")
    var leagueRating: Double = 0.0,
    @get:PropertyName("promotion_progress")
    @set:PropertyName("promotion_progress")
    var promotionProgress: Int = 0, // 0-3
    @get:PropertyName("relegation_progress")
    @set:PropertyName("relegation_progress")
    var relegationProgress: Int = 0, // 0-3
    @get:PropertyName("protection_games")
    @set:PropertyName("protection_games")
    var protectionGames: Int = 0, // 0-5 (imunidade apos promocao)
    @get:PropertyName("recent_games")
    @set:PropertyName("recent_games")
    var recentGames: List<RecentGameData> = emptyList(), // Ultimos 10 jogos
    @ServerTimestamp
    @get:PropertyName("last_calculated_at")
    @set:PropertyName("last_calculated_at")
    var lastCalculatedAt: Date? = null
) {
    constructor() : this(id = "")

    val goalDifference: Int
        get() = goalsScored - goalsConceded

    val winRate: Double
        get() = if (gamesPlayed > 0) (wins.toDouble() / gamesPlayed) * 100 else 0.0
}

// ========== LEAGUE RATING CALCULATOR ==========

object LeagueRatingCalculator {
    /**
     * Calcula o League Rating baseado nos ultimos jogos.
     *
     * LR = (PPJ * 40) + (WR * 30) + (GD * 20) + (MVP_Rate * 10)
     * Normalizado para 0-100
     */
    fun calculate(recentGames: List<RecentGameData>): Double {
        if (recentGames.isEmpty()) return 0.0

        val gamesCount = recentGames.size

        // PPJ - Pontos (XP) por Jogo (max 200 = 100 pontos)
        val avgXp = recentGames.map { it.xpEarned }.average()
        val ppjScore = (avgXp / 200.0).coerceAtMost(1.0) * 100

        // WR - Win Rate (100% = 100 pontos)
        val winRate = recentGames.count { it.won }.toDouble() / gamesCount * 100

        // GD - Goal Difference medio (+3 = 100, -3 = 0)
        val avgGD = recentGames.map { it.goalDiff }.average()
        val gdScore = ((avgGD + 3) / 6.0).coerceIn(0.0, 1.0) * 100

        // MVP Rate (50% = 100 pontos, cap)
        val mvpRate = recentGames.count { it.wasMvp }.toDouble() / gamesCount
        val mvpScore = (mvpRate / 0.5).coerceAtMost(1.0) * 100

        return (ppjScore * 0.4) + (winRate * 0.3) + (gdScore * 0.2) + (mvpScore * 0.1)
    }

    fun getDivisionForRating(rating: Double): LeagueDivision {
        return when {
            rating >= 70 -> LeagueDivision.DIAMANTE
            rating >= 50 -> LeagueDivision.OURO
            rating >= 30 -> LeagueDivision.PRATA
            else -> LeagueDivision.BRONZE
        }
    }

    fun getNextDivisionThreshold(division: LeagueDivision): Double {
        return when (division) {
            LeagueDivision.BRONZE -> 30.0
            LeagueDivision.PRATA -> 50.0
            LeagueDivision.OURO -> 70.0
            LeagueDivision.DIAMANTE -> 100.0
        }
    }

    fun getPreviousDivisionThreshold(division: LeagueDivision): Double {
        return when (division) {
            LeagueDivision.BRONZE -> 0.0
            LeagueDivision.PRATA -> 30.0
            LeagueDivision.OURO -> 50.0
            LeagueDivision.DIAMANTE -> 70.0
        }
    }
}
