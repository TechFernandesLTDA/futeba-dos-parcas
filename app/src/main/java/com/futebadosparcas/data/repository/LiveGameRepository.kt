package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.*
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LiveGameRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) {
    private val scoresCollection = firestore.collection("live_scores")
    private val eventsCollection = firestore.collection("game_events")
    private val liveStatsCollection = firestore.collection("live_player_stats")
    private val confirmationsCollection = firestore.collection("confirmations")

    companion object {
        private const val TAG = "LiveGameRepository"
    }

    /**
     * Inicia um jogo ao vivo
     */
    suspend fun startLiveGame(gameId: String, team1Id: String, team2Id: String): Result<LiveGameScore> {
        return try {
            val docRef = scoresCollection.document(gameId)

            val score = LiveGameScore(
                id = gameId,
                gameId = gameId,
                team1Id = team1Id,
                team1Score = 0,
                team2Id = team2Id,
                team2Score = 0
            )

            docRef.set(score).await()
            AppLogger.d(TAG) { "Jogo ao vivo iniciado: $gameId" }
            Result.success(score)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao iniciar jogo ao vivo", e)
            Result.failure(e)
        }
    }

    /**
     * Observa o placar em tempo real
     */
    fun observeLiveScore(gameId: String): Flow<LiveGameScore?> = callbackFlow {
        val listener = scoresCollection.document(gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro ao observar placar", error)
                    return@addSnapshotListener
                }

                val score = snapshot?.toObject(LiveGameScore::class.java)
                trySend(score)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Verifica se o usuário atual pode gerenciar eventos do jogo.
     * Retorna true se o usuário é o owner do jogo ou está confirmado.
     */
    private suspend fun canManageGameEvents(gameId: String): Boolean {
        val currentUserId = auth.currentUser?.uid
        if (currentUserId == null) {
            AppLogger.e(TAG, "canManageGameEvents: Usuário não autenticado")
            return false
        }

        AppLogger.d(TAG) { "canManageGameEvents: Verificando permissão para userId=$currentUserId, gameId=$gameId" }

        try {
            // Verificar se é owner do jogo
            val gameDoc = firestore.collection("games").document(gameId).get().await()
            val ownerId = gameDoc.getString("owner_id")
            AppLogger.d(TAG) { "canManageGameEvents: ownerId=$ownerId, currentUserId=$currentUserId" }
            if (ownerId == currentUserId) {
                AppLogger.d(TAG) { "canManageGameEvents: Usuário é owner, permissão concedida" }
                return true
            }

            // Verificar se está confirmado no jogo
            val confirmationId = "${gameId}_$currentUserId"
            val confDoc = confirmationsCollection.document(confirmationId).get().await()
            AppLogger.d(TAG) { "canManageGameEvents: confirmationId=$confirmationId, exists=${confDoc.exists()}" }
            if (confDoc.exists()) {
                val status = confDoc.getString("status")
                AppLogger.d(TAG) { "canManageGameEvents: status=$status" }
                if (status == "CONFIRMED") {
                    AppLogger.d(TAG) { "canManageGameEvents: Usuário confirmado, permissão concedida" }
                    return true
                }
            }

            AppLogger.w(TAG) { "canManageGameEvents: Permissão negada para userId=$currentUserId no jogo $gameId" }
            return false
        } catch (e: Exception) {
            AppLogger.e(TAG, "canManageGameEvents: Erro ao verificar permissão", e)
            return false
        }
    }

    /**
     * Adiciona um evento ao jogo (gol, cartão, etc)
     * Apenas owner ou jogadores confirmados podem adicionar eventos.
     */
    suspend fun addGameEvent(
        gameId: String,
        eventType: GameEventType,
        playerId: String,
        playerName: String,
        teamId: String,
        assistedById: String? = null,
        assistedByName: String? = null,
        minute: Int = 0
    ): Result<GameEvent> {
        AppLogger.d(TAG) { "addGameEvent: Iniciando - gameId=$gameId, eventType=$eventType, playerId=$playerId, playerName=$playerName, teamId=$teamId" }

        return try {
            // Validar permissão
            val hasPermission = canManageGameEvents(gameId)
            AppLogger.d(TAG) { "addGameEvent: hasPermission=$hasPermission" }

            if (!hasPermission) {
                AppLogger.w(TAG) { "addGameEvent: Permissão negada" }
                return Result.failure(Exception("Você não tem permissão para adicionar eventos neste jogo"))
            }

            val docRef = eventsCollection.document()

            val event = GameEvent(
                id = docRef.id,
                gameId = gameId,
                eventType = eventType.name,
                playerId = playerId,
                playerName = playerName,
                teamId = teamId,
                assistedById = assistedById,
                assistedByName = assistedByName,
                minute = minute
            )

            docRef.set(event).await()

            // Atualizar placar se for gol
            if (eventType == GameEventType.GOAL) {
                updateScoreForGoal(gameId, teamId)
            }

            // Atualizar estatísticas do jogador
            updatePlayerStats(gameId, playerId, teamId, eventType, assistedById)

            AppLogger.d(TAG) { "Evento adicionado: ${eventType.name} por $playerName" }
            Result.success(event)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao adicionar evento", e)
            Result.failure(e)
        }
    }

    /**
     * Atualiza placar quando há gol
     */
    private suspend fun updateScoreForGoal(gameId: String, teamId: String) {
        val scoreDoc = scoresCollection.document(gameId)
        val gameDoc = firestore.collection("games").document(gameId)

        // Tentar garantir que o documento de placar existe
        try {
            val snapshot = scoreDoc.get().await()
            if (!snapshot.exists()) {
                val teamsSnapshot = firestore.collection("teams")
                    .whereEqualTo("game_id", gameId)
                    .get()
                    .await()
                
                val teams = teamsSnapshot.toObjects(Team::class.java)
                if (teams.size >= 2) {
                    startLiveGame(gameId, teams[0].id, teams[1].id)
                    AppLogger.d(TAG) { "Placar inicializado sob demanda para o jogo $gameId" }
                }
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao tentar inicializar placar sob demanda", e)
        }

        firestore.runTransaction { transaction ->
            val snapshot = transaction.get(scoreDoc)
            val score = snapshot.toObject(LiveGameScore::class.java) 
                ?: return@runTransaction // Se ainda não existir após tentativa, aborta

            var newTeam1Score = score.team1Score
            var newTeam2Score = score.team2Score

            if (score.team1Id == teamId) {
                newTeam1Score += 1
                transaction.update(scoreDoc, "team1_score", newTeam1Score)
            } else if (score.team2Id == teamId) {
                newTeam2Score += 1
                transaction.update(scoreDoc, "team2_score", newTeam2Score)
            } else {
                // Caso o teamId não bata com nenhum (ex: substituição manual de times no meio do jogo)
                // Vamos tentar associar ao time que não tem ID ou simplesmente ignorar
                AppLogger.w(TAG) { "GOL para time desconhecido no placar: $teamId" }
            }

            // Sincronizar com documento principal do jogo para exibição na lista
            transaction.update(gameDoc, mapOf(
                "team1_score" to newTeam1Score,
                "team2_score" to newTeam2Score
            ))
        }.await()
    }

    /**
     * Atualiza estatísticas do jogador
     */
    private suspend fun updatePlayerStats(
        gameId: String,
        playerId: String,
        teamId: String,
        eventType: GameEventType,
        assistedById: String?
    ) {
        val statsId = "${gameId}_$playerId"
        val statsDoc = liveStatsCollection.document(statsId)
        val confirmationId = "${gameId}_$playerId" // Deterministic ID
        val confDoc = confirmationsCollection.document(confirmationId)

        firestore.runTransaction { transaction ->
            // 1. Update Live Player Stats
            val snapshot = transaction.get(statsDoc)
            val stats = snapshot.toObject(LivePlayerStats::class.java)

            if (stats == null) {
                // Criar nova estatística
                val newStats = LivePlayerStats(
                    id = statsId,
                    gameId = gameId,
                    playerId = playerId,
                    teamId = teamId,
                    goals = if (eventType == GameEventType.GOAL) 1 else 0,
                    assists = 0,
                    saves = if (eventType == GameEventType.SAVE) 1 else 0,
                    yellowCards = if (eventType == GameEventType.YELLOW_CARD) 1 else 0,
                    redCards = if (eventType == GameEventType.RED_CARD) 1 else 0
                )
                transaction.set(statsDoc, newStats)
            } else {
                // Atualizar estatística existente
                when (eventType) {
                    GameEventType.GOAL -> transaction.update(statsDoc, "goals", stats.goals + 1)
                    GameEventType.SAVE -> transaction.update(statsDoc, "saves", stats.saves + 1)
                    GameEventType.YELLOW_CARD -> transaction.update(statsDoc, "yellow_cards", stats.yellowCards + 1)
                    GameEventType.RED_CARD -> transaction.update(statsDoc, "red_cards", stats.redCards + 1)
                    else -> {}
                }
            }

            // 2. Sync with GameConfirmation (Roster)
            // Ensure document exists before updating to avoid crash if inconsistent
            val confSnapshot = transaction.get(confDoc)
            if (confSnapshot.exists()) {
                 val currentGoals = confSnapshot.getLong("goals") ?: 0
                 val currentYellow = confSnapshot.getLong("yellow_cards") ?: 0
                 val currentRed = confSnapshot.getLong("red_cards") ?: 0
                 val currentAssists = confSnapshot.getLong("assists") ?: 0 // New field

                 val currentSaves = confSnapshot.getLong("saves") ?: 0

                 when (eventType) {
                    GameEventType.GOAL -> transaction.update(confDoc, "goals", currentGoals + 1)
                    GameEventType.YELLOW_CARD -> transaction.update(confDoc, "yellow_cards", currentYellow + 1)
                    GameEventType.RED_CARD -> transaction.update(confDoc, "red_cards", currentRed + 1)
                    GameEventType.SAVE -> transaction.update(confDoc, "saves", currentSaves + 1)
                    else -> {}
                }
            }

            // Se houve assistência, incrementar assistências do assistente
            if (eventType == GameEventType.GOAL && assistedById != null) {
                val assistStatsId = "${gameId}_$assistedById"
                val assistStatsDoc = liveStatsCollection.document(assistStatsId)
                val assistConfirmationId = "${gameId}_$assistedById"
                val assistConfDoc = confirmationsCollection.document(assistConfirmationId)

                // Update Live Stats - criar se não existir
                val assistSnapshot = transaction.get(assistStatsDoc)
                val assistStats = assistSnapshot.toObject(LivePlayerStats::class.java)
                if (assistStats != null) {
                    transaction.update(assistStatsDoc, "assists", assistStats.assists + 1)
                } else {
                    // Criar nova estatística para o assistente
                    val newAssistStats = LivePlayerStats(
                        id = assistStatsId,
                        gameId = gameId,
                        playerId = assistedById,
                        teamId = teamId,
                        assists = 1
                    )
                    transaction.set(assistStatsDoc, newAssistStats)
                }

                // Update Confirmation
                val assistConfSnapshot = transaction.get(assistConfDoc)
                if (assistConfSnapshot.exists()) {
                    val currentAssistCount = assistConfSnapshot.getLong("assists") ?: 0
                    transaction.update(assistConfDoc, "assists", currentAssistCount + 1)
                }

            }
        }.await()
    }

    /**
     * Observa eventos do jogo em tempo real
     */
    fun observeGameEvents(gameId: String): Flow<List<GameEvent>> = callbackFlow {
        val listener = eventsCollection
            .whereEqualTo("game_id", gameId)
            // Removed orderBy to avoid needing a composite index (game_id + created_at)
            // .orderBy("created_at", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro ao observar eventos", error)
                    // Send empty list on error to prevent loading indefinitely
                    trySend(emptyList()) 
                    return@addSnapshotListener
                }

                val events = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(GameEvent::class.java)?.apply { id = doc.id }
                } ?: emptyList()

                // Sort in memory
                val sortedEvents = events.sortedByDescending { it.createdAt?.time ?: 0L }

                trySend(sortedEvents)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Observa estatísticas dos jogadores em tempo real
     */
    fun observeLivePlayerStats(gameId: String): Flow<List<LivePlayerStats>> = callbackFlow {
        val listener = liveStatsCollection
            .whereEqualTo("game_id", gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro ao observar estatisticas", error)
                    return@addSnapshotListener
                }

                val stats = snapshot?.documents?.mapNotNull {
                    it.toObject(LivePlayerStats::class.java)
                } ?: emptyList()

                trySend(stats)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Finaliza o jogo
     */
    suspend fun finishGame(gameId: String): Result<Unit> {
        return try {
            val scoreDoc = scoresCollection.document(gameId)
            scoreDoc.update("finished_at", com.google.firebase.firestore.FieldValue.serverTimestamp()).await()

            AppLogger.d(TAG) { "Jogo finalizado: $gameId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao finalizar jogo", e)
            Result.failure(e)
        }
    }

    /**
     * Busca estatísticas finais do jogo
     */
    suspend fun getFinalStats(gameId: String): Result<List<LivePlayerStats>> {
        return try {
            val snapshot = liveStatsCollection
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            val stats = snapshot.documents.mapNotNull { it.toObject(LivePlayerStats::class.java) }
            Result.success(stats)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar estatisticas finais", e)
            Result.failure(e)
        }
    }

    suspend fun clearAll(): Result<Unit> {
        return try {
            val scoresSnapshot = scoresCollection.limit(500).get().await()
            val eventsSnapshot = eventsCollection.limit(500).get().await()
            val liveStatsSnapshot = liveStatsCollection.limit(500).get().await()

            firestore.runBatch {
                scoresSnapshot.documents.forEach { doc -> it.delete(doc.reference) }
                eventsSnapshot.documents.forEach { doc -> it.delete(doc.reference) }
                liveStatsSnapshot.documents.forEach { doc -> it.delete(doc.reference) }
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Deleta um evento do jogo e reverte as estatísticas correspondentes.
     * Para GOAL: decrementa placar do time e gols do jogador
     * Para ASSIST: decrementa assistências do assistente
     * Para YELLOW_CARD/RED_CARD: decrementa cartões do jogador
     * Para SAVE: decrementa defesas do jogador
     * Apenas owner ou jogadores confirmados podem deletar eventos.
     */
    suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> {
        return try {
            // Validar permissão
            if (!canManageGameEvents(gameId)) {
                return Result.failure(Exception("Você não tem permissão para deletar eventos neste jogo"))
            }

            // 1. Buscar o evento antes de deletar para saber o que reverter
            val eventDoc = eventsCollection.document(eventId).get().await()
            val event = eventDoc.toObject(GameEvent::class.java)
                ?: return Result.failure(Exception("Evento não encontrado"))

            val eventType = event.getEventTypeEnum()

            // 2. Reverter estatísticas em transação
            firestore.runTransaction { transaction ->
                // Reverter placar se for gol
                if (eventType == GameEventType.GOAL) {
                    val scoreDoc = scoresCollection.document(gameId)
                    val gameDoc = firestore.collection("games").document(gameId)

                    val scoreSnapshot = transaction.get(scoreDoc)
                    val score = scoreSnapshot.toObject(LiveGameScore::class.java)

                    if (score != null) {
                        if (score.team1Id == event.teamId) {
                            val newScore = maxOf(0, score.team1Score - 1)
                            transaction.update(scoreDoc, "team1_score", newScore)
                            transaction.update(gameDoc, "team1_score", newScore)
                        } else if (score.team2Id == event.teamId) {
                            val newScore = maxOf(0, score.team2Score - 1)
                            transaction.update(scoreDoc, "team2_score", newScore)
                            transaction.update(gameDoc, "team2_score", newScore)
                        }
                    }
                }

                // Reverter estatísticas do jogador principal
                if (event.playerId.isNotEmpty()) {
                    val statsId = "${gameId}_${event.playerId}"
                    val statsDoc = liveStatsCollection.document(statsId)
                    val confirmationId = "${gameId}_${event.playerId}"
                    val confDoc = confirmationsCollection.document(confirmationId)

                    val statsSnapshot = transaction.get(statsDoc)
                    val stats = statsSnapshot.toObject(LivePlayerStats::class.java)

                    if (stats != null) {
                        when (eventType) {
                            GameEventType.GOAL -> {
                                transaction.update(statsDoc, "goals", maxOf(0, stats.goals - 1))
                            }
                            GameEventType.SAVE -> {
                                transaction.update(statsDoc, "saves", maxOf(0, stats.saves - 1))
                            }
                            GameEventType.YELLOW_CARD -> {
                                transaction.update(statsDoc, "yellow_cards", maxOf(0, stats.yellowCards - 1))
                            }
                            GameEventType.RED_CARD -> {
                                transaction.update(statsDoc, "red_cards", maxOf(0, stats.redCards - 1))
                            }
                            else -> {}
                        }
                    }

                    // Reverter em confirmations também
                    val confSnapshot = transaction.get(confDoc)
                    if (confSnapshot.exists()) {
                        when (eventType) {
                            GameEventType.GOAL -> {
                                val currentGoals = confSnapshot.getLong("goals") ?: 0
                                transaction.update(confDoc, "goals", maxOf(0, currentGoals - 1))
                            }
                            GameEventType.YELLOW_CARD -> {
                                val currentYellow = confSnapshot.getLong("yellow_cards") ?: 0
                                transaction.update(confDoc, "yellow_cards", maxOf(0, currentYellow - 1))
                            }
                            GameEventType.RED_CARD -> {
                                val currentRed = confSnapshot.getLong("red_cards") ?: 0
                                transaction.update(confDoc, "red_cards", maxOf(0, currentRed - 1))
                            }
                            GameEventType.SAVE -> {
                                val currentSaves = confSnapshot.getLong("saves") ?: 0
                                transaction.update(confDoc, "saves", maxOf(0, currentSaves - 1))
                            }
                            else -> {}
                        }
                    }
                }

                // Reverter assistência se o evento era um gol com assistência
                if (eventType == GameEventType.GOAL && !event.assistedById.isNullOrEmpty()) {
                    val assistStatsId = "${gameId}_${event.assistedById}"
                    val assistStatsDoc = liveStatsCollection.document(assistStatsId)
                    val assistConfDoc = confirmationsCollection.document(assistStatsId)

                    val assistSnapshot = transaction.get(assistStatsDoc)
                    val assistStats = assistSnapshot.toObject(LivePlayerStats::class.java)
                    if (assistStats != null) {
                        transaction.update(assistStatsDoc, "assists", maxOf(0, assistStats.assists - 1))
                    }

                    val assistConfSnapshot = transaction.get(assistConfDoc)
                    if (assistConfSnapshot.exists()) {
                        val currentAssists = assistConfSnapshot.getLong("assists") ?: 0
                        transaction.update(assistConfDoc, "assists", maxOf(0, currentAssists - 1))
                    }
                }

                // Deletar o evento
                transaction.delete(eventsCollection.document(eventId))
            }.await()

            AppLogger.d(TAG) { "Evento $eventId deletado e estatísticas revertidas" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao deletar evento", e)
            Result.failure(e)
        }
    }
}
