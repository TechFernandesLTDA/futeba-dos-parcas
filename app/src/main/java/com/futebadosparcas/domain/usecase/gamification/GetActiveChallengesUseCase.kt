package com.futebadosparcas.domain.usecase.gamification

import com.futebadosparcas.domain.model.WeeklyChallenge
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import javax.inject.Inject

/**
 * Get Active Challenges Use Case
 *
 * Busca todos os desafios semanais ativos no momento.
 *
 * Esta use case retorna uma lista de desafios que estão ativos e disponíveis
 * para os usuários participarem. Os desafios incluem informações de:
 * - Tipo de desafio (ex: marcar gols, vencer jogos, assistências)
 * - Data de início e fim
 * - Valor alvo (quantos gols, jogos, etc.)
 * - Recompensa em XP
 *
 * Uso:
 * ```kotlin
 * val result = getActiveChallengesUseCase(Unit)
 *
 * result.fold(
 *     onSuccess = { challenges ->
 *         challenges.forEach { challenge ->
 *             println("${challenge.name}: ${challenge.targetValue} para ${challenge.xpReward} XP")
 *         }
 *     },
 *     onFailure = { error -> /* tratar erro */ }
 * )
 * ```
 */
class GetActiveChallengesUseCase @Inject constructor(
    private val gamificationRepository: GamificationRepository
) : SuspendUseCase<Unit, List<WeeklyChallenge>>() {

    override suspend fun execute(params: Unit): List<WeeklyChallenge> {
        // Buscar desafios ativos do repositório
        val result = gamificationRepository.getActiveChallenges()

        if (result.isFailure) {
            throw result.exceptionOrNull() ?: Exception("Erro desconhecido ao buscar desafios ativos")
        }

        return result.getOrNull() ?: emptyList()
    }
}

/**
 * Parâmetros para buscar desafios ativos
 * Não há parâmetros específicos, pois busca todos os desafios ativos.
 */
object GetActiveChallengesParams
