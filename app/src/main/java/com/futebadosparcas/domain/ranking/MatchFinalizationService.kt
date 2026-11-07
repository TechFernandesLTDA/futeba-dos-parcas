package com.futebadosparcas.domain.ranking

import com.futebadosparcas.data.model.MilestoneType
import com.futebadosparcas.domain.model.GameResult
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore

/**
 * Resultado do processamento de um jogador.
 */
data class PlayerProcessingResult(
    val userId: String,
    val xpEarned: Long,
    val xpBreakdown: Map<String, Long> = emptyMap(),
    val newLevel: Int = 0,
    val leveledUp: Boolean = false,
    val milestonesUnlocked: List<MilestoneType> = emptyList(),
    val gameResult: GameResult = GameResult.DRAW
)

/**
 * Resultado do processamento do jogo.
 */
data class GameProcessingResult(
    val gameId: String,
    val success: Boolean,
    val playersProcessed: List<PlayerProcessingResult> = emptyList(),
    val error: String? = null
)

/**
 * Service responsavel por processar a finalizacao de um jogo.
 *
 * FIX #580 (2026-05-08): Esta funcao agora e NO-OP no client-side. A Cloud Function
 * `onGameStatusUpdate` (functions/src/index.ts) e o unico owner do processamento de XP
 * (estatisticas, milestones, ranking deltas, streaks, badges e liga).
 */
class MatchFinalizationService constructor(
    private val firestore: FirebaseFirestore? = null,
    private val settingsRepository: com.futebadosparcas.domain.repository.SettingsRepository? = null,
    private val leagueService: LeagueService? = null
) {
    companion object {
        private const val TAG = "MatchFinalizationService"
        const val MIN_PLAYERS = 6
    }

    suspend fun processGame(gameId: String): GameProcessingResult {
        AppLogger.d(TAG) {
            "FIX #580: processGame($gameId) e no-op no app. " +
                "Cloud Function onGameStatusUpdate processara XP server-side."
        }
        return GameProcessingResult(
            gameId = gameId,
            success = true,
            playersProcessed = emptyList(),
            error = null
        )
    }
}
