package com.futebadosparcas.data.repository

import com.futebadosparcas.data.datasource.MatchManagementDataSource
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GameConfirmationRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val matchManagementDataSource: MatchManagementDataSource
) : GameConfirmationRepository {

    private val confirmationsCollection = firestore.collection("confirmations")

    companion object {
        private const val TAG = "GameConfirmationRepo"
    }

    override suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>> {
        return try {
            val snapshot = confirmationsCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", "CONFIRMED")
                .get()
                .await()

            val confirmations = snapshot.toObjects(GameConfirmation::class.java)
            Result.success(confirmations)
        } catch (e: Exception) {
            Result.success(emptyList())
        }
    }

    override fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>> = callbackFlow {
        val subscription = confirmationsCollection
            .whereEqualTo("game_id", gameId)
            // Removido filtro por status para ouvir tudo (waitlist, pending) e filtrar na UI se precisar
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    trySend(Result.failure(e))
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val confirmations = snapshot.toObjects(GameConfirmation::class.java)
                    trySend(Result.success(confirmations))
                } else {
                    trySend(Result.success(emptyList()))
                }
            }
        awaitClose { subscription.remove() }
    }

    /**
     * Confirma presença do usuário no jogo.
     *
     * Usa ID determinístico para a confirmação: "${gameId}_${userId}"
     * Isso permite uma transação atômica única que:
     * 1. Lê o documento do jogo (lock)
     * 2. Lê a confirmação existente (se houver)
     * 3. Valida limites
     * 4. Atualiza contadores e cria/atualiza confirmação atomicamente
     */
    override suspend fun confirmPresence(
        gameId: String,
        position: String,
        isCasual: Boolean
    ): Result<GameConfirmation> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))
            val user = auth.currentUser!!

            val confirmation = matchManagementDataSource.confirmPlayer(
                gameId = gameId,
                userId = uid,
                userName = user.displayName ?: "Jogador",
                userPhoto = user.photoUrl?.toString(),
                position = position,
                isCasual = isCasual
            )
            Result.success(confirmation)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao confirmar presenca", e)
            Result.failure(e)
        }
    }

    override suspend fun getGoalkeeperCount(gameId: String): Result<Int> {
        return try {
            val snapshot = confirmationsCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", "CONFIRMED")
                .whereEqualTo("position", "GOALKEEPER")
                .get()
                .await()

            Result.success(snapshot.size())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun cancelConfirmation(gameId: String): Result<Unit> {
        return try {
            val uid = auth.currentUser?.uid ?: return Result.failure(Exception("Not authenticated"))

            val wasRemoved = matchManagementDataSource.removePlayer(gameId, uid)

            if (wasRemoved) {
                matchManagementDataSource.promoteWaitlistedPlayer(gameId)
            }

            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao cancelar confirmacao", e)
            Result.failure(e)
        }
    }

    override suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit> {
        return try {
            val wasRemoved = matchManagementDataSource.removePlayer(gameId, userId)

            if (wasRemoved) {
                matchManagementDataSource.promoteWaitlistedPlayer(gameId)
            }

            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao remover jogador", e)
            Result.failure(e)
        }
    }

    override suspend fun updatePaymentStatus(gameId: String, userId: String, isPaid: Boolean): Result<Unit> {
        return try {
            val confirmationId = "${gameId}_${userId}"
            val status = if (isPaid) com.futebadosparcas.data.model.PaymentStatus.PAID.name else com.futebadosparcas.data.model.PaymentStatus.PENDING.name
            confirmationsCollection.document(confirmationId).update("payment_status", status).await()
            Result.success(Unit)
        } catch (e: Exception) {
            // Fallback: search by query if ID is legacy
            try {
                val snapshot = confirmationsCollection
                    .whereEqualTo("game_id", gameId)
                    .whereEqualTo("user_id", userId)
                    .get()
                    .await()

                if (!snapshot.isEmpty) {
                    val status = if (isPaid) com.futebadosparcas.data.model.PaymentStatus.PAID.name else com.futebadosparcas.data.model.PaymentStatus.PENDING.name
                    snapshot.documents.first().reference.update("payment_status", status).await()
                    Result.success(Unit)
                } else {
                    Result.failure(Exception("Confirmação não encontrada"))
                }
            } catch (e2: Exception) {
                Result.failure(e2)
            }
        }
    }

    override suspend fun summonPlayers(gameId: String, confirmations: List<GameConfirmation>): Result<Unit> {
        return try {
            val batch = firestore.batch()
            confirmations.forEach { confirmation ->
                val id = if (confirmation.id.isNotEmpty()) confirmation.id else "${gameId}_${confirmation.userId}"
                val docRef = confirmationsCollection.document(id)
                batch.set(docRef, confirmation.copy(id = id, gameId = gameId, status = "PENDING"))
            }
            batch.commit().await()
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao convocar jogadores", e)
            Result.failure(e)
        }
    }

    override suspend fun getUserConfirmationIds(userId: String): Set<String> {
        return try {
            if (userId.isEmpty()) return emptySet()

            val snapshot = confirmationsCollection
                .whereEqualTo("user_id", userId)
                .whereEqualTo("status", "CONFIRMED")
                .get()
                .await()

            snapshot.documents.mapNotNull { it.getString("game_id") }.toSet()
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar IDs de confirmações do usuário", e)
            emptySet()
        }
    }

    override suspend fun getConfirmedGameIds(userId: String): List<String> {
        return try {
            val confirmationsSnapshot = confirmationsCollection
                .whereEqualTo("user_id", userId)
                .whereIn("status", listOf("CONFIRMED", "PENDING"))
                .get()
                .await()

            confirmationsSnapshot.documents
                .mapNotNull { it.getString("game_id") }
                .distinct()
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar game IDs confirmados", e)
            emptyList()
        }
    }

    override fun getUserConfirmationsFlow(userId: String): Flow<Set<String>> {
        if (userId.isEmpty()) return flowOf(emptySet())

        return callbackFlow {
            val subscription = confirmationsCollection
                .whereEqualTo("user_id", userId)
                .whereEqualTo("status", "CONFIRMED")
                .addSnapshotListener { snapshot, e ->
                    if (e != null) {
                        AppLogger.e(TAG, "getUserConfirmationsFlow: Erro ao buscar confirmacoes", e)
                        trySend(emptySet())
                        return@addSnapshotListener
                    }
                    val ids = snapshot?.documents?.mapNotNull { it.getString("game_id") }?.toSet() ?: emptySet()
                    trySend(ids)
                }
            awaitClose { subscription.remove() }
        }
    }
}
