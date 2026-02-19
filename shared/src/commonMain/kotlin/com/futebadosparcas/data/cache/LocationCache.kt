package com.futebadosparcas.data.cache

import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.util.DateTimeUtils
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Cache LRU com TTL para locais.
 *
 * Implementacao multiplataforma (KMP) com:
 * - Max 50 entradas (configuravel)
 * - TTL de 5 minutos (configuravel)
 * - Operacoes thread-safe via Mutex
 * - Suporte a diferentes tipos de chave (ID, owner, search prefix)
 *
 * @param maxEntries Numero maximo de entradas no cache (padrao 50)
 * @param ttlMs Tempo de vida em milissegundos (padrao 5 minutos)
 */
class LocationCache(
    private val maxEntries: Int = DEFAULT_MAX_ENTRIES,
    private val ttlMs: Long = DEFAULT_TTL_MS
) {
    companion object {
        private const val DEFAULT_MAX_ENTRIES = 50
        private const val DEFAULT_TTL_MS = 5 * 60 * 1000L // 5 minutos

        // Prefixos para chaves de cache
        private const val KEY_PREFIX_ID = "id:"
        private const val KEY_PREFIX_OWNER = "owner:"
        private const val KEY_PREFIX_SEARCH = "search:"
    }

    /**
     * Entrada no cache com dados, timestamp e TTL.
     */
    private data class CacheEntry<T>(
        val data: T,
        val timestamp: Long,
        val ttlMs: Long
    ) {
        fun isExpired(): Boolean {
            val now = DateTimeUtils.currentTimeMillis()
            return (now - timestamp) > ttlMs
        }
    }

    // Cache principal usando LinkedHashMap para manter ordem de acesso (LRU)
    // LinkedHashMap com accessOrder=true move entradas acessadas para o final
    private val cache = linkedMapOf<String, CacheEntry<Any>>()
    private val mutex = Mutex()

    // ========== OPERACOES PARA LOCATION INDIVIDUAL ==========

    /**
     * Busca um local pelo ID no cache.
     *
     * @param locationId ID do local
     * @return Location se encontrado e valido, null caso contrario
     */
    suspend fun getById(locationId: String): Location? = mutex.withLock {
        val key = "$KEY_PREFIX_ID$locationId"
        getFromCache(key)
    }

    /**
     * Armazena um local no cache.
     *
     * @param location Local a ser armazenado
     */
    suspend fun putById(location: Location) = mutex.withLock {
        val key = "$KEY_PREFIX_ID${location.id}"
        putInCache(key, location)
    }

    // ========== OPERACOES PARA LISTA POR OWNER ==========

    /**
     * Busca locais de um proprietario no cache.
     *
     * @param ownerId ID do proprietario
     * @return Lista de locais se encontrada e valida, null caso contrario
     */
    @Suppress("UNCHECKED_CAST")
    suspend fun getByOwner(ownerId: String): List<Location>? = mutex.withLock {
        val key = "$KEY_PREFIX_OWNER$ownerId"
        getFromCache(key)
    }

    /**
     * Armazena locais de um proprietario no cache.
     *
     * @param ownerId ID do proprietario
     * @param locations Lista de locais
     */
    suspend fun putByOwner(ownerId: String, locations: List<Location>) = mutex.withLock {
        val key = "$KEY_PREFIX_OWNER$ownerId"
        putInCache(key, locations)

        // Tambem cachear cada local individualmente
        locations.forEach { location ->
            val individualKey = "$KEY_PREFIX_ID${location.id}"
            putInCache(individualKey, location)
        }
    }

    // ========== OPERACOES PARA BUSCA (SEARCH) ==========

    /**
     * Busca resultados de pesquisa no cache pelo prefixo da query.
     *
     * @param query Termo de busca (normalizado internamente)
     * @return Lista de locais se encontrada e valida, null caso contrario
     */
    @Suppress("UNCHECKED_CAST")
    suspend fun getBySearchQuery(query: String): List<Location>? = mutex.withLock {
        val normalizedQuery = normalizeQuery(query)
        if (normalizedQuery.length < 2) return@withLock null

        val key = "$KEY_PREFIX_SEARCH$normalizedQuery"
        getFromCache(key)
    }

    /**
     * Armazena resultados de pesquisa no cache.
     *
     * @param query Termo de busca
     * @param locations Lista de locais encontrados
     */
    suspend fun putBySearchQuery(query: String, locations: List<Location>) = mutex.withLock {
        val normalizedQuery = normalizeQuery(query)
        if (normalizedQuery.length < 2) return@withLock

        val key = "$KEY_PREFIX_SEARCH$normalizedQuery"
        putInCache(key, locations)

        // Tambem cachear cada local individualmente
        locations.forEach { location ->
            val individualKey = "$KEY_PREFIX_ID${location.id}"
            putInCache(individualKey, location)
        }
    }

    // ========== INVALIDACAO ==========

    /**
     * Invalida (remove) um local especifico do cache.
     * Remove tambem das listas de owner e search que contem este local.
     *
     * @param locationId ID do local a ser invalidado
     */
    suspend fun invalidate(locationId: String) = mutex.withLock {
        val key = "$KEY_PREFIX_ID$locationId"
        cache.remove(key)

        // Remover o local de todas as listas em cache
        // (owner lists e search results que contem este local)
        invalidateListsContaining(locationId)
    }

    /**
     * Invalida todos os locais de um proprietario.
     *
     * @param ownerId ID do proprietario
     */
    suspend fun invalidateByOwner(ownerId: String): Unit = mutex.withLock {
        val key = "$KEY_PREFIX_OWNER$ownerId"
        cache.remove(key)
        Unit
    }

    /**
     * Invalida resultados de busca para um termo.
     *
     * @param query Termo de busca
     */
    suspend fun invalidateSearchQuery(query: String): Unit = mutex.withLock {
        val normalizedQuery = normalizeQuery(query)
        val key = "$KEY_PREFIX_SEARCH$normalizedQuery"
        cache.remove(key)
        Unit
    }

    /**
     * Limpa todo o cache.
     */
    suspend fun clear() = mutex.withLock {
        cache.clear()
    }

    // ========== UTILITARIOS ==========

    /**
     * Retorna estatisticas do cache.
     */
    suspend fun stats(): LocationCacheStats = mutex.withLock {
        // Remover entradas expiradas primeiro
        removeExpiredEntries()

        val idCount = cache.keys.count { it.startsWith(KEY_PREFIX_ID) }
        val ownerCount = cache.keys.count { it.startsWith(KEY_PREFIX_OWNER) }
        val searchCount = cache.keys.count { it.startsWith(KEY_PREFIX_SEARCH) }

        LocationCacheStats(
            totalEntries = cache.size,
            maxEntries = maxEntries,
            locationByIdCount = idCount,
            locationsByOwnerCount = ownerCount,
            searchResultsCount = searchCount
        )
    }

    // ========== HELPERS PRIVADOS ==========

    /**
     * Busca uma entrada do cache, verificando expiracao.
     */
    @Suppress("UNCHECKED_CAST")
    private fun <T> getFromCache(key: String): T? {
        val entry = cache[key] ?: return null

        // Verificar expiracao
        if (entry.isExpired()) {
            cache.remove(key)
            return null
        }

        // Atualizar posicao LRU (mover para o final)
        cache.remove(key)
        cache[key] = entry

        return entry.data as? T
    }

    /**
     * Armazena uma entrada no cache com eviction LRU se necessario.
     */
    private fun putInCache(key: String, data: Any) {
        // Remover entrada existente para atualizar posicao
        cache.remove(key)

        // Eviction LRU se necessario (remover entrada mais antiga)
        while (cache.size >= maxEntries) {
            val oldestKey = cache.keys.firstOrNull() ?: break
            cache.remove(oldestKey)
        }

        // Adicionar nova entrada
        val entry = CacheEntry(
            data = data,
            timestamp = DateTimeUtils.currentTimeMillis(),
            ttlMs = ttlMs
        )
        cache[key] = entry
    }

    /**
     * Remove entradas expiradas do cache.
     */
    private fun removeExpiredEntries() {
        val expiredKeys = cache.filter { it.value.isExpired() }.keys.toList()
        expiredKeys.forEach { cache.remove(it) }
    }

    /**
     * Invalida listas que contem um location especifico.
     */
    @Suppress("UNCHECKED_CAST")
    private fun invalidateListsContaining(locationId: String) {
        val keysToRemove = mutableListOf<String>()

        cache.forEach { (key, entry) ->
            if (key.startsWith(KEY_PREFIX_OWNER) || key.startsWith(KEY_PREFIX_SEARCH)) {
                val list = entry.data as? List<*>
                if (list != null) {
                    val containsLocation = list.any { item ->
                        (item as? Location)?.id == locationId
                    }
                    if (containsLocation) {
                        keysToRemove.add(key)
                    }
                }
            }
        }

        keysToRemove.forEach { cache.remove(it) }
    }

    /**
     * Normaliza a query de busca para usar como chave.
     * Remove espacos extras e converte para lowercase.
     */
    private fun normalizeQuery(query: String): String {
        return query.trim().lowercase()
    }
}

/**
 * Estatisticas do cache de locais.
 */
data class LocationCacheStats(
    val totalEntries: Int,
    val maxEntries: Int,
    val locationByIdCount: Int,
    val locationsByOwnerCount: Int,
    val searchResultsCount: Int
) {
    val utilizationPercent: Float
        get() = if (maxEntries > 0) {
            (totalEntries.toFloat() / maxEntries) * 100f
        } else 0f

    override fun toString(): String {
        return "LocationCacheStats(entries=$totalEntries/$maxEntries, " +
                "byId=$locationByIdCount, byOwner=$locationsByOwnerCount, " +
                "search=$searchResultsCount, utilization=${utilizationPercent.toInt()}.${((utilizationPercent * 10).toInt() % 10)}%)"
    }
}
