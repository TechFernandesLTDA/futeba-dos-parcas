package com.futebadosparcas.data.local

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.local.dao.UserDao
import com.futebadosparcas.util.AppLogger
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

/**
 * Worker para limpeza automatica de cache expirado.
 *
 * TTL configurados:
 * - Usuarios: 24 horas
 * - Jogos ativos: 7 dias
 * - Jogos finalizados: 3 dias
 */
@HiltWorker
class CacheCleanupWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val gameDao: GameDao,
    private val userDao: UserDao
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
            val now = System.currentTimeMillis()

            // Limpar usuarios expirados (> 24h)
            val userExpiration = now - USER_TTL_MS
            userDao.deleteExpiredUsers(userExpiration)

            // Limpar jogos finalizados antigos (> 3 dias)
            val finishedGameExpiration = now - FINISHED_GAME_TTL_MS
            gameDao.deleteOldFinishedGames(finishedGameExpiration)

            // Limpar jogos gerais muito antigos (> 7 dias)
            val gameExpiration = now - GAME_TTL_MS
            gameDao.deleteExpiredGames(gameExpiration)

            AppLogger.d(TAG) { "Cache cleanup completed successfully" }
            Result.success()
        } catch (e: Exception) {
            AppLogger.e(TAG, "Cache cleanup failed", e)
            Result.retry()
        }
    }
}
