package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.datasource.MatchManagementDataSource
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.model.Team
import com.futebadosparcas.ui.games.GameWithConfirmations
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.local.model.toDomain
import com.futebadosparcas.data.local.model.toEntity
import com.google.firebase.firestore.FieldPath
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.callbackFlow
import javax.inject.Inject

import javax.inject.Singleton

@Singleton
class GameRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val gameDao: GameDao,
    // private val badgeAwarder: com.futebadosparcas.domain.gamification.BadgeAwarder, // MIGRATED TO CLOUD
    private val liveGameRepository: com.futebadosparcas.data.repository.LiveGameRepository,
    private val matchFinalizationService: com.futebadosparcas.domain.ranking.MatchFinalizationService,
    private val postGameEventEmitter: com.futebadosparcas.domain.ranking.PostGameEventEmitter,
    private val matchManagementDataSource: MatchManagementDataSource,
    private val teamBalancer: com.futebadosparcas.domain.ai.TeamBalancer,
    private val groupRepository: com.futebadosparcas.data.repository.GroupRepository
) : GameRepository {
    private val gamesCollection = firestore.collection("games")
    private val confirmationsCollection = firestore.collection("confirmations")
    private val teamsCollection = firestore.collection("teams")

    companion object {
        private const val TAG = "GameRepository"
    }

    override suspend fun getUpcomingGames(): Result<List<Game>> {
        return try {
            val uid = auth.currentUser?.uid
            val userGroupIds = if (uid != null) {
                groupRepository.getMyGroups()
                    .getOrElse { emptyList() }
                    .map { it.id.ifEmpty { it.groupId } }
                    .filter { it.isNotEmpty() }
                    .take(10)
            } else {
                emptyList()
            }

            // Public Queries
            val scheduledTask = gamesCollection
                .whereEqualTo("status", GameStatus.SCHEDULED.name)
                .whereIn("visibility", listOf("PUBLIC_OPEN", "PUBLIC_CLOSED"))
                .orderBy("dateTime", Query.Direction.ASCENDING)
                .limit(20)
                .get()

            val confirmedTask = gamesCollection
                .whereEqualTo("status", GameStatus.CONFIRMED.name)
                .whereIn("visibility", listOf("PUBLIC_OPEN", "PUBLIC_CLOSED"))
                .orderBy("dateTime", Query.Direction.ASCENDING)
                .limit(20)
                .get()

            // Private Queries
            val privateScheduledTask = if (userGroupIds.isNotEmpty()) {
                gamesCollection
                    .whereEqualTo("status", GameStatus.SCHEDULED.name)
                    .whereEqualTo("visibility", com.futebadosparcas.data.model.GameVisibility.GROUP_ONLY.name)
                    .whereIn("group_id", userGroupIds)
                    .orderBy("dateTime", Query.Direction.ASCENDING)
                    .limit(20)
                    .get()
            } else null

            val privateConfirmedTask = if (userGroupIds.isNotEmpty()) {
                gamesCollection
                    .whereEqualTo("status", GameStatus.CONFIRMED.name)
                    .whereEqualTo("visibility", com.futebadosparcas.data.model.GameVisibility.GROUP_ONLY.name)
                    .whereIn("group_id", userGroupIds)
                    .orderBy("dateTime", Query.Direction.ASCENDING)
                    .limit(20)
                    .get()
            } else null

            // Executar queries em paralelo
            val allSnapshots = coroutineScope {
                val tasks = listOfNotNull(
                    async { scheduledTask.await() },
                    async { confirmedTask.await() },
                    if (privateScheduledTask != null) async { privateScheduledTask.await() } else null,
                    if (privateConfirmedTask != null) async { privateConfirmedTask.await() } else null
                )
                tasks.awaitAll()
            }

            val allGames = allSnapshots.flatMap { it.documents }
                .mapNotNull { doc -> doc.toObject(Game::class.java)?.apply { id = doc.id } }
                .sortedBy { it.dateTime }
                .distinctBy { it.id }
                .take(20)
                
            val games = allGames
            // Sync to local
            val entities = games.map { it.toEntity() }
            gameDao.insertGames(entities)

            Result.success(games)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos remotos, tentando local", e)
            val localGames = gameDao.getUpcomingGamesSnapshot().map { it.toDomain() }
            Result.success(localGames)
        }
    }

    override suspend fun getAllGames(): Result<List<Game>> {
        return try {
            val snapshot = gamesCollection
                .whereIn("visibility", listOf("PUBLIC_OPEN", "PUBLIC_CLOSED"))
                .orderBy("dateTime", Query.Direction.ASCENDING)
                .limit(50)
                .get()
                .await()

            val games = snapshot.documents.mapNotNull { doc ->
                doc.toObject(Game::class.java)?.apply { id = doc.id }
            }

            // Sync to Local DB
            val entities = games.map { it.toEntity() }
            gameDao.insertGames(entities)

            Result.success(games)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos remotos, tentando local", e)
            try {
                val localGames = gameDao.getAllGamesSnapshot().map { it.toDomain() }
                if (localGames.isNotEmpty()) {
                    Result.success(localGames)
                } else {
                    Result.success(emptyList())
                }
            } catch (localE: Exception) {
                Result.failure(e)
            }
        }
    }

    override suspend fun getAllGamesWithConfirmationCount(): Result<List<GameWithConfirmations>> {
        return try {
            val uid = auth.currentUser?.uid ?: ""
            
            val gamesSnapshot = gamesCollection
                .whereIn("visibility", listOf("PUBLIC_OPEN", "PUBLIC_CLOSED"))
                .orderBy("dateTime", Query.Direction.DESCENDING)
                .limit(50)
                .get()
                .await()

            // Fetch user confirmations
            val userConfirmations = if (uid.isNotEmpty()) {
                confirmationsCollection
                    .whereEqualTo("user_id", uid)
                    .whereEqualTo("status", "CONFIRMED")
                    .get()
                    .await()
                    .documents
                    .mapNotNull { it.getString("game_id") }
                    .toSet()
            } else {
                emptySet()
            }

            val result = gamesSnapshot.documents.mapNotNull { doc ->
                val game = doc.toObject(Game::class.java)?.apply { id = doc.id } ?: return@mapNotNull null
                
                GameWithConfirmations(
                    game = game,
                    confirmedCount = game.playersCount,
                    isUserConfirmed = game.id in userConfirmations
                )
            }

            Result.success(result)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos com contagem", e)
            Result.failure(e)
        }
    }

    override fun getAllGamesWithConfirmationCountFlow(): kotlinx.coroutines.flow.Flow<Result<List<GameWithConfirmations>>> {
        val uid = auth.currentUser?.uid ?: ""
        
        val gamesFlow = callbackFlow {
             val subscription = gamesCollection
                .whereIn("visibility", listOf("PUBLIC_OPEN", "PUBLIC_CLOSED"))
                .orderBy("dateTime", Query.Direction.DESCENDING)
                .limit(50)
                .addSnapshotListener { snapshot, e ->
                    if (e != null) { 
                        trySend(Result.failure<List<Game>>(e))
                        return@addSnapshotListener
                    }
                    if (snapshot != null) {
                        val games = snapshot.documents.mapNotNull { doc ->
                             doc.toObject(Game::class.java)?.apply { id = doc.id }
                        }
                        trySend(Result.success(games))
                    }
                }
             awaitClose { subscription.remove() }
        }

        val userConfFlow = if (uid.isNotEmpty()) {
             callbackFlow {
                val subscription = confirmationsCollection
                    .whereEqualTo("user_id", uid)
                    .whereEqualTo("status", "CONFIRMED")
                    .addSnapshotListener { snapshot, _ ->
                        val ids = snapshot?.documents?.mapNotNull { it.getString("game_id") }?.toSet() ?: emptySet()
                        trySend(ids)
                    }
                awaitClose { subscription.remove() }
             }
        } else {
             kotlinx.coroutines.flow.flowOf(emptySet())
        }
        
        return kotlinx.coroutines.flow.combine(gamesFlow, userConfFlow) { gamesResult, userConfs ->
             if (gamesResult.isSuccess) {
                 val games = gamesResult.getOrNull() ?: emptyList()
                 val result = games.map { game ->
                     GameWithConfirmations(
                         game = game,
                         confirmedCount = game.playersCount,
                         isUserConfirmed = game.id in userConfs
                     )
                 }
                 Result.success(result)
             } else {
                 Result.failure(gamesResult.exceptionOrNull() ?: Exception("Unknown error"))
             }
        }
    }

    override suspend fun getConfirmedUpcomingGamesForUser(): Result<List<Game>> {
        return try {
            val uid = auth.currentUser?.uid ?: return Result.success(emptyList())

            val games = withTimeout(15000L) {
                val confirmationsSnapshot = confirmationsCollection
                    .whereEqualTo("user_id", uid)
                    .whereIn("status", listOf("CONFIRMED", "PENDING"))
                    .get()
                    .await()

                val gameIds = confirmationsSnapshot.documents
                    .mapNotNull { it.getString("game_id") }
                    .distinct()

                val gamesList = if (gameIds.isEmpty()) {
                    emptyList<Game>()
                } else {
                    // Paraleliza os chunks para reduzir latência
                    coroutineScope {
                        val deferreds = gameIds.chunked(10).map { chunk ->
                            async {
                                val snapshot = gamesCollection
                                    .whereIn(com.google.firebase.firestore.FieldPath.documentId(), chunk)
                                    .get()
                                    .await()
                                
                                snapshot.documents.mapNotNull { doc ->
                                    doc.toObject(Game::class.java)?.apply { id = doc.id }
                                }
                            }
                        }
                        deferreds.awaitAll().flatten()
                    }
                }

                // Filtra apenas jogos futuros e ordena por data
                val now = java.util.Date()
                gamesList
                    .filter { it.dateTime != null && it.dateTime!! > now }
                    .sortedBy { it.dateTime }
            }

            Result.success(games)

        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos confirmados do usuario", e)
            Result.success(emptyList())
        }
    }

    override suspend fun getGameDetails(gameId: String): Result<Game> {
        return try {
            val doc = gamesCollection.document(gameId).get().await()
            val game = doc.toObject(Game::class.java)
                ?: return Result.failure(Exception("Erro ao converter jogo"))
            
            // Cache Update
            try {
                gameDao.insertGame(game.toEntity())
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao salvar cache local do jogo", e)
            }

            // Crashlytics Context
            com.google.firebase.crashlytics.FirebaseCrashlytics.getInstance().setCustomKey("active_game_id", gameId)

            Result.success(game)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar detalhes do jogo remoto, tentando local", e)
            try {
                val localGame = gameDao.getGameById(gameId)?.toDomain()
                if (localGame != null) {
                    Result.success(localGame)
                } else {
                    Result.failure(e)
                }
            } catch (localE: Exception) {
                Result.failure(e)
            }
        }
    }

    override fun getGameDetailsFlow(gameId: String): kotlinx.coroutines.flow.Flow<Result<Game>> = kotlinx.coroutines.flow.callbackFlow {
        val subscription = gamesCollection.document(gameId).addSnapshotListener { snapshot, e ->
            if (e != null) {
                trySend(Result.failure(e))
                return@addSnapshotListener
            }

            if (snapshot != null && snapshot.exists()) {
                val game = snapshot.toObject(Game::class.java)
                if (game != null) {
                    trySend(Result.success(game))
                } else {
                    trySend(Result.failure(Exception("Erro de conversão")))
                }
            } else {
                trySend(Result.failure(Exception("Jogo não encontrado")))
            }
        }
        awaitClose { subscription.remove() }
    }

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
                val sdf = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", java.util.Locale.getDefault())
                finalGame = finalGame.copy(dateTime = sdf.parse(dateTimeStr))
            } catch (e: Exception) {
                AppLogger.e(TAG, "createGame: Error parsing dateTime from date/time strings", e)
            }
        }

        docRef.set(finalGame).await()
        Result.success(finalGame)
        } catch (e: Exception) {
            Result.failure(e)
        }
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

    override fun getGameConfirmationsFlow(gameId: String): kotlinx.coroutines.flow.Flow<Result<List<GameConfirmation>>> = kotlinx.coroutines.flow.callbackFlow {
        val subscription = confirmationsCollection
            .whereEqualTo("game_id", gameId)
            // .whereEqualTo("status", "CONFIRMED") // Removido para ouvir tudo (waitlist, pending) e filtrar na UI se precisar
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

    override suspend fun generateTeams(
        gameId: String,
        numberOfTeams: Int,
        balanceTeams: Boolean
    ): Result<List<Team>> {
        return try {
            // Fetch existing teams to delete in the same batch
            val existingTeamsSnapshot = teamsCollection
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            val confirmationsResult = getGameConfirmations(gameId)
            if (confirmationsResult.isFailure) return Result.failure(confirmationsResult.exceptionOrNull()!!)

            val allPlayers = confirmationsResult.getOrNull()!!
            
            // Logic to generate teams (keep existing)
            val goalkeepers = allPlayers.filter { it.position == "GOALKEEPER" }.toMutableList()
            val fieldPlayers = allPlayers.filter { it.position == "FIELD" }.toMutableList()

            goalkeepers.shuffle()
            
            // Prepare Teams containers
            val teamPlayerLists = List(numberOfTeams) { mutableListOf<String>() }
            
            // Distribute Goalkeepers first
            goalkeepers.forEachIndexed { index, goalkeeper ->
                val teamIndex = index % numberOfTeams
                teamPlayerLists[teamIndex].add(goalkeeper.userId)
            }

            if (balanceTeams) {
                // Use AI/Smart Balancer
                val balancedTeamsResult = teamBalancer.balanceTeams(gameId, allPlayers, numberOfTeams)
                
                if (balancedTeamsResult.isSuccess) {
                   val balancedTeams = balancedTeamsResult.getOrNull()!!
                   // Map playerIds from balancedTeams to teamPlayerLists for persistence
                   // Or simply use the balanced Teams directly, but we need to respect the colors and naming logic below if not provided
                   
                   // Just override the lists if the balancer returns ordered teams
                   balancedTeams.forEachIndexed { index, team ->
                       if (index < numberOfTeams) {
                           teamPlayerLists[index].clear()
                           teamPlayerLists[index].addAll(team.playerIds)
                       }
                   }
                } else {
                   // Fallback if balancer fails
                    AppLogger.w(TAG) { "Falha no balanceamento: ${balancedTeamsResult.exceptionOrNull()?.message}. Usando aleatório." }
                    val fieldPlayers = allPlayers.filter { it.position == "FIELD" }.toMutableList()
                    fieldPlayers.shuffle()
                    fieldPlayers.forEachIndexed { index, player ->
                        val teamIndex = index % numberOfTeams
                        teamPlayerLists[teamIndex].add(player.userId)
                    }
                }
            } else {
                fieldPlayers.shuffle()
                
                // Simple distribution
                fieldPlayers.forEachIndexed { index, player ->
                    val teamIndex = index % numberOfTeams
                    teamPlayerLists[teamIndex].add(player.userId)
                }
            }

            val teams = mutableListOf<Team>()
            val teamColors = listOf("#58CC02", "#FF9600", "#1CB0F6", "#FF4B4B", "#FFD600", "#CE82FF")

            val batch = firestore.batch()

            // 1. Queue Deletes
            existingTeamsSnapshot.documents.forEach { doc ->
                batch.delete(doc.reference)
            }

            // 2. Queue Creates
            teamPlayerLists.forEachIndexed { index, playerIds ->
                val teamRef = teamsCollection.document()
                val teamName = "Time ${index + 1}"
                val color = teamColors.getOrElse(index) { "#${String.format("%06X", (0..0xFFFFFF).random())}" }

                val newTeam = Team(
                    id = teamRef.id,
                    gameId = gameId,
                    name = teamName,
                    playerIds = playerIds,
                    color = color
                )

                batch.set(teamRef, newTeam)
                teams.add(newTeam)
            }

            batch.commit().await()

            // Sync denormalized team names to Game
            if (teams.size >= 2) {
                // Ensure sorting matches typical Team 1, Team 2 order (by name usually)
                val sortedTeams = teams.sortedBy { it.name }
                val updates = mapOf(
                    "team1_name" to sortedTeams[0].name,
                    "team2_name" to sortedTeams[1].name
                )
                gamesCollection.document(gameId).update(updates).await()
            }

            Result.success(teams)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getGameTeams(gameId: String): Result<List<Team>> {
        return try {
            val snapshot = teamsCollection
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            val teams = snapshot.documents.mapNotNull { doc ->
                doc.toObject(Team::class.java)?.apply { id = doc.id }
            }
            Result.success(teams)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getGameTeamsFlow(gameId: String): kotlinx.coroutines.flow.Flow<Result<List<Team>>> = kotlinx.coroutines.flow.callbackFlow {
        val subscription = teamsCollection
            .whereEqualTo("game_id", gameId)
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    trySend(Result.failure(e))
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val teams = snapshot.documents.mapNotNull { doc ->
                        doc.toObject(Team::class.java)?.apply { id = doc.id }
                    }
                    trySend(Result.success(teams))
                } else {
                    trySend(Result.success(emptyList()))
                }
            }
        awaitClose { subscription.remove() }
    }

    override suspend fun clearGameTeams(gameId: String): Result<Unit> {
        return try {
            val snapshot = teamsCollection
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.delete(doc.reference)
            }
            batch.commit().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateTeams(teams: List<Team>): Result<Unit> {
        return try {
            val batch = firestore.batch()
            teams.forEach { team ->
                val teamRef = teamsCollection.document(team.id)
                batch.set(teamRef, team)
            }
            batch.commit().await()

            // Sync denormalized team names to Game if applicable
            val gameIds = teams.map { it.gameId }.distinct()
            if (gameIds.size == 1) {
                val gameId = gameIds.first()
                if (teams.size >= 2) {
                    val sortedTeams = teams.sortedBy { it.name }
                    val updates = mapOf(
                        "team1_name" to sortedTeams[0].name,
                        "team2_name" to sortedTeams[1].name
                    )
                    gamesCollection.document(gameId).update(updates)
                }
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateGame(game: Game): Result<Unit> {
        return try {
            gamesCollection.document(game.id).set(game).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun deleteGame(gameId: String): Result<Unit> {
        return try {
            gamesCollection.document(gameId).delete().await()
            // Sync with local DB
            gameDao.deleteGame(gameId)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun clearAll(): Result<Unit> {
        return try {
            // Limpa o banco de dados local
            gameDao.clearAll()

            // Limpa as coleções do Firestore
            val gamesSnapshot = gamesCollection.limit(500).get().await()
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

    /**
     * Verifica se há conflito de horário para uma quadra específica.
     * Dois jogos conflitam se seus intervalos de tempo se sobrepõem.
     */
    override suspend fun checkTimeConflict(
        fieldId: String,
        date: String,
        startTime: String,
        endTime: String,
        excludeGameId: String?
    ): Result<List<TimeConflict>> {
        return try {
            if (fieldId.isEmpty()) {
                return Result.success(emptyList())
            }

            val gamesResult = getGamesByFieldAndDate(fieldId, date)
            if (gamesResult.isFailure) {
                return Result.failure(gamesResult.exceptionOrNull()!!)
            }

            val existingGames = gamesResult.getOrNull()!!
                .filter { it.id != excludeGameId }
                .filter { it.status != GameStatus.CANCELLED.name }

            val conflicts = mutableListOf<TimeConflict>()

            // Converte horarios para minutos desde meia-noite para facilitar comparação
            val newStart = timeToMinutes(startTime)
            var newEnd = timeToMinutes(endTime)
            
            // Tratar virada de meia-noite (ex: 23:00 - 01:00)
            if (newEnd <= newStart && endTime.isNotEmpty()) {
                newEnd += 1440 // Adiciona 24 horas em minutos
            }

            for (game in existingGames) {
                val existingStart = timeToMinutes(game.time)
                var existingEnd = timeToMinutes(game.endTime)
                
                if (existingEnd <= existingStart && game.endTime.isNotEmpty()) {
                    existingEnd += 1440
                }

                // Verifica sobreposição: dois intervalos [A,B] e [C,D] se sobrepõem se A < D e C < B
                if (newStart < existingEnd && existingStart < newEnd) {
                    // Calcula minutos de sobreposição
                    val overlapStart = maxOf(newStart, existingStart)
                    val overlapEnd = minOf(newEnd, existingEnd)
                    val overlapMinutes = overlapEnd - overlapStart

                    conflicts.add(TimeConflict(game, overlapMinutes))
                }
            }

            Result.success(conflicts)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao verificar conflito de horario", e)
            Result.failure(e)
        }
    }

    /**
     * Busca todos os jogos agendados para uma quadra em uma data específica.
     */
    override suspend fun getGamesByFieldAndDate(fieldId: String, date: String): Result<List<Game>> {
        return try {
            val snapshot = gamesCollection
                .whereEqualTo("field_id", fieldId)
                .whereEqualTo("date", date)
                .get()
                .await()

            val games = snapshot.toObjects(Game::class.java)
            Result.success(games)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos por quadra e data", e)
            Result.failure(e)
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

    /**
     * Converte horário no formato HH:mm para minutos desde meia-noite.
     */
    override fun getGameEventsFlow(gameId: String): kotlinx.coroutines.flow.Flow<Result<List<com.futebadosparcas.data.model.GameEvent>>> = kotlinx.coroutines.flow.flow {
        liveGameRepository.observeGameEvents(gameId).collect { events ->
            emit(Result.success(events))
        }
    }

    override fun getLiveScoreFlow(gameId: String): kotlinx.coroutines.flow.Flow<com.futebadosparcas.data.model.LiveGameScore?> {
        return liveGameRepository.observeLiveScore(gameId)
    }

    override suspend fun sendGameEvent(gameId: String, event: com.futebadosparcas.data.model.GameEvent): Result<Unit> {
        // Delegate to LiveGameRepository to ensure consistency using Root Collection
        val result = liveGameRepository.addGameEvent(
            gameId = gameId,
            eventType = event.getEventTypeEnum(),
            playerId = event.playerId,
            playerName = event.playerName,
            teamId = event.teamId,
            assistedById = event.assistedById,
            assistedByName = event.assistedByName,
            minute = event.minute
        )
        return if (result.isSuccess) Result.success(Unit) else Result.failure(result.exceptionOrNull()!!)
    }

    override suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> {
        return liveGameRepository.deleteGameEvent(gameId, eventId)
    }

    override fun getLiveAndUpcomingGamesFlow(): kotlinx.coroutines.flow.Flow<Result<List<GameWithConfirmations>>> {
        val uid = auth.currentUser?.uid ?: ""

        // Flow principal combinando Publicos + Privados
        return kotlinx.coroutines.flow.channelFlow {
            // 1. Obter grupos do usuário (para filtro de GROUP_ONLY)
            // Monitora mudanças nos grupos para atualizar a lista de jogos se entrar/sair de grupos
            val userGroupsFlow = if (uid.isNotEmpty()) groupRepository.getMyGroupsFlow() else kotlinx.coroutines.flow.flowOf(emptyList())
            
            userGroupsFlow.collect { userGroups ->
                val userGroupIds = userGroups.map { it.id.ifEmpty { it.groupId } }
                    .filter { it.isNotEmpty() }
                    .take(10) 
                
                // 2. Definir Queries
                val now = java.util.Calendar.getInstance().apply {
                    add(java.util.Calendar.HOUR_OF_DAY, -4) // Include recent live games
                }.time

                // Query A: Jogos Públicos
                val publicQuery = gamesCollection
                    .whereIn("visibility", listOf(
                        com.futebadosparcas.data.model.GameVisibility.PUBLIC_OPEN.name,
                        com.futebadosparcas.data.model.GameVisibility.PUBLIC_CLOSED.name
                    ))
                    .whereGreaterThan("dateTime", now)
                    .orderBy("dateTime", Query.Direction.ASCENDING)
                    .limit(30)

                // Query B: Jogos do Grupo (se houver grupos)
                val groupQuery = if (userGroupIds.isNotEmpty()) {
                    gamesCollection
                        .whereEqualTo("visibility", com.futebadosparcas.data.model.GameVisibility.GROUP_ONLY.name)
                        .whereIn("group_id", userGroupIds)
                        .whereGreaterThan("dateTime", now)
                        .orderBy("dateTime", Query.Direction.ASCENDING)
                        .limit(30)
                } else null

                // 3. Listeners
                val publicFlow = callbackFlow {
                    val sub = publicQuery.addSnapshotListener { snap, e ->
                        if (e != null) {
                            AppLogger.e(TAG, "getLiveAndUpcomingGamesFlow: Erro na Query Publica", e)
                            trySend(emptyList())
                            return@addSnapshotListener
                        }

                        val games = snap?.toObjects(Game::class.java)?.onEach { it.id = snap.documents.find { d -> d.id == it.id }?.id ?: it.id } ?: emptyList()
                        trySend(games)
                    }
                    awaitClose { sub.remove() }
                }

                val groupGamesFlow = if (groupQuery != null) {
                    callbackFlow {
                        val sub = groupQuery.addSnapshotListener { snap, e ->
                            if (e != null) { 
                                AppLogger.e(TAG, "getLiveAndUpcomingGamesFlow: Erro na Query de Grupo", e)
                                trySend(emptyList())
                                return@addSnapshotListener 
                            }
                            val games = snap?.toObjects(Game::class.java)?.onEach { it.id = snap.documents.find { d -> d.id == it.id }?.id ?: it.id } ?: emptyList()
                            trySend(games)
                        }
                        awaitClose { sub.remove() }
                    }
                } else {
                    kotlinx.coroutines.flow.flowOf(emptyList())
                }

                // 4. User Confirmations (para UI state)
                val userConfFlow = getUserConfirmationsFlow(uid)

                // 5. Combine everything
                kotlinx.coroutines.flow.combine(publicFlow, groupGamesFlow, userConfFlow) { publicGames, groupGames, userConfs ->
                    val allGames = (publicGames + groupGames)
                        .filter { it.status == GameStatus.SCHEDULED.name || it.status == GameStatus.CONFIRMED.name || it.status == GameStatus.LIVE.name }
                        .distinctBy { it.id }
                        .sortedBy { it.dateTime }
                        .take(20)

                    val result = allGames.map { game ->
                        GameWithConfirmations(
                            game = game,
                            confirmedCount = game.playersCount,
                            isUserConfirmed = game.id in userConfs
                        )
                    }
                    Result.success(result)
                }.collect {
                    send(it)
                }
            }
        }
    }

    override fun getHistoryGamesFlow(limit: Int): kotlinx.coroutines.flow.Flow<Result<List<GameWithConfirmations>>> {
        val uid = auth.currentUser?.uid ?: ""

        return kotlinx.coroutines.flow.channelFlow {
            // 1. Obter grupos do usuário
            val userGroupsFlow = if (uid.isNotEmpty()) groupRepository.getMyGroupsFlow() else kotlinx.coroutines.flow.flowOf(emptyList())
            
            userGroupsFlow.collect { userGroups ->
                val userGroupIds = userGroups.map { it.id.ifEmpty { it.groupId } }
                    .filter { it.isNotEmpty() }
                    .take(10)
                
                // Query A: Public History
                val publicQuery = gamesCollection
                    .whereIn("visibility", listOf(
                        com.futebadosparcas.data.model.GameVisibility.PUBLIC_OPEN.name,
                        com.futebadosparcas.data.model.GameVisibility.PUBLIC_CLOSED.name
                    ))
                    //.whereLessThanWithType("dateTime", java.util.Date()) // Opcional, mas sort DESC já cuida
                    .orderBy("dateTime", Query.Direction.DESCENDING)
                    .limit(limit.toLong())

                // Query B: Group History
                val groupQuery = if (userGroupIds.isNotEmpty()) {
                    gamesCollection
                        .whereEqualTo("visibility", com.futebadosparcas.data.model.GameVisibility.GROUP_ONLY.name)
                        .whereIn("group_id", userGroupIds)
                        .orderBy("dateTime", Query.Direction.DESCENDING)
                        .limit(limit.toLong())
                } else null

                // Listeners
                val publicFlow = callbackFlow {
                    val sub = publicQuery.addSnapshotListener { snap, e ->
                        if (e != null) { trySend(emptyList()); return@addSnapshotListener }
                        val games = snap?.toObjects(Game::class.java)?.onEach { it.id = snap.documents.find { d -> d.id == it.id }?.id ?: it.id } ?: emptyList()
                        trySend(games)
                    }
                    awaitClose { sub.remove() }
                }

                val groupGamesFlow = if (groupQuery != null) {
                    callbackFlow {
                        val sub = groupQuery.addSnapshotListener { snap, e ->
                            if (e != null) { trySend(emptyList()); return@addSnapshotListener }
                            val games = snap?.toObjects(Game::class.java)?.onEach { it.id = snap.documents.find { d -> d.id == it.id }?.id ?: it.id } ?: emptyList()
                            trySend(games)
                        }
                        awaitClose { sub.remove() }
                    }
                } else {
                    kotlinx.coroutines.flow.flowOf(emptyList())
                }

                val userConfFlow = getUserConfirmationsFlow(uid)

                kotlinx.coroutines.flow.combine(publicFlow, groupGamesFlow, userConfFlow) { publicGames, groupGames, userConfs ->
                    val allGames = (publicGames + groupGames)
                        .filter { it.status == GameStatus.FINISHED.name || it.status == GameStatus.CANCELLED.name }
                        .distinctBy { it.id }
                        .sortedByDescending { it.dateTime }
                        .take(limit)

                    val result = allGames.map { game ->
                        GameWithConfirmations(
                            game = game,
                            confirmedCount = game.playersCount,
                            isUserConfirmed = game.id in userConfs
                        )
                    }
                    Result.success(result)
                }.collect {
                    send(it)
                }
            }
        }
    }

    override suspend fun getGamesByFilter(filterType: GameFilterType): Result<List<GameWithConfirmations>> {
        return try {
            val uid = auth.currentUser?.uid ?: ""
            if (uid.isEmpty()) return Result.success(emptyList())

            val games = when (filterType) {
                GameFilterType.MY_GAMES -> {
                    val confs = confirmationsCollection
                        .whereEqualTo("user_id", uid)
                        .whereEqualTo("status", "CONFIRMED")
                        // .orderBy("confirmed_at", Query.Direction.DESCENDING) // Removed to avoid missing index crash
                        .limit(20)
                        .get().await()

                    val gameIds = confs.documents.mapNotNull { it.getString("game_id") }.distinct()
                    if (gameIds.isEmpty()) emptyList()
                    else {
                        val chunks = gameIds.chunked(10)
                        val allGames = mutableListOf<Game>()
                        // CoroutineScope para paralelizar seria ideal, mas loops simples resolvem para <20 items
                        chunks.forEach { chunk ->
                            val g = gamesCollection.whereIn(FieldPath.documentId(), chunk).get().await()
                            allGames.addAll(g.toObjects(Game::class.java).mapNotNull { 
                                it.apply { id =  g.documents.find { d -> d.id == it.id }?.id ?: it.id } // Garantir ID se possivel, mas toObject ja pega se anotado
                            })
                        }
                        allGames.forEach { game -> 
                             // Garantir ID correto pos-serializacao
                             if (game.id.isEmpty()) {
                                 // Buscou por ID, entao ID existe no objeto se anotado corretamente @DocumentId
                             }
                        }
                        allGames.sortedByDescending { it.dateTime }
                    }
                }
                else -> emptyList()
            }

            val result = games.map { game ->
                GameWithConfirmations(
                    game = game,
                    confirmedCount = game.playersCount,
                    isUserConfirmed = true
                )
            }
            Result.success(result)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun getUserConfirmationsFlow(uid: String): kotlinx.coroutines.flow.Flow<Set<String>> {
        if (uid.isEmpty()) return kotlinx.coroutines.flow.flowOf(emptySet())

        return callbackFlow {
            val subscription = confirmationsCollection
                .whereEqualTo("user_id", uid)
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

    private fun timeToMinutes(time: String): Int {
        return try {
            val parts = time.split(":")
            val hours = parts[0].toInt()
            val minutes = if (parts.size > 1) parts[1].toInt() else 0
            hours * 60 + minutes
        } catch (e: Exception) {
            0
        }
    }

    // ========== FASE 1: Public Games Discovery ==========

    override suspend fun getPublicGames(limit: Int): Result<List<Game>> {
        return try {
            val snapshot = gamesCollection
                .whereIn("visibility", listOf(
                    com.futebadosparcas.data.model.GameVisibility.PUBLIC_CLOSED.name,
                    com.futebadosparcas.data.model.GameVisibility.PUBLIC_OPEN.name
                ))
                .whereIn("status", listOf(
                    GameStatus.SCHEDULED.name,
                    GameStatus.CONFIRMED.name
                ))
                .orderBy("dateTime", Query.Direction.ASCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val games = snapshot.documents.mapNotNull { doc ->
                doc.toObject(Game::class.java)?.apply { id = doc.id }
            }

            AppLogger.d(TAG) { "Encontrados ${games.size} jogos públicos" }
            Result.success(games)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos públicos", e)
            Result.failure(e)
        }
    }

    override fun getPublicGamesFlow(limit: Int): kotlinx.coroutines.flow.Flow<List<Game>> = callbackFlow {
        val listener = gamesCollection
            .whereIn("visibility", listOf(
                com.futebadosparcas.data.model.GameVisibility.PUBLIC_CLOSED.name,
                com.futebadosparcas.data.model.GameVisibility.PUBLIC_OPEN.name
            ))
            .whereIn("status", listOf(
                GameStatus.SCHEDULED.name,
                GameStatus.CONFIRMED.name
            ))
            .orderBy("dateTime", Query.Direction.ASCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro no listener de jogos públicos", error)
                    return@addSnapshotListener
                }

                val games = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Game::class.java)?.apply { id = doc.id }
                } ?: emptyList()

                trySend(games)
            }

        awaitClose { listener.remove() }
    }

    override suspend fun getNearbyPublicGames(
        userLat: Double,
        userLng: Double,
        radiusKm: Double,
        limit: Int
    ): Result<List<Game>> {
        return try {
            // Buscar todos os jogos públicos
            val publicGamesResult = getPublicGames(100) // Buscar mais jogos para filtrar por distância
            val allPublicGames = publicGamesResult.getOrElse { emptyList() }

            // Filtrar por distância usando fórmula de Haversine
            val nearbyGames = allPublicGames.filter { game ->
                if (game.locationLat == null || game.locationLng == null) return@filter false

                val distance = calculateDistance(
                    userLat, userLng,
                    game.locationLat!!, game.locationLng!!
                )
                distance <= radiusKm
            }.sortedBy { game ->
                // Ordenar por distância
                calculateDistance(
                    userLat, userLng,
                    game.locationLat ?: 0.0,
                    game.locationLng ?: 0.0
                )
            }.take(limit)

            AppLogger.d(TAG) { "Encontrados ${nearbyGames.size} jogos próximos em ${radiusKm}km" }
            Result.success(nearbyGames)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos próximos", e)
            Result.failure(e)
        }
    }

    override suspend fun getOpenPublicGames(limit: Int): Result<List<Game>> {
        return try {
            val snapshot = gamesCollection
                .whereEqualTo("visibility", com.futebadosparcas.data.model.GameVisibility.PUBLIC_OPEN.name)
                .whereIn("status", listOf(
                    GameStatus.SCHEDULED.name,
                    GameStatus.CONFIRMED.name
                ))
                .orderBy("dateTime", Query.Direction.ASCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val games = snapshot.documents.mapNotNull { doc ->
                doc.toObject(Game::class.java)?.apply { id = doc.id }
            }

            AppLogger.d(TAG) { "Encontrados ${games.size} jogos abertos para solicitações" }
            Result.success(games)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos abertos", e)
            Result.failure(e)
        }
    }

    /**
     * Calcula distância entre duas coordenadas usando fórmula de Haversine
     * @return Distância em quilômetros
     */
    private fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val R = 6371.0 // Raio da Terra em km
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2)
        val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c
    }
}
