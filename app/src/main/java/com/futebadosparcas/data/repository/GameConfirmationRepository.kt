package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GameConfirmation
import kotlinx.coroutines.flow.Flow

/**
 * Repositório responsável por confirmações de presença em jogos
 */
interface GameConfirmationRepository {
    suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>>
    fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>>
    suspend fun confirmPresence(
        gameId: String,
        position: String = "FIELD",
        isCasual: Boolean = false
    ): Result<GameConfirmation>
    suspend fun getGoalkeeperCount(gameId: String): Result<Int>
    suspend fun cancelConfirmation(gameId: String): Result<Unit>
    suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit>
    suspend fun updatePaymentStatus(gameId: String, userId: String, isPaid: Boolean): Result<Unit>
    suspend fun summonPlayers(gameId: String, confirmations: List<GameConfirmation>): Result<Unit>

    // Helper methods para queries
    suspend fun getUserConfirmationIds(userId: String): Set<String>
    suspend fun getConfirmedGameIds(userId: String): List<String>
    fun getUserConfirmationsFlow(userId: String): Flow<Set<String>>
}
