package com.futebadosparcas.domain.usecase.ranking

import com.futebadosparcas.domain.model.SeasonParticipation
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase

/**
 * Get Season Ranking Use Case
 *
 * Busca o ranking da temporada ativa com filtro de limite de jogadores.
 *
 * Responsabilidades:
 * - Obter temporada ativa do repositório de gamificação
 * - Buscar classificação completa da temporada
 * - Retornar lista de participações ordenadas por pontos
 *
 * Tratamento de Erros:
 * - Se não houver temporada ativa, falha com mensagem clara
 * - Se a busca falhar, propaga erro do repositório
 *
 * Usage:
 * ```kotlin
 * val result = getSeasonRankingUseCase(GetSeasonRankingParams(limit = 50))
 *
 * result.fold(
 *     onSuccess = { participations ->
 *         // Exibir ranking: participations[0] é o 1º lugar
 *         participations.forEach { participation ->
 *             println("${participation.userId}: ${participation.points} pontos")
 *         }
 *     },
 *     onFailure = { error ->
 *         println("Erro ao buscar ranking: ${error.message}")
 *     }
 * )
 * ```
 */
class GetSeasonRankingUseCase constructor(
    private val gamificationRepository: GamificationRepository
) : SuspendUseCase<GetSeasonRankingParams, List<SeasonParticipation>>() {

    override suspend fun execute(params: GetSeasonRankingParams): List<SeasonParticipation> {
        // Validar limite
        val limit = params.limit.coerceIn(1, 1000)

        // Buscar temporada ativa
        val seasonResult = gamificationRepository.getActiveSeason()
        val season = seasonResult.getOrNull()
            ?: throw IllegalStateException("Nenhuma temporada ativa encontrada")

        // Buscar ranking da temporada
        val rankingResult = gamificationRepository.getSeasonRanking(season.id, limit)
        return rankingResult.getOrThrow()
    }
}

/**
 * Parâmetros para GetSeasonRankingUseCase
 *
 * @param limit Número máximo de jogadores a retornar (padrão: 50, máximo: 1000)
 */
data class GetSeasonRankingParams(
    val limit: Int = 50
)
