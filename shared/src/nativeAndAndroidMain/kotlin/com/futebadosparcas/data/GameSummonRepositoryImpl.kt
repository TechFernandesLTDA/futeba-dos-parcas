package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GameSummon
import com.futebadosparcas.domain.model.PlayerPosition
import com.futebadosparcas.domain.model.SummonStatus
import com.futebadosparcas.domain.model.UpcomingGame
import com.futebadosparcas.domain.model.gameSummonId
import com.futebadosparcas.domain.repository.GameSummonRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.DocumentSnapshot
import dev.gitlive.firebase.firestore.FieldValue
import dev.gitlive.firebase.firestore.Timestamp
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.datetime.Clock

/**
 * Implementação compartilhada (Android+iOS) do GameSummonRepository.
 *
 * Sistema de convocação para jogos: dono convoca membros, membros aceitam/recusam.
 * Usa GitLive Firebase Kotlin SDK (cross-platform).
 */
class GameSummonRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : GameSummonRepository {

    private val firestore = Firebase.firestore
    private val summonsCollection = firestore.collection("game_summons")
    private val gamesCollection = firestore.collection("games")
    private val groupsCollection = firestore.collection("groups")
    private val usersCollection = firestore.collection("users")
    private val notificationsCollection = firestore.collection("notifications")

