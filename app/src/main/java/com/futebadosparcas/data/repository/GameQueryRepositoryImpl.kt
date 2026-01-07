package com.futebadosparcas.data.repository

import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.local.model.toDomain
import com.futebadosparcas.data.local.model.toEntity
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.domain.util.deduplicateSortAndLimit
import com.futebadosparcas.domain.util.mergeAndDeduplicate
import com.futebadosparcas.ui.games.GameWithConfirmations
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
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GameQueryRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val gameDao: GameDao,
    private val groupRepository: GroupRepository,
    private val confirmationRepository: GameConfirmationRepository
) : GameQueryRepository {

    private val gamesCollection = firestore.collection("games")

    companion object {
        private const val TAG = "GameQueryRepository"
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
                .deduplicateSortAndLimit(
                    idSelector = { it.id },
                    sortSelector = { it.dateTime },
                    limit = 20
                )

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
            val userConfirmations = confirmationRepository.getUserConfirmationIds(uid)

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

    override fun getAllGamesWithConfirmationCountFlow(): Flow<Result<List<GameWithConfirmations>>> {
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

        val userConfFlow = confirmationRepository.getUserConfirmationsFlow(uid)

        return combine(gamesFlow, userConfFlow) { gamesResult, userConfs ->
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

            val games = withTimeout(8000L) {
                val gameIds = confirmationRepository.getConfirmedGameIds(uid)

                val gamesList = if (gameIds.isEmpty()) {
                    emptyList<Game>()
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

    override fun getGameDetailsFlow(gameId: String): Flow<Result<Game>> = callbackFlow {
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
                    flowOf(emptyList())
                }

                // 4. User Confirmations (para UI state)
                val userConfFlow = confirmationRepository.getUserConfirmationsFlow(uid)

                // 5. Combine everything
                combine(publicFlow, groupGamesFlow, userConfFlow) { publicGames, groupGames, userConfs ->
                    val allGames = publicGames.mergeAndDeduplicate(groupGames) { it.id }
                        .filter { it.status == GameStatus.SCHEDULED.name || it.status == GameStatus.CONFIRMED.name || it.status == GameStatus.LIVE.name }
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
                    flowOf(emptyList())
                }

                val userConfFlow = confirmationRepository.getUserConfirmationsFlow(uid)

                combine(publicFlow, groupGamesFlow, userConfFlow) { publicGames, groupGames, userConfs ->
                    val allGames = publicGames.mergeAndDeduplicate(groupGames) { it.id }
                        .filter { it.status == GameStatus.FINISHED.name || it.status == GameStatus.CANCELLED.name }
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
                        doc.toObject(Game::class.java)?.apply { id = doc.id }
                    }
            } else {
                emptyList()
            }

            val publicGames = publicSnapshot.documents.mapNotNull { doc ->
                doc.toObject(Game::class.java)?.apply { id = doc.id }
            }

            // Combinar e deduplicar
            val allGames = (publicGames + groupGames)
                .distinctBy { it.id }
                .sortedByDescending { it.dateTime }

            // Verificar se ha mais paginas
            val hasMore = allGames.size > pageSize
            val gamesPage = allGames.take(pageSize)

            // Atualizar cursor para proxima pagina
            val newLastGameId = if (gamesPage.isNotEmpty()) {
                val lastGame = gamesPage.last()
                // Guardar snapshot para reutilizar
                lastDocumentSnapshot = publicSnapshot.documents.find { it.id == lastGame.id }
                lastGame.id
            } else {
                null
            }

            // Buscar confirmacoes do usuario
            val userConfirmations = confirmationRepository.getUserConfirmationIds(uid)

            // Mapear para GameWithConfirmations
            val result = gamesPage.map { game ->
                GameWithConfirmations(
                    game = game,
                    confirmedCount = game.playersCount,
                    isUserConfirmed = game.id in userConfirmations
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

            val games = when (filterType) {
                GameFilterType.MY_GAMES -> {
                    val gameIds = confirmationRepository.getConfirmedGameIds(uid)
                    if (gameIds.isEmpty()) emptyList()
                    else {
                        val chunks = gameIds.chunked(10)
                        val allGames = mutableListOf<Game>()
                        chunks.forEach { chunk ->
                            val g = gamesCollection.whereIn(FieldPath.documentId(), chunk).get().await()
                            allGames.addAll(g.toObjects(Game::class.java).mapNotNull {
                                it.apply { id = g.documents.find { d -> d.id == it.id }?.id ?: it.id }
                            })
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
