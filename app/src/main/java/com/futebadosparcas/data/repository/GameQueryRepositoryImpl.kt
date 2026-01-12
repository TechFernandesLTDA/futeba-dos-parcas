package com.futebadosparcas.data.repository

import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.local.model.toDomain
import com.futebadosparcas.data.local.model.toEntity
import com.futebadosparcas.data.model.Game as AndroidGame
import com.futebadosparcas.data.model.GameConfirmation as AndroidGameConfirmation
import com.futebadosparcas.data.model.GameEvent as AndroidGameEvent
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.model.Team as AndroidTeam
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameDetailConsolidated
import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.GameFilterType
import com.futebadosparcas.domain.model.GameWithConfirmations
import com.futebadosparcas.domain.model.PaginatedGames
import com.futebadosparcas.domain.model.Team
import com.futebadosparcas.domain.model.TimeConflict
import com.futebadosparcas.domain.repository.GameQueryRepository as KmpGameQueryRepository
import com.futebadosparcas.domain.repository.GameConfirmationRepository
import com.futebadosparcas.domain.util.deduplicateSortAndLimit
import com.futebadosparcas.domain.util.mergeAndDeduplicate
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.toKmpGame
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implementacao Android do GameQueryRepository.
 *
 * Durante a migracao KMP, esta implementacao usa modelos Android internamente
 * e converte para modelos KMP nos retornos dos metodos.
 */
