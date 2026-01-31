package com.futebadosparcas.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * Entidade e DAO para histórico de busca local (Room).
 * Armazena buscas recentes do usuário para sugestões rápidas.
 */

// ==================== Entity ====================

/**
 * Entidade de histórico de busca.
 */
@Entity(tableName = "search_history")
data class SearchHistoryEntity(
    @PrimaryKey
    val id: String,
    val query: String,
    val category: String,  // SearchCategory name
    val timestamp: Long,
    val resultCount: Int = 0
)

/**
 * Entidade de termos de busca populares (cache do servidor).
 */
@Entity(tableName = "popular_searches")
data class PopularSearchEntity(
    @PrimaryKey
    val id: String,
    val term: String,
    val searchCount: Int,
    val lastUpdated: Long
)

// ==================== DAO ====================

/**
 * DAO para operações de histórico de busca.
 */
@Dao
interface SearchHistoryDao {

    // ==================== Histórico do Usuário ====================

    /**
     * Insere ou atualiza uma busca no histórico.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSearch(search: SearchHistoryEntity)

    /**
     * Obtém histórico de buscas ordenado por timestamp.
     */
    @Query("SELECT * FROM search_history ORDER BY timestamp DESC")
    fun getSearchHistory(): Flow<List<SearchHistoryEntity>>

    /**
     * Obtém buscas recentes (limitado).
     */
    @Query("SELECT * FROM search_history ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentSearches(limit: Int = 10): Flow<List<SearchHistoryEntity>>

    /**
     * Obtém buscas por categoria.
     */
    @Query("SELECT * FROM search_history WHERE category = :category ORDER BY timestamp DESC LIMIT :limit")
    fun getSearchesByCategory(category: String, limit: Int = 10): Flow<List<SearchHistoryEntity>>

    /**
     * Busca no histórico por termo.
     */
    @Query("SELECT * FROM search_history WHERE query LIKE '%' || :searchTerm || '%' ORDER BY timestamp DESC LIMIT :limit")
    fun searchInHistory(searchTerm: String, limit: Int = 5): Flow<List<SearchHistoryEntity>>

    /**
     * Verifica se uma busca existe no histórico.
     */
    @Query("SELECT EXISTS(SELECT 1 FROM search_history WHERE query = :query AND category = :category)")
    suspend fun searchExists(query: String, category: String): Boolean

    /**
     * Atualiza o timestamp de uma busca existente.
     */
    @Query("UPDATE search_history SET timestamp = :timestamp, resultCount = :resultCount WHERE query = :query AND category = :category")
    suspend fun updateSearchTimestamp(query: String, category: String, timestamp: Long, resultCount: Int)

    /**
     * Deleta uma busca específica.
     */
    @Delete
    suspend fun deleteSearch(search: SearchHistoryEntity)

    /**
     * Deleta busca por ID.
     */
    @Query("DELETE FROM search_history WHERE id = :id")
    suspend fun deleteSearchById(id: String)

    /**
     * Limpa todo o histórico.
     */
    @Query("DELETE FROM search_history")
    suspend fun clearHistory()

    /**
     * Limpa histórico antigo (mantém últimos N dias).
     */
    @Query("DELETE FROM search_history WHERE timestamp < :cutoffTimestamp")
    suspend fun clearOldHistory(cutoffTimestamp: Long)

    /**
     * Conta total de buscas no histórico.
     */
    @Query("SELECT COUNT(*) FROM search_history")
    suspend fun getHistoryCount(): Int

    /**
     * Mantém apenas as N buscas mais recentes.
     */
    @Query("""
        DELETE FROM search_history
        WHERE id NOT IN (
            SELECT id FROM search_history
            ORDER BY timestamp DESC
            LIMIT :keepCount
        )
    """)
    suspend fun trimHistory(keepCount: Int = 50)

    // ==================== Buscas Populares ====================

    /**
     * Insere ou atualiza termos populares.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPopularSearches(searches: List<PopularSearchEntity>)

    /**
     * Obtém termos populares.
     */
    @Query("SELECT * FROM popular_searches ORDER BY searchCount DESC LIMIT :limit")
    fun getPopularSearches(limit: Int = 10): Flow<List<PopularSearchEntity>>

    /**
     * Limpa cache de buscas populares.
     */
    @Query("DELETE FROM popular_searches")
    suspend fun clearPopularSearches()

    /**
     * Verifica se o cache de populares está atualizado.
     */
    @Query("SELECT MAX(lastUpdated) FROM popular_searches")
    suspend fun getPopularSearchesLastUpdate(): Long?
}

// ==================== Repository Helper ====================

/**
 * Helper para operações comuns de histórico.
 */
object SearchHistoryHelper {

    /**
     * Cria ID único para busca.
     */
    fun createSearchId(query: String, category: String): String {
        return "${query.lowercase().trim()}_$category"
    }

    /**
     * Timestamp de corte para 30 dias atrás.
     */
    fun getThirtyDaysAgoCutoff(): Long {
        return System.currentTimeMillis() - (30L * 24 * 60 * 60 * 1000)
    }

    /**
     * Timestamp de corte para 7 dias atrás.
     */
    fun getSevenDaysAgoCutoff(): Long {
        return System.currentTimeMillis() - (7L * 24 * 60 * 60 * 1000)
    }

    /**
     * Timestamp de corte para 24 horas atrás.
     */
    fun getOneDayAgoCutoff(): Long {
        return System.currentTimeMillis() - (24L * 60 * 60 * 1000)
    }
}

// ==================== Data Classes for UI ====================

/**
 * Modelo de busca recente para UI.
 */
data class RecentSearch(
    val id: String,
    val query: String,
    val category: String,
    val timestamp: Long,
    val resultCount: Int
) {
    companion object {
        fun fromEntity(entity: SearchHistoryEntity): RecentSearch {
            return RecentSearch(
                id = entity.id,
                query = entity.query,
                category = entity.category,
                timestamp = entity.timestamp,
                resultCount = entity.resultCount
            )
        }
    }
}

/**
 * Modelo de termo popular para UI.
 */
data class PopularSearch(
    val term: String,
    val searchCount: Int
) {
    companion object {
        fun fromEntity(entity: PopularSearchEntity): PopularSearch {
            return PopularSearch(
                term = entity.term,
                searchCount = entity.searchCount
            )
        }
    }
}
