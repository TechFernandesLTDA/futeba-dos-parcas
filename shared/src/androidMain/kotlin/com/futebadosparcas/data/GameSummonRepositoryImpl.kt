package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameSummon
import com.futebadosparcas.domain.model.PlayerPosition
import com.futebadosparcas.domain.model.SummonStatus
import com.futebadosparcas.domain.model.UpcomingGame
import com.futebadosparcas.domain.model.gameSummonId
import com.futebadosparcas.domain.repository.GameSummonRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Implementacao Android do GameSummonRepository.
 */
class GameSummonRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : GameSummonRepository {

    private val firestore get() = firebaseDataSource.getFirestore()
    private val summonsCollection get() = firestore.collection("game_summons")
    private val gamesCollection get() = firestore.collection("games")
    private val groupsCollection get() = firestore.collection("groups")
    private val usersCollection get() = firestore.collection("users")
    private val notificationsCollection get() = firestore.collection("notifications")
    private val confirmationsCollection get() = firestore.collection("confirmations")

    override suspend fun createSummonsForGame(
        gameId: String,
        groupId: String,
        gameDate: String,
        locationName: String
    ): Result<Int> {
        return try {
            val currentUserId = firebaseDataSource.getCurrentAuthUserId()
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

            val members = membersSnapshot.documents.mapNotNull { doc ->
                val userId = doc.getString("user_id")
                val userName = doc.getString("user_name")
                val userPhoto = doc.getString("user_photo")
                if (userId != null && userId != currentUserId) {
                    MemberData(userId, userName ?: "", userPhoto)
                } else null
            }

            if (members.isEmpty()) {
                return Result.success(0)
            }

            // Criar convocações em batch
            val batch = firestore.batch()
            var count = 0

            members.forEach { member ->
                // Criar convocação
                val summonId = gameSummonId(gameId, member.userId)
                val summonRef = summonsCollection.document(summonId)

                val summonData = mapOf(
                    "id" to summonId,
                    "game_id" to gameId,
                    "group_id" to groupId,
                    "user_id" to member.userId,
                    "user_name" to member.userName,
                    "user_photo" to member.userPhoto,
                    "status" to SummonStatus.PENDING.name,
                    "summoned_by" to currentUserId,
                    "summoned_by_name" to currentUserName,
                    "summoned_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                )
                batch.set(summonRef, summonData)

                // Criar notificação
                val notificationRef = notificationsCollection.document()
                val notificationData = mapOf(
                    "id" to notificationRef.id,
                    "user_id" to member.userId,
                    "type" to "GAME_SUMMON",
                    "title" to "Convocação para jogo",
                    "message" to "$currentUserName convocou você para um jogo em $gameDate - Grupo $groupName",
                    "sender_id" to currentUserId,
                    "sender_name" to currentUserName,
                    "reference_id" to gameId,
                    "reference_type" to "game",
                    "created_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                )
                batch.set(notificationRef, notificationData)

                count++
            }

            batch.commit().await()

            // Atualizar contagem de convocações no jogo
            gamesCollection.document(gameId)
                .update("summon_count", count)
                .await()

            Result.success(count)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getMyPendingSummons(): Result<List<GameSummon>> {
        return try {
            val userId = firebaseDataSource.getCurrentAuthUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = summonsCollection
                .whereEqualTo("user_id", userId)
                .whereEqualTo("status", SummonStatus.PENDING.name)
                .get()
                .await()

            val summons = snapshot.documents.mapNotNull { doc ->
                docToGameSummon(doc.id, doc.data)
            }
            Result.success(summons)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getMyPendingSummonsFlow(): Flow<List<GameSummon>> = callbackFlow {
        val userId = firebaseDataSource.getCurrentAuthUserId()
        if (userId == null) {
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
                val summons = snapshot?.documents?.mapNotNull { doc ->
                    docToGameSummon(doc.id, doc.data)
                } ?: emptyList()
                trySend(summons)
            }

        awaitClose { listener.remove() }
    }

    override suspend fun getGameSummons(gameId: String): Result<List<GameSummon>> {
        return try {
            // P1 #12: Adicionar .limit() - máximo 100 convocações por jogo
            val snapshot = summonsCollection
                .whereEqualTo("game_id", gameId)
                .orderBy("summoned_at", com.google.firebase.firestore.Query.Direction.ASCENDING)
                .limit(100)
                .get()
                .await()

            val summons = snapshot.documents.mapNotNull { doc ->
                docToGameSummon(doc.id, doc.data)
            }
            Result.success(summons)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getGameSummonsFlow(gameId: String): Flow<List<GameSummon>> = callbackFlow {
        // P1 #12: Adicionar .limit() para real-time listener
        val listener = summonsCollection
            .whereEqualTo("game_id", gameId)
            .limit(100)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val summons = snapshot?.documents?.mapNotNull { doc ->
                    docToGameSummon(doc.id, doc.data)
                } ?: emptyList()
                trySend(summons)
            }

        awaitClose { listener.remove() }
    }

    override suspend fun acceptSummon(gameId: String, position: PlayerPosition): Result<Unit> {
        return try {
            val userId = firebaseDataSource.getCurrentAuthUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val summonId = gameSummonId(gameId, userId)
            val summonDoc = summonsCollection.document(summonId).get().await()

            if (!summonDoc.exists()) {
                return Result.failure(Exception("Convocação não encontrada"))
            }

            val summon = docToGameSummon(summonId, summonDoc.data)
            if (summon?.canRespond() != true) {
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
                    "responded_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
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
                    "confirmed_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                ))

                // 3. Atualizar contadores do jogo
                val gameRef = gamesCollection.document(gameId)
                if (position == PlayerPosition.GOALKEEPER) {
                    transaction.update(gameRef, "goalkeepers_count", com.google.firebase.firestore.FieldValue.increment(1))
                } else {
                    transaction.update(gameRef, "players_count", com.google.firebase.firestore.FieldValue.increment(1))
                }

                // 4. Adicionar à agenda do usuário
                val upcomingGameRef = usersCollection.document(userId)
                    .collection("upcoming_games")
                    .document(gameId)

                transaction.set(upcomingGameRef, mapOf(
                    "id" to gameId,
                    "game_id" to gameId,
                    "group_id" to (gameDoc.getString("group_id") ?: ""),
                    "group_name" to (gameDoc.getString("group_name") ?: ""),
                    "date_time" to gameDoc.getDate("dateTime"),
                    "location_name" to (gameDoc.getString("location_name") ?: ""),
                    "location_address" to (gameDoc.getString("location_address") ?: ""),
                    "field_name" to (gameDoc.getString("field_name") ?: ""),
                    "status" to (gameDoc.getString("status") ?: "SCHEDULED"),
                    "my_position" to position.name,
                    "confirmed_count" to ((gameDoc.getLong("players_count")?.toInt() ?: 0) + 1),
                    "max_players" to (gameDoc.getLong("max_players")?.toInt() ?: 14)
                ))
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun declineSummon(gameId: String): Result<Unit> {
        return try {
            val userId = firebaseDataSource.getCurrentAuthUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val summonId = gameSummonId(gameId, userId)
            val summonDoc = summonsCollection.document(summonId).get().await()

            if (!summonDoc.exists()) {
                return Result.failure(Exception("Convocação não encontrada"))
            }

            val summon = docToGameSummon(summonId, summonDoc.data)
            if (summon?.canRespond() != true) {
                return Result.failure(Exception("Convocação já respondida"))
            }

            // Atualizar convocação
            summonsCollection.document(summonId).update(mapOf(
                "status" to SummonStatus.DECLINED.name,
                "responded_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )).await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getMyUpcomingGames(limit: Int): Result<List<UpcomingGame>> {
        return try {
            val userId = firebaseDataSource.getCurrentAuthUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val now = java.util.Date()
            val twoWeeksFromNow = java.util.Calendar.getInstance().apply {
                add(java.util.Calendar.DAY_OF_YEAR, 14)
            }.time

            val snapshot = usersCollection.document(userId)
                .collection("upcoming_games")
                .whereGreaterThanOrEqualTo("date_time", now)
                .whereLessThanOrEqualTo("date_time", twoWeeksFromNow)
                .orderBy("date_time", com.google.firebase.firestore.Query.Direction.ASCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val games = snapshot.documents.mapNotNull { doc ->
                docToUpcomingGame(doc.id, doc.data)
            }
            Result.success(games)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getMyUpcomingGamesFlow(limit: Int): Flow<List<UpcomingGame>> = callbackFlow {
        val userId = firebaseDataSource.getCurrentAuthUserId()
        if (userId == null) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val now = java.util.Date()
        val twoWeeksFromNow = java.util.Calendar.getInstance().apply {
            add(java.util.Calendar.DAY_OF_YEAR, 14)
        }.time

        val listener = usersCollection.document(userId)
            .collection("upcoming_games")
            .whereGreaterThanOrEqualTo("date_time", now)
            .whereLessThanOrEqualTo("date_time", twoWeeksFromNow)
            .orderBy("date_time", com.google.firebase.firestore.Query.Direction.ASCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val games = snapshot?.documents?.mapNotNull { doc ->
                    docToUpcomingGame(doc.id, doc.data)
                } ?: emptyList()
                trySend(games)
            }

        awaitClose { listener.remove() }
    }

    override suspend fun cancelPresence(gameId: String): Result<Unit> {
        return try {
            val userId = firebaseDataSource.getCurrentAuthUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val summonId = gameSummonId(gameId, userId)

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
                    transaction.update(gameRef, "goalkeepers_count", com.google.firebase.firestore.FieldValue.increment(-1))
                } else {
                    transaction.update(gameRef, "players_count", com.google.firebase.firestore.FieldValue.increment(-1))
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

    override suspend fun isSummonedForGame(gameId: String): Result<Boolean> {
        return try {
            val userId = firebaseDataSource.getCurrentAuthUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val summonId = gameSummonId(gameId, userId)
            val doc = summonsCollection.document(summonId).get().await()

            Result.success(doc.exists())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getMySummonForGame(gameId: String): Result<GameSummon?> {
        return try {
            val userId = firebaseDataSource.getCurrentAuthUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val summonId = gameSummonId(gameId, userId)
            val doc = summonsCollection.document(summonId).get().await()

            if (doc.exists()) {
                val summon = docToGameSummon(summonId, doc.data)
                Result.success(summon)
            } else {
                Result.success(null)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun docToGameSummon(id: String, data: Map<String, Any>?): GameSummon? {
        if (data == null) return null
        return try {
            GameSummon(
                id = id,
                gameId = data["game_id"] as? String ?: "",
                groupId = data["group_id"] as? String ?: "",
                userId = data["user_id"] as? String ?: "",
                userName = data["user_name"] as? String ?: "",
                userPhoto = data["user_photo"] as? String,
                status = data["status"] as? String ?: SummonStatus.PENDING.name,
                position = data["position"] as? String,
                summonedBy = data["summoned_by"] as? String ?: "",
                summonedByName = data["summoned_by_name"] as? String ?: "",
                summonedAt = (data["summoned_at"] as? com.google.firebase.Timestamp)?.seconds?.times(1000),
                respondedAt = (data["responded_at"] as? com.google.firebase.Timestamp)?.seconds?.times(1000)
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun docToUpcomingGame(id: String, data: Map<String, Any>?): UpcomingGame? {
        if (data == null) return null
        return try {
            val dateTime = when (val raw = data["date_time"]) {
                is java.util.Date -> raw.time
                is com.google.firebase.Timestamp -> raw.seconds * 1000
                is Long -> raw
                else -> 0L
            }
            UpcomingGame(
                id = id,
                gameId = data["game_id"] as? String ?: "",
                groupId = data["group_id"] as? String,
                groupName = data["group_name"] as? String,
                dateTime = dateTime,
                locationName = data["location_name"] as? String ?: "",
                locationAddress = data["location_address"] as? String ?: "",
                fieldName = data["field_name"] as? String ?: "",
                status = data["status"] as? String ?: "SCHEDULED",
                myPosition = data["my_position"] as? String,
                confirmedCount = (data["confirmed_count"] as? Number)?.toInt() ?: 0,
                maxPlayers = (data["max_players"] as? Number)?.toInt() ?: 0
            )
        } catch (e: Exception) {
            null
        }
    }

    private data class MemberData(
        val userId: String,
        val userName: String,
        val userPhoto: String?
    )
}