@Singleton
class GameQueryRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val gameDao: GameDao,
    private val groupRepository: GroupRepository,
    private val confirmationRepository: GameConfirmationRepository
) : KmpGameQueryRepository {

    private val gamesCollection = firestore.collection("games")

    companion object {
        private const val TAG = "GameQueryRepository"
    }

    // ========== Helper Methods para Conversao ==========

    private fun List<AndroidGame>.toKmpGames(): List<Game> = map { it.toKmpGame() }

    private fun List<AndroidGameConfirmation>.toKmpConfirmations(): List<GameConfirmation> = map { it.toKmpConfirmation() }

    private fun AndroidGameConfirmation.toKmpConfirmation(): GameConfirmation = GameConfirmation(
        id = id,
        gameId = gameId,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        position = position,
        teamId = null, // Android GameConfirmation nao tem teamId
        status = status,
        paymentStatus = paymentStatus,
        isCasualPlayer = isCasualPlayer,
        goals = goals,
        assists = assists,
        saves = saves,
        yellowCards = yellowCards,
        redCards = redCards,
        nickname = nickname,
        xpEarned = xpEarned,
        isMvp = isMvp,
        isBestGk = isBestGk,
        isWorstPlayer = isWorstPlayer,
        confirmedAt = confirmedAt?.time
    )

    private fun List<AndroidGameEvent>.toKmpEvents(): List<GameEvent> = map { it.toKmpEvent() }

    private fun AndroidGameEvent.toKmpEvent(): GameEvent = GameEvent(
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

    private fun List<AndroidTeam>.toKmpTeams(): List<Team> = map { it.toKmpTeam() }

    private fun AndroidTeam.toKmpTeam(): Team = Team(
        id = id,
        gameId = gameId,
        name = name,
        color = color,
        playerIds = playerIds,
        score = score
    )

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

            val allAndroidGames = allSnapshots.flatMap { it.documents }
                .mapNotNull { doc -> doc.toObject(AndroidGame::class.java)?.apply { id = doc.id } }
                .deduplicateSortAndLimit(
                    idSelector = { it.id },
                    sortSelector = { it.dateTime },
                    limit = 20
                )

            // Sync to local
            val entities = allAndroidGames.map { it.toEntity() }
            gameDao.insertGames(entities)

            // Converter para KMP
            val kmpGames = allAndroidGames.map { it.toKmpGame() }
            Result.success(kmpGames)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos remotos, tentando local", e)
            val localGames = gameDao.getUpcomingGamesSnapshot().map { it.toDomain().toKmpGame() }
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

            val androidGames = snapshot.documents.mapNotNull { doc ->
                doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
            }

            // Sync to Local DB
            val entities = androidGames.map { it.toEntity() }
            gameDao.insertGames(entities)

            Result.success((androidGames as List<AndroidGame>).toKmpGames())
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos remotos, tentando local", e)
            try {
                val localGames = gameDao.getAllGamesSnapshot().map { (it.toDomain() as AndroidGame).toKmpGame() }
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
            val userConfirmations = confirmationRepository.getUserConfirmationIds(uid)

            val result = gamesSnapshot.documents.mapNotNull { doc ->
                val androidGame = doc.toObject(AndroidGame::class.java)?.apply { id = doc.id } ?: return@mapNotNull null

                GameWithConfirmations(
                    game = androidGame.toKmpGame(),
                    confirmedCount = androidGame.playersCount,
                    isUserConfirmed = androidGame.id in userConfirmations
                )
            }

            Result.success(result)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos com contagem", e)
            Result.failure(e)
        }
    }

    override fun getAllGamesWithConfirmationCountFlow(): Flow<Result<List<GameWithConfirmations>>> {
        val uid = auth.currentUser?.uid ?: ""

        val gamesFlow = callbackFlow {
            val subscription = gamesCollection
                .whereIn("visibility", listOf("PUBLIC_OPEN", "PUBLIC_CLOSED"))
                .orderBy("dateTime", Query.Direction.DESCENDING)
                .limit(50)
                .addSnapshotListener { snapshot, e ->
                    if (e != null) {
                        trySend(Result.failure<List<AndroidGame>>(e))
                        return@addSnapshotListener
                    }
                    if (snapshot != null) {
                        val androidGames = snapshot.documents.mapNotNull { doc ->
                            doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                        }
                        trySend(Result.success(androidGames))
                    }
                }
            awaitClose { subscription.remove() }
        }

        val userConfFlow = confirmationRepository.getUserConfirmationsFlow(uid)

        return combine(gamesFlow, userConfFlow) { gamesResult, userConfs ->
            if (gamesResult.isSuccess) {
                val androidGames = gamesResult.getOrNull() ?: emptyList()
                val result = androidGames.map { androidGame ->
                    GameWithConfirmations(
                        game = androidGame.toKmpGame(),
                        confirmedCount = androidGame.playersCount,
                        isUserConfirmed = androidGame.id in userConfs
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

            val games = withTimeout(8000L) {
                val gameIds = confirmationRepository.getConfirmedGameIds(uid)

                val androidGamesList = if (gameIds.isEmpty()) {
                    emptyList<AndroidGame>()
                } else {
                    // Paraleliza os chunks para reduzir latência
                    coroutineScope {
                        val deferreds = gameIds.chunked(10).map { chunk ->
                            async {
                                val snapshot = gamesCollection
                                    .whereIn(FieldPath.documentId(), chunk)
                                    .get()
                                    .await()

                                snapshot.documents.mapNotNull { doc ->
                                    doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                                }
                            }
                        }
                        deferreds.awaitAll().flatten()
                    }
                }

                // Filtra apenas jogos futuros e ordena por data
                val now = java.util.Date()
                androidGamesList
                    .filter { it.dateTime != null && it.dateTime!! > now }
                    .sortedBy { it.dateTime }
            }

            Result.success((games as List<AndroidGame>).map { it.toKmpGame() })

        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos confirmados do usuario", e)
            Result.success(emptyList())
        }
    }

    override suspend fun getGameDetails(gameId: String): Result<Game> {
        return try {
            val doc = gamesCollection.document(gameId).get().await()
            val androidGame = doc.toObject(AndroidGame::class.java)
                ?: return Result.failure(Exception("Erro ao converter jogo"))

            // Cache Update
            try {
                gameDao.insertGame(androidGame.toEntity())
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao salvar cache local do jogo", e)
            }

            // Crashlytics Context
            com.google.firebase.crashlytics.FirebaseCrashlytics.getInstance().setCustomKey("active_game_id", gameId)

            Result.success(androidGame.toKmpGame())
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar detalhes do jogo remoto, tentando local", e)
            try {
                val localGame = gameDao.getGameById(gameId)?.toDomain()?.toKmpGame()
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

    /**
     * ✅ OTIMIZAÇÃO #2: Consolidação de Queries Paralelas
     *
     * ANTES: 3 queries sequenciais
     * - getGameDetails() ~100-150ms
     * - getGameConfirmations() ~100-150ms
     * - getGameEvents() ~100-150ms
     * Total: 300-400ms
     *
     * DEPOIS: 3 queries paralelas usando async/awaitAll
     * Total: 150-200ms (50% de melhoria!)
     */
    override suspend fun getGameDetailConsolidated(gameId: String): Result<GameDetailConsolidated> {
        return try {
            coroutineScope {
                // ✅ Executar as 3 queries em paralelo
                val gameTask = async {
                    try {
                        gamesCollection.document(gameId).get().await()
                    } catch (e: Exception) {
                        AppLogger.e(TAG, "Erro ao buscar game consolidado", e)
                        null
                    }
                }

                val confirmationsTask = async {
                    try {
                        confirmationRepository.getGameConfirmations(gameId).getOrNull() ?: emptyList()
                    } catch (e: Exception) {
                        AppLogger.e(TAG, "Erro ao buscar confirmações consolidadas", e)
                        emptyList()
                    }
                }

                val eventsTask = async {
                    try {
                        firestore.collection("games").document(gameId)
                            .collection("events")
                            .orderBy("createdAt", Query.Direction.DESCENDING)
                            .limit(100)
                            .get()
                            .await()
                            .toObjects(AndroidGameEvent::class.java)
                    } catch (e: Exception) {
                        AppLogger.e(TAG, "Erro ao buscar eventos consolidados", e)
                        emptyList()
                    }
                }

                val teamsTask = async {
                    try {
                        firestore.collection("games").document(gameId)
                            .collection("teams")
                            .get()
                            .await()
                            .toObjects(AndroidTeam::class.java)
                    } catch (e: Exception) {
                        AppLogger.e(TAG, "Erro ao buscar times consolidados", e)
                        emptyList()
                    }
                }

                // ✅ Aguardar todas as queries em paralelo
                val gameSnapshot = gameTask.await()
                val confirmations = confirmationsTask.await()
                val androidEvents = eventsTask.await()
                val androidTeams = teamsTask.await()

                if (gameSnapshot == null || !gameSnapshot.exists()) {
                    return@coroutineScope Result.failure(Exception("Jogo não encontrado"))
                }

                val androidGame = gameSnapshot.toObject(AndroidGame::class.java)
                    ?: return@coroutineScope Result.failure(Exception("Erro ao converter jogo consolidado"))

                // Cache do jogo
                try {
                    gameDao.insertGame(androidGame.toEntity())
                } catch (e: Exception) {
                    AppLogger.e(TAG, "Erro ao salvar game cache consolidado", e)
                }

                // Log de performance
                AppLogger.d(TAG) { "✅ getGameDetailConsolidated: 3 queries em paralelo para gameId=$gameId" }

                Result.success(GameDetailConsolidated(
                    game = androidGame.toKmpGame(),
                    confirmations = confirmations,
                    events = androidEvents.toKmpEvents(),
                    teams = androidTeams.toKmpTeams()
                ))
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar detalhes consolidados do jogo", e)
            Result.failure(e)
        }
    }

    override fun getGameDetailsFlow(gameId: String): Flow<Result<Game>> = callbackFlow {
        val subscription = gamesCollection.document(gameId).addSnapshotListener { snapshot, e ->
            if (e != null) {
                trySend(Result.failure(e))
                return@addSnapshotListener
            }

            if (snapshot != null && snapshot.exists()) {
                val androidGame = snapshot.toObject(AndroidGame::class.java)
                if (androidGame != null) {
                    trySend(Result.success(androidGame.toKmpGame()))
                } else {
                    trySend(Result.failure(Exception("Erro de conversão")))
                }
            } else {
                trySend(Result.failure(Exception("Jogo não encontrado")))
            }
        }
        awaitClose { subscription.remove() }
    }

    override fun getLiveAndUpcomingGamesFlow(): Flow<Result<List<GameWithConfirmations>>> {
        val uid = auth.currentUser?.uid ?: ""

        // Flow principal combinando Publicos + Privados
        return channelFlow {
            // 1. Obter grupos do usuário (para filtro de GROUP_ONLY)
            // Monitora mudanças nos grupos para atualizar a lista de jogos se entrar/sair de grupos
            val userGroupsFlow = if (uid.isNotEmpty()) groupRepository.getMyGroupsFlow() else flowOf(emptyList())

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

                        val androidGames = snap?.toObjects(AndroidGame::class.java)?.onEach { it.id = snap.documents.find { d -> d.id == it.id }?.id ?: it.id } ?: emptyList()
                        trySend(androidGames)
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
                            val androidGames = snap?.toObjects(AndroidGame::class.java)?.onEach { it.id = snap.documents.find { d -> d.id == it.id }?.id ?: it.id } ?: emptyList()
                            trySend(androidGames)
                        }
                        awaitClose { sub.remove() }
                    }
                } else {
                    flowOf(emptyList())
                }

                // 4. User Confirmations (para UI state)
                val userConfFlow = confirmationRepository.getUserConfirmationsFlow(uid)

                // 5. Combine everything
                combine(publicFlow, groupGamesFlow, userConfFlow) { publicGames, groupGames, userConfs ->
                    val allAndroidGames = publicGames.mergeAndDeduplicate(groupGames) { it.id }
                        .filter { it.status == GameStatus.SCHEDULED.name || it.status == GameStatus.CONFIRMED.name || it.status == GameStatus.LIVE.name }
                        .sortedBy { it.dateTime }
                        .take(20)

                    val result = allAndroidGames.map { androidGame ->
                        GameWithConfirmations(
                            game = androidGame.toKmpGame(),
                            confirmedCount = androidGame.playersCount,
                            isUserConfirmed = androidGame.id in userConfs
                        )
                    }
                    Result.success(result)
                }.collect {
                    send(it)
                }
            }
        }
    }

    override fun getHistoryGamesFlow(limit: Int): Flow<Result<List<GameWithConfirmations>>> {
        val uid = auth.currentUser?.uid ?: ""

        return channelFlow {
            // 1. Obter grupos do usuário
            val userGroupsFlow = if (uid.isNotEmpty()) groupRepository.getMyGroupsFlow() else flowOf(emptyList())

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
                        val androidGames = snap?.toObjects(AndroidGame::class.java)?.onEach { it.id = snap.documents.find { d -> d.id == it.id }?.id ?: it.id } ?: emptyList()
                        trySend(androidGames)
                    }
                    awaitClose { sub.remove() }
                }

                val groupGamesFlow = if (groupQuery != null) {
                    callbackFlow {
                        val sub = groupQuery.addSnapshotListener { snap, e ->
                            if (e != null) { trySend(emptyList()); return@addSnapshotListener }
                            val androidGames = snap?.toObjects(AndroidGame::class.java)?.onEach { it.id = snap.documents.find { d -> d.id == it.id }?.id ?: it.id } ?: emptyList()
                            trySend(androidGames)
                        }
                        awaitClose { sub.remove() }
                    }
                } else {
                    flowOf(emptyList())
                }

                val userConfFlow = confirmationRepository.getUserConfirmationsFlow(uid)

                combine(publicFlow, groupGamesFlow, userConfFlow) { publicGames, groupGames, userConfs ->
                    val allAndroidGames = publicGames.mergeAndDeduplicate(groupGames) { it.id }
                        .filter { it.status == GameStatus.FINISHED.name || it.status == GameStatus.CANCELLED.name }
                        .sortedByDescending { it.dateTime }
                        .take(limit)

                    val result = allAndroidGames.map { androidGame ->
                        GameWithConfirmations(
                            game = androidGame.toKmpGame(),
                            confirmedCount = androidGame.playersCount,
                            isUserConfirmed = androidGame.id in userConfs
                        )
                    }
                    Result.success(result)
                }.collect {
                    send(it)
                }
            }
        }
    }

    // Cache para cursor de paginacao
    private var lastDocumentSnapshot: DocumentSnapshot? = null

    override suspend fun getHistoryGamesPaginated(
        pageSize: Int,
        lastGameId: String?
    ): Result<PaginatedGames> {
        return try {
            val uid = auth.currentUser?.uid ?: ""

            // Buscar grupos do usuario
            val userGroupIds = if (uid.isNotEmpty()) {
                groupRepository.getMyGroups()
                    .getOrElse { emptyList() }
                    .map { it.id.ifEmpty { it.groupId } }
                    .filter { it.isNotEmpty() }
                    .take(10)
            } else {
                emptyList()
            }

            // Se temos um cursor, buscar o documento de referencia
            val startAfterDoc: DocumentSnapshot? = if (lastGameId != null && lastDocumentSnapshot?.id == lastGameId) {
                lastDocumentSnapshot
            } else if (lastGameId != null) {
                // Buscar o documento pelo ID
                gamesCollection.document(lastGameId).get().await()
            } else {
                null
            }

            // Construir query base com ordenacao
            var publicQuery = gamesCollection
                .whereIn("visibility", listOf(
                    com.futebadosparcas.data.model.GameVisibility.PUBLIC_OPEN.name,
                    com.futebadosparcas.data.model.GameVisibility.PUBLIC_CLOSED.name
                ))
                .whereIn("status", listOf(GameStatus.FINISHED.name, GameStatus.CANCELLED.name))
                .orderBy("dateTime", Query.Direction.DESCENDING)

            // Aplicar cursor se existir
            if (startAfterDoc != null && startAfterDoc.exists()) {
                publicQuery = publicQuery.startAfter(startAfterDoc)
            }

            // Buscar uma pagina + 1 para saber se ha mais
            val publicSnapshot = publicQuery.limit((pageSize + 1).toLong()).get().await()

            // Query para jogos de grupo (se houver)
            val groupGames = if (userGroupIds.isNotEmpty()) {
                var groupQuery = gamesCollection
                    .whereEqualTo("visibility", com.futebadosparcas.data.model.GameVisibility.GROUP_ONLY.name)
                    .whereIn("group_id", userGroupIds)
                    .whereIn("status", listOf(GameStatus.FINISHED.name, GameStatus.CANCELLED.name))
                    .orderBy("dateTime", Query.Direction.DESCENDING)

                if (startAfterDoc != null && startAfterDoc.exists()) {
                    groupQuery = groupQuery.startAfter(startAfterDoc)
                }

                groupQuery.limit((pageSize + 1).toLong()).get().await()
                    .documents.mapNotNull { doc ->
                        doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                    }
            } else {
                emptyList()
            }

            val publicGames = publicSnapshot.documents.mapNotNull { doc ->
                doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
            }

            // Combinar e deduplicar
            val allAndroidGames = (publicGames + groupGames)
                .distinctBy { it.id }
                .sortedByDescending { it.dateTime }

            // Verificar se ha mais paginas
            val hasMore = allAndroidGames.size > pageSize
            val androidGamesPage = allAndroidGames.take(pageSize)

            // Atualizar cursor para proxima pagina
            val newLastGameId = if (androidGamesPage.isNotEmpty()) {
                val lastGame = androidGamesPage.last()
                // Guardar snapshot para reutilizar
                lastDocumentSnapshot = publicSnapshot.documents.find { it.id == lastGame.id }
                lastGame.id
            } else {
                null
            }

            // Buscar confirmacoes do usuario
            val userConfirmations = confirmationRepository.getUserConfirmationIds(uid)

            // Mapear para GameWithConfirmations
            val result = androidGamesPage.map { androidGame ->
                GameWithConfirmations(
                    game = androidGame.toKmpGame(),
                    confirmedCount = androidGame.playersCount,
                    isUserConfirmed = androidGame.id in userConfirmations
                )
            }

            AppLogger.d(TAG) { "getHistoryGamesPaginated: ${result.size} jogos, hasMore=$hasMore" }

            Result.success(PaginatedGames(
                games = result,
                lastGameId = newLastGameId,
                hasMore = hasMore
            ))
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar historico paginado", e)
            Result.failure(e)
        }
    }

    override suspend fun getGamesByFilter(filterType: GameFilterType): Result<List<GameWithConfirmations>> {
        return try {
            val uid = auth.currentUser?.uid ?: ""
            if (uid.isEmpty()) return Result.success(emptyList())

            val androidGames = when (filterType) {
                GameFilterType.MY_GAMES -> {
                    val gameIds = confirmationRepository.getConfirmedGameIds(uid)
                    if (gameIds.isEmpty()) emptyList()
                    else {
                        val chunks = gameIds.chunked(10)
                        val allAndroidGames = mutableListOf<AndroidGame>()
                        chunks.forEach { chunk ->
                            val g = gamesCollection.whereIn(FieldPath.documentId(), chunk).get().await()
                            allAndroidGames.addAll(g.toObjects(AndroidGame::class.java).mapNotNull {
                                it.apply { id = g.documents.find { d -> d.id == it.id }?.id ?: it.id }
                            })
                        }
                        allAndroidGames.sortedByDescending { it.dateTime }
                    }
                }
                else -> emptyList()
            }

            val result = androidGames.map { androidGame ->
                GameWithConfirmations(
                    game = androidGame.toKmpGame(),
                    confirmedCount = androidGame.playersCount,
                    isUserConfirmed = true
                )
            }
            Result.success(result)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

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

            val androidGames = snapshot.documents.mapNotNull { doc ->
                doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
            }

            AppLogger.d(TAG) { "Encontrados ${androidGames.size} jogos públicos" }
            Result.success(androidGames.toKmpGames())
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos públicos", e)
            Result.failure(e)
        }
    }

    override fun getPublicGamesFlow(limit: Int): Flow<List<Game>> = callbackFlow {
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

                val androidGames = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                } ?: emptyList()

                trySend(androidGames.toKmpGames())
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

            val androidGames = snapshot.documents.mapNotNull { doc ->
                doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
            }

            AppLogger.d(TAG) { "Encontrados ${androidGames.size} jogos abertos para solicitações" }
            Result.success(androidGames.toKmpGames())
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos abertos", e)
            Result.failure(e)
        }
    }

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

            // Converte horarios para minutos desde meia-noite para facilitar comparacao
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

                    conflicts.add(TimeConflict(conflictingGame = game, overlapMinutes = overlapMinutes))
                }
            }

            Result.success(conflicts)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao verificar conflito de horario", e)
            Result.failure(e)
        }
    }

    override suspend fun getGamesByFieldAndDate(fieldId: String, date: String): Result<List<Game>> {
        return try {
            val snapshot = gamesCollection
                .whereEqualTo("field_id", fieldId)
                .whereEqualTo("date", date)
                .get()
                .await()

            val androidGames = snapshot.toObjects(AndroidGame::class.java)
            Result.success(androidGames.toKmpGames())
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos por quadra e data", e)
            Result.failure(e)
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
