package com.futebadosparcas.data.repository

import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameConfirmation as AndroidGameConfirmation
import com.futebadosparcas.data.model.GameEvent
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.model.LiveGameScore
import com.futebadosparcas.data.model.Team
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
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * GameRepository implementado como Facade que delega para repositórios especializados:
 * - GameQueryRepository: queries e busca de jogos
 * - GameConfirmationRepository: confirmações de presença
 * - GameEventsRepository: eventos de partida
 * - GameTeamRepository: gerenciamento de times
 */
@Singleton
class GameRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val gameDao: GameDao,
    private val queryRepository: com.futebadosparcas.domain.repository.GameQueryRepository,
    private val confirmationRepository: com.futebadosparcas.domain.repository.GameConfirmationRepository,
    private val eventsRepository: GameEventsRepository,
    private val teamRepository: GameTeamRepository,
    private val liveGameRepository: LiveGameRepository
) : GameRepository {
    private val gamesCollection = firestore.collection("games")

    companion object {
        private const val TAG = "GameRepository"
    }

    // ========== Helper Methods para Conversao KMP -> Android ==========

    private fun KmpGameWithConfirmations.toAndroidGameWithConfirmations(): GameWithConfirmations = GameWithConfirmations(
        game = game.toAndroidGame(),
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
        conflictingGame = conflictingGame.toAndroidGame(),
        overlapMinutes = overlapMinutes
    )

    private fun List<KmpTimeConflict>.toAndroidTimeConflicts(): List<TimeConflict> = map { it.toAndroidTimeConflict() }

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
        queryRepository.getUpcomingGames().map { it.toAndroidGames() }

    override suspend fun getAllGames(): Result<List<Game>> =
        queryRepository.getAllGames().map { it.toAndroidGames() }

    override suspend fun getAllGamesWithConfirmationCount(): Result<List<GameWithConfirmations>> =
        queryRepository.getAllGamesWithConfirmationCount().map { it.toAndroidGameWithConfirmations() }

    override fun getAllGamesWithConfirmationCountFlow(): Flow<Result<List<GameWithConfirmations>>> =
        queryRepository.getAllGamesWithConfirmationCountFlow().map { result ->
            result.map { it.toAndroidGameWithConfirmations() }
        }

    override suspend fun getConfirmedUpcomingGamesForUser(): Result<List<Game>> =
        queryRepository.getConfirmedUpcomingGamesForUser().map { it.toAndroidGames() }

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
        queryRepository.getGameDetails(gameId).map { it.toAndroidGame() }

    override fun getGameDetailsFlow(gameId: String): Flow<Result<Game>> =
        queryRepository.getGameDetailsFlow(gameId).map { result ->
            result.map { it.toAndroidGame() }
        }

    override suspend fun getPublicGames(limit: Int): Result<List<Game>> =
        queryRepository.getPublicGames(limit).map { it.toAndroidGames() }

    override fun getPublicGamesFlow(limit: Int): Flow<List<Game>> =
        queryRepository.getPublicGamesFlow(limit).map { it.toAndroidGames() }

    override suspend fun getNearbyPublicGames(
        userLat: Double,
        userLng: Double,
        radiusKm: Double,
        limit: Int
    ): Result<List<Game>> =
        queryRepository.getNearbyPublicGames(userLat, userLng, radiusKm, limit).map { it.toAndroidGames() }

    override suspend fun getOpenPublicGames(limit: Int): Result<List<Game>> =
        queryRepository.getOpenPublicGames(limit).map { it.toAndroidGames() }

    override suspend fun checkTimeConflict(
        fieldId: String,
        date: String,
        startTime: String,
        endTime: String,
        excludeGameId: String?
    ): Result<List<TimeConflict>> =
        queryRepository.checkTimeConflict(fieldId, date, startTime, endTime, excludeGameId).map { it.toAndroidTimeConflicts() }

    override suspend fun getGamesByFieldAndDate(fieldId: String, date: String): Result<List<Game>> =
        queryRepository.getGamesByFieldAndDate(fieldId, date).map { it.toAndroidGames() }

    // ========== Confirmation Methods - Delegação para GameConfirmationRepository ==========
    override suspend fun getGameConfirmations(gameId: String): Result<List<AndroidGameConfirmation>> =
        confirmationRepository.getGameConfirmations(gameId).map { kmpConfirmations ->
            kmpConfirmations.map { it.toAndroidModel() }
        }

    override fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<AndroidGameConfirmation>>> =
        confirmationRepository.getGameConfirmationsFlow(gameId).map { result ->
            result.map { kmpConfirmations ->
                kmpConfirmations.map { it.toAndroidModel() }
            }
        }

    override suspend fun confirmPresence(
        gameId: String,
        position: String,
        isCasual: Boolean
    ): Result<AndroidGameConfirmation> =
        confirmationRepository.confirmPresence(gameId, position, isCasual).map { it.toAndroidModel() }

    override suspend fun getGoalkeeperCount(gameId: String): Result<Int> =
        confirmationRepository.getGoalkeeperCount(gameId)

    override suspend fun cancelConfirmation(gameId: String): Result<Unit> =
        confirmationRepository.cancelConfirmation(gameId)

    override suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit> =
        confirmationRepository.removePlayerFromGame(gameId, userId)

    override suspend fun confirmPlayerAsOwner(gameId: String, userId: String): Result<Unit> =
        confirmationRepository.updateConfirmationStatusForUser(gameId, userId, "CONFIRMED")

    override suspend fun updatePaymentStatus(gameId: String, userId: String, isPaid: Boolean): Result<Unit> =
        confirmationRepository.updatePaymentStatus(gameId, userId, isPaid)

    override suspend fun summonPlayers(gameId: String, confirmations: List<AndroidGameConfirmation>): Result<Unit> =
        confirmationRepository.summonPlayers(gameId, confirmations.map { it.toKmpModel() })

    override suspend fun acceptInvitation(gameId: String, position: String): Result<AndroidGameConfirmation> =
        confirmationRepository.acceptInvitation(gameId, position).map { it.toAndroidModel() }

    // ========== Events Methods - Delegação para GameEventsRepository ==========
    override fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>> =
        eventsRepository.getGameEventsFlow(gameId)

    override fun getLiveScoreFlow(gameId: String): Flow<LiveGameScore?> =
        eventsRepository.getLiveScoreFlow(gameId)

    override suspend fun sendGameEvent(gameId: String, event: GameEvent): Result<Unit> =
        eventsRepository.sendGameEvent(gameId, event)

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

            // Safety check: ensure dateTime is set
            var finalGame = game.copy(id = docRef.id, ownerId = uid)
            if (finalGame.dateTime == null && finalGame.date.isNotEmpty() && finalGame.time.isNotEmpty()) {
                try {
                    // Combine date and time (assuming format yyyy-MM-dd and HH:mm)
                    val dateTimeStr = "${finalGame.date} ${finalGame.time}"
                    val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
                    finalGame = finalGame.copy(dateTimeRaw = sdf.parse(dateTimeStr))
                } catch (e: Exception) {
                    AppLogger.e(TAG, "createGame: Error parsing dateTime from date/time strings", e)
                }
            }

            // Validar o jogo antes de salvar (#28 - Validação de bounds)
            val validationErrors = finalGame.validate()
            if (validationErrors.isNotEmpty()) {
                val errorMsg = validationErrors.joinToString(", ") { it.message }
                return Result.failure(IllegalArgumentException("Validação falhou: $errorMsg"))
            }

            docRef.set(finalGame).await()
            Result.success(finalGame)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateGameStatus(gameId: String, status: String): Result<Unit> {
        return try {
            if (status == GameStatus.LIVE.name) {
                // Ao iniciar o jogo, sincronizar nomes dos times e inicializar placar
                try {
                    val teamsResult = getGameTeams(gameId)
                    if (teamsResult.isSuccess) {
                        val teams = teamsResult.getOrNull() ?: emptyList()
                        if (teams.size >= 2) {
                            val updates = mapOf(
                                "status" to status,
                                "team1_name" to teams[0].name,
                                "team2_name" to teams[1].name,
                                "team1_score" to 0,
                                "team2_score" to 0
                            )
                            gamesCollection.document(gameId).update(updates).await()

                            // Criar ou resetar documento na coleção live_scores
                            liveGameRepository.startLiveGame(gameId, teams[0].id, teams[1].id)
                            AppLogger.d(TAG) { "Jogo $gameId iniciado: nomes sincronizados e placar resetado." }
                        } else {
                            gamesCollection.document(gameId).update("status", status).await()
                        }
                    } else {
                        gamesCollection.document(gameId).update("status", status).await()
                    }
                } catch (e: Exception) {
                    AppLogger.e(TAG, "Erro ao processar início de jogo LIVE para $gameId", e)
                    gamesCollection.document(gameId).update("status", status).await()
                }
            } else {
                gamesCollection.document(gameId).update("status", status).await()
            }

            if (status == GameStatus.FINISHED.name) {
                // Logic migrated to Cloud Functions (Badges, XP, etc)
                AppLogger.i(TAG) { "Jogo finalizado. Badges e XP serão processados via Cloud Functions." }
            }

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
            // Validar o jogo antes de salvar (#28 - Validação de bounds)
            val validationErrors = game.validate()
            if (validationErrors.isNotEmpty()) {
                val errorMsg = validationErrors.joinToString(", ") { it.message }
                return Result.failure(IllegalArgumentException("Validação falhou: $errorMsg"))
            }

            // Atualizar o timestamp de atualização (#1 - Campo updatedAt)
            val updatedGame = game.copy().apply {
                updatedAt = java.util.Date()
            }

            gamesCollection.document(game.id).set(updatedGame).await()
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
