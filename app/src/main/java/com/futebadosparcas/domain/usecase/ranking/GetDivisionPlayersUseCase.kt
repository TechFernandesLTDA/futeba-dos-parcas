package com.futebadosparcas.domain.usecase.ranking

import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.domain.model.SeasonParticipation
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import javax.inject.Inject

/**
 * Get Division Players Use Case
 *
 * Busca todos os jogadores de uma divisão específica na temporada ativa.
 *
 * Responsabilidades:
 * - Validar divisão fornecida
 * - Obter temporada ativa
 * - Filtrar participações por divisão
 * - Retornar lista de jogadores ordenada por rating/pontos
 *
 * Tratamento de Erros:
 * - Se não houver temporada ativa, falha com mensagem clara
 * - Se a busca falhar, propaga erro do repositório
 *
 * Exemplo de Divisões:
 * - BRONZE: 0-29 rating (iniciantes)
 * - PRATA: 30-49 rating (intermediário)
 * - OURO: 50-69 rating (avançado)
 * - DIAMANTE: 70-100 rating (elite)
 *
 * Usage:
 * ```kotlin
 * val result = getDivisionPlayersUseCase(
 *     GetDivisionPlayersParams(
 *         division = LeagueDivision.OURO,
 *         limit = 100
 *     )
 * )
 *
 * result.fold(
 *     onSuccess = { players ->
 *         println("Ouro tem ${players.size} jogadores")
 *         players.forEach { player ->
 *             println("${player.userId}: ${player.leagueRating} rating - ${player.wins}V ${player.draws}E ${player.losses}D")
 *         }
 *     },
 *     onFailure = { error ->
 *         println("Erro ao buscar jogadores da divisão: ${error.message}")
 *     }
 * )
 * ```
 */
class GetDivisionPlayersUseCase @Inject constructor(
    private val gamificationRepository: GamificationRepository
) : SuspendUseCase<GetDivisionPlayersParams, List<SeasonParticipation>>() {

    override suspend fun execute(params: GetDivisionPlayersParams): List<SeasonParticipation> {
        // Validar limite
        val limit = params.limit.coerceIn(1, 1000)

        // Buscar temporada ativa
        val seasonResult = gamificationRepository.getActiveSeason()
        val season = seasonResult.getOrNull()
            ?: throw IllegalStateException("Nenhuma temporada ativa encontrada")

        // Buscar ranking da temporada (todos os jogadores)
        val allParticipantsResult = gamificationRepository.getSeasonRanking(season.id, limit)
        val allParticipants = allParticipantsResult.getOrThrow()

        // Filtrar jogadores da divisão especificada
        val divisionPlayers = allParticipants.filter { participation ->
            val playerDivision = LeagueDivision.fromString(participation.division)
            playerDivision == params.division
        }

        return divisionPlayers
    }
}

/**
 * Parâmetros para GetDivisionPlayersUseCase
 *
 * @param division Divisão da liga a buscar jogadores
 * @param limit Número máximo de jogadores a retornar (padrão: 50, máximo: 1000)
 *              Este limite se aplica ao ranking total antes de filtrar por divisão
 */
data class GetDivisionPlayersParams(
    val division: LeagueDivision,
    val limit: Int = 50
)
