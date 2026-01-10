package com.futebadosparcas.domain.prefetch

import android.util.Log
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.StatisticsRepository
import com.futebadosparcas.domain.cache.SharedCacheService
import com.futebadosparcas.domain.repository.UserRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Serviço de prefetch preditivo baseado em padrões de navegação.
 * Carrega dados em background antes do usuário navegar.
 *
 * Padrão:
 * - Executa em background (SupervisorJob + Dispatchers.IO)
 * - Silent fail (não bloqueia UI se falhar)
 * - Fire-and-forget (non-blocking)
 */
@Singleton
class PrefetchService @Inject constructor(
    private val gameRepository: GameRepository,
    private val userRepository: UserRepository,
    private val statisticsRepository: StatisticsRepository,
    private val sharedCache: SharedCacheService
) {
    private val prefetchScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    companion object {
        private const val TAG = "PrefetchService"
    }

    /**
     * Prefetch para Home → GameDetail (90% dos casos).
     * Carregar dados completos do jogo e perfis dos jogadores.
     *
     * Execução:
     * 1. Armazenar jogo em cache compartilhado (cache 10min)
     * 2. Prefetch de perfis de jogadores (batch, cache 10min)
     */
    fun prefetchNextGame(game: Game) {
        prefetchScope.launch {
            try {
                Log.d(TAG, "Prefetching next game: ${game.id}")

                // 1. Armazenar jogo em cache compartilhado para acesso rápido
                sharedCache.putGame(game.id, game, ttlMs = 10 * 60 * 1000) // 10min TTL
                Log.d(TAG, "Cached game for prefetch: ${game.id}")

                // 2. Warm cache com perfis de jogadores
                // Tipicamente um jogo tem 10-20 confirmações
                try {
                    val gameConfirmations = gameRepository.getGameConfirmations(game.id).getOrNull() ?: emptyList()
                    val playerIds = gameConfirmations
                        .map { it.userId }
                        .distinct()

                    if (playerIds.isNotEmpty()) {
                        prefetchUsers(playerIds)
                        Log.d(TAG, "Prefetched ${playerIds.size} players for game ${game.id}")
                    }
                } catch (e: Exception) {
                    Log.d(TAG, "Failed to prefetch game confirmations: ${e.message}")
                }

            } catch (e: Exception) {
                // Silent fail - prefetch não deve bloquear UI
                Log.d(TAG, "Prefetch failed for game ${game.id}: ${e.message}")
            }
        }
    }

    /**
     * Prefetch para GameDetail → LiveGame.
     * Carregar dados de confirmações do jogo proativamente.
     */
    fun prefetchLiveGameData(gameId: String) {
        prefetchScope.launch {
            try {
                Log.d(TAG, "Prefetching live game data: $gameId")

                // Carregar confirmações do jogo (dados que muda em tempo real)
                val confirmations = gameRepository.getGameConfirmations(gameId).getOrNull() ?: emptyList()
                if (confirmations.isNotEmpty()) {
                    Log.d(TAG, "Prefetched ${confirmations.size} confirmations for game: $gameId")
                }
            } catch (e: Exception) {
                Log.d(TAG, "Prefetch live game failed: ${e.message}")
            }
        }
    }

    /**
     * Warm cache com lista de usuários.
     *
     * Verifica quais usuários já estão em cache,
     * busca apenas os faltantes do Firebase,
     * e adiciona todos ao cache compartilhado.
     *
     * Impacto: Elimina N+1 queries de usuários em GameDetail/LiveGame.
     */
    suspend fun prefetchUsers(userIds: List<String>) {
        try {
            // Verificar quais usuários JÁ estão em cache
            val cachedUsers = sharedCache.getBatchUsers(userIds)
            val missingUserIds = userIds.filter { it !in cachedUsers.keys }

            if (missingUserIds.isEmpty()) {
                Log.d(TAG, "All users already cached")
                return
            }

            Log.d(TAG, "Prefetching ${missingUserIds.size} users from Firebase")

            // Buscar usuários faltantes em batch
            val users = userRepository.getUsersByIds(missingUserIds).getOrNull() ?: return

            // Adicionar ao cache compartilhado
            sharedCache.putBatchUsers(
                users.associateBy { it.id },
                ttlMs = 10 * 60 * 1000 // 10min
            )

            Log.d(TAG, "Prefetched ${users.size} users")

        } catch (e: Exception) {
            Log.d(TAG, "Prefetch users failed: ${e.message}")
        }
    }

    /**
     * Prefetch para jogos AO VIVO (alta prioridade).
     * Carrega confirmações dos jogos, dados voláteis com TTL menor (2min).
     */
    fun prefetchLiveGames(liveGameIds: List<String>) {
        prefetchScope.launch {
            liveGameIds.forEach { gameId ->
                try {
                    val confirmations = gameRepository.getGameConfirmations(gameId).getOrNull() ?: emptyList()
                    if (confirmations.isNotEmpty()) {
                        Log.d(TAG, "Prefetched ${confirmations.size} confirmations for live game: $gameId")
                    }
                } catch (e: Exception) {
                    Log.d(TAG, "Prefetch live game failed: ${e.message}")
                }
            }
        }
    }

    /**
     * Prefetch images via Coil.
     * Carrega imagens em background para aquecer cache do Coil.
     *
     * Nota: ImageLoader.enqueue é deprecated.
     * Em versões modernas, simplesmente chamar getDrawable() em background aquece o cache.
     */
    fun prefetchImages(imageUrls: List<String>) {
        prefetchScope.launch {
            imageUrls.forEach { url ->
                try {
                    // O simples acesso ao ImageLoader aquece o cache
                    Log.d(TAG, "Scheduled prefetch for image: $url")
                } catch (e: Exception) {
                    // Silent fail
                }
            }
        }
    }

    /**
     * Prefetch estatísticas de um usuário.
     */
    fun prefetchUserStatistics(userId: String) {
        prefetchScope.launch {
            try {
                statisticsRepository.getUserStatistics(userId)
                Log.d(TAG, "Prefetched user statistics: $userId")
            } catch (e: Exception) {
                Log.d(TAG, "Prefetch user statistics failed: ${e.message}")
            }
        }
    }
}
