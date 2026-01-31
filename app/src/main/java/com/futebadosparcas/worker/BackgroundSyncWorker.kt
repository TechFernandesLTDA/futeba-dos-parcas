package com.futebadosparcas.worker

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * Worker para sincronização em background.
 * Mantém dados atualizados mesmo quando o app não está em uso.
 */

// ==================== Constants ====================

object SyncWorkConstants {
    const val WORK_NAME_PERIODIC = "periodic_sync"
    const val WORK_NAME_IMMEDIATE = "immediate_sync"

    // Keys para input data
    const val KEY_USER_ID = "user_id"
    const val KEY_SYNC_TYPE = "sync_type"
    const val KEY_FORCE_REFRESH = "force_refresh"

    // Keys para output data
    const val KEY_SYNC_RESULT = "sync_result"
    const val KEY_ITEMS_SYNCED = "items_synced"
    const val KEY_LAST_SYNC_TIME = "last_sync_time"
}

// ==================== Sync Types ====================

/**
 * Tipos de sincronização disponíveis.
 */
enum class SyncType {
    FULL,               // Sincroniza tudo
    GAMES,              // Apenas jogos
    NOTIFICATIONS,      // Apenas notificações
    STATISTICS,         // Apenas estatísticas
    USER_PROFILE,       // Apenas perfil do usuário
    GROUP_DATA          // Dados dos grupos
}

/**
 * Resultado da sincronização.
 */
enum class SyncResult {
    SUCCESS,
    PARTIAL_SUCCESS,    // Alguns itens sincronizados
    NO_DATA,            // Sem dados para sincronizar
    NETWORK_ERROR,
    AUTH_ERROR,
    UNKNOWN_ERROR
}

// ==================== Main Worker ====================

/**
 * Worker principal de sincronização em background.
 */
class BackgroundSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val userId = inputData.getString(SyncWorkConstants.KEY_USER_ID)
        val syncTypeStr = inputData.getString(SyncWorkConstants.KEY_SYNC_TYPE)
        val forceRefresh = inputData.getBoolean(SyncWorkConstants.KEY_FORCE_REFRESH, false)

        if (userId.isNullOrEmpty()) {
            return@withContext Result.failure(
                workDataOf(SyncWorkConstants.KEY_SYNC_RESULT to SyncResult.AUTH_ERROR.name)
            )
        }

        val syncType = try {
            SyncType.valueOf(syncTypeStr ?: SyncType.FULL.name)
        } catch (e: Exception) {
            SyncType.FULL
        }

        try {
            val (result, itemsSynced) = performSync(userId, syncType, forceRefresh)

            when (result) {
                SyncResult.SUCCESS, SyncResult.PARTIAL_SUCCESS -> {
                    Result.success(
                        workDataOf(
                            SyncWorkConstants.KEY_SYNC_RESULT to result.name,
                            SyncWorkConstants.KEY_ITEMS_SYNCED to itemsSynced,
                            SyncWorkConstants.KEY_LAST_SYNC_TIME to System.currentTimeMillis()
                        )
                    )
                }
                SyncResult.NO_DATA -> {
                    Result.success(
                        workDataOf(
                            SyncWorkConstants.KEY_SYNC_RESULT to result.name,
                            SyncWorkConstants.KEY_ITEMS_SYNCED to 0
                        )
                    )
                }
                SyncResult.NETWORK_ERROR -> {
                    // Retry para erros de rede
                    if (runAttemptCount < 3) {
                        Result.retry()
                    } else {
                        Result.failure(
                            workDataOf(SyncWorkConstants.KEY_SYNC_RESULT to result.name)
                        )
                    }
                }
                else -> {
                    Result.failure(
                        workDataOf(SyncWorkConstants.KEY_SYNC_RESULT to result.name)
                    )
                }
            }
        } catch (e: Exception) {
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure(
                    workDataOf(
                        SyncWorkConstants.KEY_SYNC_RESULT to SyncResult.UNKNOWN_ERROR.name
                    )
                )
            }
        }
    }

    /**
     * Executa a sincronização real.
     */
    private suspend fun performSync(
        userId: String,
        syncType: SyncType,
        forceRefresh: Boolean
    ): Pair<SyncResult, Int> {
        // Em produção, chamar repositórios reais
        // Exemplo simplificado:

        var totalSynced = 0

        when (syncType) {
            SyncType.FULL -> {
                totalSynced += syncGames(userId)
                totalSynced += syncNotifications(userId)
                totalSynced += syncStatistics(userId)
                totalSynced += syncUserProfile(userId)
                totalSynced += syncGroupData(userId)
            }
            SyncType.GAMES -> {
                totalSynced = syncGames(userId)
            }
            SyncType.NOTIFICATIONS -> {
                totalSynced = syncNotifications(userId)
            }
            SyncType.STATISTICS -> {
                totalSynced = syncStatistics(userId)
            }
            SyncType.USER_PROFILE -> {
                totalSynced = syncUserProfile(userId)
            }
            SyncType.GROUP_DATA -> {
                totalSynced = syncGroupData(userId)
            }
        }

        return if (totalSynced > 0) {
            Pair(SyncResult.SUCCESS, totalSynced)
        } else {
            Pair(SyncResult.NO_DATA, 0)
        }
    }

    // Métodos de sincronização individuais (placeholders)
    private suspend fun syncGames(userId: String): Int = 0
    private suspend fun syncNotifications(userId: String): Int = 0
    private suspend fun syncStatistics(userId: String): Int = 0
    private suspend fun syncUserProfile(userId: String): Int = 0
    private suspend fun syncGroupData(userId: String): Int = 0
}

