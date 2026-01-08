package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.*
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.Date

/**
 * Implementação Android do FirebaseDataSource usando Firebase Android SDK.
 *
 * NOTA: Esta é uma implementação inicial. A versão completa com retry policy,
 * logging avançado e otimizações será migrada na Fase 3 quando os repositórios
 * forem movidos para o shared module.
 *
 * @param firestore FirebaseFirestore instance
 * @param auth FirebaseAuth instance
 */
actual class FirebaseDataSource(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) {

    companion object {
        private const val COLLECTION_GAMES = "games"
        private const val COLLECTION_CONFIRMATIONS = "confirmations"
        private const val COLLECTION_TEAMS = "teams"
        private const val COLLECTION_STATISTICS = "statistics"
        private const val COLLECTION_USERS = "users"
        private const val COLLECTION_GROUPS = "groups"
        private const val COLLECTION_USER_GROUPS = "user_groups"
        private const val COLLECTION_XP_LOGS = "xp_logs"
    }

    // ========== GAMES ==========

    actual suspend fun getUpcomingGames(limit: Int): Result<List<Game>> {
        return try {
            val now = Date()
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .whereGreaterThanOrEqualTo("dateTime", now)
                .orderBy("dateTime", Query.Direction.ASCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            Result.success(snapshot.toObjects(Game::class.java))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getUpcomingGamesFlow(limit: Int): Flow<Result<List<Game>>> = callbackFlow {
        val now = Date()
        val listener = firestore.collection(COLLECTION_GAMES)
            .whereGreaterThanOrEqualTo("dateTime", now)
            .orderBy("dateTime", Query.Direction.ASCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    trySend(Result.success(snapshot.toObjects(Game::class.java)))
                }
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun getGameById(gameId: String): Result<Game> {
        return try {
            val doc = firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .get()
                .await()

            val game = doc.toObject(Game::class.java)
                ?: return Result.failure(Exception("Jogo não encontrado"))
            Result.success(game)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getGameByIdFlow(gameId: String): Flow<Result<Game>> = callbackFlow {
        val listener = firestore.collection(COLLECTION_GAMES)
            .document(gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                if (snapshot != null && snapshot.exists()) {
                    val game = snapshot.toObject(Game::class.java)
                    if (game != null) {
                        trySend(Result.success(game))
                    }
                }
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun getConfirmedGamesForUser(userId: String): Result<List<Game>> {
        // TODO: Implementar query complexa com joins
        return Result.success(emptyList())
    }

    actual suspend fun getGamesByGroup(groupId: String, limit: Int): Result<List<Game>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .whereEqualTo("groupId", groupId)
                .orderBy("dateTime", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            Result.success(snapshot.toObjects(Game::class.java))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getPublicGames(limit: Int): Result<List<Game>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .whereEqualTo("visibility", "PUBLIC")
                .limit(limit.toLong())
                .get()
                .await()

            Result.success(snapshot.toObjects(Game::class.java))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun createGame(game: Game): Result<Game> {
        return try {
            val docRef = firestore.collection(COLLECTION_GAMES).document()
            val gameWithId = game.copy(id = docRef.id)
            docRef.set(gameWithId).await()
            Result.success(gameWithId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updateGame(gameId: String, updates: Map<String, Any>): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .update(updates)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun deleteGame(gameId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .delete()
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== CONFIRMATIONS ==========

    actual suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                .whereEqualTo("gameId", gameId)
                .get()
                .await()

            Result.success(snapshot.toObjects(GameConfirmation::class.java))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>> = callbackFlow {
        val listener = firestore.collection(COLLECTION_CONFIRMATIONS)
            .whereEqualTo("gameId", gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    trySend(Result.success(snapshot.toObjects(GameConfirmation::class.java)))
                }
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun confirmPresence(
        gameId: String,
        userId: String,
        userName: String,
        userPhoto: String?,
        position: String,
        isCasualPlayer: Boolean
    ): Result<GameConfirmation> {
        return try {
            val confirmation = GameConfirmation(
                id = "",
                gameId = gameId,
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                position = position,
                isCasualPlayer = isCasualPlayer
            )

            val docRef = firestore.collection(COLLECTION_CONFIRMATIONS).document()
            val confirmationWithId = confirmation.copy(id = docRef.id)
            docRef.set(confirmationWithId).await()
            Result.success(confirmationWithId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun cancelConfirmation(gameId: String, userId: String): Result<Unit> {
        return try {
            val query = firestore.collection(COLLECTION_CONFIRMATIONS)
                .whereEqualTo("gameId", gameId)
                .whereEqualTo("userId", userId)
                .get()
                .await()

            query.documents.forEach { it.reference.delete().await() }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updatePaymentStatus(gameId: String, userId: String, isPaid: Boolean): Result<Unit> {
        // TODO: Implementar
        return Result.success(Unit)
    }

    // ========== TEAMS ==========

    actual suspend fun getGameTeams(gameId: String): Result<List<Team>> {
        // TODO: Implementar
        return Result.success(emptyList())
    }

    actual fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>> = callbackFlow {
        // TODO: Implementar
        awaitClose { }
    }

    actual suspend fun saveTeams(gameId: String, teams: List<Team>): Result<Unit> {
        // TODO: Implementar
        return Result.success(Unit)
    }

    actual suspend fun clearGameTeams(gameId: String): Result<Unit> {
        // TODO: Implementar
        return Result.success(Unit)
    }

    // ========== STATISTICS ==========

    actual suspend fun getUserStatistics(userId: String): Result<Statistics> {
        // TODO: Implementar
        return Result.failure(Exception("Not implemented"))
    }

    actual fun getUserStatisticsFlow(userId: String): Flow<Result<Statistics>> = callbackFlow {
        // TODO: Implementar
        awaitClose { }
    }

    actual suspend fun updateUserStatistics(userId: String, updates: Map<String, Any>): Result<Unit> {
        // TODO: Implementar
        return Result.success(Unit)
    }

    // ========== USERS ==========

    actual suspend fun getUserById(userId: String): Result<User> {
        return try {
            val doc = firestore.collection(COLLECTION_USERS)
                .document(userId)
                .get()
                .await()

            val user = doc.toObject(User::class.java)
                ?: return Result.failure(Exception("Usuário não encontrado"))
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getUsersByIds(userIds: List<String>): Result<List<User>> {
        return try {
            if (userIds.isEmpty()) return Result.success(emptyList())

            val chunks = userIds.chunked(10)
            val allUsers = mutableListOf<User>()

            for (chunk in chunks) {
                val snapshot = firestore.collection(COLLECTION_USERS)
                    .whereIn(FieldPath.documentId(), chunk)
                    .get()
                    .await()
                allUsers.addAll(snapshot.toObjects(User::class.java))
            }

            Result.success(allUsers)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getCurrentUser(): Result<User> {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(Exception("Usuário não autenticado"))
        return getUserById(uid)
    }

    actual suspend fun updateUser(userId: String, updates: Map<String, Any>): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(updates)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun searchUsers(query: String, limit: Int): Result<List<User>> {
        // TODO: Implementar busca com startAt/endAt
        return Result.success(emptyList())
    }

    // ========== GROUPS ==========

    actual suspend fun getUserGroups(userId: String): Result<List<UserGroup>> {
        // TODO: Implementar
        return Result.success(emptyList())
    }

    actual fun getUserGroupsFlow(userId: String): Flow<Result<List<UserGroup>>> = callbackFlow {
        // TODO: Implementar
        awaitClose { }
    }

    actual suspend fun getGroupById(groupId: String): Result<UserGroup> {
        // TODO: Implementar
        return Result.failure(Exception("Not implemented"))
    }

    // ========== XP LOGS ==========

    actual suspend fun getUserXpLogs(userId: String, limit: Int): Result<List<XpLog>> {
        // TODO: Implementar
        return Result.success(emptyList())
    }

    // ========== BATCH OPERATIONS ==========

    actual suspend fun executeBatch(operations: List<BatchOperation>): Result<Unit> {
        return try {
            val batch = firestore.batch()

            operations.forEach { operation ->
                when (operation) {
                    is BatchOperation.Set -> {
                        val ref = firestore.collection(operation.collection).document(operation.documentId)
                        batch.set(ref, operation.data)
                    }
                    is BatchOperation.Update -> {
                        val ref = firestore.collection(operation.collection).document(operation.documentId)
                        batch.update(ref, operation.updates)
                    }
                    is BatchOperation.Delete -> {
                        val ref = firestore.collection(operation.collection).document(operation.documentId)
                        batch.delete(ref)
                    }
                }
            }

            batch.commit().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
