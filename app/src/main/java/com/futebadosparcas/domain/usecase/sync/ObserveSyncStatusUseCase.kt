package com.futebadosparcas.domain.usecase.sync

import com.futebadosparcas.data.local.model.LocationSyncEntity
import com.futebadosparcas.domain.sync.LocationSyncManager
import com.futebadosparcas.domain.sync.SyncStatus
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

/**
 * Dados de status de sincronização para a UI.
 *
 * @property pendingCount Número de itens pendentes de sincronização
 * @property failedCount Número de itens que falharam permanentemente
 * @property status Status atual da sincronização
 * @property hasPendingItems Se há itens pendentes (útil para badge)
 */
data class SyncStatusInfo(
    val pendingCount: Int,
    val failedCount: Int,
    val status: SyncStatus,
    val hasPendingItems: Boolean = pendingCount > 0
)

/**
 * Use case para observar o status de sincronização.
 *
 * Expõe informações reativas sobre:
 * - Contagem de itens pendentes (para badge na UI)
 * - Contagem de itens com falha permanente
 * - Status geral da sincronização
 *
 * Exemplo de uso na UI:
 * ```kotlin
 * @Composable
 * fun SyncIndicator(viewModel: MyViewModel) {
 *     val pendingCount by viewModel.pendingCount.collectAsStateWithLifecycle()
 *
 *     if (pendingCount > 0) {
 *         Badge {
 *             Text("$pendingCount")
 *         }
 *     }
 * }
 * ```
 */
class ObserveSyncStatusUseCase @Inject constructor(
    private val syncManager: LocationSyncManager
) {
    /**
     * Flow de contagem de itens pendentes.
     * Ideal para exibir badge na UI.
     */
    val pendingCount: Flow<Int> = syncManager.pendingCount

    /**
     * Flow de contagem de itens com falha permanente.
     */
    val failedCount: Flow<Int> = syncManager.failedCount

    /**
     * Flow de status de sincronização.
     */
    val syncStatus: Flow<SyncStatus> = syncManager.syncStatus

    /**
     * Flow de itens pendentes detalhados.
     */
    val pendingItems: Flow<List<LocationSyncEntity>> = syncManager.pendingItems
}

/**
 * Use case para disparar sincronização manual.
 *
 * Útil para:
 * - Pull-to-refresh
 * - Botão "Sincronizar agora"
 * - Retentativa após erro
 */
class TriggerSyncUseCase @Inject constructor(
    private val syncManager: LocationSyncManager
) {
    /**
     * Dispara sincronização manual.
     */
    operator fun invoke() {
        syncManager.triggerSync()
    }
}

/**
 * Use case para cancelar uma operação pendente.
 */
class CancelPendingSyncUseCase @Inject constructor(
    private val syncManager: LocationSyncManager
) {
    /**
     * Cancela uma operação pendente específica.
     *
     * @param syncItemId ID do item na fila de sincronização
     */
    suspend operator fun invoke(syncItemId: String) {
        syncManager.cancelPendingOperation(syncItemId)
    }
}

/**
 * Use case para limpar itens com falha permanente.
 */
class ClearFailedSyncsUseCase @Inject constructor(
    private val syncManager: LocationSyncManager
) {
    /**
     * Remove todos os itens que falharam permanentemente.
     */
    suspend operator fun invoke() {
        syncManager.clearFailedItems()
    }
}
