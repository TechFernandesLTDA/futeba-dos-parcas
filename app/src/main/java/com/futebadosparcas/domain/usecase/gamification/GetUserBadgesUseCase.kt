package com.futebadosparcas.domain.usecase.gamification

import com.futebadosparcas.domain.model.BadgeDefinition
import com.futebadosparcas.domain.model.UserBadge
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import javax.inject.Inject

/**
 * Get User Badges Use Case
 *
 * Busca todas as badges desbloqueadas por um usuário.
 *
 * Esta use case retorna informações completas sobre as badges conquistadas,
 * incluindo:
 * - Lista de badges desbloqueadas
 * - Data de desbloqueio de cada badge
 * - Contagem de quantas vezes cada badge foi desbloqueada
 * - Informações sobre badges ainda não conquistadas
 *
 * A use case também fornece estatísticas úteis como:
 * - Percentual de conclusão (badges conquistadas / total disponível)
 * - Distribuição por raridade
 * - Badges recentes
 *
 * Uso:
 * ```kotlin
 * val result = getUserBadgesUseCase(GetUserBadgesParams(userId = "user123"))
 *
 * result.fold(
 *     onSuccess = { badges ->
 *         println("Badges conquistadas: ${badges.earnedBadges.size}")
 *         println("Percentual de conclusão: ${badges.completionPercentage}%")
 *     },
 *     onFailure = { error -> /* tratar erro */ }
 * )
 * ```
 */
class GetUserBadgesUseCase @Inject constructor(
    private val gamificationRepository: GamificationRepository
) : SuspendUseCase<GetUserBadgesParams, UserBadgesResult>() {

    override suspend fun execute(params: GetUserBadgesParams): UserBadgesResult {
        // Validar ID do usuário
        require(params.userId.isNotBlank()) {
            "ID do usuário não pode estar vazio"
        }

        // 1. Buscar badges conquistadas pelo usuário
        val earnedResult = gamificationRepository.getUserBadges(params.userId)
        if (earnedResult.isFailure) {
            throw earnedResult.exceptionOrNull()
                ?: Exception("Erro desconhecido ao buscar badges do usuário")
        }
        val earnedBadges = earnedResult.getOrNull() ?: emptyList()

        // 2. Buscar todas as badges disponíveis no sistema
        val availableResult = gamificationRepository.getAvailableBadges()
        if (availableResult.isFailure) {
            throw availableResult.exceptionOrNull()
                ?: Exception("Erro desconhecido ao buscar badges disponíveis")
        }
        val allBadges = availableResult.getOrNull() ?: emptyList()

        // 3. Calcular badges não conquistadas
        val earnedIds = earnedBadges.map { it.badgeId }.toSet()
        val unlockedBadges = allBadges.filter { badge -> badge.id in earnedIds }
        val lockedBadges = allBadges.filter { badge -> badge.id !in earnedIds }

        // 4. Buscar badges recentes (últimas 5 conquistadas)
        val recentBadges = earnedBadges
            .sortedByDescending { it.unlockedAt }
            .take(5)

        // 5. Calcular distribuição por raridade
        val badgeMap = allBadges.associateBy { it.id }
        val rarityDistribution = earnedBadges
            .mapNotNull { userBadge -> badgeMap[userBadge.badgeId]?.rarity?.displayName }
            .groupBy { it }
            .mapValues { it.value.size }

        // 6. Calcular percentual de conclusão
        val completionPercentage = if (allBadges.isNotEmpty()) {
            (earnedBadges.size.toDouble() / allBadges.size.toDouble()) * 100
        } else {
            0.0
        }

        // 7. Calcular contagem por categoria
        val categoryDistribution = badgeMap
            .filterKeys { it in earnedIds }
            .values
            .groupBy { it.category.displayName }
            .mapValues { it.value.size }

        return UserBadgesResult(
            userId = params.userId,
            earnedBadges = earnedBadges.sortedByDescending { it.unlockedAt },
            unlockedBadges = unlockedBadges,
            lockedBadges = lockedBadges,
            recentBadges = recentBadges,
            totalEarned = earnedBadges.size,
            totalAvailable = allBadges.size,
            completionPercentage = completionPercentage,
            rarityDistribution = rarityDistribution,
            categoryDistribution = categoryDistribution
        )
    }
}

/**
 * Parâmetros para buscar badges de um usuário
 *
 * @param userId ID do usuário
 */
data class GetUserBadgesParams(
    val userId: String
)

/**
 * Resultado da busca de badges de um usuário
 *
 * @param userId ID do usuário
 * @param earnedBadges Lista de badges conquistadas ordenadas por data de desbloqueio (mais recentes primeiro)
 * @param unlockedBadges Definições das badges conquistadas com informações completas
 * @param lockedBadges Definições das badges ainda não conquistadas
 * @param recentBadges Últimas 5 badges conquistadas
 * @param totalEarned Número total de badges conquistadas
 * @param totalAvailable Número total de badges disponíveis no sistema
 * @param completionPercentage Percentual de badges conquistadas em relação ao total
 * @param rarityDistribution Mapa com contagem de badges por raridade
 * @param categoryDistribution Mapa com contagem de badges por categoria
 */
data class UserBadgesResult(
    val userId: String,
    val earnedBadges: List<UserBadge>,
    val unlockedBadges: List<BadgeDefinition>,
    val lockedBadges: List<BadgeDefinition>,
    val recentBadges: List<UserBadge>,
    val totalEarned: Int,
    val totalAvailable: Int,
    val completionPercentage: Double,
    val rarityDistribution: Map<String, Int>,
    val categoryDistribution: Map<String, Int>
)
