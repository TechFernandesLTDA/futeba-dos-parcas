package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.repository.GameConfirmationRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implementacao Android do GameConfirmationRepository (KMP).
 *
 * Usa FirebaseDataSource (KMP) internamente.
 *
 * @param dataSource DataSource Firebase para acesso aos dados
 */
@Singleton
class GameConfirmationRepositoryImpl @Inject constructor(
    private val dataSource: FirebaseDataSource
) : GameConfirmationRepository {

    override suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>> {
        return dataSource.getGameConfirmations(gameId)
    }

    override fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>> {
        return dataSource.getGameConfirmationsFlow(gameId)
    }

    override suspend fun confirmPresence(
        gameId: String,
        position: String,
        isCasual: Boolean
    ): Result<GameConfirmation> {
        // Buscar usuario atual para obter informacoes necessarias
        val currentUserResult = dataSource.getCurrentUser()
        if (currentUserResult.isFailure) {
            return Result.failure(
                currentUserResult.exceptionOrNull() ?: Exception("Falha ao obter usuario atual")
            )
        }

        val user = currentUserResult.getOrNull()!!

        return dataSource.confirmPresence(
            gameId = gameId,
            userId = user.id,
            userName = user.name,
            userPhoto = user.photoUrl,
            position = position,
            isCasualPlayer = isCasual
        )
    }

    override suspend fun getGoalkeeperCount(gameId: String): Result<Int> {
        return dataSource.getGameConfirmations(gameId).map { confirmations ->
            confirmations.count {
                it.position == "GOALKEEPER" &&
                (it.status == "CONFIRMED" || it.status == "PENDING")
            }
        }
    }

    override suspend fun cancelConfirmation(gameId: String): Result<Unit> {
        val userId = dataSource.getCurrentUserId()
            ?: return Result.failure(Exception("Usuario nao autenticado"))

        return dataSource.cancelConfirmation(gameId, userId)
    }

    override suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit> {
        return dataSource.removePlayerFromGame(gameId, userId)
    }

    override suspend fun updatePaymentStatus(
        gameId: String,
        userId: String,
        isPaid: Boolean
    ): Result<Unit> {
        return dataSource.updatePaymentStatus(gameId, userId, isPaid)
    }

    override suspend fun summonPlayers(
        gameId: String,
        confirmations: List<GameConfirmation>
    ): Result<Unit> {
        return dataSource.summonPlayers(gameId, confirmations)
    }

    override suspend fun getUserConfirmationIds(userId: String): Set<String> {
        return if (userId.isEmpty()) {
            emptySet()
        } else {
            // Buscar jogos confirmados pelo usuario
            dataSource.getConfirmedGamesForUser(userId)
                .map { games -> games.map { it.id }.toSet() }
                .getOrDefault(emptySet())
        }
    }

    override suspend fun getConfirmedGameIds(userId: String): List<String> {
        return dataSource.getConfirmedGamesForUser(userId)
            .map { games -> games.map { it.id } }
            .getOrDefault(emptyList())
    }

    override fun getUserConfirmationsFlow(userId: String): Flow<Set<String>> {
        if (userId.isEmpty()) {
            return kotlinx.coroutines.flow.flowOf(emptySet())
        }

        return dataSource.getUpcomingGamesFlow()
            .map { result ->
                result.getOrDefault(emptyList())
                    .map { it.id }
                    .toSet()
            }
            .catch { emit(emptySet()) }
    }
}
