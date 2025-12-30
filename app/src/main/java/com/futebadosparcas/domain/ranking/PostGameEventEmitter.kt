package com.futebadosparcas.domain.ranking

import com.futebadosparcas.ui.statistics.PostGameSummary
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Emite eventos pos-jogo para que a UI possa mostrar o resumo de XP.
 * Singleton compartilhado entre o repositorio e a UI.
 */
@Singleton
class PostGameEventEmitter @Inject constructor() {

    private val _postGameEvents = MutableSharedFlow<PostGameSummary>(
        replay = 1,
        extraBufferCapacity = 5
    )
    val postGameEvents: SharedFlow<PostGameSummary> = _postGameEvents.asSharedFlow()

    /**
     * Emite um evento pos-jogo para o usuario atual.
     */
    suspend fun emit(summary: PostGameSummary) {
        _postGameEvents.emit(summary)
    }

    /**
     * Cria um PostGameSummary a partir do resultado de processamento.
     */
    fun createSummary(
        gameId: String,
        result: PlayerProcessingResult,
        previousXp: Int,
        previousLevel: Int
    ): PostGameSummary {
        return PostGameSummary(
            gameId = gameId,
            xpEarned = result.xpEarned,
            xpBreakdown = result.xpBreakdown,
            previousXp = previousXp,
            newXp = previousXp + result.xpEarned,
            previousLevel = previousLevel,
            newLevel = result.newLevel,
            leveledUp = result.leveledUp,
            newLevelName = com.futebadosparcas.data.model.LevelTable.getLevelName(result.newLevel),
            milestonesUnlocked = result.milestonesUnlocked,
            gameResult = result.gameResult.name
        )
    }
}
