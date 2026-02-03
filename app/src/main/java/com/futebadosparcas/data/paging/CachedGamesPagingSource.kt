package com.futebadosparcas.data.paging

import androidx.paging.PagingSource
import androidx.paging.PagingState
import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.local.model.toDomain
import com.futebadosparcas.data.local.model.toEntity
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.ui.games.GameWithConfirmations
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QuerySnapshot
import kotlinx.coroutines.tasks.await

/**
 * CachedGamesPagingSource - PagingSource com cache Room
 *
 * Estratégia:
 * 1. Primeira página: busca do cache (offline-first)
 * 2. Em paralelo, busca do Firestore
 * 3. Próximas páginas: sempre do Firestore (com cache automático)
 *
 * Benefícios:
 * - Renderização instantânea com dados em cache
 * - Funciona offline
 * - Dados atualizados em background
 */
class CachedGamesPagingSource(
    private val firestore: FirebaseFirestore,
    private val gameDao: GameDao,
    private val groupId: String? = null,
    private val includeFinished: Boolean = true,
    private val pageSize: Int = 20 // Reduzido de 30 para 20 (melhor performance)
) : PagingSource<QuerySnapshot, GameWithConfirmations>() {

    companion object {
        private const val TAG = "CachedGamesPagingSource"
    }

    override suspend fun load(params: LoadParams<QuerySnapshot>): LoadResult<QuerySnapshot, GameWithConfirmations> {
        return try {
            val currentPage = params.key
            val isFirstPage = currentPage == null

            // PRIMEIRA PÁGINA: Tenta cache primeiro (offline-first)
            if (isFirstPage) {
                val cachedGames = gameDao.getUpcomingGamesSnapshot()
                if (cachedGames.isNotEmpty()) {
                    AppLogger.d(TAG) { "Loaded ${cachedGames.size} games from cache (first page)" }

                    // Retorna cache imediatamente
                    val gamesWithConfirmations = cachedGames.map { entity ->
                        GameWithConfirmations(
                            game = entity.toDomain(),
                            confirmedCount = 0, // TODO: Cache confirmations count
                            isUserConfirmed = false
                        )
                    }

                    // Buscar do Firestore em background para atualizar cache
                    // (não bloqueia a UI)
                    loadFromNetworkAndUpdateCache(null)

                    return LoadResult.Page(
                        data = gamesWithConfirmations.take(pageSize),
                        prevKey = null,
                        nextKey = null // TODO: Implementar paginação de cache
                    )
                }
            }

            // DEMAIS PÁGINAS ou CACHE VAZIO: Busca do Firestore
            val snapshot = loadFromNetworkAndUpdateCache(currentPage)

            // Converter para GameWithConfirmations
            val gamesWithConfirmations = snapshot.documents.mapNotNull { doc ->
                try {
                    val game = doc.toObject(Game::class.java)?.copy(id = doc.id)
                    game?.let {
                        GameWithConfirmations(
                            game = it,
                            confirmedCount = 0, // TODO: Buscar confirmations count
                            isUserConfirmed = false
                        )
                    }
                } catch (e: Exception) {
                    AppLogger.e(TAG, "Error parsing game document ${doc.id}", e)
                    null
                }
            }

            AppLogger.d(TAG) { "Loaded ${gamesWithConfirmations.size} games from network" }

            LoadResult.Page(
                data = gamesWithConfirmations,
                prevKey = null,
                nextKey = if (gamesWithConfirmations.size < params.loadSize) null else snapshot
            )
        } catch (e: Exception) {
            AppLogger.e(TAG, "Error loading games page", e)
            LoadResult.Error(e)
        }
    }

    /**
     * Busca do Firestore e atualiza cache
     */
    private suspend fun loadFromNetworkAndUpdateCache(currentPage: QuerySnapshot?): QuerySnapshot {
        var query: Query = firestore.collection("games")

        // Filter by group if provided
        if (groupId != null) {
            query = query.whereEqualTo("group_id", groupId)
        }

        // Filter by status: apenas SCHEDULED, CONFIRMED, LIVE
        if (!includeFinished) {
            query = query.whereIn("status", listOf("SCHEDULED", "CONFIRMED", "LIVE"))
        }

        // Order by dateTime (oldest first para upcoming)
        query = query.orderBy("dateTime", Query.Direction.ASCENDING)

        // Cursor pagination
        if (currentPage != null) {
            val lastDocument = currentPage.documents.lastOrNull()
            if (lastDocument != null) {
                query = query.startAfter(lastDocument)
            }
        }

        // Limit page size
        query = query.limit(pageSize.toLong())

        // Execute query com timeout
        val snapshot = query.get().await()

        // Atualizar cache com resultados
        val games = snapshot.documents.mapNotNull { doc ->
            try {
                doc.toObject(Game::class.java)?.copy(id = doc.id)
            } catch (e: Exception) {
                null
            }
        }

        if (games.isNotEmpty()) {
            gameDao.insertGames(games.map { it.toEntity() })
            AppLogger.d(TAG) { "Updated cache with ${games.size} games" }
        }

        return snapshot
    }

    override fun getRefreshKey(state: PagingState<QuerySnapshot, GameWithConfirmations>): QuerySnapshot? {
        return null
    }
}