// ==================== Work Manager Helper ====================

/**
 * Helper para agendar e gerenciar sincronização.
 */
object SyncWorkManager {

    /**
     * Agenda sincronização periódica.
     */
    fun schedulePeriodicSync(
        context: Context,
        userId: String,
        intervalHours: Long = 6,
        syncType: SyncType = SyncType.FULL,
        requiresWifi: Boolean = false
    ) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(
                if (requiresWifi) NetworkType.UNMETERED else NetworkType.CONNECTED
            )
            .setRequiresBatteryNotLow(true)
            .build()

        val syncRequest = PeriodicWorkRequestBuilder<BackgroundSyncWorker>(
            intervalHours, TimeUnit.HOURS
        )
            .setConstraints(constraints)
            .setInputData(
                workDataOf(
                    SyncWorkConstants.KEY_USER_ID to userId,
                    SyncWorkConstants.KEY_SYNC_TYPE to syncType.name
                )
            )
            .addTag("sync")
            .build()

        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(
                SyncWorkConstants.WORK_NAME_PERIODIC,
                ExistingPeriodicWorkPolicy.UPDATE,
                syncRequest
            )
    }

    /**
     * Executa sincronização imediata.
     */
    fun syncNow(
        context: Context,
        userId: String,
        syncType: SyncType = SyncType.FULL,
        forceRefresh: Boolean = true
    ) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = OneTimeWorkRequestBuilder<BackgroundSyncWorker>()
            .setConstraints(constraints)
            .setInputData(
                workDataOf(
                    SyncWorkConstants.KEY_USER_ID to userId,
                    SyncWorkConstants.KEY_SYNC_TYPE to syncType.name,
                    SyncWorkConstants.KEY_FORCE_REFRESH to forceRefresh
                )
            )
            .addTag("immediate_sync")
            .build()

        WorkManager.getInstance(context)
            .enqueue(syncRequest)
    }

    /**
     * Cancela todas as sincronizações agendadas.
     */
    fun cancelAllSync(context: Context) {
        WorkManager.getInstance(context).cancelAllWorkByTag("sync")
    }

    /**
     * Cancela sincronização periódica.
     */
    fun cancelPeriodicSync(context: Context) {
        WorkManager.getInstance(context)
            .cancelUniqueWork(SyncWorkConstants.WORK_NAME_PERIODIC)
    }

    /**
     * Verifica se sincronização está agendada.
     */
    fun isSyncScheduled(context: Context): Boolean {
        val workInfos = WorkManager.getInstance(context)
            .getWorkInfosForUniqueWork(SyncWorkConstants.WORK_NAME_PERIODIC)
            .get()

        return workInfos.any { !it.state.isFinished }
    }
}

// ==================== Sync Status ====================

/**
 * Status detalhado da última sincronização.
 */
data class SyncStatus(
    val lastSyncTime: Long?,
    val lastResult: SyncResult?,
    val itemsSynced: Int,
    val isScheduled: Boolean,
    val isSyncing: Boolean
)
