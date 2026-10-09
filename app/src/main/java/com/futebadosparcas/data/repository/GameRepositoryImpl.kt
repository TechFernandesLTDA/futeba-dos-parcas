package com.futebadosparcas.data.repository

import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.data.model.GameConfirmation as AndroidGameConfirmation
import com.futebadosparcas.data.model.GameEvent
import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.data.model.LiveGameScore
import com.futebadosparcas.domain.model.Team
import com.futebadosparcas.domain.model.Game as KmpGame
import com.futebadosparcas.domain.model.GameConfirmation as KmpGameConfirmation
import com.futebadosparcas.domain.model.GameFilterType as KmpGameFilterType
import com.futebadosparcas.domain.model.GameWithConfirmations as KmpGameWithConfirmations
import com.futebadosparcas.domain.model.TimeConflict as KmpTimeConflict
import com.futebadosparcas.ui.games.GameWithConfirmations
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.toAndroidGame
import com.futebadosparcas.util.toAndroidGames
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.functions
import com.google.firebase.Firebase
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * GameRepository implementado como Facade que delega para repositórios especializados:
 * - GameQueryRepository: queries e busca de jogos
 * - GameConfirmationRepository: confirmações de presença
 * - GameEventsRepository: eventos de partida
 * - GameTeamRepository: gerenciamento de times
 */
