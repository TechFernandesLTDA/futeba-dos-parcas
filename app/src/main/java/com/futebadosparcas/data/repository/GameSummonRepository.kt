package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.AppNotification
import com.futebadosparcas.data.model.GameSummon
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.NotificationAction
import com.futebadosparcas.data.model.NotificationType
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.data.model.SummonStatus
import com.futebadosparcas.data.model.UpcomingGame
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.Calendar
import java.util.Date
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GameSummonRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) {
    private val summonsCollection = firestore.collection("game_summons")
    private val gamesCollection = firestore.collection("games")
    private val groupsCollection = firestore.collection("groups")
    private val usersCollection = firestore.collection("users")
    private val notificationsCollection = firestore.collection("notifications")
    private val confirmationsCollection = firestore.collection("confirmations")

    /**
     * Cria convocações para todos os membros do grupo ao criar um jogo
     */
    suspend fun createSummonsForGame(
        gameId: String,
        groupId: String,
        gameDate: String,
        locationName: String
    ): Result<Int> {
        return try {
            val currentUserId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Buscar dados do usuário atual
            val currentUserDoc = usersCollection.document(currentUserId).get().await()
            val currentUserName = currentUserDoc.getString("name") ?: ""

            // Buscar dados do grupo
            val groupDoc = groupsCollection.document(groupId).get().await()
            val groupName = groupDoc.getString("name") ?: ""

            // Buscar membros do grupo (exceto o criador)
            val membersSnapshot = groupsCollection.document(groupId)
                .collection("members")
                .whereEqualTo("status", "ACTIVE")
                .get()
                .await()

            val members = membersSnapshot.toObjects(GroupMember::class.java)
                .filter { it.userId != currentUserId }

            if (members.isEmpty()) {
                return Result.success(0)
            }

            // Criar convocações em batch
            val batch = firestore.batch()
            var count = 0

            members.forEach { member ->
                // Criar convocação
                val summonId = GameSummon.generateId(gameId, member.userId)
                val summonRef = summonsCollection.document(summonId)
                val summon = GameSummon(
                    id = summonId,
                    gameId = gameId,
                    groupId = groupId,
                    userId = member.userId,
                    userName = member.userName,
                    userPhoto = member.userPhoto,
                    status = SummonStatus.PENDING.name,
                    summonedBy = currentUserId,
                    summonedByName = currentUserName
                )
                batch.set(summonRef, summon)

                // Criar notificação
                val notificationRef = notificationsCollection.document()
                val notification = AppNotification(
                    id = notificationRef.id,
                    userId = member.userId,
                    type = NotificationType.GAME_SUMMON.name,
                    title = "Convocação para jogo",
                    message = "$currentUserName convocou você para um jogo em $gameDate - Grupo $groupName",
                    senderId = currentUserId,
                    senderName = currentUserName,
                    referenceId = gameId,
                    referenceType = "game",
                    actionType = NotificationAction.CONFIRM_POSITION.name
                )
                batch.set(notificationRef, notification)

                count++
            }

            batch.commit().await()

            // Atualizar contagem de convocações no jogo
            gamesCollection.document(gameId).update("summon_count", count).await()

            Result.success(count)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca convocações pendentes do usuário atual
     */
    suspend fun getMyPendingSummons(): Result<List<GameSummon>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = summonsCollection
                .whereEqualTo("user_id", userId)
                .whereEqualTo("status", SummonStatus.PENDING.name)
                .get()
                .await()

            val summons = snapshot.toObjects(GameSummon::class.java)
            Result.success(summons)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Observa convocações pendentes em tempo real
     */
    fun getMyPendingSummonsFlow(): Flow<List<GameSummon>> = callbackFlow {
        val userId = auth.currentUser?.uid ?: run {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val listener = summonsCollection
            .whereEqualTo("user_id", userId)
            .whereEqualTo("status", SummonStatus.PENDING.name)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val summons = snapshot?.toObjects(GameSummon::class.java) ?: emptyList()
                trySend(summons)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Busca convocações de um jogo específico
     */
    suspend fun getGameSummons(gameId: String): Result<List<GameSummon>> {
        return try {
            val snapshot = summonsCollection
                .whereEqualTo("game_id", gameId)
                .orderBy("summoned_at", Query.Direction.ASCENDING)
                .get()
                .await()

            val summons = snapshot.toObjects(GameSummon::class.java)
            Result.success(summons)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Observa convocações de um jogo em tempo real
     */
    fun getGameSummonsFlow(gameId: String): Flow<List<GameSummon>> = callbackFlow {
        val listener = summonsCollection
            .whereEqualTo("game_id", gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val summons = snapshot?.toObjects(GameSummon::class.java) ?: emptyList()
                trySend(summons)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Aceita uma convocação e confirma presença
     */
    suspend fun acceptSummon(gameId: String, position: PlayerPosition): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val summonId = GameSummon.generateId(gameId, userId)
            val summonDoc = summonsCollection.document(summonId).get().await()

            if (!summonDoc.exists()) {
                return Result.failure(Exception("Convocação não encontrada"))
            }

            val summon = summonDoc.toObject(GameSummon::class.java)
                ?: return Result.failure(Exception("Erro ao carregar convocação"))

            if (!summon.canRespond()) {
                return Result.failure(Exception("Convocação já respondida"))
            }

            // Buscar dados do jogo
            val gameDoc = gamesCollection.document(gameId).get().await()
            if (!gameDoc.exists()) {
                return Result.failure(Exception("Jogo não encontrado"))
            }

            // Buscar dados do usuário
            val userDoc = usersCollection.document(userId).get().await()
            val userName = userDoc.getString("name") ?: ""
            val userPhoto = userDoc.getString("photo_url")

            // Executar transação
            firestore.runTransaction { transaction ->
                // 1. Atualizar convocação
                val summonRef = summonsCollection.document(summonId)
                transaction.update(summonRef, mapOf(
                    "status" to SummonStatus.CONFIRMED.name,
                    "position" to position.name,
                    "responded_at" to FieldValue.serverTimestamp()
                ))

                // 2. Criar confirmação de presença
                val confirmationId = "${gameId}_${userId}"
                val confirmationRef = confirmationsCollection.document(confirmationId)
                transaction.set(confirmationRef, mapOf(
                    "id" to confirmationId,
                    "game_id" to gameId,
                    "user_id" to userId,
                    "user_name" to userName,
                    "user_photo" to userPhoto,
                    "position" to position.name,
                    "status" to "CONFIRMED",
                    "payment_status" to "PENDING",
                    "confirmed_at" to FieldValue.serverTimestamp()
                ))

                // 3. Atualizar contadores do jogo
                val gameRef = gamesCollection.document(gameId)
                if (position == PlayerPosition.GOALKEEPER) {
                    transaction.update(gameRef, "goalkeepers_count", FieldValue.increment(1))
                } else {
                    transaction.update(gameRef, "players_count", FieldValue.increment(1))
                }

                // 4. Adicionar à agenda do usuário
                val upcomingGameRef = usersCollection.document(userId)
                    .collection("upcoming_games")
                    .document(gameId)

                transaction.set(upcomingGameRef, mapOf(
                    "id" to gameId,
                    "game_id" to gameId,
                    "group_id" to summon.groupId,
                    "group_name" to (gameDoc.getString("group_name") ?: ""),
                    "date_time" to gameDoc.getDate("dateTime"),
                    "location_name" to (gameDoc.getString("location_name") ?: ""),
                    "location_address" to (gameDoc.getString("location_address") ?: ""),
                    "field_name" to (gameDoc.getString("field_name") ?: ""),
                    "status" to (gameDoc.getString("status") ?: "SCHEDULED"),
                    "my_position" to position.name,
                    "confirmed_count" to (gameDoc.getLong("players_count")?.toInt() ?: 0) + 1,
                    "max_players" to (gameDoc.getLong("max_players")?.toInt() ?: 14)
                ))
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Recusa uma convocação
     */
    suspend fun declineSummon(gameId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val summonId = GameSummon.generateId(gameId, userId)
            val summonDoc = summonsCollection.document(summonId).get().await()

            if (!summonDoc.exists()) {
                return Result.failure(Exception("Convocação não encontrada"))
            }

            val summon = summonDoc.toObject(GameSummon::class.java)
                ?: return Result.failure(Exception("Erro ao carregar convocação"))

            if (!summon.canRespond()) {
                return Result.failure(Exception("Convocação já respondida"))
            }

            // Atualizar convocação
            summonsCollection.document(summonId).update(mapOf(
                "status" to SummonStatus.DECLINED.name,
                "responded_at" to FieldValue.serverTimestamp()
            )).await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca próximos jogos do usuário (agenda)
     */
    suspend fun getMyUpcomingGames(limit: Int = 10): Result<List<UpcomingGame>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val now = Date()
            val twoWeeksFromNow = Calendar.getInstance().apply {
                add(Calendar.DAY_OF_YEAR, 14)
            }.time

            val snapshot = usersCollection.document(userId)
                .collection("upcoming_games")
                .whereGreaterThanOrEqualTo("date_time", now)
                .whereLessThanOrEqualTo("date_time", twoWeeksFromNow)
                .orderBy("date_time", Query.Direction.ASCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val games = snapshot.toObjects(UpcomingGame::class.java)
            Result.success(games)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Observa próximos jogos em tempo real
     */
    fun getMyUpcomingGamesFlow(limit: Int = 10): Flow<List<UpcomingGame>> = callbackFlow {
        val userId = auth.currentUser?.uid ?: run {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val now = Date()
        val twoWeeksFromNow = Calendar.getInstance().apply {
            add(Calendar.DAY_OF_YEAR, 14)
        }.time

        val listener = usersCollection.document(userId)
            .collection("upcoming_games")
            .whereGreaterThanOrEqualTo("date_time", now)
            .whereLessThanOrEqualTo("date_time", twoWeeksFromNow)
            .orderBy("date_time", Query.Direction.ASCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val games = snapshot?.toObjects(UpcomingGame::class.java) ?: emptyList()
                trySend(games)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Cancela presença em um jogo (remove da agenda)
     */
    suspend fun cancelPresence(gameId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val summonId = GameSummon.generateId(gameId, userId)

            // Buscar convocação para saber a posição
            val summonDoc = summonsCollection.document(summonId).get().await()
            val position = summonDoc.getString("position")

            // Executar transação
            firestore.runTransaction { transaction ->
                // 1. Atualizar convocação para pendente novamente
                val summonRef = summonsCollection.document(summonId)
                if (summonDoc.exists()) {
                    transaction.update(summonRef, mapOf(
                        "status" to SummonStatus.PENDING.name,
                        "position" to null,
                        "responded_at" to null
                    ))
                }

                // 2. Remover confirmação
                val confirmationId = "${gameId}_${userId}"
                val confirmationRef = confirmationsCollection.document(confirmationId)
                transaction.delete(confirmationRef)

                // 3. Atualizar contadores do jogo
                val gameRef = gamesCollection.document(gameId)
                if (position == PlayerPosition.GOALKEEPER.name) {
                    transaction.update(gameRef, "goalkeepers_count", FieldValue.increment(-1))
                } else {
                    transaction.update(gameRef, "players_count", FieldValue.increment(-1))
                }

                // 4. Remover da agenda do usuário
                val upcomingGameRef = usersCollection.document(userId)
                    .collection("upcoming_games")
                    .document(gameId)
                transaction.delete(upcomingGameRef)
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Verifica se o usuário foi convocado para um jogo
     */
    suspend fun isSummonedForGame(gameId: String): Result<Boolean> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val summonId = GameSummon.generateId(gameId, userId)
            val doc = summonsCollection.document(summonId).get().await()

            Result.success(doc.exists())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca status da convocação do usuário para um jogo
     */
    suspend fun getMySummonForGame(gameId: String): Result<GameSummon?> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val summonId = GameSummon.generateId(gameId, userId)
            val doc = summonsCollection.document(summonId).get().await()

            if (doc.exists()) {
                val summon = doc.toObject(GameSummon::class.java)
                Result.success(summon)
            } else {
                Result.success(null)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
