package com.futebadosparcas.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.futebadosparcas.data.local.model.GroupEntity
import kotlinx.coroutines.flow.Flow

/**
 * DAO para operações de cache de grupos
 *
 * Implementa pattern de cache offline-first com TTL
 */
@Dao
interface GroupDao {

    /**
     * Insere ou atualiza um grupo no cache
     * OnConflict REPLACE: substitui se já existir
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(group: GroupEntity)

    /**
     * Insere múltiplos grupos em batch
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(groups: List<GroupEntity>)

    /**
     * Busca um grupo pelo ID
     * Retorna null se não existir
     */
    @Query("SELECT * FROM groups WHERE id = :groupId LIMIT 1")
    suspend fun getById(groupId: String): GroupEntity?

    /**
     * Busca um grupo pelo ID como Flow (reativo)
     */
    @Query("SELECT * FROM groups WHERE id = :groupId LIMIT 1")
    fun getByIdFlow(groupId: String): Flow<GroupEntity?>

    /**
     * Busca todos os grupos do cache
     * Ordenados por nome
     */
    @Query("SELECT * FROM groups ORDER BY name ASC")
    fun getAllFlow(): Flow<List<GroupEntity>>

    /**
     * Busca grupos por status
     * Exemplo: status = "ACTIVE"
     */
    @Query("SELECT * FROM groups WHERE status = :status ORDER BY name ASC")
    fun getByStatusFlow(status: String): Flow<List<GroupEntity>>

    /**
     * Busca grupos de um owner específico
     */
    @Query("SELECT * FROM groups WHERE ownerId = :ownerId ORDER BY name ASC")
    fun getByOwnerFlow(ownerId: String): Flow<List<GroupEntity>>

    /**
     * Deleta um grupo do cache
     */
    @Query("DELETE FROM groups WHERE id = :groupId")
    suspend fun delete(groupId: String)

    /**
     * Deleta grupos expirados (TTL)
     */
    @Query("DELETE FROM groups WHERE cachedAt < :cutoffTimestamp")
    suspend fun deleteExpired(cutoffTimestamp: Long)

    /**
     * Limpa todo o cache de grupos
     */
    @Query("DELETE FROM groups")
    suspend fun deleteAll()

    /**
     * Conta quantos grupos estão no cache
     */
    @Query("SELECT COUNT(*) FROM groups")
    suspend fun getCount(): Int

    /**
     * Conta quantos grupos ativos estão no cache
     */
    @Query("SELECT COUNT(*) FROM groups WHERE status = 'ACTIVE'")
    suspend fun getActiveCount(): Int

    /**
     * Busca grupos expirados (para cleanup)
     */
    @Query("SELECT * FROM groups WHERE cachedAt < :cutoffTimestamp")
    suspend fun getExpired(cutoffTimestamp: Long): List<GroupEntity>
}
