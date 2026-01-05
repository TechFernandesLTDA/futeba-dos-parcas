package com.futebadosparcas.domain.usecase.badge

import com.futebadosparcas.data.model.Badge
import com.futebadosparcas.data.model.UserBadge
import com.futebadosparcas.data.repository.GamificationRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import javax.inject.Inject

/**
 * Use Case para gerenciar badges do jogador.
 *
 * Responsabilidades:
 * - Buscar badges conquistadas
 * - Verificar progresso de badges pendentes
 * - Listar badges disponíveis
 * - Calcular estatísticas de gamificação
 */
class GetUserBadgesUseCase @Inject constructor(
    private val gamificationRepository: GamificationRepository,
    private val auth: FirebaseAuth
) {
    companion object {
        private const val TAG = "GetUserBadgesUseCase"
    }

    /**
     * Resumo de badges do jogador.
     */
    data class BadgesSummary(
        val earnedBadges: List<UserBadge>,
        val availableBadges: List<Badge>,
        val recentBadges: List<UserBadge>,
        val totalEarned: Int,
        val totalAvailable: Int,
        val completionPercentage: Double,
        val rarityDistribution: Map<String, Int>
    )

    /**
     * Busca resumo completo de badges do jogador.
     *
     * @param userId ID do jogador (null = usuário atual)
     * @return Result com resumo de badges
     */
    suspend fun getBadgesSummary(userId: String? = null): Result<BadgesSummary> {
        val targetUserId = userId ?: auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Usuário não autenticado"))

        AppLogger.d(TAG) { "Buscando badges do jogador: $targetUserId" }

        return try {
            // 1. Buscar badges conquistadas
            val earnedResult = gamificationRepository.getUserBadges(targetUserId)
            if (earnedResult.isFailure) {
                return Result.failure(earnedResult.exceptionOrNull()!!)
            }
            val earnedBadges = earnedResult.getOrNull()!!

            // 2. Buscar badges disponíveis
            val availableResult = gamificationRepository.getAvailableBadges()
            if (availableResult.isFailure) {
                return Result.failure(availableResult.exceptionOrNull()!!)
            }
            val allBadges = availableResult.getOrNull()!!

            // 3. Filtrar badges não conquistadas
            val earnedIds = earnedBadges.map { it.badgeId }.toSet()
            val availableBadges = allBadges.filter { it.id !in earnedIds }

            // 4. Badges recentes (últimas 5)
            val recentBadges = earnedBadges
                .sortedByDescending { it.earnedAt }
                .take(5)

            // 5. Calcular distribuição por raridade
            val rarityDistribution = earnedBadges
                .groupBy { it.rarity ?: "COMMON" }
                .mapValues { it.value.size }

            // 6. Calcular porcentagem de conclusão
            val completionPercentage = if (allBadges.isNotEmpty()) {
                (earnedBadges.size.toDouble() / allBadges.size.toDouble()) * 100
            } else {
                0.0
            }

            val summary = BadgesSummary(
                earnedBadges = earnedBadges.sortedByDescending { it.earnedAt },
                availableBadges = availableBadges,
                recentBadges = recentBadges,
                totalEarned = earnedBadges.size,
                totalAvailable = allBadges.size,
                completionPercentage = completionPercentage,
                rarityDistribution = rarityDistribution
            )

            AppLogger.d(TAG) {
                "Badges carregadas: ${earnedBadges.size}/${allBadges.size} (${completionPercentage.toInt()}%)"
            }

            Result.success(summary)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar badges", e)
            Result.failure(e)
        }
    }

    /**
     * Busca badges recentes do jogador.
     *
     * @param userId ID do jogador
     * @param limit Número máximo de badges
     * @return Result com lista de badges recentes
     */
    suspend fun getRecentBadges(
        userId: String? = null,
        limit: Int = 5
    ): Result<List<UserBadge>> {
        val targetUserId = userId ?: auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Usuário não autenticado"))

        AppLogger.d(TAG) { "Buscando badges recentes: userId=$targetUserId, limit=$limit" }

        return gamificationRepository.getRecentBadges(targetUserId, limit)
    }

    /**
     * Verifica se jogador possui uma badge específica.
     *
     * @param badgeId ID da badge
     * @param userId ID do jogador (null = usuário atual)
     * @return Result com boolean indicando se possui
     */
    suspend fun hasBadge(badgeId: String, userId: String? = null): Result<Boolean> {
        val targetUserId = userId ?: auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Usuário não autenticado"))

        AppLogger.d(TAG) { "Verificando badge: $badgeId para $targetUserId" }

        val earnedResult = gamificationRepository.getUserBadges(targetUserId)
        if (earnedResult.isFailure) {
            return Result.failure(earnedResult.exceptionOrNull()!!)
        }

        val hasBadge = earnedResult.getOrNull()!!.any { it.badgeId == badgeId }
        return Result.success(hasBadge)
    }

    /**
     * Busca badges filtradas por categoria.
     *
     * @param category Categoria das badges
     * @param userId ID do jogador (null = usuário atual)
     * @return Result com lista de badges da categoria
     */
    suspend fun getBadgesByCategory(
        category: String,
        userId: String? = null
    ): Result<List<UserBadge>> {
        val targetUserId = userId ?: auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Usuário não autenticado"))

        AppLogger.d(TAG) { "Buscando badges por categoria: $category" }

        val earnedResult = gamificationRepository.getUserBadges(targetUserId)
        if (earnedResult.isFailure) {
            return Result.failure(earnedResult.exceptionOrNull()!!)
        }

        val filteredBadges = earnedResult.getOrNull()!!.filter {
            it.category == category
        }

        return Result.success(filteredBadges)
    }
}
