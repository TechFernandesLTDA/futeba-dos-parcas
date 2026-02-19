package com.futebadosparcas.domain.usecase.game

import com.futebadosparcas.domain.ranking.GameProcessingResult
import com.futebadosparcas.domain.ranking.MatchFinalizationService
import com.futebadosparcas.domain.usecase.SuspendUseCase

/**
 * Finish Game Use Case
 *
 * Finishes a game and processes all post-game actions via MatchFinalizationService:
 * - Updates game status to FINISHED
 * - Calculates and awards XP to all players
 * - Updates player statistics (global and season)
 * - Awards badges automatically (HAT_TRICK, PAREDAO)
 * - Updates ranking deltas
 * - Updates league participation
 *
 * Usage:
 * ```kotlin
 * val result = finishGameUseCase(FinishGameParams(gameId = "game123"))
 *
 * result.fold(
 *     onSuccess = { processingResult ->
 *         processingResult.playersProcessed.forEach { player ->
 *             println("${player.userId}: +${player.xpEarned} XP")
 *         }
 *     },
 *     onFailure = { error -> /* handle error */ }
 * )
 * ```
 */
class FinishGameUseCase constructor(
    private val matchFinalizationService: MatchFinalizationService
) : SuspendUseCase<FinishGameParams, FinishGameResult>() {

    override suspend fun execute(params: FinishGameParams): FinishGameResult {
        // Process game using MatchFinalizationService
        // This handles all post-game logic atomically:
        // - XP calculation and persistence
        // - Statistics updates
        // - Badge awarding
        // - League updates
        // - Streak updates
        val processingResult = matchFinalizationService.processGame(params.gameId)

        if (!processingResult.success && processingResult.error != null) {
            // Allow "already processed" as success
            if (processingResult.error != "Jogo ja processado") {
                throw IllegalStateException(processingResult.error)
            }
        }

        return FinishGameResult.fromProcessingResult(processingResult)
    }
}

/**
 * Parameters for finishing a game
 */
data class FinishGameParams(
    val gameId: String
)

/**
 * Result of finishing a game
 */
data class FinishGameResult(
    val gameId: String,
    val success: Boolean,
    val playersProcessed: Int,
    val xpAwarded: Map<String, Long>,
    val levelUps: List<String>,
    val message: String? = null
) {
    companion object {
        fun fromProcessingResult(result: GameProcessingResult): FinishGameResult {
            val xpAwarded = result.playersProcessed.associate { it.userId to it.xpEarned }
            val levelUps = result.playersProcessed.filter { it.leveledUp }.map { it.userId }

            return FinishGameResult(
                gameId = result.gameId,
                success = result.success,
                playersProcessed = result.playersProcessed.size,
                xpAwarded = xpAwarded,
                levelUps = levelUps,
                message = result.error
            )
        }
    }
}
