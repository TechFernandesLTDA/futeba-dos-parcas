package com.futebadosparcas.domain.ranking

import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.data.model.XpLog
import com.futebadosparcas.data.repository.GameResult

/**
 * Resultado do calculo de XP para um jogador em uma partida.
 */
data class XpCalculationResult(
    val totalXp: Int,
    val breakdown: XpBreakdown,
    val gameResult: GameResult
)

data class XpBreakdown(
    val participation: Int = 0,
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0,
    val result: Int = 0,
    val mvp: Int = 0,
    val milestones: Int = 0,
    val streak: Int = 0
) {
    val total: Int
        get() = participation + goals + assists + saves + result + mvp + milestones + streak

    fun toDisplayMap(): Map<String, Int> {
        val map = mutableMapOf<String, Int>()
        if (participation > 0) map["Participação"] = participation
        if (goals > 0) map["Gols"] = goals
        if (assists > 0) map["Assistências"] = assists
        if (saves > 0) map["Defesas"] = saves
        if (result > 0) map["Resultado"] = result
        if (mvp > 0) map["MVP"] = mvp
        if (milestones > 0) map["Milestones"] = milestones
        if (streak > 0) map["Sequência"] = streak
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
 * - Participacao: 25 XP por jogo
 * - Gols: 15 XP cada (max 5 = 75 XP)
 * - Assistencias: 10 XP cada (max 5 = 50 XP)
 * - Defesas (goleiro): 8 XP cada (max 10 = 80 XP)
 * - Clean Sheet (goleiro): 30 XP
 * - Vitoria: 15 XP
 * - Empate: 5 XP
 * - MVP: 50 XP
 * - Melhor Gol: 20 XP
 * - Streak 7: 100 XP (uma vez por streak)
 * - Streak 30: 500 XP (uma vez por streak)
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

        // Determinar resultado do jogo
        val gameResult = when {
            playerData.teamWon -> GameResult.WIN
            playerData.teamDrew -> GameResult.DRAW
            else -> GameResult.LOSS
        }

        val breakdown = XpBreakdown(
            participation = participationXp,
            goals = goalsXp,
            assists = assistsXp,
            saves = savesXp,
            result = resultXp,
            mvp = mvpXp,
            streak = streakXp
        )

        return XpCalculationResult(
            totalXp = breakdown.total,
            breakdown = breakdown,
            gameResult = gameResult
        )
    }

    /**
     * Calcula XP a partir de GameConfirmation (dados do jogo finalizados).
     */
    fun calculateFromConfirmation(
        confirmation: GameConfirmation,
        teamWon: Boolean,
        teamDrew: Boolean,
        opponentsGoals: Int,
        isMvp: Boolean,
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
            isWorstPlayer = false,
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
        xpBefore: Int,
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
            xpParticipation = breakdown.participation,
            xpGoals = breakdown.goals,
            xpAssists = breakdown.assists,
            xpSaves = breakdown.saves,
            xpResult = breakdown.result,
            xpMvp = breakdown.mvp,
            xpMilestones = breakdown.milestones,
            xpStreak = breakdown.streak,
            goals = goals,
            assists = assists,
            saves = saves,
            wasMvp = breakdown.mvp > 0,
            gameResult = calculationResult.gameResult.name,
            milestonesUnlocked = milestonesUnlocked
        )
    }
}