    override suspend fun createSummonsForGame(
        gameId: String,
        groupId: String,
        gameDate: String,
        locationName: String
    ): Result<Int> {
        return try {
            val currentUserId = firebaseDataSource.getCurrentAuthUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val currentUserDoc = usersCollection.document(currentUserId).get()
            val currentUserName = currentUserDoc.get<String?>("name") ?: ""

            val groupDoc = groupsCollection.document(groupId).get()
            val groupName = groupDoc.get<String?>("name") ?: ""

            val membersSnapshot = groupsCollection.document(groupId)
                .collection("members")
                .where { "status" equalTo "ACTIVE" }
                .get()

            val members = membersSnapshot.documents.mapNotNull { doc ->
                val uid = doc.get<String?>("user_id")
                val uname = doc.get<String?>("user_name")
                val uphoto = doc.get<String?>("user_photo")
                if (uid != null && uid != currentUserId) {
                    MemberData(uid, uname ?: "", uphoto)
                } else null
            }

            if (members.isEmpty()) return Result.success(0)

            var count = 0
            firestore.batch().apply {
                members.forEach { member ->
                    val summonId = gameSummonId(gameId, member.userId)
                    val summonRef = summonsCollection.document(summonId)
                    set(
                        documentRef = summonRef,
                        data = mapOf(
                            "id" to summonId,
                            "game_id" to gameId,
                            "group_id" to groupId,
                            "user_id" to member.userId,
                            "user_name" to member.userName,
                            "user_photo" to member.userPhoto,
                            "status" to SummonStatus.PENDING.name,
                            "summoned_by" to currentUserId,
                            "summoned_by_name" to currentUserName,
                            "summoned_at" to FieldValue.serverTimestamp,
                        )
                    )

                    val notificationRef = notificationsCollection.document
                    set(
                        documentRef = notificationRef,
                        data = mapOf(
                            "id" to notificationRef.id,
                            "user_id" to member.userId,
                            "type" to "GAME_SUMMON",
                            "title" to "Convocação para jogo",
                            "message" to "$currentUserName convocou você para um jogo em $gameDate - Grupo $groupName",
                            "sender_id" to currentUserId,
                            "sender_name" to currentUserName,
                            "reference_id" to gameId,
                            "reference_type" to "game",
                            "created_at" to FieldValue.serverTimestamp,
                        )
                    )
                    count++
                }
            }.commit()

            gamesCollection.document(gameId).update("summon_count" to count)

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
                .where { "user_id" equalTo userId }
                .where { "status" equalTo SummonStatus.PENDING.name }
                .get()
            Result.success(snapshot.documents.mapNotNull { docToGameSummon(it.id, it) })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getMyPendingSummonsFlow(): Flow<List<GameSummon>> {
        val userId = firebaseDataSource.getCurrentAuthUserId() ?: return flowOf(emptyList())
        return flow {
            summonsCollection
                .where { "user_id" equalTo userId }
                .where { "status" equalTo SummonStatus.PENDING.name }
                .snapshots
                .catch { emit(emptyList()) }
                .collect { snap ->
                    emit(snap.documents.mapNotNull { docToGameSummon(it.id, it) })
                }
        }
    }

    override suspend fun getGameSummons(gameId: String): Result<List<GameSummon>> {
        return try {
            val snapshot = summonsCollection
                .where { "game_id" equalTo gameId }
                .orderBy("summoned_at", Direction.ASCENDING)
                .limit(100)
                .get()
            Result.success(snapshot.documents.mapNotNull { docToGameSummon(it.id, it) })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getGameSummonsFlow(gameId: String): Flow<List<GameSummon>> = flow {
        summonsCollection
            .where { "game_id" equalTo gameId }
            .limit(100)
            .snapshots
            .catch { emit(emptyList()) }
            .collect { snap ->
                emit(snap.documents.mapNotNull { docToGameSummon(it.id, it) })
            }
    }

    override suspend fun acceptSummon(gameId: String, position: PlayerPosition): Result<Unit> {
        return try {
            val userId = firebaseDataSource.getCurrentAuthUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val summonId = gameSummonId(gameId, userId)
            val summonDoc = summonsCollection.document(summonId).get()

            if (!summonDoc.exists) {
                return Result.failure(Exception("Convocação não encontrada"))
            }

            val summon = docToGameSummon(summonId, summonDoc)
            if (summon?.canRespond() != true) {
                return Result.failure(Exception("Convocação já respondida"))
            }

            val gameDoc = gamesCollection.document(gameId).get()
            if (!gameDoc.exists) {
                return Result.failure(Exception("Jogo não encontrado"))
            }

            val userDoc = usersCollection.document(userId).get()
            val userName = userDoc.get<String?>("name") ?: ""
            val userPhoto = userDoc.get<String?>("photo_url")

            firebaseDataSource.confirmPresence(
                gameId = gameId,
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                position = position.name,
                isCasualPlayer = false
            ).getOrElse { return Result.failure(it) }
            val confirmedGameDoc = gamesCollection.document(gameId).get()

            firestore.runTransaction<Unit> {
                val summonRef = summonsCollection.document(summonId)
                update(
                    summonRef,
                    mapOf(
                        "status" to SummonStatus.CONFIRMED.name,
                        "position" to position.name,
                        "responded_at" to FieldValue.serverTimestamp,
                    )
                )

                val upcomingGameRef = usersCollection.document(userId)
                    .collection("upcoming_games")
                    .document(gameId)

                set(
                    upcomingGameRef,
                    mapOf(
                        "id" to gameId,
                        "game_id" to gameId,
                        "group_id" to (confirmedGameDoc.get<String?>("group_id") ?: ""),
                        "group_name" to (confirmedGameDoc.get<String?>("group_name") ?: ""),
                        "date_time" to confirmedGameDoc.get<Timestamp?>("dateTime"),
                        "location_name" to (confirmedGameDoc.get<String?>("location_name") ?: ""),
                        "location_address" to (confirmedGameDoc.get<String?>("location_address") ?: ""),
                        "field_name" to (confirmedGameDoc.get<String?>("field_name") ?: ""),
                        "status" to (confirmedGameDoc.get<String?>("status") ?: "SCHEDULED"),
                        "my_position" to position.name,
                        "confirmed_count" to (confirmedGameDoc.get<Long?>("players_count")?.toInt() ?: 0),
                        "max_players" to (confirmedGameDoc.get<Long?>("max_players")?.toInt() ?: 14),
                    )
                )
            }

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
            val summonDoc = summonsCollection.document(summonId).get()

            if (!summonDoc.exists) {
                return Result.failure(Exception("Convocação não encontrada"))
            }

            val summon = docToGameSummon(summonId, summonDoc)
            if (summon?.canRespond() != true) {
                return Result.failure(Exception("Convocação já respondida"))
            }

            summonsCollection.document(summonId).update(
                mapOf(
                    "status" to SummonStatus.DECLINED.name,
                    "responded_at" to FieldValue.serverTimestamp,
                )
            )

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getMyUpcomingGames(limit: Int): Result<List<UpcomingGame>> {
        return try {
            val userId = firebaseDataSource.getCurrentAuthUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val nowMs = Clock.System.now().toEpochMilliseconds()
            val twoWeeksMs = nowMs + 14L * 24 * 60 * 60 * 1000

            val snapshot = usersCollection.document(userId)
                .collection("upcoming_games")
                .where { "date_time" greaterThanOrEqualTo Timestamp(nowMs / 1000, ((nowMs % 1000) * 1_000_000).toInt()) }
                .where { "date_time" lessThanOrEqualTo Timestamp(twoWeeksMs / 1000, ((twoWeeksMs % 1000) * 1_000_000).toInt()) }
                .orderBy("date_time", Direction.ASCENDING)
                .limit(limit.toLong())
                .get()

            Result.success(snapshot.documents.mapNotNull { docToUpcomingGame(it.id, it) })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getMyUpcomingGamesFlow(limit: Int): Flow<List<UpcomingGame>> {
        val userId = firebaseDataSource.getCurrentAuthUserId() ?: return flowOf(emptyList())
        val nowMs = Clock.System.now().toEpochMilliseconds()
        val twoWeeksMs = nowMs + 14L * 24 * 60 * 60 * 1000

        return flow {
            usersCollection.document(userId)
                .collection("upcoming_games")
                .where { "date_time" greaterThanOrEqualTo Timestamp(nowMs / 1000, ((nowMs % 1000) * 1_000_000).toInt()) }
                .where { "date_time" lessThanOrEqualTo Timestamp(twoWeeksMs / 1000, ((twoWeeksMs % 1000) * 1_000_000).toInt()) }
                .orderBy("date_time", Direction.ASCENDING)
                .limit(limit.toLong())
                .snapshots
                .catch { emit(emptyList()) }
                .collect { snap ->
                    emit(snap.documents.mapNotNull { docToUpcomingGame(it.id, it) })
                }
        }
    }

    override suspend fun cancelPresence(gameId: String): Result<Unit> {
        return try {
            val userId = firebaseDataSource.getCurrentAuthUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val summonId = gameSummonId(gameId, userId)
            val summonDoc = summonsCollection.document(summonId).get()

            firebaseDataSource.cancelConfirmation(gameId, userId)
                .getOrElse { return Result.failure(it) }

            firestore.runTransaction<Unit> {
                val summonRef = summonsCollection.document(summonId)
                if (summonDoc.exists) {
                    update(
                        summonRef,
                        mapOf(
                            "status" to SummonStatus.PENDING.name,
                            "position" to null,
                            "responded_at" to null,
                        )
                    )
                }

                val upcomingGameRef = usersCollection.document(userId)
                    .collection("upcoming_games")
                    .document(gameId)
                delete(upcomingGameRef)
            }

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
            val doc = summonsCollection.document(summonId).get()
            Result.success(doc.exists)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getMySummonForGame(gameId: String): Result<GameSummon?> {
        return try {
            val userId = firebaseDataSource.getCurrentAuthUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))
            val summonId = gameSummonId(gameId, userId)
            val doc = summonsCollection.document(summonId).get()
            if (doc.exists) {
                Result.success(docToGameSummon(summonId, doc))
            } else {
                Result.success(null)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun docToGameSummon(id: String, doc: DocumentSnapshot): GameSummon? {
        return try {
            val summonedAtTs = doc.get<Timestamp?>("summoned_at")
            val respondedAtTs = doc.get<Timestamp?>("responded_at")
            GameSummon(
                id = id,
                gameId = doc.get<String?>("game_id") ?: "",
                groupId = doc.get<String?>("group_id") ?: "",
                userId = doc.get<String?>("user_id") ?: "",
                userName = doc.get<String?>("user_name") ?: "",
                userPhoto = doc.get<String?>("user_photo"),
                status = doc.get<String?>("status") ?: SummonStatus.PENDING.name,
                position = doc.get<String?>("position"),
                summonedBy = doc.get<String?>("summoned_by") ?: "",
                summonedByName = doc.get<String?>("summoned_by_name") ?: "",
                summonedAt = summonedAtTs?.let { it.seconds * 1000L + it.nanoseconds / 1_000_000L },
                respondedAt = respondedAtTs?.let { it.seconds * 1000L + it.nanoseconds / 1_000_000L },
            )
        } catch (_: Exception) {
            null
        }
    }

    private fun docToUpcomingGame(id: String, doc: DocumentSnapshot): UpcomingGame? {
        return try {
            val dateTimeTs = doc.get<Timestamp?>("date_time")
            val dateTimeMs = dateTimeTs?.let { it.seconds * 1000L + it.nanoseconds / 1_000_000L } ?: 0L
            UpcomingGame(
                id = id,
                gameId = doc.get<String?>("game_id") ?: "",
                groupId = doc.get<String?>("group_id"),
                groupName = doc.get<String?>("group_name"),
                dateTime = dateTimeMs,
                locationName = doc.get<String?>("location_name") ?: "",
                locationAddress = doc.get<String?>("location_address") ?: "",
                fieldName = doc.get<String?>("field_name") ?: "",
                status = doc.get<String?>("status") ?: "SCHEDULED",
                myPosition = doc.get<String?>("my_position"),
                confirmedCount = doc.get<Long?>("confirmed_count")?.toInt() ?: 0,
                maxPlayers = doc.get<Long?>("max_players")?.toInt() ?: 0,
            )
        } catch (_: Exception) {
            null
        }
    }

    private data class MemberData(
        val userId: String,
        val userName: String,
        val userPhoto: String?
    )
}
