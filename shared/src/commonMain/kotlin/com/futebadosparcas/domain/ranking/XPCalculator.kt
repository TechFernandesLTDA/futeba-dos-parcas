package com.futebadosparcas.domain.ranking

import com.futebadosparcas.domain.model.GameResult
import com.futebadosparcas.domain.model.GamificationSettings
import com.futebadosparcas.domain.model.PlayerPosition

/**
 * Resultado do calculo de XP para um jogador em uma partida.
 */
data class XpCalculationResult(
    val totalXp: Long,
    val breakdown: XpBreakdown,
    val gameResult: GameResult
)

/**
 * Detalhamento do XP ganho por categoria.
 */
data class XpBreakdown(
    val participation: Long = 0,
    val goals: Long = 0,
    val assists: Long = 0,
    val saves: Long = 0,
    val result: Long = 0,
    val mvp: Long = 0,
    val milestones: Long = 0,
    val streak: Long = 0,
    val penalty: Long = 0
) {
    val total: Long
        get() = participation + goals + assists + saves + result + mvp + milestones + streak + penalty

    fun toDisplayMap(): Map<String, Long> {
        val map = mutableMapOf<String, Long>()
        if (participation > 0) map["Participacao"] = participation
        if (goals > 0) map["Gols"] = goals
        if (assists > 0) map["Assistencias"] = assists
        if (saves > 0) map["Defesas"] = saves
        if (result > 0) map["Resultado"] = result
        if (mvp > 0) map["MVP"] = mvp
        if (milestones > 0) map["Milestones"] = milestones
        if (streak > 0) map["Sequencia"] = streak
        if (penalty < 0) map["Bola Murcha"] = penalty
        return map
    }
}

/**
 * Dados de entrada para calculo de XP de um jogador.
 */
data class PlayerGameData(
    val playerId: String,
    val position: PlayerPosition,
    val goals: Int,
    val assists: Int,
    val saves: Int,
    val yellowCards: Int,
    val redCards: Int,
    val isMvp: Boolean,
    val isWorstPlayer: Boolean,
    val hasBestGoal: Boolean,
    val teamId: String,
    val teamWon: Boolean,
    val teamDrew: Boolean,
    val currentStreak: Int = 0
)

/**
 * Calculador de XP baseado em regras definidas.
 *
 * Regras padrao:
 * - Participacao: 10 XP por jogo
 * - Gols: 10 XP cada
 * - Assistencias: 7 XP cada
 * - Defesas (goleiro): 8 XP cada (aumentado para balance)
 * - Clean Sheet (goleiro): 15 XP bonus
 * - Vitoria: 20 XP
 * - Empate: 10 XP
 * - MVP: 30 XP
 * - Streak 3: 20 XP
 * - Streak 5: 35 XP (NOVO)
 * - Streak 7: 50 XP
 * - Streak 10: 100 XP
 * - Bola Murcha (worst player): -10 XP (penalidade)
 */
object XPCalculator {

    // Constantes de XP padrao
    private const val DEFAULT_XP_PRESENCE = 10
    private const val DEFAULT_XP_PER_GOAL = 10
    private const val DEFAULT_XP_PER_ASSIST = 7
    private const val DEFAULT_XP_PER_SAVE = 8         // Aumentado de 5 para 8 (balance goleiros)
    private const val DEFAULT_XP_CLEAN_SHEET = 15    // NOVO: Bonus goleiro clean sheet
    private const val DEFAULT_XP_WIN = 20
    private const val DEFAULT_XP_DRAW = 10
    private const val DEFAULT_XP_MVP = 30
    private const val DEFAULT_XP_WORST_PLAYER_PENALTY = -10

    // Bonus de Sequencia (Streak)
    private const val DEFAULT_XP_STREAK_3 = 20
    private const val DEFAULT_XP_STREAK_5 = 35       // NOVO: Bonus intermediário
    private const val DEFAULT_XP_STREAK_7 = 50
    private const val DEFAULT_XP_STREAK_10 = 100

    // Limites Anti-Cheat (Tetos de XP por jogo)
    private const val MAX_GOALS_PER_GAME = 15
    private const val MAX_ASSISTS_PER_GAME = 10
    private const val MAX_SAVES_PER_GAME = 30
    private const val MAX_XP_PER_GAME = 500

