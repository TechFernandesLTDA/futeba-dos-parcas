package com.futebadosparcas.domain.usecase.stats

import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.data.repository.StatisticsRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import com.futebadosparcas.util.AppLogger

/**
 * Get Player Statistics Use Case
 *
 * Busca estatísticas completas de um jogador específico.
 *
 * Responsabilidades:
 * - Buscar estatísticas do jogador (gols, assistências, vitórias, etc.)
 * - Validar se o jogador existe
 * - Retornar dados formatados para a UI
 *
 * Uso:
 * ```kotlin
 * val result = getPlayerStatisticsUseCase(GetPlayerStatisticsParams("user123"))
 *
 * result.fold(
 *     onSuccess = { stats ->
 *         println("Total de jogos: ${stats.totalGames}")
 *     },
 *     onFailure = { error ->
 *         println("Erro: ${error.message}")
 *     }
 * )
 * ```
 */
class GetPlayerStatisticsUseCase constructor(
    private val statisticsRepository: StatisticsRepository
) : SuspendUseCase<GetPlayerStatisticsParams, UserStatistics>() {

    companion object {
        private const val TAG = "GetPlayerStatisticsUseCase"
    }

    override suspend fun execute(params: GetPlayerStatisticsParams): UserStatistics {
        AppLogger.d(TAG) { "Buscando estatísticas do jogador: ${params.userId}" }

        // Validar parâmetros
        require(params.userId.isNotBlank()) {
            "ID do jogador não pode estar vazio"
        }

        // Buscar estatísticas do repositório
        val result = statisticsRepository.getUserStatistics(params.userId)

        return result.getOrElse { exception ->
            AppLogger.e(TAG, "Erro ao buscar estatísticas", exception)
            throw exception
        }
    }
}

/**
 * Parâmetros para buscar estatísticas de um jogador
 *
 * @param userId ID único do jogador no Firestore
 */
data class GetPlayerStatisticsParams(
    val userId: String
)
