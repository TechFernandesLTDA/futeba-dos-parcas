package com.futebadosparcas.data.repository

import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.util.BatchOperationHelper
import com.futebadosparcas.data.local.model.toDomain
import com.futebadosparcas.data.local.model.toEntity
import com.futebadosparcas.data.model.Game as AndroidGame
import com.futebadosparcas.data.model.GameConfirmation as AndroidGameConfirmation
import com.futebadosparcas.data.model.GameEvent as AndroidGameEvent
import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.data.model.Team as AndroidTeam
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.UserRole
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

/**
 * Implementacao Android do GameQueryRepository.
 *
 * Durante a migracao KMP, esta implementacao usa modelos Android internamente
 * e converte para modelos KMP nos retornos dos metodos.
 *
 * Permissões são gerenciadas pelo PermissionManager centralizado.
 */
class GameQueryRepositoryImpl constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val gameDao: GameDao,
    private val groupRepository: GroupRepository,
    private val confirmationRepository: GameConfirmationRepository,
    private val permissionManager: com.futebadosparcas.domain.permission.PermissionManager
) : KmpGameQueryRepository {

    private val gamesCollection = firestore.collection("games")

    companion object {
        private const val TAG = "GameQueryRepository"
    }

    // === SOFT DELETE (P2 #40) ===
    // Filtra jogos soft-deletados no lado cliente.
    // Firestore nao suporta query eficiente para campos nulos,
    // entao filtramos apos deserializar os documentos.

    /**
     * Filtra jogos que foram soft-deletados (deleted_at != null).
     * Usado em todas as queries de listagem para garantir que jogos
     * soft-deletados nao aparecam na UI.
     */
    private fun List<AndroidGame>.filterNotSoftDeleted(): List<AndroidGame> =
        filter { !it.isSoftDeleted() }

    // ========== Permissões (delegado ao PermissionManager) ==========

    /**
     * Verifica se o usuario atual pode ver todos os jogos (admin).
     * Delegado ao PermissionManager centralizado.
     */
    private suspend fun isCurrentUserAdmin(): Boolean = permissionManager.isAdmin()

    /**
     * Verifica se o usuario atual pode ver todo o histórico.
     */
    private suspend fun canViewAllHistory(): Boolean = permissionManager.canViewAllHistory()

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

            // ADMIN SUPPORT: Se admin, buscar TODOS os jogos sem filtro de visibilidade
            val isAdmin = isCurrentUserAdmin()
            if (isAdmin) {
                return getUpcomingGamesForAdmin()
            }

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

            // FIX: Query para jogos do owner (garante que o dono sempre veja seus jogos)
            val ownerScheduledTask = if (uid != null) {
                gamesCollection
                    .whereEqualTo("owner_id", uid)
                    .whereEqualTo("status", GameStatus.SCHEDULED.name)
                    .orderBy("dateTime", Query.Direction.ASCENDING)
                    .limit(20)
                    .get()
            } else null

            val ownerConfirmedTask = if (uid != null) {
                gamesCollection
                    .whereEqualTo("owner_id", uid)
                    .whereEqualTo("status", GameStatus.CONFIRMED.name)
                    .orderBy("dateTime", Query.Direction.ASCENDING)
                    .limit(20)
                    .get()
            } else null

            // Executar queries em paralelo (FIX: inclui ownerTasks)
            val allSnapshots = coroutineScope {
                val tasks = listOfNotNull(
                    async { scheduledTask.await() },
                    async { confirmedTask.await() },
                    if (privateScheduledTask != null) async { privateScheduledTask.await() } else null,
                    if (privateConfirmedTask != null) async { privateConfirmedTask.await() } else null,
                    if (ownerScheduledTask != null) async { ownerScheduledTask.await() } else null,
                    if (ownerConfirmedTask != null) async { ownerConfirmedTask.await() } else null
                )
                tasks.awaitAll()
            }

            val allAndroidGames = allSnapshots.flatMap { it.documents }
                .mapNotNull { doc -> doc.toObject(AndroidGame::class.java)?.apply { id = doc.id } }
                .filterNotSoftDeleted() // P2 #40: Excluir jogos soft-deletados
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

    /**
     * ADMIN ONLY: Busca TODOS os jogos futuros sem filtro de visibilidade.
     * Admins podem ver jogos de qualquer grupo ou visibilidade.
     */
    private suspend fun getUpcomingGamesForAdmin(): Result<List<Game>> {
        return try {
            AppLogger.d(TAG) { "Admin: buscando TODOS os jogos futuros" }

            // Query para jogos SCHEDULED
            val scheduledTask = gamesCollection
                .whereEqualTo("status", GameStatus.SCHEDULED.name)
                .orderBy("dateTime", Query.Direction.ASCENDING)
                .limit(50)
                .get()

            // Query para jogos CONFIRMED
            val confirmedTask = gamesCollection
                .whereEqualTo("status", GameStatus.CONFIRMED.name)
                .orderBy("dateTime", Query.Direction.ASCENDING)
                .limit(50)
                .get()

            // Query para jogos LIVE
            val liveTask = gamesCollection
                .whereEqualTo("status", GameStatus.LIVE.name)
                .orderBy("dateTime", Query.Direction.ASCENDING)
                .limit(20)
                .get()

            // Executar queries em paralelo
            val allSnapshots = coroutineScope {
                val tasks = listOf(
                    async { scheduledTask.await() },
                    async { confirmedTask.await() },
                    async { liveTask.await() }
                )
                tasks.awaitAll()
            }

            val allAndroidGames = allSnapshots.flatMap { it.documents }
                .mapNotNull { doc -> doc.toObject(AndroidGame::class.java)?.apply { id = doc.id } }
                .filterNotSoftDeleted() // P2 #40: Excluir jogos soft-deletados
                .deduplicateSortAndLimit(
                    idSelector = { it.id },
                    sortSelector = { it.dateTime },
                    limit = 50
                )

            AppLogger.d(TAG) { "Admin: encontrados ${allAndroidGames.size} jogos" }

            // Sync to local
            val entities = allAndroidGames.map { it.toEntity() }
            gameDao.insertGames(entities)

            // Converter para KMP
            val kmpGames = allAndroidGames.map { it.toKmpGame() }
            Result.success(kmpGames)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Admin: Erro ao buscar todos os jogos", e)
            val localGames = gameDao.getUpcomingGamesSnapshot().map { it.toDomain().toKmpGame() }
            Result.success(localGames)
        }
    }

    override suspend fun getAllGames(): Result<List<Game>> {
        return try {
            val uid = auth.currentUser?.uid

            // FIX: Buscar jogos públicos + jogos do owner em paralelo
            coroutineScope {
                val publicGamesDeferred = async {
                    gamesCollection
                        .whereIn("visibility", listOf("PUBLIC_OPEN", "PUBLIC_CLOSED"))
                        .orderBy("dateTime", Query.Direction.ASCENDING)
                        .limit(50)
                        .get()
                        .await()
                        .documents.mapNotNull { doc ->
                            doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                        }
                }

                val ownerGamesDeferred = if (uid != null) {
                    async {
                        gamesCollection
                            .whereEqualTo("owner_id", uid)
                            .orderBy("dateTime", Query.Direction.ASCENDING)
                            .limit(50)
                            .get()
                            .await()
                            .documents.mapNotNull { doc ->
                                doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                            }
                    }
                } else null

                val publicGames = publicGamesDeferred.await()
                val ownerGames = ownerGamesDeferred?.await() ?: emptyList()

                // Combinar, filtrar soft-deleted e deduplicar
                val allGames = (publicGames + ownerGames)
                    .filterNotSoftDeleted() // P2 #40: Excluir jogos soft-deletados
                    .distinctBy { it.id }
                    .sortedBy { it.dateTime }
                    .take(50)

                // Sync to Local DB
                val entities = allGames.map { it.toEntity() }
                gameDao.insertGames(entities)

                Result.success(allGames.toKmpGames())
            }
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

            // FIX: Buscar jogos públicos + jogos do owner em paralelo
            coroutineScope {
                val publicGamesDeferred = async {
                    gamesCollection
                        .whereIn("visibility", listOf("PUBLIC_OPEN", "PUBLIC_CLOSED"))
                        .orderBy("dateTime", Query.Direction.DESCENDING)
                        .limit(50)
                        .get()
                        .await()
                        .documents.mapNotNull { doc ->
                            doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                        }
                }

                val ownerGamesDeferred = if (uid.isNotEmpty()) {
                    async {
                        gamesCollection
                            .whereEqualTo("owner_id", uid)
                            .orderBy("dateTime", Query.Direction.DESCENDING)
                            .limit(50)
                            .get()
                            .await()
                            .documents.mapNotNull { doc ->
                                doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                            }
                    }
                } else null

                val publicGames = publicGamesDeferred.await()
                val ownerGames = ownerGamesDeferred?.await() ?: emptyList()

                // Combinar, filtrar soft-deleted e deduplicar
                val allGames = (publicGames + ownerGames)
                    .filterNotSoftDeleted() // P2 #40: Excluir jogos soft-deletados
                    .distinctBy { it.id }
                    .sortedByDescending { it.dateTime }
                    .take(50)

                // Fetch user confirmations
                val userConfirmations = confirmationRepository.getUserConfirmationIds(uid)

                val result = allGames.map { androidGame ->
                    GameWithConfirmations(
                        game = androidGame.toKmpGame(),
                        confirmedCount = androidGame.playersCount,
                        isUserConfirmed = androidGame.id in userConfirmations || androidGame.ownerId == uid
                    )
                }

                Result.success(result)
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos com contagem", e)
            Result.failure(e)
        }
    }

    override fun getAllGamesWithConfirmationCountFlow(): Flow<Result<List<GameWithConfirmations>>> {
        val uid = auth.currentUser?.uid ?: ""

        // Flow para jogos públicos
        val publicGamesFlow = callbackFlow {
            val subscription = gamesCollection
                .whereIn("visibility", listOf("PUBLIC_OPEN", "PUBLIC_CLOSED"))
                .orderBy("dateTime", Query.Direction.DESCENDING)
                .limit(50)
                .addSnapshotListener { snapshot, e ->
                    if (e != null) {
                        trySend(emptyList())
                        return@addSnapshotListener
                    }
                    if (snapshot != null) {
                        val androidGames = snapshot.documents.mapNotNull { doc ->
                            doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                        }
                        trySend(androidGames)
                    }
                }
            awaitClose { subscription.remove() }
        }

        // FIX: Flow para jogos do owner
        val ownerGamesFlow = if (uid.isNotEmpty()) {
            callbackFlow {
                val subscription = gamesCollection
                    .whereEqualTo("owner_id", uid)
                    .orderBy("dateTime", Query.Direction.DESCENDING)
                    .limit(50)
                    .addSnapshotListener { snapshot, e ->
                        if (e != null) {
                            trySend(emptyList())
                            return@addSnapshotListener
                        }
                        if (snapshot != null) {
                            val androidGames = snapshot.documents.mapNotNull { doc ->
                                doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                            }
                            trySend(androidGames)
                        }
                    }
                awaitClose { subscription.remove() }
            }
        } else {
            flowOf(emptyList())
        }

        val userConfFlow = confirmationRepository.getUserConfirmationsFlow(uid)

        // FIX: Combina jogos públicos + jogos do owner
        return combine(publicGamesFlow, ownerGamesFlow, userConfFlow) { publicGames, ownerGames, userConfs ->
            // Merge, filtrar soft-deleted e deduplica
            val allGames = (publicGames + ownerGames)
                .filterNotSoftDeleted() // P2 #40: Excluir jogos soft-deletados
                .distinctBy { it.id }
                .sortedByDescending { it.dateTime }
                .take(50)

            val result = allGames.map { androidGame ->
                GameWithConfirmations(
                    game = androidGame.toKmpGame(),
                    confirmedCount = androidGame.playersCount,
                    isUserConfirmed = androidGame.id in userConfs || androidGame.ownerId == uid
                )
            }
            Result.success(result)
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

                // P2 #40: Filtra soft-deletados, apenas jogos futuros e ordena por data
                val now = java.util.Date()
                androidGamesList
                    .filterNotSoftDeleted()
                    .filter { val dt = it.dateTime; dt != null && dt > now }
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
                            .orderBy("created_at", Query.Direction.DESCENDING)
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

        return channelFlow {
            val isAdmin = isCurrentUserAdmin()

            // Monitora mudanças nos grupos para atualizar a lista de jogos
            val userGroupsFlow = if (uid.isNotEmpty() && !isAdmin) groupRepository.getMyGroupsFlow() else flowOf(emptyList())

            userGroupsFlow.collect { userGroups ->
                val userGroupIds = userGroups.map { it.id.ifEmpty { it.groupId } }
                    .filter { it.isNotEmpty() }
                    .take(10)

                val now = java.util.Calendar.getInstance().apply {
                    add(java.util.Calendar.HOUR_OF_DAY, -4) // Incluir jogos live recentes
                }.time

                // Definir queries e criar flows de snapshot
                val adminGamesFlow = buildAdminGamesFlow(isAdmin, now)
                val publicFlow = buildPublicGamesFlow(isAdmin, now)
                val groupGamesFlow = buildGroupGamesFlow(isAdmin, userGroupIds, now)
                val ownerGamesFlow = buildOwnerGamesFlow(isAdmin, uid, now)
                val userConfFlow = confirmationRepository.getUserConfirmationsFlow(uid)

                // Combinar todas as fontes de dados
                combine(adminGamesFlow, publicFlow, groupGamesFlow, ownerGamesFlow, userConfFlow) { adminGames, publicGames, groupGames, ownerGames, userConfs ->
                    val allAndroidGames = mergeAndFilterGames(adminGames, publicGames, groupGames, ownerGames)
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

    /**
     * Cria Flow de snapshot para jogos de admin (todos os jogos futuros).
     */
    private fun buildAdminGamesFlow(isAdmin: Boolean, now: java.util.Date): Flow<List<AndroidGame>> {
        if (!isAdmin) return flowOf(emptyList())
        val query = gamesCollection
            .whereGreaterThan("dateTime", now)
            .orderBy("dateTime", Query.Direction.ASCENDING)
            .limit(50)
        return createSnapshotFlow(query, "Admin")
    }

    /**
     * Cria Flow de snapshot para jogos públicos.
     */
    private fun buildPublicGamesFlow(isAdmin: Boolean, now: java.util.Date): Flow<List<AndroidGame>> {
        if (isAdmin) return flowOf(emptyList())
        val query = gamesCollection
            .whereIn("visibility", listOf(
                com.futebadosparcas.data.model.GameVisibility.PUBLIC_OPEN.name,
                com.futebadosparcas.data.model.GameVisibility.PUBLIC_CLOSED.name
            ))
            .whereGreaterThan("dateTime", now)
            .orderBy("dateTime", Query.Direction.ASCENDING)
            .limit(30)
        return createSnapshotFlow(query, "Publica")
    }

    /**
     * Cria Flow de snapshot para jogos do grupo.
     */
    private fun buildGroupGamesFlow(
        isAdmin: Boolean,
        userGroupIds: List<String>,
        now: java.util.Date
    ): Flow<List<AndroidGame>> {
        if (isAdmin || userGroupIds.isEmpty()) return flowOf(emptyList())
        val query = gamesCollection
            .whereEqualTo("visibility", com.futebadosparcas.data.model.GameVisibility.GROUP_ONLY.name)
            .whereIn("group_id", userGroupIds)
            .whereGreaterThan("dateTime", now)
            .orderBy("dateTime", Query.Direction.ASCENDING)
            .limit(30)
        return createSnapshotFlow(query, "Grupo")
    }

    /**
     * Cria Flow de snapshot para jogos do owner.
     */
    private fun buildOwnerGamesFlow(isAdmin: Boolean, uid: String, now: java.util.Date): Flow<List<AndroidGame>> {
        if (isAdmin || uid.isEmpty()) return flowOf(emptyList())
        val query = gamesCollection
            .whereEqualTo("owner_id", uid)
            .whereGreaterThan("dateTime", now)
            .orderBy("dateTime", Query.Direction.ASCENDING)
            .limit(30)
        return createSnapshotFlow(query, "Owner")
    }

    /**
     * Cria um Flow genérico de snapshot listener para uma query Firestore.
     * Reduz duplicação de código entre os diferentes flows de jogos.
     */
    private fun createSnapshotFlow(query: Query, label: String): Flow<List<AndroidGame>> = callbackFlow {
        val sub = query.addSnapshotListener { snap, e ->
            if (e != null) {
                AppLogger.e(TAG, "getLiveAndUpcomingGamesFlow: Erro na Query de $label", e)
                trySend(emptyList())
                return@addSnapshotListener
            }
            val androidGames = snap?.toObjects(AndroidGame::class.java)?.onEach {
                it.id = snap.documents.find { d -> d.id == it.id }?.id ?: it.id
            } ?: emptyList()
            trySend(androidGames)
        }
        awaitClose { sub.remove() }
    }

    /**
     * Filtra status válidos (SCHEDULED, CONFIRMED, LIVE) para jogos futuros/live.
     */
    private val validUpcomingStatuses = setOf(
        GameStatus.SCHEDULED.name,
        GameStatus.CONFIRMED.name,
        GameStatus.LIVE.name
    )

    /**
     * Combina e filtra jogos de todas as fontes (admin vs não-admin).
     */
    private fun mergeAndFilterGames(
        adminGames: List<AndroidGame>,
        publicGames: List<AndroidGame>,
        groupGames: List<AndroidGame>,
        ownerGames: List<AndroidGame>
    ): List<AndroidGame> {
        return if (adminGames.isNotEmpty()) {
            // Admin: usa todos os jogos sem merge
            adminGames
                .filterNotSoftDeleted()
                .filter { it.status in validUpcomingStatuses }
                .sortedBy { it.dateTime }
                .take(50)
        } else {
            // Não-admin: merge das fontes filtradas
            publicGames
                .mergeAndDeduplicate(groupGames) { it.id }
                .mergeAndDeduplicate(ownerGames) { it.id }
                .filterNotSoftDeleted()
                .filter { it.status in validUpcomingStatuses }
                .sortedBy { it.dateTime }
                .take(20)
        }
    }

    override fun getHistoryGamesFlow(limit: Int): Flow<Result<List<GameWithConfirmations>>> {
        val uid = auth.currentUser?.uid ?: ""

        return channelFlow {
            // ADMIN SUPPORT: Se admin, buscar TODOS os jogos finalizados sem filtro
            val isAdmin = isCurrentUserAdmin()
            if (isAdmin) {
                AppLogger.d(TAG) { "Admin acessando histórico - mostrando TODOS os jogos finalizados" }

                val adminQuery = gamesCollection
                    .whereIn("status", listOf(GameStatus.FINISHED.name, GameStatus.CANCELLED.name))
                    .orderBy("dateTime", Query.Direction.DESCENDING)
                    .limit(limit.toLong())

                val adminFlow = callbackFlow {
                    val sub = adminQuery.addSnapshotListener { snap, e ->
                        if (e != null) {
                            trySend(Result.failure<List<GameWithConfirmations>>(e))
                            return@addSnapshotListener
                        }
                        val androidGames = (snap?.documents?.mapNotNull { doc ->
                            doc.toObject(AndroidGame::class.java)?.also { it.id = doc.id }
                        } ?: emptyList()).filterNotSoftDeleted() // P2 #40

                        val result = androidGames.map { androidGame ->
                            GameWithConfirmations(
                                game = androidGame.toKmpGame(),
                                confirmedCount = androidGame.playersCount,
                                isUserConfirmed = false
                            )
                        }
                        trySend(Result.success(result))
                    }
                    awaitClose { sub.remove() }
                }

                adminFlow.collect { send(it) }
                return@channelFlow
            }

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
                    .whereIn("status", listOf(GameStatus.FINISHED.name, GameStatus.CANCELLED.name))
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

                // Query C: Owner History (FIX: garante que o dono sempre veja seu histórico)
                val ownerQuery = if (uid.isNotEmpty()) {
                    gamesCollection
                        .whereEqualTo("owner_id", uid)
                        .whereIn("status", listOf(GameStatus.FINISHED.name, GameStatus.CANCELLED.name))
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

                // Flow para histórico do owner (FIX)
                val ownerGamesFlow = if (ownerQuery != null) {
                    callbackFlow {
                        val sub = ownerQuery.addSnapshotListener { snap, e ->
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

                // FIX: Usuários normais só veem jogos que PARTICIPARAM ou são DONOS
                // Admin já foi tratado acima e retorna todos os jogos
                combine(publicFlow, groupGamesFlow, ownerGamesFlow, userConfFlow) { publicGames, groupGames, ownerGames, userConfs ->
                    // Primeiro, junta todos os jogos candidatos, filtra soft-deleted e remove duplicatas
                    val allCandidateGames = (publicGames + groupGames + ownerGames)
                        .filterNotSoftDeleted() // P2 #40: Excluir jogos soft-deletados
                        .distinctBy { it.id }
                        .filter { it.status == GameStatus.FINISHED.name || it.status == GameStatus.CANCELLED.name }

                    // FIX: Filtra para mostrar APENAS jogos onde usuário:
                    // 1. É o dono (owner_id == uid), OU
                    // 2. Participou (está na lista de confirmações)
                    val filteredGames = allCandidateGames.filter { game ->
                        game.ownerId == uid || game.id in userConfs
                    }

                    val sortedGames = filteredGames
                        .sortedByDescending { it.dateTime }
                        .take(limit)

                    val result = sortedGames.map { androidGame ->
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

            // ADMIN SUPPORT: Se admin, buscar TODOS os jogos finalizados
            val isAdmin = isCurrentUserAdmin()
            if (isAdmin) {
                AppLogger.d(TAG) { "Admin acessando histórico paginado - mostrando TODOS os jogos" }
                return getHistoryGamesPaginatedForAdmin(pageSize, lastGameId)
            }

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

            // Query para jogos do owner (FIX: garante que o dono sempre veja seu histórico)
            val ownerGames = if (uid.isNotEmpty()) {
                var ownerQuery = gamesCollection
                    .whereEqualTo("owner_id", uid)
                    .whereIn("status", listOf(GameStatus.FINISHED.name, GameStatus.CANCELLED.name))
                    .orderBy("dateTime", Query.Direction.DESCENDING)

                if (startAfterDoc != null && startAfterDoc.exists()) {
                    ownerQuery = ownerQuery.startAfter(startAfterDoc)
                }

                ownerQuery.limit((pageSize + 1).toLong()).get().await()
                    .documents.mapNotNull { doc ->
                        doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                    }
            } else {
                emptyList()
            }

            val publicGames = publicSnapshot.documents.mapNotNull { doc ->
                doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
            }

            // Buscar confirmacoes do usuario ANTES de filtrar
            val userConfirmations = confirmationRepository.getUserConfirmationIds(uid)

            // Combinar, filtrar soft-deleted e deduplicar
            val allCandidateGames = (publicGames + groupGames + ownerGames)
                .filterNotSoftDeleted() // P2 #40: Excluir jogos soft-deletados
                .distinctBy { it.id }

            // FIX: Filtrar para mostrar APENAS jogos onde usuário:
            // 1. É o dono (owner_id == uid), OU
            // 2. Participou (está na lista de confirmações)
            val filteredGames = allCandidateGames.filter { game ->
                game.ownerId == uid || game.id in userConfirmations
            }.sortedByDescending { it.dateTime }

            // Verificar se ha mais paginas
            val hasMore = filteredGames.size > pageSize
            val androidGamesPage = filteredGames.take(pageSize)

            // Atualizar cursor para proxima pagina
            val newLastGameId = if (androidGamesPage.isNotEmpty()) {
                val lastGame = androidGamesPage.last()
                // Guardar snapshot para reutilizar
                lastDocumentSnapshot = publicSnapshot.documents.find { it.id == lastGame.id }
                lastGame.id
            } else {
                null
            }

            // Mapear para GameWithConfirmations
            val result = androidGamesPage.map { androidGame ->
                GameWithConfirmations(
                    game = androidGame.toKmpGame(),
                    confirmedCount = androidGame.playersCount,
                    isUserConfirmed = androidGame.id in userConfirmations
                )
            }

            AppLogger.d(TAG) { "getHistoryGamesPaginated: ${result.size} jogos (filtrado por participação), hasMore=$hasMore" }

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

    /**
     * Versão de admin para histórico paginado - retorna TODOS os jogos finalizados.
     * Admins podem ver todos os jogos para supervisão e análise.
     */
    private suspend fun getHistoryGamesPaginatedForAdmin(
        pageSize: Int,
        lastGameId: String?
    ): Result<PaginatedGames> {
        return try {
            // Se temos um cursor, buscar o documento de referência
            val startAfterDoc: DocumentSnapshot? = if (lastGameId != null && lastDocumentSnapshot?.id == lastGameId) {
                lastDocumentSnapshot
            } else if (lastGameId != null) {
                gamesCollection.document(lastGameId).get().await()
            } else {
                null
            }

            // Query para TODOS os jogos finalizados (sem filtro de visibilidade)
            var query = gamesCollection
                .whereIn("status", listOf(GameStatus.FINISHED.name, GameStatus.CANCELLED.name))
                .orderBy("dateTime", Query.Direction.DESCENDING)

            if (startAfterDoc != null && startAfterDoc.exists()) {
                query = query.startAfter(startAfterDoc)
            }

            val snapshot = query.limit((pageSize + 1).toLong()).get().await()

            val androidGames = snapshot.documents.mapNotNull { doc ->
                doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
            }.filterNotSoftDeleted() // P2 #40: Excluir jogos soft-deletados

            val hasMore = androidGames.size > pageSize
            val gamesPage = androidGames.take(pageSize)

            val newLastGameId = if (gamesPage.isNotEmpty()) {
                val lastGame = gamesPage.last()
                lastDocumentSnapshot = snapshot.documents.find { it.id == lastGame.id }
                lastGame.id
            } else {
                null
            }

            val result = gamesPage.map { androidGame ->
                GameWithConfirmations(
                    game = androidGame.toKmpGame(),
                    confirmedCount = androidGame.playersCount,
                    isUserConfirmed = false
                )
            }

            AppLogger.d(TAG) { "getHistoryGamesPaginatedForAdmin: ${result.size} jogos (ADMIN), hasMore=$hasMore" }

            Result.success(PaginatedGames(
                games = result,
                lastGameId = newLastGameId,
                hasMore = hasMore
            ))
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar historico paginado (admin)", e)
            Result.failure(e)
        }
    }

    override suspend fun getGamesByFilter(filterType: GameFilterType): Result<List<GameWithConfirmations>> {
        return try {
            val uid = auth.currentUser?.uid ?: ""
            if (uid.isEmpty()) return Result.success(emptyList())

            val androidGames = when (filterType) {
                GameFilterType.MY_GAMES -> {
                    // FIX: Buscar jogos onde usuário é OWNER + jogos onde tem confirmação
                    coroutineScope {
                        // 1. Buscar jogos onde o usuário é dono (owner)
                        val ownedGamesDeferred = async {
                            try {
                                gamesCollection
                                    .whereEqualTo("owner_id", uid)
                                    .orderBy("dateTime", Query.Direction.DESCENDING)
                                    .limit(50)
                                    .get()
                                    .await()
                                    .documents.mapNotNull { doc ->
                                        doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                                    }
                            } catch (e: Exception) {
                                AppLogger.e(TAG, "Erro ao buscar jogos do owner", e)
                                emptyList()
                            }
                        }

                        // 2. Buscar jogos onde o usuário tem confirmação
                        val confirmedGamesDeferred = async {
                            try {
                                val gameIds = confirmationRepository.getConfirmedGameIds(uid)
                                if (gameIds.isEmpty()) {
                                    emptyList()
                                } else {
                                    // Busca paralela em chunks de 10 (limite do whereIn)
                                    BatchOperationHelper.parallelWhereIn(
                                        collection = gamesCollection,
                                        ids = gameIds,
                                        mapper = { doc ->
                                            doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                                        }
                                    )
                                }
                            } catch (e: Exception) {
                                AppLogger.e(TAG, "Erro ao buscar jogos confirmados", e)
                                emptyList()
                            }
                        }

                        // 3. Combinar, filtrar soft-deleted e deduplicar
                        val ownedGames = ownedGamesDeferred.await()
                        val confirmedGames = confirmedGamesDeferred.await()

                        (ownedGames + confirmedGames)
                            .filterNotSoftDeleted() // P2 #40: Excluir jogos soft-deletados
                            .distinctBy { it.id }
                            .sortedByDescending { it.dateTime }
                    }
                }
                else -> emptyList()
            }

            // Buscar confirmações do usuário para marcar corretamente isUserConfirmed
            val userConfirmations = confirmationRepository.getUserConfirmationIds(uid)

            val result = androidGames.map { androidGame ->
                GameWithConfirmations(
                    game = androidGame.toKmpGame(),
                    confirmedCount = androidGame.playersCount,
                    // FIX: Verificar se realmente tem confirmação (pode ser apenas owner sem confirmação)
                    isUserConfirmed = androidGame.id in userConfirmations || androidGame.ownerId == uid
                )
            }
            Result.success(result)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro em getGamesByFilter", e)
            Result.failure(e)
        }
    }

    override suspend fun getPublicGames(limit: Int): Result<List<Game>> {
        return try {
            val now = System.currentTimeMillis()
            // Buscar mais que o limit pois filtramos jogos passados client-side
            val fetchLimit = (limit * 3).coerceAtLeast(15).toLong()

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
                .limit(fetchLimit)
                .get()
                .await()

            val androidGames = snapshot.documents.mapNotNull { doc ->
                doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
            }
                .filterNotSoftDeleted() // P2 #40: Excluir jogos soft-deletados
                .filter { game ->
                    // Mostrar apenas jogos futuros (dateTime >= agora)
                    val gameDateTime = game.dateTime?.time ?: 0L
                    gameDateTime >= now
                }
                .take(limit)

            AppLogger.d(TAG) { "Encontrados ${androidGames.size} jogos públicos futuros" }
            Result.success(androidGames.toKmpGames())
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogos públicos", e)
            Result.failure(e)
        }
    }

    override fun getPublicGamesFlow(limit: Int): Flow<List<Game>> = callbackFlow {
        // Buscar mais que o limit pois filtramos jogos passados client-side
        val fetchLimit = (limit * 3).coerceAtLeast(15).toLong()

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
            .limit(fetchLimit)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro no listener de jogos públicos", error)
                    return@addSnapshotListener
                }

                val now = System.currentTimeMillis()
                val androidGames = (snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(AndroidGame::class.java)?.apply { id = doc.id }
                } ?: emptyList())
                    .filterNotSoftDeleted() // P2 #40
                    .filter { game ->
                        // Mostrar apenas jogos futuros (dateTime >= agora)
                        val gameDateTime = game.dateTime?.time ?: 0L
                        gameDateTime >= now
                    }
                    .take(limit)

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
                val lat = game.locationLat ?: return@filter false
                val lng = game.locationLng ?: return@filter false
                val distance = calculateDistance(userLat, userLng, lat, lng)
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

            AppLogger.d(TAG) { "Encontrados ${androidGames.size} jogos abertos para solicitacoes" }
            Result.success(androidGames.filterNotSoftDeleted().toKmpGames()) // P2 #40
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
                return Result.failure(gamesResult.exceptionOrNull() ?: Exception("Erro ao buscar jogos"))
            }

            val existingGames = (gamesResult.getOrNull() ?: emptyList())
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
            // Limite de 50 jogos por campo/data para evitar leituras excessivas
            val snapshot = gamesCollection
                .whereEqualTo("field_id", fieldId)
                .whereEqualTo("date", date)
                .limit(50)
                .get()
                .await()

            val androidGames = snapshot.toObjects(AndroidGame::class.java)
                .filterNotSoftDeleted() // P2 #40: Excluir jogos soft-deletados
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
