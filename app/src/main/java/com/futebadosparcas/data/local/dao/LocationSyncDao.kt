package com.futebadosparcas.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.futebadosparcas.data.local.model.LocationSyncEntity
import com.futebadosparcas.data.local.model.SyncAction
import kotlinx.coroutines.flow.Flow

/**
 * DAO para operações de sincronização de Location.
 *
 * Gerencia a fila de sincronização offline, permitindo:
 * - Enfileirar operações quando offline
 * - Recuperar itens pendentes quando online
 * - Rastrear tentativas e erros de sincronização
 */
@Dao
interface LocationSyncDao {

    /**
     * Obtém todos os itens pendentes de sincronização, ordenados por timestamp (FIFO).
     * Retorna um Flow para observação reativa.
     */
    @Query("SELECT * FROM location_sync_queue ORDER BY timestamp ASC")
    fun getPendingSyncs(): Flow<List<LocationSyncEntity>>

    /**
     * Obtém todos os itens pendentes como snapshot (não reativo).
     */
    @Query("SELECT * FROM location_sync_queue ORDER BY timestamp ASC")
    suspend fun getPendingSyncsSnapshot(): List<LocationSyncEntity>

    /**
     * Obtém itens prontos para sincronização (nextRetryAt <= agora).
     */
    @Query("SELECT * FROM location_sync_queue WHERE nextRetryAt <= :currentTime ORDER BY timestamp ASC")
    suspend fun getReadyToSync(currentTime: Long = System.currentTimeMillis()): List<LocationSyncEntity>

    /**
     * Obtém a contagem de itens pendentes de sincronização.
     * Útil para mostrar badge de "pendente" na UI.
     */
    @Query("SELECT COUNT(*) FROM location_sync_queue")
    fun getPendingCount(): Flow<Int>

    /**
     * Obtém a contagem de itens pendentes como snapshot.
     */
    @Query("SELECT COUNT(*) FROM location_sync_queue")
    suspend fun getPendingCountSnapshot(): Int

    /**
     * Obtém itens por locationId.
     * Útil para verificar se já existe uma operação pendente para um location específico.
     */
    @Query("SELECT * FROM location_sync_queue WHERE locationId = :locationId")
    suspend fun getByLocationId(locationId: String): List<LocationSyncEntity>

    /**
     * Obtém um item específico pelo ID.
     */
    @Query("SELECT * FROM location_sync_queue WHERE id = :id")
    suspend fun getById(id: String): LocationSyncEntity?

    /**
     * Insere um novo item na fila de sincronização.
     * Se já existir um item com o mesmo ID, substitui.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: LocationSyncEntity)

    /**
     * Insere múltiplos itens na fila.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<LocationSyncEntity>)

    /**
     * Atualiza um item existente na fila.
     */
    @Update
    suspend fun update(item: LocationSyncEntity)

    /**
     * Remove um item da fila (após sincronização bem-sucedida).
     */
    @Delete
    suspend fun delete(item: LocationSyncEntity)

    /**
     * Remove um item pelo ID.
     */
    @Query("DELETE FROM location_sync_queue WHERE id = :id")
    suspend fun deleteById(id: String)

    /**
     * Remove todos os itens de um location específico.
     * Útil quando o location é deletado localmente.
     */
    @Query("DELETE FROM location_sync_queue WHERE locationId = :locationId")
    suspend fun deleteByLocationId(locationId: String)

    /**
     * Incrementa o contador de tentativas e atualiza o erro e próximo retry.
     */
    @Query("""
        UPDATE location_sync_queue
        SET retryCount = retryCount + 1,
            lastError = :error,
            nextRetryAt = :nextRetryAt
        WHERE id = :id
    """)
    suspend fun incrementRetry(id: String, error: String, nextRetryAt: Long)

    /**
     * Limpa itens que excederam o número máximo de tentativas.
     * Estes itens são considerados "falhados permanentemente".
     */
    @Query("DELETE FROM location_sync_queue WHERE retryCount >= :maxRetries")
    suspend fun clearFailedItems(maxRetries: Int = LocationSyncEntity.MAX_RETRY_COUNT)

    /**
     * Obtém itens que falharam (excederam MAX_RETRY_COUNT).
     * Útil para exibir ao usuário ou logging.
     */
    @Query("SELECT * FROM location_sync_queue WHERE retryCount >= :maxRetries")
    suspend fun getFailedItems(maxRetries: Int = LocationSyncEntity.MAX_RETRY_COUNT): List<LocationSyncEntity>

    /**
     * Contagem de itens com falha.
     */
    @Query("SELECT COUNT(*) FROM location_sync_queue WHERE retryCount >= :maxRetries")
    fun getFailedCount(maxRetries: Int = LocationSyncEntity.MAX_RETRY_COUNT): Flow<Int>

    /**
     * Limpa toda a fila de sincronização.
     * CUIDADO: usar apenas para reset completo ou testes.
     */
    @Query("DELETE FROM location_sync_queue")
    suspend fun clearAll()

    /**
     * Remove itens antigos que foram enfileirados há mais de X dias.
     * Limpeza de manutenção para evitar acúmulo de dados antigos.
     */
    @Query("DELETE FROM location_sync_queue WHERE timestamp < :expirationTime")
    suspend fun deleteExpiredItems(expirationTime: Long)

    /**
     * Verifica se existe operação pendente do tipo específico para um location.
     */
    @Query("SELECT COUNT(*) FROM location_sync_queue WHERE locationId = :locationId AND action = :action")
    suspend fun hasOperationPending(locationId: String, action: SyncAction): Int

    /**
     * Cancela operações CREATE pendentes se houver DELETE posterior.
     * Otimização para evitar criar e depois deletar.
     */
    @Query("""
        DELETE FROM location_sync_queue
        WHERE locationId = :locationId
        AND action = 'CREATE'
        AND EXISTS (
            SELECT 1 FROM location_sync_queue sq2
            WHERE sq2.locationId = :locationId
            AND sq2.action = 'DELETE'
            AND sq2.timestamp > location_sync_queue.timestamp
        )
    """)
    suspend fun cancelCreateIfDeleteExists(locationId: String)
}