    /**
     * Calcula o XP ganho por um jogador em uma partida.
     */
    fun calculate(
        playerData: PlayerGameData,
        opponentsGoals: Int = 0,
        settings: GamificationSettings? = null
    ): XpCalculationResult {
        // Usar settings dinamicas ou fallback para constantes fixas
        val xpPresence = settings?.xpPresence ?: DEFAULT_XP_PRESENCE
        val xpPerGoal = settings?.xpPerGoal ?: DEFAULT_XP_PER_GOAL
        val xpPerAssist = settings?.xpPerAssist ?: DEFAULT_XP_PER_ASSIST
        val xpPerSave = settings?.xpPerSave ?: DEFAULT_XP_PER_SAVE
        val xpWin = settings?.xpWin ?: DEFAULT_XP_WIN
        val xpDraw = settings?.xpDraw ?: DEFAULT_XP_DRAW
        val xpMvp = settings?.xpMvp ?: DEFAULT_XP_MVP
        val xpWorstPlayerPenalty = settings?.xpWorstPlayerPenalty ?: DEFAULT_XP_WORST_PLAYER_PENALTY

        val xpStreak3 = settings?.xpStreak3 ?: DEFAULT_XP_STREAK_3
        val xpStreak5 = settings?.xpStreak5 ?: DEFAULT_XP_STREAK_5
        val xpStreak7 = settings?.xpStreak7 ?: DEFAULT_XP_STREAK_7
        val xpStreak10 = settings?.xpStreak10 ?: DEFAULT_XP_STREAK_10
        val xpCleanSheet = settings?.xpCleanSheet ?: DEFAULT_XP_CLEAN_SHEET

        // 1. XP de Presenca (Base operacional)
        val participationXp = xpPresence

        // 2. XP de Gols (COM teto anti-cheat)
        val cappedGoals = playerData.goals.coerceAtMost(MAX_GOALS_PER_GAME)
        val goalsXp = cappedGoals * xpPerGoal

        // 3. XP de Assistencias (COM teto anti-cheat)
        val cappedAssists = playerData.assists.coerceAtMost(MAX_ASSISTS_PER_GAME)
        val assistsXp = cappedAssists * xpPerAssist

        // 4. XP de Defesas (Para goleiros, COM teto anti-cheat)
        val cappedSaves = playerData.saves.coerceAtMost(MAX_SAVES_PER_GAME)
        val savesXp = cappedSaves * xpPerSave

        // 5. XP de Resultado
        val resultXp = when {
            playerData.teamWon -> xpWin
            playerData.teamDrew -> xpDraw
            else -> 0
        }

        // 6. XP de MVP
        val mvpXp = if (playerData.isMvp) xpMvp else 0

        // 7. XP de Sequencia (Streak) - escalonado: 3 -> 5 -> 7 -> 10
        val streakXp = when {
            playerData.currentStreak >= 10 -> xpStreak10
            playerData.currentStreak >= 7 -> xpStreak7
            playerData.currentStreak >= 5 -> xpStreak5   // NOVO: Bonus intermediário
            playerData.currentStreak >= 3 -> xpStreak3
            else -> 0
        }

        // 8. Penalidade por ser Bola Murcha (worst player)
        val penaltyXp = if (playerData.isWorstPlayer) xpWorstPlayerPenalty else 0

        // Determinar resultado do jogo
        val gameResult = when {
            playerData.teamWon -> GameResult.WIN
            playerData.teamDrew -> GameResult.DRAW
            else -> GameResult.LOSS
        }

        val breakdown = XpBreakdown(
            participation = participationXp.toLong(),
            goals = goalsXp.toLong(),
            assists = assistsXp.toLong(),
            saves = savesXp.toLong(),
            result = resultXp.toLong(),
            mvp = mvpXp.toLong(),
            streak = streakXp.toLong(),
            penalty = penaltyXp.toLong()
        )

        // Garantir que XP total nunca seja negativo e aplica teto máximo
        val totalXp = maxOf(0L, breakdown.total).coerceAtMost(MAX_XP_PER_GAME.toLong())

        return XpCalculationResult(
            totalXp = totalXp,
            breakdown = breakdown,
            gameResult = gameResult
        )
    }

    /**
     * Calcula XP simplificado para casos onde nao temos todos os dados.
     */
    fun calculateSimple(
        goals: Int,
        assists: Int,
        saves: Int,
        won: Boolean,
        drew: Boolean,
        isMvp: Boolean,
        currentStreak: Int = 0,
        settings: GamificationSettings? = null
    ): XpCalculationResult {
        val playerData = PlayerGameData(
            playerId = "",
            position = PlayerPosition.LINE,
            goals = goals,
            assists = assists,
            saves = saves,
            yellowCards = 0,
            redCards = 0,
            isMvp = isMvp,
            isWorstPlayer = false,
            hasBestGoal = false,
            teamId = "",
            teamWon = won,
            teamDrew = drew,
            currentStreak = currentStreak
        )

        return calculate(playerData, settings = settings)
    }

    /**
     * Calcula XP a partir de GameConfirmation (dados do jogo finalizados).
     * Agora inclui isWorstPlayer para aplicar penalidade corretamente.
     */
    fun calculateFromConfirmation(
        confirmation: com.futebadosparcas.domain.model.GameConfirmation,
        teamWon: Boolean,
        teamDrew: Boolean,
        opponentsGoals: Int,
        isMvp: Boolean,
        isWorstPlayer: Boolean = false,
        hasBestGoal: Boolean,
        currentStreak: Int,
        settings: GamificationSettings? = null
    ): XpCalculationResult {
        val playerData = PlayerGameData(
            playerId = confirmation.userId,
            position = confirmation.getPositionEnum(),
            goals = confirmation.goals,
            assists = confirmation.assists,
            saves = confirmation.saves,
            yellowCards = confirmation.yellowCards,
            redCards = confirmation.redCards,
            isMvp = isMvp,
            isWorstPlayer = isWorstPlayer,
            hasBestGoal = hasBestGoal,
            teamId = confirmation.teamId ?: "",
            teamWon = teamWon,
            teamDrew = teamDrew,
            currentStreak = currentStreak
        )

        return calculate(playerData, opponentsGoals, settings)
    }
}
