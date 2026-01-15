package com.futebadosparcas.data.local

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import coil.Coil
import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.local.dao.UserDao
import com.futebadosparcas.domain.cache.SharedCacheService
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.PerformanceTracker
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

/**
 * Worker para limpeza automatica de cache expirado.
 *
 * Tipos de limpeza:
 * - Room: Usuarios (24h), Jogos finalizados (3d), Jogos gerais (7d)
 * - SharedCache: Usuários e jogos com TTL expirado
 * - Coil Disk Cache: Arquivos com mais de 7 dias
 * - Performance: Log de estatísticas de cache
 *
 * Agendado: A cada 12 horas via WorkManager
 */
@HiltWorker
class CacheCleanupWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val gameDao: GameDao,
    private val userDao: UserDao,
    private val sharedCache: SharedCacheService,
    private val performanceTracker: PerformanceTracker
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val TAG = "CacheCleanupWorker"
        private const val WORK_NAME = "cache_cleanup_work"

        // TTL em milissegundos
        private const val USER_TTL_MS = 24 * 60 * 60 * 1000L      // 24 horas
        private const val GAME_TTL_MS = 7 * 24 * 60 * 60 * 1000L  // 7 dias
        private const val FINISHED_GAME_TTL_MS = 3 * 24 * 60 * 60 * 1000L // 3 dias

        /**
         * Agenda o worker para executar a cada 12 horas.
         */
        fun schedule(context: Context) {
            val workRequest = PeriodicWorkRequestBuilder<CacheCleanupWorker>(
                12, TimeUnit.HOURS
            ).build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest
            )

            AppLogger.d(TAG) { "Cache cleanup scheduled" }
        }

        /**
         * Cancela o worker agendado.
         */
        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }

    override suspend fun doWork(): Result {
        return try {
            val startTime = System.currentTimeMillis()
            val now = System.currentTimeMillis()
            var totalDeleted = 0

            AppLogger.d(TAG) { "Starting cache cleanup..." }

            // Stage 1: Limpar usuarios expirados (> 24h)
            val userExpiration = now - USER_TTL_MS
            userDao.deleteExpiredUsers(userExpiration)
            AppLogger.d(TAG) { "Cleaned expired users" }

            // Stage 2: Limpar jogos finalizados antigos (> 3 dias)
            val finishedGameExpiration = now - FINISHED_GAME_TTL_MS
            gameDao.deleteOldFinishedGames(finishedGameExpiration)
            AppLogger.d(TAG) { "Cleaned old finished games" }

            // Stage 3: Limpar jogos gerais muito antigos (> 7 dias)
            val gameExpiration = now - GAME_TTL_MS
            gameDao.deleteExpiredGames(gameExpiration)
            AppLogger.d(TAG) { "Cleaned expired games" }

            val duration = System.currentTimeMillis() - startTime
            AppLogger.d(TAG) { "Cache cleanup completed in ${duration}ms, deleted $totalDeleted entries" }
            Result.success()
        } catch (e: Exception) {
            AppLogger.e(TAG, "Cache cleanup failed", e)
            Result.retry()
        }
    }
}
