package com.futebadosparcas.domain.sync

import com.futebadosparcas.data.local.dao.LocationSyncDao
import com.futebadosparcas.data.local.model.LocationSyncEntity
import com.futebadosparcas.data.local.model.SyncAction
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.NetworkMonitor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import com.google.gson.Gson

/**
 * Status da sincronização de Locations.
 */
sealed class SyncStatus {
    /** Sem itens pendentes */
    data object Idle : SyncStatus()

    /** Sincronização em andamento */
    data class Syncing(val progress: Int, val total: Int) : SyncStatus()

    /** Sincronização completa com sucesso */
    data class Success(val syncedCount: Int) : SyncStatus()

    /** Erro durante sincronização */
    data class Error(val message: String, val pendingCount: Int) : SyncStatus()

    /** Offline - aguardando conectividade */
    data class Offline(val pendingCount: Int) : SyncStatus()
}

/**
 * Resultado da sincronização de um item individual.
 */
data class SyncItemResult(
    val syncItem: LocationSyncEntity,
    val success: Boolean,
    val error: String? = null
)

/**
 * Gerenciador de sincronização offline para Location.
 *
 * Responsabilidades:
 * - Enfileirar operações quando offline
 * - Sincronizar automaticamente quando online
 * - Implementar exponential backoff (10s, 60s, 300s)
 * - Otimizar operações conflitantes (ex: CREATE seguido de DELETE)
 * - Expor contagem de pendentes para UI (badge)
 *
 * Uso:
 * ```kotlin
 * lateinit var syncManager: LocationSyncManager
 *
 * // Enfileirar operação offline
 * syncManager.queueCreate(location)
 * syncManager.queueUpdate(location)
 * syncManager.queueDelete(locationId)
 *
 * // Observar status
 * syncManager.syncStatus.collect { status ->
 *     when (status) {
 *         is SyncStatus.Offline -> showBadge(status.pendingCount)
 *         is SyncStatus.Syncing -> showProgress(status.progress, status.total)
 *         // ...
 *     }
 * }
 * ```
 */
