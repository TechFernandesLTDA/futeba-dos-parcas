package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import com.futebadosparcas.platform.UuidGenerator
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.FirebaseAuth
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.*
import dev.gitlive.firebase.functions.FirebaseFunctionsException
import dev.gitlive.firebase.functions.code
import dev.gitlive.firebase.functions.functions
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toInstant
import kotlinx.datetime.toLocalDateTime

internal class FirebaseGamesDataSource(
    private val firestore: FirebaseFirestore = Firebase.firestore,
    private val auth: FirebaseAuth = Firebase.auth
) {
    // ========== GAMES ==========

    suspend fun getUpcomingGames(limit: Int): Result<List<Game>> {
        return try {
            val nowMillis = Clock.System.now().toEpochMilliseconds()
            val nowTs = Timestamp(nowMillis / 1000, ((nowMillis % 1000) * 1_000_000).toInt())
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .where { "dateTime" greaterThanOrEqualTo nowTs }
                .orderBy("dateTime", Direction.ASCENDING)
                .limit(limit)
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toGameOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getUpcomingGamesFlow(limit: Int): Flow<Result<List<Game>>> {
        val nowMillis = Clock.System.now().toEpochMilliseconds()
        val nowTs = Timestamp(nowMillis / 1000, ((nowMillis % 1000) * 1_000_000).toInt())
        return firestore.collection(COLLECTION_GAMES)
            .where { "dateTime" greaterThanOrEqualTo nowTs }
            .orderBy("dateTime", Direction.ASCENDING)
            .limit(limit)
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toGameOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    suspend fun getGameById(gameId: String): Result<Game> {
        return try {
            val doc = firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .get()

            val game = doc.toGameOrNull()
                ?: return Result.failure(Exception("Jogo não encontrado"))
            Result.success(game)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getGameByIdFlow(gameId: String): Flow<Result<Game>> {
        return firestore.collection(COLLECTION_GAMES)
            .document(gameId)
            .snapshots()
            .map { snapshot ->
                val game = snapshot.toGameOrNull()
                if (game != null) Result.success(game)
                else Result.failure(Exception("Jogo não encontrado"))
            }
            .catch { e -> emit(Result.failure(e)) }
    }

    suspend fun getConfirmedGamesForUser(userId: String): Result<List<Game>> {
        return try {
            // 1. Buscar confirmações do usuário
            val confirmations = firestore.collection(COLLECTION_CONFIRMATIONS)
                .where { "user_id" equalTo userId }
                .where { "status" equalTo "CONFIRMED" }
                .get()
                .documents.mapNotNull { it.toGameConfirmationOrNull() }

            // 2. Extrair IDs únicos de jogos
            val gameIds = confirmations.map { it.gameId }.distinct()
            if (gameIds.isEmpty()) {
                return Result.success(emptyList())
            }

            // 3. Buscar jogos em chunks (whereIn limit = 10)
            val games = mutableListOf<Game>()
            gameIds.chunked(10).forEach { chunk ->
                val snapshot = firestore.collection(COLLECTION_GAMES)
                    .where { FieldPath.documentId inArray chunk }
                    .get()
                games.addAll(snapshot.documents.mapNotNull { it.toGameOrNull() })
            }

            // 4. Ordenar por data do jogo
            Result.success(games.sortedBy { "${it.date} ${it.time}" })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getGamesByGroup(groupId: String, limit: Int): Result<List<Game>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .where { "group_id" equalTo groupId }
                .orderBy("dateTime", Direction.DESCENDING)
                .limit(limit)
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toGameOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getPublicGames(limit: Int): Result<List<Game>> {
        return try {
            val nowMillis = Clock.System.now().toEpochMilliseconds()
            val nowTs = Timestamp(nowMillis / 1000, ((nowMillis % 1000) * 1_000_000).toInt())
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .where { "visibility" inArray listOf("PUBLIC_OPEN", "PUBLIC_CLOSED") }
                .where { "dateTime" greaterThanOrEqualTo nowTs }
                .orderBy("dateTime", Direction.ASCENDING)
                .limit(limit)
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toGameOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createGame(game: Game): Result<Game> {
        return try {
            val docRef = firestore.collection(COLLECTION_GAMES).document
            val gameWithId = game.copy(id = docRef.id)
            docRef.set(gameWithId)

            // Escreve campo "dateTime" como Firestore Timestamp para permitir
            // consultas por data (ex: getUpcomingGames usa where { "dateTime" >= nowTs }).
            // A classe Game tem dateTime como computed getter (String), não como campo
            // armazenado, então é necessário escrever explicitamente (issue #877).
            val dateTimeTs = runCatching {
                val localDateTime = LocalDateTime.parse("${game.date}T${game.time}")
                val epochSeconds = localDateTime.toInstant(kotlinx.datetime.TimeZone.currentSystemDefault()).epochSeconds
                Timestamp(epochSeconds, 0)
            }.getOrNull()
            if (dateTimeTs != null) {
                docRef.update(mapOf("dateTime" to dateTimeTs))
            }

            Result.success(gameWithId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateGame(gameId: String, updates: Map<String, Any>): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .update(updates)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteGame(gameId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .delete()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== CONFIRMATIONS ==========

    suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                .where { "game_id" equalTo gameId }
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toGameConfirmationOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>> {
        return firestore.collection(COLLECTION_CONFIRMATIONS)
            .where { "game_id" equalTo gameId }
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toGameConfirmationOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    suspend fun confirmPresence(
        gameId: String,
        userId: String,
        userName: String,
        userPhoto: String?,
        position: String,
        isCasualPlayer: Boolean
    ): Result<GameConfirmation> {
        return try {
            val docId = "${gameId}_${userId}"
            val docRef = firestore.collection(COLLECTION_CONFIRMATIONS).document(docId)
            Firebase.functions(FUNCTIONS_REGION)
                .httpsCallable("confirmGamePresence")
                .invoke(
                    mapOf(
                        "gameId" to gameId,
                        "position" to if (position == "GOALKEEPER") "GOALKEEPER" else "FIELD",
                        "isCasualPlayer" to isCasualPlayer
                    )
                )

            val confirmation = docRef.get().toGameConfirmationOrNull()
                ?: return Result.failure(
                    Exception("Confirmação não encontrada após callable: $docId")
                )
            Result.success(confirmation)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun cancelConfirmation(gameId: String, userId: String): Result<Unit> {
        return try {
            // FIX #4144: marcar CANCELLED em vez de deletar. O trigger
            // onGameVacancy depende de before=CONFIRMED -> after=CANCELLED
            // (UPDATE); delete deixava a vaga sem promover a waitlist.
            // Espelha app FirebaseDataSourceImpl.kt e web useGames.ts.
            val batch = firestore.batch()
            val docRef =
                firestore.collection(COLLECTION_CONFIRMATIONS)
                    .document("${gameId}_${userId}")
            val doc = docRef.get()
            if (doc.exists) {
                batch.update(
                    docRef,
                    mapOf(
                        "status" to "CANCELLED",
                        "updated_at" to FieldValue.serverTimestamp,
                    ),
                )
            } else {
                // Fallback: buscar por query
                val query = firestore.collection(COLLECTION_CONFIRMATIONS)
                    .where { "game_id" equalTo gameId }
                    .where { "user_id" equalTo userId }
                    .get()
                query.documents.forEach {
                    batch.update(
                        it.reference,
                        mapOf(
                            "status" to "CANCELLED",
                            "updated_at" to FieldValue.serverTimestamp,
                        ),
                    )
                }
            }
            batch.commit()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updatePaymentStatus(gameId: String, userId: String, isPaid: Boolean): Result<Unit> {
        return try {
            val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                .where { "game_id" equalTo gameId }
                .where { "user_id" equalTo userId }
                .get()

            if (snapshot.documents.isEmpty()) {
                return Result.failure(NoSuchElementException("Confirmação não encontrada"))
            }

            val status = if (isPaid) "PAID" else "PENDING"
            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.update(doc.reference, mapOf("payment_status" to status))
            }
            batch.commit()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit> {
        return try {
            // FIX #4144: CANCELLED em vez de delete (mesmo motivo do
            // cancelConfirmation — trigger onGameVacancy depende de UPDATE).
            val batch = firestore.batch()
            val docRef =
                firestore.collection(COLLECTION_CONFIRMATIONS)
                    .document("${gameId}_${userId}")
            val doc = docRef.get()
            if (doc.exists) {
                batch.update(
                    docRef,
                    mapOf(
                        "status" to "CANCELLED",
                        "updated_at" to FieldValue.serverTimestamp,
                    ),
                )
            } else {
                // Fallback: buscar por query
                val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                    .where { "game_id" equalTo gameId }
                    .where { "user_id" equalTo userId }
                    .get()
                snapshot.documents.forEach { d ->
                    batch.update(
                        d.reference,
                        mapOf(
                            "status" to "CANCELLED",
                            "updated_at" to FieldValue.serverTimestamp,
                        ),
                    )
                }
            }
            batch.commit()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun summonPlayers(
        gameId: String,
        confirmations: List<GameConfirmation>
    ): Result<Unit> {
        return try {
            val batch = firestore.batch()
            confirmations.forEach { confirmation ->
                val docRef = firestore.collection(COLLECTION_CONFIRMATIONS)
                    .document("${gameId}_${confirmation.userId}")
                // FIX #2296: removidas as chaves camelCase duplicadas. O
                // parsing usa @SerialName(snake_case), então as duplicatas
                // eram redundantes e infladas o payload de escrita.
                val confirmationData = mapOf(
                    "id" to docRef.id,
                    "game_id" to gameId,
                    "user_id" to confirmation.userId,
                    "user_name" to confirmation.userName,
                    "user_photo" to confirmation.userPhoto,
                    "position" to confirmation.position,
                    "status" to "PENDING",
                    "is_casual_player" to confirmation.isCasualPlayer
                )
                batch.set(docRef, confirmationData)
            }
            batch.commit()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun acceptInvitation(
        gameId: String,
        userId: String,
        position: String
    ): Result<GameConfirmation> {
        return try {
            // O convite precisa existir, mas a promoção para CONFIRMED é
            // exclusivamente server-authoritative. A callable revalida vagas e
            // goleiros na mesma transação e é idempotente para retries.
            val docRef = firestore.collection(COLLECTION_CONFIRMATIONS).document("${gameId}_${userId}")
            val doc = docRef.get()
            val invitation = if (doc.exists) {
                doc
            } else {
                val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                    .where { "game_id" equalTo gameId }
                    .where { "user_id" equalTo userId }
                    .get()
                if (snapshot.documents.isEmpty()) {
                    return Result.failure(Exception("Convite não encontrado"))
                }
                snapshot.documents[0]
            }

            confirmPresence(
                gameId = gameId,
                userId = userId,
                userName = invitation.get<String?>("user_name")
                    ?: invitation.get<String?>("userName") ?: "",
                userPhoto = invitation.get<String?>("user_photo")
                    ?: invitation.get<String?>("userPhoto"),
                position = position,
                isCasualPlayer = invitation.get<Boolean?>("is_casual_player")
                    ?: invitation.get<Boolean?>("isCasualPlayer") ?: false
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateConfirmationStatus(
        gameId: String,
        userId: String,
        status: String
    ): Result<Unit> {
        return try {
            // Tentar pelo ID determinístico primeiro
            val docRef = firestore.collection(COLLECTION_CONFIRMATIONS).document("${gameId}_${userId}")
            val doc = docRef.get()
            if (doc.exists) {
                docRef.update(mapOf("status" to status))
            } else {
                // Fallback: buscar por query
                val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                    .where { "game_id" equalTo gameId }
                    .where { "user_id" equalTo userId }
                    .get()

                if (snapshot.documents.isEmpty()) {
                    return Result.failure(Exception("Confirmação não encontrada"))
                }

                val batch = firestore.batch()
                snapshot.documents.forEach { d ->
                    batch.update(d.reference, mapOf("status" to status))
                }
                batch.commit()
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== WAITLIST ==========

    fun getGameWaitlistFlow(gameId: String): Flow<Result<List<GameWaitlist>>> {
        return firestore.collection(COLLECTION_GAMES)
            .document(gameId)
            .collection("waitlist")
            .snapshots()
            .map { snapshot ->
                val entries = snapshot.documents.mapNotNull { doc ->
                    val status = doc.get<String?>("status") ?: WaitlistStatus.WAITING.name
                    if (status != WaitlistStatus.WAITING.name && status != WaitlistStatus.NOTIFIED.name) {
                        return@mapNotNull null
                    }
                    GameWaitlist(
                        id = doc.id,
                        gameId = doc.get<String?>("game_id") ?: gameId,
                        userId = doc.get<String?>("user_id") ?: doc.id,
                        userName = doc.get<String?>("user_name") ?: "",
                        userPhoto = doc.get<String?>("user_photo"),
                        position = doc.get<String?>("position") ?: "FIELD",
                        queuePosition = doc.get<Long?>("queue_position")?.toInt() ?: 0,
                        status = status,
                        addedAt = doc.safeLong("added_at"),
                        notifiedAt = doc.safeLong("notified_at"),
                        responseDeadline = doc.safeLong("response_deadline")
                    )
                }.sortedBy { it.queuePosition }
                Result.success(entries)
            }
            .catch { e -> emit(Result.failure(e)) }
    }

    suspend fun joinWaitlist(gameId: String, position: String): Result<GameWaitlist> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))
            val normalizedPos = if (position == "GOALKEEPER") "GOALKEEPER" else "FIELD"
            Firebase.functions(FUNCTIONS_REGION)
                .httpsCallable("joinGameWaitlist")
                .invoke(
                    mapOf(
                        "gameId" to gameId,
                        "position" to normalizedPos
                    )
                )
            val doc = firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .collection("waitlist")
                .document(uid)
                .get()
            val entry = if (doc.exists) {
                GameWaitlist(
                    id = doc.id,
                    gameId = doc.get<String?>("game_id") ?: gameId,
                    userId = doc.get<String?>("user_id") ?: uid,
                    userName = doc.get<String?>("user_name") ?: (auth.currentUser?.displayName ?: ""),
                    userPhoto = doc.get<String?>("user_photo"),
                    position = doc.get<String?>("position") ?: normalizedPos,
                    queuePosition = doc.get<Long?>("queue_position")?.toInt() ?: 1,
                    status = doc.get<String?>("status") ?: WaitlistStatus.WAITING.name
                )
            } else {
                GameWaitlist(
                    id = uid,
                    gameId = gameId,
                    userId = uid,
                    userName = auth.currentUser?.displayName ?: "",
                    position = normalizedPos,
                    queuePosition = 1,
                    status = WaitlistStatus.WAITING.name
                )
            }
            Result.success(entry)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun leaveWaitlist(gameId: String, userId: String): Result<Unit> {
        return try {
            val waitlistCol = firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .collection("waitlist")
            val docRef = waitlistCol.document(userId)
            val doc = docRef.get()
            if (doc.exists) {
                docRef.delete()
            } else {
                val query = waitlistCol.where { "user_id" equalTo userId }.get()
                val batch = firestore.batch()
                query.documents.forEach { batch.delete(it.reference) }
                batch.commit()
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }


    // ========== TEAMS ==========

    suspend fun getGameTeams(gameId: String): Result<List<Team>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_TEAMS)
                .where { "game_id" equalTo gameId }
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toTeamOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>> {
        return firestore.collection(COLLECTION_TEAMS)
            .where { "game_id" equalTo gameId }
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toTeamOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    suspend fun saveTeams(gameId: String, teams: List<Team>): Result<Unit> {
        return try {
            val batch = firestore.batch()

            teams.forEach { team ->
                val docRef = firestore.collection(COLLECTION_TEAMS).document
                val teamData = mapOf(
                    "id" to docRef.id,
                    "game_id" to gameId,
                    "name" to team.name,
                    "color" to team.color,
                    "player_ids" to team.playerIds,
                    "score" to team.score
                )
                batch.set(docRef, teamData)
            }

            batch.commit()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun clearGameTeams(gameId: String): Result<Unit> {
        return try {
            val snapshot = firestore.collection(COLLECTION_TEAMS)
                .where { "game_id" equalTo gameId }
                .get()

            val batch = firestore.batch()
            snapshot.documents.forEach { doc -> batch.delete(doc.reference) }
            batch.commit()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }


    // ========== LIVE GAME ==========

    suspend fun createLiveGame(gameId: String): Result<Unit> {
        return try {
            val liveScoreData = mapOf(
                "game_id" to gameId,
                "team1_score" to 0,
                "team2_score" to 0,
                "owner_id" to (auth.currentUser?.uid ?: ""),
                "started_at" to FieldValue.serverTimestamp
            )
            firestore.collection("live_scores")
                .document(gameId)
                .set(liveScoreData)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateLiveScore(gameId: String, team1Score: Int, team2Score: Int): Result<Unit> {
        return try {
            firestore.collection("live_scores")
                .document(gameId)
                .update(mapOf(
                    "team1_score" to team1Score,
                    "team2_score" to team2Score
                ))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun addGameEvent(gameId: String, event: GameEvent): Result<GameEvent> {
        return try {
            // A mesma chave acompanha todo retry interno do callable. O backend
            // usa esse valor no ID determinístico do evento e devolve o evento
            // existente quando a resposta anterior se perde na rede.
            val requestId = event.id.ifBlank { UuidGenerator.generate() }
            val functions = Firebase.functions(FUNCTIONS_REGION)
            functions.httpsCallable("submitLiveGameEvent")
                .invoke(
                    mapOf(
                        "requestId" to requestId,
                        "gameId" to gameId,
                        "eventType" to event.eventType,
                        "playerId" to event.playerId,
                        "playerName" to event.playerName,
                        "teamId" to event.teamId,
                        "assistedById" to event.assistedById,
                        "assistedByName" to event.assistedByName,
                        "minute" to event.minute,
                    )
                )
            Result.success(event.copy(id = "${gameId}_${requestId}"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getGameEvents(gameId: String): Result<List<GameEvent>> {
        return try {
            val snapshot = firestore.collection("game_events")
                .where { "game_id" equalTo gameId }
                .orderBy("minute", Direction.ASCENDING)
                .get()
            Result.success(snapshot.documents.mapNotNull { it.toGameEventOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>> {
        return firestore.collection("game_events")
            .where { "game_id" equalTo gameId }
            .orderBy("minute", Direction.ASCENDING)
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toGameEventOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    fun getLiveScoreFlow(gameId: String): Flow<Result<LiveScore?>> =
        firestore.collection("live_scores")
            .document(gameId)
            .snapshots()
            .map { snapshot ->
                Result.success(if (snapshot.exists) snapshot.toLiveScoreOrNull() else null)
            }
            .catch { e -> emit(Result.failure(e)) }

    // ========== LIVE GAME (NOVOS MÉTODOS) ==========

    suspend fun startLiveGame(gameId: String, team1Id: String, team2Id: String): Result<LiveScore> {
        return try {
            val docRef = firestore.collection("live_scores").document(gameId)

            val scoreData = mapOf(
                "game_id" to gameId,
                "team1_id" to team1Id,
                "team1_score" to 0,
                "team2_id" to team2Id,
                "team2_score" to 0,
                "started_at" to FieldValue.serverTimestamp
            )

            docRef.set(scoreData)

            val score = LiveScore(
                id = gameId,
                gameId = gameId,
                team1Id = team1Id,
                team1Score = 0,
                team2Id = team2Id,
                team2Score = 0
            )

            Result.success(score)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun canManageGameEvents(gameId: String): Boolean {
        val currentUserId = auth.currentUser?.uid
        if (currentUserId == null) {
            println("FirebaseDataSource: canManageGameEvents: Usuário não autenticado")
            return false
        }

        return try {
            // Verificar se é owner do jogo
            val gameDoc = firestore.collection("games").document(gameId).get()
            val ownerId = gameDoc.get<String?>("owner_id")
            if (ownerId == currentUserId) {
                println("FirebaseDataSource: canManageGameEvents: Usuário é owner")
                return true
            }

            // Verificar se está confirmado no jogo
            val confirmationId = "${gameId}_$currentUserId"
            val confDoc = firestore.collection("confirmations").document(confirmationId).get()
            if (confDoc.exists) {
                val status = confDoc.get<String?>("status")
                if (status == "CONFIRMED") {
                    println("FirebaseDataSource: canManageGameEvents: Usuário confirmado")
                    return true
                }
            }

            println("FirebaseDataSource: canManageGameEvents: Permissão negada")
            false
        } catch (e: Exception) {
            println("FirebaseDataSource: canManageGameEvents: Erro: ${e.message}")
            false
        }
    }

    suspend fun updateScoreForGoal(gameId: String, teamId: String): Result<Unit> {
        return try {
            val scoreDocRef = firestore.collection("live_scores").document(gameId)
            val gameDocRef = firestore.collection("games").document(gameId)

            // Garantir que o documento de placar existe
            try {
                val snapshot = scoreDocRef.get()
                if (!snapshot.exists) {
                    val teamsSnapshot = firestore.collection("teams")
                        .where { "game_id" equalTo gameId }
                        .get()

                    val teams = teamsSnapshot.documents.mapNotNull { it.toTeamOrNull() }
                    if (teams.size >= 2) {
                        startLiveGame(gameId, teams[0].id, teams[1].id)
                        println("FirebaseDataSource: Placar inicializado sob demanda")
                    }
                }
            } catch (e: Exception) {
                println("FirebaseDataSource: Erro ao inicializar placar: ${e.message}")
            }

            firestore.runTransaction<Unit> {
                val snapshot = get(scoreDocRef)
                val score = snapshot.toLiveScoreOrNull() ?: return@runTransaction

                var newTeam1Score = score.team1Score
                var newTeam2Score = score.team2Score

                when {
                    score.team1Id == teamId -> {
                        newTeam1Score += 1
                        update(scoreDocRef, mapOf("team1_score" to newTeam1Score))
                    }
                    score.team2Id == teamId -> {
                        newTeam2Score += 1
                        update(scoreDocRef, mapOf("team2_score" to newTeam2Score))
                    }
                    else -> {
                        println("FirebaseDataSource: GOL para time desconhecido: $teamId")
                    }
                }

                // Sincronizar com documento principal do jogo
                update(gameDocRef, mapOf(
                    "team1_score" to newTeam1Score,
                    "team2_score" to newTeam2Score
                ))
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updatePlayerStats(
        gameId: String,
        playerId: String,
        teamId: String,
        eventType: GameEventType,
        assistedById: String?
    ): Result<Unit> {
        return try {
            val statsId = "${gameId}_$playerId"
            val statsDocRef = firestore.collection("live_player_stats").document(statsId)
            val confirmationId = "${gameId}_$playerId"
            val confDocRef = firestore.collection("confirmations").document(confirmationId)

            firestore.runTransaction<Unit> {
                // 1. Atualizar Live Player Stats
                val snapshot = get(statsDocRef)

                if (!snapshot.exists) {
                    // Criar nova estatística
                    val newStats = mapOf(
                        "id" to statsId,
                        "game_id" to gameId,
                        "player_id" to playerId,
                        "team_id" to teamId,
                        "goals" to if (eventType == GameEventType.GOAL) 1 else 0,
                        "assists" to 0,
                        "saves" to if (eventType == GameEventType.SAVE) 1 else 0,
                        "yellow_cards" to if (eventType == GameEventType.YELLOW_CARD) 1 else 0,
                        "red_cards" to if (eventType == GameEventType.RED_CARD) 1 else 0
                    )
                    set(statsDocRef, newStats)
                } else {
                    // Atualizar estatística existente
                    when (eventType) {
                        GameEventType.GOAL -> update(statsDocRef, mapOf("goals" to snapshot.getGoals() + 1))
                        GameEventType.SAVE -> update(statsDocRef, mapOf("saves" to snapshot.getSaves() + 1))
                        GameEventType.YELLOW_CARD -> update(statsDocRef, mapOf("yellow_cards" to snapshot.getYellowCards() + 1))
                        GameEventType.RED_CARD -> update(statsDocRef, mapOf("red_cards" to snapshot.getRedCards() + 1))
                        else -> {}
                    }
                }

                // 2. Sync com GameConfirmation
                val confSnapshot = get(confDocRef)
                if (confSnapshot.exists) {
                    val currentGoals = confSnapshot.get<Long?>("goals") ?: 0
                    val currentYellow = confSnapshot.get<Long?>("yellow_cards") ?: 0
                    val currentRed = confSnapshot.get<Long?>("red_cards") ?: 0
                    val currentSaves = confSnapshot.get<Long?>("saves") ?: 0

                    when (eventType) {
                        GameEventType.GOAL -> update(confDocRef, mapOf("goals" to currentGoals + 1))
                        GameEventType.YELLOW_CARD -> update(confDocRef, mapOf("yellow_cards" to currentYellow + 1))
                        GameEventType.RED_CARD -> update(confDocRef, mapOf("red_cards" to currentRed + 1))
                        GameEventType.SAVE -> update(confDocRef, mapOf("saves" to currentSaves + 1))
                        else -> {}
                    }
                }

                // 3. Atualizar assistência se houver
                if (eventType == GameEventType.GOAL && assistedById != null) {
                    val assistStatsId = "${gameId}_$assistedById"
                    val assistStatsDocRef = firestore.collection("live_player_stats").document(assistStatsId)
                    val assistConfDocRef = firestore.collection("confirmations").document(assistStatsId)

                    // Update Live Stats
                    val assistSnapshot = get(assistStatsDocRef)
                    if (assistSnapshot.exists) {
                        update(assistStatsDocRef, mapOf("assists" to assistSnapshot.getAssists() + 1))
                    } else {
                        val newAssistStats = mapOf(
                            "id" to assistStatsId,
                            "game_id" to gameId,
                            "player_id" to assistedById,
                            "team_id" to teamId,
                            "assists" to 1
                        )
                        set(assistStatsDocRef, newAssistStats)
                    }

                    // Update Confirmation
                    val assistConfSnapshot = get(assistConfDocRef)
                    if (assistConfSnapshot.exists) {
                        val currentAssistCount = assistConfSnapshot.get<Long?>("assists") ?: 0
                        update(assistConfDocRef, mapOf("assists" to currentAssistCount + 1))
                    }
                }
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> {
        return try {
            val functions = Firebase.functions(FUNCTIONS_REGION)
            functions.httpsCallable("deleteLiveGameEvent")
                .invoke(
                    mapOf(
                        "gameId" to gameId,
                        "eventId" to eventId,
                    )
                )
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

}
