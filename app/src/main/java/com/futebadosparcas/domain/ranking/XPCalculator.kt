package com.futebadosparcas.domain.ranking

import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.data.model.XpLog
import com.futebadosparcas.data.repository.GameResult

/**
 * Resultado do calculo de XP para um jogador em uma partida.
 */
data class XpCalculationResult(
    val totalXp: Long,
    val breakdown: XpBreakdown,
    val gameResult: GameResult
)

data class XpBreakdown(
    val participation: Long = 0,
    val goals: Long = 0,
    val assists: Long = 0,
    val saves: Long = 0,
    val result: Long = 0,
    val mvp: Long = 0,
    val milestones: Long = 0,
    val streak: Long = 0,
    val penalty: Long = 0 // Penalidade por ser worst player
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
 * Regras:
 * - Participacao: 10 XP por jogo
 * - Gols: 10 XP cada
 * - Assistencias: 7 XP cada
 * - Defesas (goleiro): 5 XP cada
 * - Vitoria: 20 XP
 * - Empate: 10 XP
 * - MVP: 30 XP
 * - Streak 3: 20 XP
 * - Streak 7: 50 XP
 * - Streak 10: 100 XP
 * - Bola Murcha (worst player): -10 XP (penalidade)
 */
object XPCalculator {

    // Constantes de XP (Sincronizadas com o Contrato Publico)
    private const val XP_PRESENCE = 10
    private const val XP_PER_GOAL = 10
    private const val XP_PER_ASSIST = 7
    private const val XP_PER_SAVE = 5
    private const val XP_WIN = 20
    private const val XP_DRAW = 10
    private const val XP_MVP = 30
    private const val XP_WORST_PLAYER_PENALTY = -10

    // Bonus de Sequencia (Streak)
    private const val XP_STREAK_3 = 20
    private const val XP_STREAK_7 = 50
    private const val XP_STREAK_10 = 100

    /**
     * Calcula o XP ganho por um jogador em uma partida.
     */
    fun calculate(
        playerData: PlayerGameData,
        opponentsGoals: Int = 0,
        settings: com.futebadosparcas.data.model.GamificationSettings? = null
    ): XpCalculationResult {
        // Usar settings dinamicas ou fallback para constantes fixas
        val xpPresence = settings?.xpPresence ?: XP_PRESENCE
        val xpPerGoal = settings?.xpPerGoal ?: XP_PER_GOAL
        val xpPerAssist = settings?.xpPerAssist ?: XP_PER_ASSIST
        val xpPerSave = settings?.xpPerSave ?: XP_PER_SAVE
        val xpWin = settings?.xpWin ?: XP_WIN
        val xpDraw = settings?.xpDraw ?: XP_DRAW
        val xpMvp = settings?.xpMvp ?: XP_MVP

        val xpStreak3 = settings?.xpStreak3 ?: XP_STREAK_3
        val xpStreak7 = settings?.xpStreak7 ?: XP_STREAK_7
        val xpStreak10 = settings?.xpStreak10 ?: XP_STREAK_10

        // 1. XP de Presenca (Base operacional)
        val participationXp = xpPresence

        // 2. XP de Gols (Sem teto artificial)
        val goalsXp = playerData.goals * xpPerGoal

        // 3. XP de Assistencias (Sem teto artificial)
        val assistsXp = playerData.assists * xpPerAssist

        // 4. XP de Defesas (Para goleiros)
        val savesXp = playerData.saves * xpPerSave

        // 5. XP de Resultado
        val resultXp = when {
            playerData.teamWon -> xpWin
            playerData.teamDrew -> xpDraw
            else -> 0
        }

        // 6. XP de MVP
        val mvpXp = if (playerData.isMvp) xpMvp else 0

        // 7. XP de Sequencia (Streak)
        val streakXp = when {
            playerData.currentStreak >= 10 -> xpStreak10
            playerData.currentStreak >= 7 -> xpStreak7
            playerData.currentStreak >= 3 -> xpStreak3
            else -> 0
        }

        // 8. Penalidade por ser Bola Murcha (worst player)
        val penaltyXp = if (playerData.isWorstPlayer) XP_WORST_PLAYER_PENALTY else 0

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

        // Garantir que XP total nunca seja negativo
        val totalXp = maxOf(0L, breakdown.total)

        return XpCalculationResult(
            totalXp = totalXp,
            breakdown = breakdown,
            gameResult = gameResult
        )
    }

    /**
     * Calcula XP a partir de GameConfirmation (dados do jogo finalizados).
     * Agora inclui isWorstPlayer para aplicar penalidade corretamente.
     */
    fun calculateFromConfirmation(
        confirmation: GameConfirmation,
        teamWon: Boolean,
        teamDrew: Boolean,
        opponentsGoals: Int,
        isMvp: Boolean,
        isWorstPlayer: Boolean = false,
        hasBestGoal: Boolean,
        currentStreak: Int,
        settings: com.futebadosparcas.data.model.GamificationSettings? = null
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
            teamId = "",
            teamWon = teamWon,
            teamDrew = teamDrew,
            currentStreak = currentStreak
        )

        return calculate(playerData, opponentsGoals, settings)
    }

    /**
     * Cria um XpLog a partir do resultado do calculo.
     */
    fun createXpLog(
        userId: String,
        gameId: String,
        calculationResult: XpCalculationResult,
        xpBefore: Long,
        levelBefore: Int,
        levelAfter: Int,
        milestonesUnlocked: List<String> = emptyList(),
        goals: Int = 0,
        assists: Int = 0,
        saves: Int = 0
    ): XpLog {
        val breakdown = calculationResult.breakdown
        return XpLog(
            userId = userId,
            gameId = gameId,
            xpEarned = calculationResult.totalXp,
            xpBefore = xpBefore,
            xpAfter = xpBefore + calculationResult.totalXp,
            levelBefore = levelBefore,
            levelAfter = levelAfter,
            xpParticipation = breakdown.participation.toInt(),
            xpGoals = breakdown.goals.toInt(),
            xpAssists = breakdown.assists.toInt(),
            xpSaves = breakdown.saves.toInt(),
            xpResult = breakdown.result.toInt(),
            xpMvp = breakdown.mvp.toInt(),
            xpMilestones = breakdown.milestones.toInt(),
            xpStreak = breakdown.streak.toInt(),
            goals = goals,
            assists = assists,
            saves = saves,
            wasMvp = breakdown.mvp > 0,
            gameResult = calculationResult.gameResult.name,
            milestonesUnlocked = milestonesUnlocked
        )
    }
}