class LocationSyncManager constructor(
    private val locationSyncDao: LocationSyncDao,
    private val locationRepository: LocationRepository,
    private val networkMonitor: NetworkMonitor
) {
    companion object {
        private const val TAG = "LocationSyncManager"

        /** Intervalo mínimo entre tentativas de sync batch */
        private const val MIN_SYNC_INTERVAL_MS = 5_000L

        /** TTL para itens na fila (7 dias) */
        private const val QUEUE_ITEM_TTL_MS = 7 * 24 * 60 * 60 * 1000L
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val gson = Gson()

    // Estado interno
    private var syncJob: Job? = null
    private var lastSyncAttempt: Long = 0

    // Status de sincronização
    private val _syncStatus = MutableStateFlow<SyncStatus>(SyncStatus.Idle)
    val syncStatus: StateFlow<SyncStatus> = _syncStatus.asStateFlow()

    // Contagem de itens pendentes (Flow reativo)
    val pendingCount: Flow<Int> = locationSyncDao.getPendingCount()

    // Contagem de itens com falha permanente
    val failedCount: Flow<Int> = locationSyncDao.getFailedCount()

    // Itens pendentes (Flow reativo)
    val pendingItems: Flow<List<LocationSyncEntity>> = locationSyncDao.getPendingSyncs()

    init {
        // Observar conectividade e iniciar sync quando online
        scope.launch {
            networkMonitor.isConnected.collect { isConnected ->
                if (isConnected) {
                    AppLogger.d(TAG) { "Conectividade restaurada - iniciando sincronização" }
                    triggerSync()
                } else {
                    updateStatusForOffline()
                }
            }
        }

        // Cleanup periódico de itens expirados
        scope.launch {
            while (true) {
                delay(60 * 60 * 1000L) // A cada hora
                cleanupExpiredItems()
            }
        }
    }

    // ========== API PÚBLICA - Enfileiramento ==========

    /**
     * Enfileira uma operação CREATE para sincronização.
     *
     * @param location Location a ser criado
     * @return ID do item na fila
     */
    suspend fun queueCreate(location: Location): String {
        val syncItem = createSyncItem(location.id, SyncAction.CREATE, location)
        locationSyncDao.insert(syncItem)
        AppLogger.d(TAG) { "CREATE enfileirado: ${location.id} - ${location.name}" }
        updateStatusForOffline()
        return syncItem.id
    }

    /**
     * Enfileira uma operação UPDATE para sincronização.
     *
     * Otimização: Se já existir um CREATE pendente para este location,
     * atualiza os dados do CREATE ao invés de criar UPDATE separado.
     *
     * @param location Location a ser atualizado
     * @return ID do item na fila
     */
    suspend fun queueUpdate(location: Location): String {
        // Verificar se já existe CREATE pendente para este location
        val existingItems = locationSyncDao.getByLocationId(location.id)
        val existingCreate = existingItems.find { it.action == SyncAction.CREATE }

        if (existingCreate != null) {
            // Atualizar o CREATE existente com os novos dados
            val updatedItem = existingCreate.copy(
                locationJson = gson.toJson(location),
                timestamp = System.currentTimeMillis()
            )
            locationSyncDao.update(updatedItem)
            AppLogger.d(TAG) { "CREATE existente atualizado: ${location.id}" }
            return existingCreate.id
        }

        // Caso contrário, criar UPDATE
        val syncItem = createSyncItem(location.id, SyncAction.UPDATE, location)
        locationSyncDao.insert(syncItem)
        AppLogger.d(TAG) { "UPDATE enfileirado: ${location.id}" }
        updateStatusForOffline()
        return syncItem.id
    }

    /**
     * Enfileira uma operação DELETE para sincronização.
     *
     * Otimização: Se existir CREATE pendente para este location,
     * ambos são cancelados (location nunca foi sincronizado).
     *
     * @param locationId ID do Location a ser deletado
     * @return ID do item na fila (ou null se operação foi otimizada)
     */
    suspend fun queueDelete(locationId: String): String? {
        // Verificar se existe CREATE pendente
        val existingItems = locationSyncDao.getByLocationId(locationId)
        val existingCreate = existingItems.find { it.action == SyncAction.CREATE }

        if (existingCreate != null) {
            // Location nunca foi sincronizado - cancelar CREATE
            locationSyncDao.deleteByLocationId(locationId)
            AppLogger.d(TAG) { "CREATE cancelado por DELETE: $locationId" }
            updateStatusForOffline()
            return null
        }

        // Remover UPDATEs pendentes (DELETE vai sobrescrever)
        existingItems.filter { it.action == SyncAction.UPDATE }.forEach {
            locationSyncDao.delete(it)
        }

        val syncItem = createSyncItem(locationId, SyncAction.DELETE, null)
        locationSyncDao.insert(syncItem)
        AppLogger.d(TAG) { "DELETE enfileirado: $locationId" }
        updateStatusForOffline()
        return syncItem.id
    }

    // ========== API PÚBLICA - Sincronização ==========

    /**
     * Dispara sincronização manual.
     * Útil para pull-to-refresh ou botão de "sincronizar agora".
     */
    fun triggerSync() {
        if (!networkMonitor.isCurrentlyConnected()) {
            AppLogger.d(TAG) { "Sync ignorado - sem conectividade" }
            return
        }

        // Throttle para evitar múltiplas chamadas
        val now = System.currentTimeMillis()
        if (now - lastSyncAttempt < MIN_SYNC_INTERVAL_MS) {
            AppLogger.d(TAG) { "Sync throttled - aguarde ${MIN_SYNC_INTERVAL_MS}ms entre tentativas" }
            return
        }
        lastSyncAttempt = now

        // Cancelar sync anterior se existir
        syncJob?.cancel()

        syncJob = scope.launch {
            performSync()
        }
    }

    /**
     * Cancela uma operação pendente específica.
     */
    suspend fun cancelPendingOperation(syncItemId: String) {
        locationSyncDao.deleteById(syncItemId)
        AppLogger.d(TAG) { "Operação pendente cancelada: $syncItemId" }
        updateStatusForOffline()
    }

    /**
     * Remove todos os itens com falha permanente.
     */
    suspend fun clearFailedItems() {
        locationSyncDao.clearFailedItems()
        AppLogger.d(TAG) { "Itens com falha permanente removidos" }
    }

    /**
     * Limpa toda a fila de sincronização.
     * CUIDADO: Usar apenas para reset completo.
     */
    suspend fun clearAllPending() {
        locationSyncDao.clearAll()
        _syncStatus.value = SyncStatus.Idle
        AppLogger.w(TAG) { "Fila de sincronização limpa completamente" }
    }

    // ========== LÓGICA INTERNA ==========

    /**
     * Cria um item de sincronização.
     */
    private fun createSyncItem(
        locationId: String,
        action: SyncAction,
        location: Location?
    ): LocationSyncEntity {
        val locationJson = location?.let { gson.toJson(it) } ?: "{}"
        return LocationSyncEntity(
            locationId = locationId,
            action = action,
            locationJson = locationJson
        )
    }

    /**
     * Executa a sincronização de todos os itens pendentes.
     */
    private suspend fun performSync() {
        val pendingItems = locationSyncDao.getReadyToSync()

        if (pendingItems.isEmpty()) {
            _syncStatus.value = SyncStatus.Idle
            return
        }

        AppLogger.d(TAG) { "Iniciando sync de ${pendingItems.size} itens" }
        _syncStatus.value = SyncStatus.Syncing(0, pendingItems.size)

        var successCount = 0
        var errorCount = 0

        pendingItems.forEachIndexed { index, item ->
            val result = syncItem(item)

            if (result.success) {
                successCount++
                locationSyncDao.delete(item)
            } else {
                errorCount++
                handleSyncError(item, result.error ?: "Erro desconhecido")
            }

            _syncStatus.value = SyncStatus.Syncing(index + 1, pendingItems.size)
        }

        // Atualizar status final
        val remainingCount = locationSyncDao.getPendingCountSnapshot()
        _syncStatus.value = when {
            remainingCount == 0 -> SyncStatus.Success(successCount)
            errorCount > 0 -> SyncStatus.Error(
                "Falha em $errorCount de ${pendingItems.size} itens",
                remainingCount
            )
            else -> SyncStatus.Idle
        }

        AppLogger.d(TAG) { "Sync completo: $successCount sucesso, $errorCount erro, $remainingCount restantes" }
    }

    /**
     * Sincroniza um item individual.
     */
    private suspend fun syncItem(item: LocationSyncEntity): SyncItemResult {
        return try {
            when (item.action) {
                SyncAction.CREATE -> {
                    val location = gson.fromJson(item.locationJson, Location::class.java)
                    val result = locationRepository.createLocation(location)
                    result.fold(
                        onSuccess = { SyncItemResult(item, true) },
                        onFailure = { SyncItemResult(item, false, it.message) }
                    )
                }
                SyncAction.UPDATE -> {
                    val location = gson.fromJson(item.locationJson, Location::class.java)
                    val result = locationRepository.updateLocation(location)
                    result.fold(
                        onSuccess = { SyncItemResult(item, true) },
                        onFailure = { SyncItemResult(item, false, it.message) }
                    )
                }
                SyncAction.DELETE -> {
                    val result = locationRepository.deleteLocation(item.locationId)
                    result.fold(
                        onSuccess = { SyncItemResult(item, true) },
                        onFailure = { SyncItemResult(item, false, it.message) }
                    )
                }
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao sincronizar item ${item.id}", e)
            SyncItemResult(item, false, e.message)
        }
    }

    /**
     * Trata erro de sincronização com exponential backoff.
     */
    private suspend fun handleSyncError(item: LocationSyncEntity, error: String) {
        if (!item.canRetry()) {
            AppLogger.e(TAG, "Item ${item.id} excedeu tentativas máximas: $error")
            return // Deixa o item para ser tratado como falha permanente
        }

        val nextRetryAt = System.currentTimeMillis() + item.getNextBackoffDelay()
        locationSyncDao.incrementRetry(item.id, error, nextRetryAt)

        AppLogger.w(TAG) {
            "Item ${item.id} falhou (tentativa ${item.retryCount + 1}/${LocationSyncEntity.MAX_RETRY_COUNT}). " +
            "Próximo retry em ${item.getNextBackoffDelay() / 1000}s. Erro: $error"
        }

        // Agendar próxima tentativa
        scheduleRetry(item.getNextBackoffDelay())
    }

    /**
     * Agenda uma nova tentativa de sync após delay.
     */
    private fun scheduleRetry(delayMs: Long) {
        scope.launch {
            delay(delayMs)
            if (networkMonitor.isCurrentlyConnected()) {
                triggerSync()
            }
        }
    }

    /**
     * Atualiza o status para modo offline.
     */
    private suspend fun updateStatusForOffline() {
        val count = locationSyncDao.getPendingCountSnapshot()
        if (count > 0 && !networkMonitor.isCurrentlyConnected()) {
            _syncStatus.value = SyncStatus.Offline(count)
        } else if (count > 0) {
            // Online mas com pendências - pode ter falhado
            _syncStatus.value = SyncStatus.Error("Pendências de sincronização", count)
        } else {
            _syncStatus.value = SyncStatus.Idle
        }
    }

    /**
     * Limpa itens expirados da fila.
     */
    private suspend fun cleanupExpiredItems() {
        val expirationTime = System.currentTimeMillis() - QUEUE_ITEM_TTL_MS
        locationSyncDao.deleteExpiredItems(expirationTime)
        AppLogger.d(TAG) { "Limpeza de itens expirados concluída" }
    }
}
