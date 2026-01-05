package com.futebadosparcas.domain.usecase

import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GamificationSettings
import com.futebadosparcas.domain.ranking.XPCalculator

/**
 * Use Case para calcular XP de um jogador em uma partida.
 * Usa o XPCalculator compartilhado e aplica regras de negocio.
 */
class CalculatePlayerXpUseCase {

    /**
     * Calcula o XP ganho por um jogador em um jogo finalizado.
     *
     * @param confirmation Confirmacao do jogador no jogo
     * @param teamWon Se o time do jogador venceu
     * @param teamDrew Se o jogo terminou empatado
     * @param opponentsGoals Gols do time adversario
     * @param isMvp Se o jogador foi MVP
     * @param isWorstPlayer Se o jogador foi o pior da partida (Bola Murcha)
     * @param hasBestGoal Se o jogador fez o melhor gol
     * @param currentStreak Sequencia atual de vitorias do jogador
     * @param settings Configuracoes de gamificacao (opcional)
     * @return Resultado do calculo de XP
     */
    operator fun invoke(
        confirmation: GameConfirmation,
        teamWon: Boolean,
        teamDrew: Boolean,
        opponentsGoals: Int = 0,
        isMvp: Boolean = false,
        isWorstPlayer: Boolean = false,
        hasBestGoal: Boolean = false,
        currentStreak: Int = 0,
        settings: GamificationSettings? = null
    ): XpCalculationResult {
        return XPCalculator.calculateFromConfirmation(
            confirmation = confirmation,
            teamWon = teamWon,
            teamDrew = teamDrew,
            opponentsGoals = opponentsGoals,
            isMvp = isMvp,
            isWorstPlayer = isWorstPlayer,
            hasBestGoal = hasBestGoal,
            currentStreak = currentStreak,
            settings = settings
        )
    }

    /**
     * Calcula o XP ganho com validacao de regras de negocio.
     * Retorna Result para tratamento de erros.
     */
    fun calculateSafe(
        confirmation: GameConfirmation,
        teamWon: Boolean,
        teamDrew: Boolean,
        opponentsGoals: Int = 0,
        isMvp: Boolean = false,
        isWorstPlayer: Boolean = false,
        hasBestGoal: Boolean = false,
        currentStreak: Int = 0,
        settings: GamificationSettings? = null
    ): Result<XpCalculationResult> {
        return try {
            // Validacoes
            if (currentStreak < 0) {
                return Result.failure(IllegalArgumentException("Sequencia nao pode ser negativa"))
            }

            if (opponentsGoals < 0) {
                return Result.failure(IllegalArgumentException("Gols do adversario nao podem ser negativos"))
            }

            val result = invoke(
                confirmation = confirmation,
                teamWon = teamWon,
                teamDrew = teamDrew,
                opponentsGoals = opponentsGoals,
                isMvp = isMvp,
                isWorstPlayer = isWorstPlayer,
                hasBestGoal = hasBestGoal,
                currentStreak = currentStreak,
                settings = settings
            )

            Result.success(result)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

/**
 * Resultado do calculo de XP (re-exportado do XPCalculator).
 */
typealias XpCalculationResult = com.futebadosparcas.domain.ranking.XpCalculationResult
typealias XpBreakdown = com.futebadosparcas.domain.ranking.XpBreakdown
