package com.futebadosparcas.domain.ranking

import com.futebadosparcas.domain.model.PlayerRankingItem
import com.futebadosparcas.domain.model.RankingCategory
import com.futebadosparcas.domain.model.RankingPeriod
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.datetime.Clock

/**
 * Gerenciador de paginação para ranking.
 *
 * Implementa paginação baseada em cursor (offset) para listas grandes,
 * com cache inteligente e controle de concorrência.
 *
 * CMD-25: Paginação, cache e otimizações de recomposição
 *
 * @param pageSize Tamanho da página (padrão: 50)
 */
class RankingPagingManager(
    private val pageSize: Int = DEFAULT_PAGE_SIZE
) {
    companion object {
        const val DEFAULT_PAGE_SIZE = 50
        const val MAX_CACHE_SIZE = 200 // Total de itens em cache (4 páginas)
        const val PREFETCH_DISTANCE = 15 // Itens restantes para trigger prefetch
    }

    // Cache LRU simples - usando LinkedHashMap compatível com KMP
    private val cache = LinkedHashMap<String, CachedRankingPage>()

    // Mutex para controle de concorrência
    private val loadMutex = Mutex()

    // Estado de loading por página
    private val loadingPages = mutableSetOf<String>()

    /**
     * Resultado de uma operação de página.
     */
    sealed class PageResult {
        data class Success(
            val items: List<PlayerRankingItem>,
            val hasMore: Boolean,
            val currentPage: Int,
            val totalCount: Int? = null
        ) : PageResult()

        data class Error(val exception: Throwable) : PageResult()
        object Loading : PageResult()
    }

    /**
     * Página em cache.
     */
    private data class CachedRankingPage(
        val items: List<PlayerRankingItem>,
        val timestamp: Long = Clock.System.now().toEpochMilliseconds(),
        val hasMore: Boolean
    )

    /**
     * Chave de cache para uma página.
     */
    private data class PageKey(
        val category: RankingCategory,
        val period: RankingPeriod,
        val page: Int
    ) {
        fun asString() = "${category.name}_${period.name}_$page"

        companion object {
            fun fromString(key: String): PageKey? {
                val parts = key.split("_")
                if (parts.size < 3) return null

                val category = try {
                    RankingCategory.valueOf(parts[0])
                } catch (e: Exception) {
                    return null
                }

                val period = try {
                    RankingPeriod.valueOf(parts[1])
                } catch (e: Exception) {
                    return null
                }

                val page = parts.getOrNull(2)?.toIntOrNull() ?: return null

                return PageKey(category, period, page)
            }
        }
    }

    /**
     * Estado da paginação.
     */
    data class PagingState(
        val items: List<PlayerRankingItem> = emptyList(),
        val hasMore: Boolean = true,
        val currentPage: Int = 0,
        val isLoading: Boolean = false,
        val error: Throwable? = null
    ) {
        val isEmpty: Boolean get() = items.isEmpty() && !isLoading
        val isInitialLoading: Boolean get() = isLoading && currentPage == 0
    }

    /**
     * Cache TTL em millis (5 minutos).
     */
    private val cacheTtl = 5 * 60 * 1000L

    /**
     * Verifica se uma página em cache ainda é válida.
     */
    private fun isCacheValid(cached: CachedRankingPage): Boolean {
        return Clock.System.now().toEpochMilliseconds() - cached.timestamp < cacheTtl
    }

    /**
     * Obtém uma página do cache se válida.
     */
    private fun getCachedPage(key: PageKey): CachedRankingPage? {
        val cached = cache[key.asString()] ?: return null
        return if (isCacheValid(cached)) cached else null
    }

    /**
     * Coloca uma página no cache.
     */
    private fun putCachedPage(key: PageKey, page: CachedRankingPage) {
        val cacheKey = key.asString()
        cache[cacheKey] = page

        // LRU manual: remover entrada mais antiga se exceder MAX_CACHE_SIZE
        if (cache.size > MAX_CACHE_SIZE) {
            val oldestKey = cache.entries.minByOrNull { it.value.timestamp }?.key
            if (oldestKey != null) {
                cache.remove(oldestKey)
            }
        }
    }

    /**
     * Carrega uma página de dados.
     *
     * @param category Categoria do ranking
     * @param period Período do ranking
     * @param page Número da página (0-based)
     * @param fetch Função de fetch dos dados
     * @return Resultado da página
     */
    suspend fun loadPage(
        category: RankingCategory,
        period: RankingPeriod,
        page: Int,
        fetch: suspend (offset: Int, limit: Int) -> Result<List<PlayerRankingItem>>
    ): PageResult {
        val key = PageKey(category, period, page)
        val cacheKey = key.asString()

        // Verificar cache primeiro
        getCachedPage(key)?.let { cached ->
            return PageResult.Success(
                items = cached.items,
                hasMore = cached.hasMore,
                currentPage = page,
                totalCount = null // Não temos total em cache
            )
        }

        // Verificar se já está carregando
        loadMutex.withLock {
            if (cacheKey in loadingPages) {
                return PageResult.Loading
            }
            loadingPages.add(cacheKey)
        }

        return try {
            val offset = page * pageSize
            val result = fetch(offset, pageSize)

            result.fold(
                onSuccess = { items ->
                    val hasMore = items.size >= pageSize
                    val cachedPage = CachedRankingPage(items, hasMore = hasMore)
                    putCachedPage(key, cachedPage)

                    PageResult.Success(
                        items = items,
                        hasMore = hasMore,
                        currentPage = page
                    )
                },
                onFailure = { error ->
                    PageResult.Error(error)
                }
            )
        } finally {
            loadMutex.withLock {
                loadingPages.remove(cacheKey)
            }
        }
    }

    /**
     * Carrega a próxima página.
     */
    suspend fun loadNext(
        currentState: PagingState,
        category: RankingCategory,
        period: RankingPeriod,
        fetch: suspend (offset: Int, limit: Int) -> Result<List<PlayerRankingItem>>
    ): PagingState {
        if (currentState.isLoading || !currentState.hasMore) {
            return currentState
        }

        val nextPage = currentState.currentPage + 1
        val result = loadPage(category, period, nextPage, fetch)

        return when (result) {
            is PageResult.Success -> {
                currentState.copy(
                    items = currentState.items + result.items,
                    hasMore = result.hasMore,
                    currentPage = nextPage,
                    isLoading = false,
                    error = null
                )
            }
            is PageResult.Error -> {
                currentState.copy(
                    isLoading = false,
                    error = result.exception
                )
            }
            is PageResult.Loading -> {
                currentState.copy(isLoading = true)
            }
        }
    }

    /**
     * Recarrega a primeira página (refresh).
     */
    suspend fun refresh(
        category: RankingCategory,
        period: RankingPeriod,
        fetch: suspend (offset: Int, limit: Int) -> Result<List<PlayerRankingItem>>
    ): PagingState {
        // Limpar cache para essa categoria/periodo
        val prefix = "${category.name}_${period.name}_"
        val keysToRemove = cache.keys.filter { it.startsWith(prefix) }
        keysToRemove.forEach { cache.remove(it) }

        val result = loadPage(category, period, 0, fetch)

        return when (result) {
            is PageResult.Success -> {
                PagingState(
                    items = result.items,
                    hasMore = result.hasMore,
                    currentPage = 0,
                    isLoading = false
                )
            }
            is PageResult.Error -> {
                PagingState(
                    items = emptyList(),
                    hasMore = true,
                    currentPage = 0,
                    isLoading = false,
                    error = result.exception
                )
            }
            is PageResult.Loading -> {
                PagingState(
                    items = emptyList(),
                    hasMore = true,
                    currentPage = 0,
                    isLoading = true
                )
            }
        }
    }

    /**
     * Invalida todo o cache.
     */
    fun invalidateAll() {
        cache.clear()
    }

    /**
     * Invalida cache para uma categoria específica.
     */
    fun invalidateCategory(category: RankingCategory) {
        val prefix = "${category.name}_"
        val keys = cache.keys.filter { it.startsWith(prefix) }
        keys.forEach { cache.remove(it) }
    }

    /**
     * Invalida cache para uma categoria e período específicos.
     */
    fun invalidate(category: RankingCategory, period: RankingPeriod) {
        val prefix = "${category.name}_${period.name}_"
        val keys = cache.keys.filter { it.startsWith(prefix) }
        keys.forEach { cache.remove(it) }
    }

    /**
     * Verifica se precisa carregar mais baseado na posição do scroll.
     *
     * @param firstVisibleItemIndex Primeiro item visível
     * @param itemCount Total de itens carregados
     * @return true se deve carregar mais
     */
    fun shouldLoadMore(
        firstVisibleItemIndex: Int,
        itemCount: Int
    ): Boolean {
        if (itemCount == 0) return true

        val itemsFromEnd = itemCount - firstVisibleItemIndex
        return itemsFromEnd <= PREFETCH_DISTANCE
    }

    /**
     * Obtém estatísticas do cache.
     */
    fun getCacheStats(): CacheStats {
        val validEntries = cache.values.count { isCacheValid(it) }
        val expiredEntries = cache.size - validEntries

        return CacheStats(
            totalEntries = cache.size,
            validEntries = validEntries,
            expiredEntries = expiredEntries,
            maxCapacity = MAX_CACHE_SIZE,
            hitRate = if (cache.isNotEmpty()) validEntries.toFloat() / cache.size else 0f
        )
    }

    /**
     * Estatísticas do cache.
     */
    data class CacheStats(
        val totalEntries: Int,
        val validEntries: Int,
        val expiredEntries: Int,
        val maxCapacity: Int,
        val hitRate: Float
    )
}