class GameRepositoryImpl constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val gameDao: GameDao,
    private val queryRepository: com.futebadosparcas.domain.repository.GameQueryRepository,
    private val confirmationRepository: com.futebadosparcas.domain.repository.GameConfirmationRepository,
    private val eventsRepository: com.futebadosparcas.domain.repository.GameEventsRepository,
    private val teamRepository: com.futebadosparcas.domain.repository.GameTeamRepository
) : GameRepository {
    private val gamesCollection = firestore.collection("games")

    companion object {
        private const val TAG = "GameRepository"
        private const val FUNCTIONS_REGION = "southamerica-east1"

        // Campos server-managed que o cliente NUNCA deve escrever (Firestore rules
        // hasNoGameValidationClientFields bloqueia writes que os contêm).
        private val SERVER_MANAGED_KEYS = setOf(
            "xp_processed", "xp_processing", "xp_processed_at",
            "xp_reward_status", "xp_reward_held_at", "xp_reward_hold_reasons",
            "xp_reward_review_decision", "xp_reward_reviewed_at", "xp_reward_reviewed_by",
            "xp_reward_review_reason", "xp_reward_review_previous_status", "xp_reward_review_new_status",
            "validation_status", "validation_score", "validation_version",
            "validation_updated_at", "validation_mode", "validation_reasons",
            "started_at", "started_by", "start_validation_score",
            "finished_at", "finished_by", "finish_validation_score",
            "reviewed_at", "reviewed_by", "review_reason"
        )
    }

    /**
     * Converte Game para um Map contendo apenas campos client-writable.
     * Remove todos os campos server-managed (xp_*, validation_*, finished_at, etc.)
     * que o Firestore rules bloqueia em creates/updates de games.
     * Usa snake_case para compatibilidade com as rules e CF triggers.
     */
    private fun gameToClientWriteMap(game: Game, includeTimestamps: Boolean = true): MutableMap<String, Any?> {
        val map = mutableMapOf<String, Any?>()

        // Mapeamento manual snake_case — NAO serializa o data class completo
        // (o Android SDK ignora @SerialName do KMP e produz camelCase)
        map["schedule_id"] = game.scheduleId
        map["date"] = game.date
        map["time"] = game.time
        map["end_time"] = game.endTime
        map["status"] = game.status
        map["max_players"] = game.maxPlayers
        map["max_goalkeepers"] = game.maxGoalkeepers
        map["players_count"] = game.playersCount
        map["goalkeepers_count"] = game.goalkeepersCount
        map["daily_price"] = game.dailyPrice
        map["total_cost"] = game.totalCost
        map["pix_key"] = game.pixKey
        map["number_of_teams"] = game.numberOfTeams
        map["owner_id"] = game.ownerId
        map["owner_name"] = game.ownerName
        map["location_id"] = game.locationId
        map["field_id"] = game.fieldId
        map["location_name"] = game.locationName
        map["location_address"] = game.locationAddress
        game.locationLat?.let { map["location_lat"] = it }
        game.locationLng?.let { map["location_lng"] = it }
        map["field_name"] = game.fieldName
        map["game_type"] = game.gameType
        map["gender"] = game.gender
        map["recurrence"] = game.recurrence
        game.recurrenceIndex?.let { map["recurrence_index"] = it }
        game.recurrenceCount?.let { map["recurrence_count"] = it }
        game.recurrenceEndDate?.let { map["recurrence_end_date"] = it }
        map["visibility"] = game.visibility
        map["players"] = emptyList<String>()
        map["team1_score"] = game.team1Score
        map["team2_score"] = game.team2Score
        map["team1_name"] = game.team1Name
        map["team2_name"] = game.team2Name
        game.groupId?.let { map["group_id"] = it }
        game.groupName?.let { map["group_name"] = it }
        map["co_organizers"] = game.coOrganizers
        map["auto_close_hours"] = game.autoCloseHours
        map["require_checkin"] = game.requireCheckin
        map["checkin_radius_meters"] = game.checkinRadiusMeters
        map["rules"] = game.rules
        map["is_soft_deleted"] = game.isSoftDeleted
        map["is_public"] = game.isPublic
        map["voting_concluded"] = game.votingConcluded
        map["post_game_report_generated"] = false
        map["auto_closed"] = false

        // Server-managed fields explicitamente EXCLUIDOS:
        // xp_processed, xp_processing, xp_processed_at, xp_reward_*, validation_*,
        // started_at, finished_at, reviewed_at, etc.

        if (includeTimestamps) {
            map["created_at"] = com.google.firebase.firestore.FieldValue.serverTimestamp()
            map["updated_at"] = com.google.firebase.firestore.FieldValue.serverTimestamp()
        }

        // Sanity: garante que nenhum campo server-managed entrou no map
        SERVER_MANAGED_KEYS.forEach { key ->
            require(!map.containsKey(key)) { "BUG: server-managed field '$key' leaked into client write map" }
        }

        return map
    }

    // ========== Helper Methods para Conversao KMP -> Android ==========

    private fun KmpGameWithConfirmations.toAndroidGameWithConfirmations(): GameWithConfirmations = GameWithConfirmations(
        game = game, // Já é domain.model.Game (KmpGame)
        confirmedCount = confirmedCount,
        isUserConfirmed = isUserConfirmed
    )

    private fun List<KmpGameWithConfirmations>.toAndroidGameWithConfirmations(): List<GameWithConfirmations> = map { it.toAndroidGameWithConfirmations() }

    private fun toAndroidPaginatedGames(
        kmpGames: List<KmpGameWithConfirmations>,
        lastGameId: String?,
        hasMore: Boolean
    ): PaginatedGames = PaginatedGames(
        games = kmpGames.map { it.toAndroidGameWithConfirmations() },
        lastGameId = lastGameId,
        hasMore = hasMore
    )

    private fun KmpTimeConflict.toAndroidTimeConflict(): TimeConflict = TimeConflict(
        // FIX #4127: TimeConflict não carrega mais Game inteiro.
        conflictingTime = conflictingTime,
        conflictingEndTime = conflictingEndTime,
        overlapMinutes = overlapMinutes
    )

    private fun List<KmpTimeConflict>.toAndroidTimeConflicts(): List<TimeConflict> = map { it.toAndroidTimeConflict() }

    // Conversores para GameEvent (domain -> data)
    private fun com.futebadosparcas.domain.model.GameEvent.toAndroidGameEvent(): com.futebadosparcas.data.model.GameEvent {
        return com.futebadosparcas.data.model.GameEvent(
            id = id,
            gameId = gameId,
            eventType = eventType,
            playerId = playerId,
            playerName = playerName,
            teamId = teamId,
            assistedById = assistedById,
            assistedByName = assistedByName,
            minute = minute,
            createdBy = createdBy,
            createdAt = createdAt?.let { java.util.Date(it) }
        )
    }

    private fun List<com.futebadosparcas.domain.model.GameEvent>.toAndroidGameEvents(): List<com.futebadosparcas.data.model.GameEvent> = map { it.toAndroidGameEvent() }

    // Conversor para LiveScore (domain -> data)
    private fun com.futebadosparcas.domain.model.LiveScore.toAndroidLiveGameScore(): com.futebadosparcas.data.model.LiveGameScore {
        return com.futebadosparcas.data.model.LiveGameScore(
            id = id,
            gameId = gameId,
            scores = scores,
            team1Id = team1Id,
            team1Score = team1Score,
            team2Id = team2Id,
            team2Score = team2Score,
            startedAt = startedAt?.let { java.util.Date(it) },
            finishedAt = finishedAt?.let { java.util.Date(it) }
        )
    }

    // Conversor para GameEvent (data -> domain)
    private fun com.futebadosparcas.data.model.GameEvent.toKmpGameEvent(): com.futebadosparcas.domain.model.GameEvent {
        return com.futebadosparcas.domain.model.GameEvent(
            id = id,
            gameId = gameId,
            eventType = eventType,
            playerId = playerId,
            playerName = playerName,
            teamId = teamId,
            assistedById = assistedById,
            assistedByName = assistedByName,
            minute = minute,
            createdBy = createdBy,
            createdAt = createdAt?.time
        )
    }

    private fun KmpGameFilterType.toAndroidFilterType(): GameFilterType = when (this) {
        KmpGameFilterType.ALL -> GameFilterType.ALL
        KmpGameFilterType.OPEN -> GameFilterType.OPEN
        KmpGameFilterType.MY_GAMES -> GameFilterType.MY_GAMES
        KmpGameFilterType.LIVE -> GameFilterType.LIVE
    }

    private fun GameFilterType.toKmpFilterType(): KmpGameFilterType = when (this) {
        GameFilterType.ALL -> KmpGameFilterType.ALL
        GameFilterType.OPEN -> KmpGameFilterType.OPEN
        GameFilterType.MY_GAMES -> KmpGameFilterType.MY_GAMES
        GameFilterType.LIVE -> KmpGameFilterType.LIVE
    }

    // ========== Query Methods - Delegação para GameQueryRepository ==========
    override suspend fun getUpcomingGames(): Result<List<Game>> =
        queryRepository.getUpcomingGames()

    override suspend fun getAllGames(): Result<List<Game>> =
        queryRepository.getAllGames()

    override suspend fun getAllGamesWithConfirmationCount(): Result<List<GameWithConfirmations>> =
        queryRepository.getAllGamesWithConfirmationCount().map { it.toAndroidGameWithConfirmations() }

    override fun getAllGamesWithConfirmationCountFlow(): Flow<Result<List<GameWithConfirmations>>> =
        queryRepository.getAllGamesWithConfirmationCountFlow().map { result ->
            result.map { it.toAndroidGameWithConfirmations() }
        }

    override suspend fun getConfirmedUpcomingGamesForUser(): Result<List<Game>> =
        queryRepository.getConfirmedUpcomingGamesForUser()

    override fun getLiveAndUpcomingGamesFlow(): Flow<Result<List<GameWithConfirmations>>> =
        queryRepository.getLiveAndUpcomingGamesFlow().map { result ->
            result.map { it.toAndroidGameWithConfirmations() }
        }

    override fun getHistoryGamesFlow(limit: Int): Flow<Result<List<GameWithConfirmations>>> =
        queryRepository.getHistoryGamesFlow(limit).map { result ->
            result.map { it.toAndroidGameWithConfirmations() }
        }

    override suspend fun getGamesByFilter(filterType: GameFilterType): Result<List<GameWithConfirmations>> =
        queryRepository.getGamesByFilter(filterType.toKmpFilterType()).map { it.toAndroidGameWithConfirmations() }

    override suspend fun getHistoryGamesPaginated(pageSize: Int, lastGameId: String?): Result<PaginatedGames> =
        queryRepository.getHistoryGamesPaginated(pageSize, lastGameId).map {
            toAndroidPaginatedGames(it.games, it.lastGameId, it.hasMore)
        }

    override suspend fun getGameDetails(gameId: String): Result<Game> =
        queryRepository.getGameDetails(gameId) // Já retorna domain.model.Game

    override fun getGameDetailsFlow(gameId: String): Flow<Result<Game>> =
        queryRepository.getGameDetailsFlow(gameId)

    override suspend fun getPublicGames(limit: Int): Result<List<Game>> =
        queryRepository.getPublicGames(limit)

    override fun getPublicGamesFlow(limit: Int): Flow<List<Game>> =
        queryRepository.getPublicGamesFlow(limit)

    override suspend fun getNearbyPublicGames(
        userLat: Double,
        userLng: Double,
        radiusKm: Double,
        limit: Int
    ): Result<List<Game>> =
        queryRepository.getNearbyPublicGames(userLat, userLng, radiusKm, limit)

    override suspend fun getOpenPublicGames(limit: Int): Result<List<Game>> =
        queryRepository.getOpenPublicGames(limit)

    override suspend fun checkTimeConflict(
        fieldId: String,
        date: String,
        startTime: String,
        endTime: String,
        excludeGameId: String?
    ): Result<List<TimeConflict>> =
        queryRepository.checkTimeConflict(fieldId, date, startTime, endTime, excludeGameId).map { it.toAndroidTimeConflicts() }

    override suspend fun getFieldBusySlots(
        fieldId: String,
        startDate: String,
        endDate: String,
        excludeGameId: String?
    ): Result<List<com.futebadosparcas.domain.model.FieldBusySlot>> =
        queryRepository.getFieldBusySlots(fieldId, startDate, endDate, excludeGameId)

    // ========== Confirmation Methods - Delegação para GameConfirmationRepository ==========
    override suspend fun getGameConfirmations(gameId: String): Result<List<com.futebadosparcas.domain.model.GameConfirmation>> =
        confirmationRepository.getGameConfirmations(gameId)

    override fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<com.futebadosparcas.domain.model.GameConfirmation>>> =
        confirmationRepository.getGameConfirmationsFlow(gameId)

    override suspend fun confirmPresence(
        gameId: String,
        position: String,
        isCasual: Boolean
    ): Result<com.futebadosparcas.domain.model.GameConfirmation> =
        confirmationRepository.confirmPresence(gameId, position, isCasual)

    override suspend fun getGoalkeeperCount(gameId: String): Result<Int> =
        confirmationRepository.getGoalkeeperCount(gameId)

    override suspend fun cancelConfirmation(gameId: String): Result<Unit> =
        confirmationRepository.cancelConfirmation(gameId)

    override suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit> =
        confirmationRepository.removePlayerFromGame(gameId, userId)

    override suspend fun confirmPlayerAsOwner(gameId: String, userId: String): Result<Unit> {
        return runCatching {
            Firebase.functions(FUNCTIONS_REGION)
                .getHttpsCallable("confirmPlayerAsManager")
                .call(
                    mapOf(
                        "gameId" to gameId,
                        "userId" to userId
                    )
                )
                .await()
            AppLogger.i(TAG) { "Jogador $userId confirmado pelo gestor no jogo $gameId" }
        }
    }

    override suspend fun updatePaymentStatus(gameId: String, userId: String, isPaid: Boolean): Result<Unit> =
        confirmationRepository.updatePaymentStatus(gameId, userId, isPaid)

    override suspend fun summonPlayers(gameId: String, confirmations: List<com.futebadosparcas.domain.model.GameConfirmation>): Result<Unit> =
        confirmationRepository.summonPlayers(gameId, confirmations)

    override suspend fun acceptInvitation(gameId: String, position: String): Result<com.futebadosparcas.domain.model.GameConfirmation> =
        confirmationRepository.acceptInvitation(gameId, position)

    // ========== Events Methods - Delegação para GameEventsRepository ==========
    override fun getGameEventsFlow(gameId: String): Flow<Result<List<com.futebadosparcas.data.model.GameEvent>>> =
        eventsRepository.getGameEventsFlow(gameId).map { result ->
            result.map { it.toAndroidGameEvents() }
        }

    override fun getLiveScoreFlow(gameId: String): Flow<com.futebadosparcas.data.model.LiveGameScore?> =
        eventsRepository.getLiveScoreFlow(gameId).map { liveScore ->
            liveScore?.toAndroidLiveGameScore()
        }

    override suspend fun sendGameEvent(gameId: String, event: com.futebadosparcas.data.model.GameEvent): Result<Unit> =
        eventsRepository.sendGameEvent(gameId, event.toKmpGameEvent())

    override suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> =
        eventsRepository.deleteGameEvent(gameId, eventId)

    // ========== Team Methods - Delegação para GameTeamRepository ==========
    override suspend fun generateTeams(
        gameId: String,
        numberOfTeams: Int,
        balanceTeams: Boolean
    ): Result<List<Team>> = teamRepository.generateTeams(gameId, numberOfTeams, balanceTeams)

    override suspend fun getGameTeams(gameId: String): Result<List<Team>> =
        teamRepository.getGameTeams(gameId)

    override fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>> =
        teamRepository.getGameTeamsFlow(gameId)

    override suspend fun clearGameTeams(gameId: String): Result<Unit> =
        teamRepository.clearGameTeams(gameId)

    override suspend fun updateTeams(teams: List<Team>): Result<Unit> =
        teamRepository.updateTeams(teams)

    // ========== Game Management Methods - Mantidos aqui (CRUD e Status) ==========
    override suspend fun createGame(game: Game): Result<Game> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            val docRef = gamesCollection.document()

            val finalGame = game.copy(id = docRef.id, ownerId = uid)
            val writeData = gameToClientWriteMap(finalGame)

            docRef.set(writeData).await()
            Result.success(finalGame)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateGameStatus(gameId: String, status: String): Result<Unit> {
        return try {
            if (status == GameStatus.LIVE.name) {
                Firebase.functions(FUNCTIONS_REGION)
                    .getHttpsCallable("startGameLifecycle")
                    .call(mapOf("gameId" to gameId))
                    .await()
                AppLogger.d(TAG) { "Jogo $gameId iniciado via Cloud Function." }
                return Result.success(Unit)
            }

            if (status == GameStatus.FINISHED.name) {
                Firebase.functions(FUNCTIONS_REGION)
                    .getHttpsCallable("finishGameLifecycle")
                    .call(mapOf("gameId" to gameId))
                    .await()
                AppLogger.i(TAG) { "Jogo $gameId finalizado via Cloud Function." }
                return Result.success(Unit)
            }

            gamesCollection.document(gameId).update("status", status).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateGameConfirmationStatus(gameId: String, isOpen: Boolean): Result<Unit> {
        return try {
            val status = if (isOpen) "SCHEDULED" else "CONFIRMED"
            gamesCollection.document(gameId).update("status", status).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateGame(game: Game): Result<Unit> {
        return try {
            val writeData = gameToClientWriteMap(game, includeTimestamps = false)
            writeData["updated_at"] = com.google.firebase.firestore.FieldValue.serverTimestamp()

            gamesCollection.document(game.id).set(writeData, com.google.firebase.firestore.SetOptions.merge()).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteGame(gameId: String): Result<Unit> {
        return try {
            // BUG #5 FIX: Deleção em cascata de todos os dados relacionados
            val confirmationsCollection = firestore.collection("confirmations")
            val teamsCollection = firestore.collection("teams")
            val mvpVotesCollection = firestore.collection("mvp_votes")
            val liveScoresCollection = firestore.collection("live_scores")

            // 1. Buscar todos os documentos relacionados
            val confirmations = confirmationsCollection
                .whereEqualTo("game_id", gameId)
                .get().await()

            val teams = teamsCollection
                .whereEqualTo("game_id", gameId)
                .get().await()

            val mvpVotes = mvpVotesCollection
                .whereEqualTo("game_id", gameId)
                .get().await()

            val gameEvents = gamesCollection.document(gameId)
                .collection("game_events")
                .get().await()

            // 2. Deletar em batch (limite de 500 operações por batch)
            val batch = firestore.batch()
            var operationCount = 0
            val maxBatchSize = 450 // Margem de segurança

            // Deletar confirmações
            confirmations.documents.forEach { doc ->
                batch.delete(doc.reference)
                operationCount++
            }

            // Deletar times
            teams.documents.forEach { doc ->
                batch.delete(doc.reference)
                operationCount++
            }

            // Deletar votos MVP
            mvpVotes.documents.forEach { doc ->
                batch.delete(doc.reference)
                operationCount++
            }

            // Deletar eventos do jogo (subcollection)
            gameEvents.documents.forEach { doc ->
                batch.delete(doc.reference)
                operationCount++
            }

            // Deletar live_score se existir
            val liveScoreDoc = liveScoresCollection.document(gameId)
            batch.delete(liveScoreDoc)
            operationCount++

            // Deletar o jogo principal
            batch.delete(gamesCollection.document(gameId))

            // Commit do batch
            batch.commit().await()

            // Sync with local DB
            gameDao.deleteGame(gameId)

            AppLogger.i(TAG) { "Jogo $gameId deletado com sucesso. Removidos: $operationCount documentos relacionados." }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao deletar jogo $gameId em cascata", e)
            Result.failure(e)
        }
    }

    override suspend fun clearAll(): Result<Unit> {
        return try {
            // Limpa o banco de dados local
            gameDao.clearAll()

            // Limpa as coleções do Firestore
            val gamesSnapshot = gamesCollection.limit(500).get().await()
            val confirmationsCollection = firestore.collection("confirmations")
            val teamsCollection = firestore.collection("teams")
            val confirmationsSnapshot = confirmationsCollection.limit(500).get().await()
            val teamsSnapshot = teamsCollection.limit(500).get().await()

            firestore.runBatch {
                gamesSnapshot.documents.forEach { doc -> it.delete(doc.reference) }
                confirmationsSnapshot.documents.forEach { doc -> it.delete(doc.reference) }
                teamsSnapshot.documents.forEach { doc -> it.delete(doc.reference) }
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // === SOFT DELETE (P2 #40) ===

    override suspend fun softDeleteGame(gameId: String): Result<Unit> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            val updates = mapOf(
                "deleted_at" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                "deleted_by" to uid,
                "updated_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )

            gamesCollection.document(gameId).update(updates).await()

            AppLogger.i(TAG) { "Jogo $gameId soft-deletado por $uid" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao soft-deletar jogo $gameId", e)
            Result.failure(e)
        }
    }

    override suspend fun restoreGame(gameId: String): Result<Unit> {
        return try {
            val updates = mapOf(
                "deleted_at" to com.google.firebase.firestore.FieldValue.delete(),
                "deleted_by" to com.google.firebase.firestore.FieldValue.delete(),
                "updated_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )

            gamesCollection.document(gameId).update(updates).await()

            AppLogger.i(TAG) { "Jogo $gameId restaurado com sucesso" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao restaurar jogo $gameId", e)
            Result.failure(e)
        }
    }

    override suspend fun updatePartialPayment(
        gameId: String,
        userId: String,
        amount: Double
    ): Result<Unit> {
        return try {
            val confirmationsCollection = firestore.collection("confirmations")
            val query = confirmationsCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("user_id", userId)
                .limit(1)
                .get()
                .await()

            if (query.documents.isNotEmpty()) {
                val doc = query.documents.first()
                val updates = mapOf(
                    "partial_payment" to amount,
                    "payment_status" to if (amount > 0) "PARTIAL" else "PENDING"
                )
                doc.reference.update(updates).await()
            }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar pagamento parcial", e)
            Result.failure(e)
        }
    }
}

/**
 * Converte modelo KMP para Android.
 */
private fun KmpGameConfirmation.toAndroidModel(): AndroidGameConfirmation {
    return AndroidGameConfirmation(
        id = id,
        gameId = gameId,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        position = position,
        status = status,
        paymentStatus = paymentStatus,
        isCasualPlayer = isCasualPlayer,
        goals = goals,
        yellowCards = yellowCards,
        redCards = redCards,
        assists = assists,
        saves = saves,
        confirmedAt = confirmedAt?.let { java.util.Date(it) },
        nickname = nickname,
        xpEarned = xpEarned,
        isMvp = isMvp,
        isBestGk = isBestGk,
        isWorstPlayer = isWorstPlayer
    )
}

/**
 * Converte modelo Android para KMP.
 */
private fun AndroidGameConfirmation.toKmpModel(): KmpGameConfirmation {
    return KmpGameConfirmation(
        id = id,
        gameId = gameId,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        position = position,
        status = status,
        paymentStatus = paymentStatus,
        isCasualPlayer = isCasualPlayer,
        goals = goals,
        yellowCards = yellowCards,
        redCards = redCards,
        assists = assists,
        saves = saves,
        confirmedAt = confirmedAt?.time,
        nickname = nickname,
        xpEarned = xpEarned,
        isMvp = isMvp,
        isBestGk = isBestGk,
        isWorstPlayer = isWorstPlayer
    )
}
