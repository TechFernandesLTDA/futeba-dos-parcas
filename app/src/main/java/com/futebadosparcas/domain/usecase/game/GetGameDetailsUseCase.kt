package com.futebadosparcas.domain.usecase.game

import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.Team
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase

/**
 * Get Game Details Use Case
 *
 * Obtém os detalhes completos de um jogo, incluindo participantes, times e estatísticas.
 *
 * Retorna um objeto [GameDetails] que contém:
 * - Informações completas do jogo
 * - Lista de confirmações (participantes confirmados)
 * - Lista de times (se o jogo possui times balanceados)
 * - Contadores de posições (goleiros, campo)
 *
 * Usage:
 * ```kotlin
 * val result = getGameDetailsUseCase(GetGameDetailsParams(gameId = "game123"))
 *
 * result.fold(
 *     onSuccess = { details ->
 *         println("Jogo: ${details.game.locationName}")
 *         println("Participantes: ${details.confirmations.size}")
 *         println("Times: ${details.teams.size}")
 *     },
 *     onFailure = { error -> /* handle error */ }
 * )
 * ```
 */
class GetGameDetailsUseCase constructor(
    private val gameRepository: GameRepository
) : SuspendUseCase<GetGameDetailsParams, GameDetails>() {

    override suspend fun execute(params: GetGameDetailsParams): GameDetails {
        // Validar parâmetro obrigatório
        require(params.gameId.isNotBlank()) { "ID do jogo é obrigatório" }

        // Obter jogo
        val game = gameRepository.getGameDetails(params.gameId).getOrThrow()

        // Obter confirmações (participantes)
        val confirmations = try {
            gameRepository.getGameConfirmations(params.gameId).getOrNull() ?: emptyList()
        } catch (e: Exception) {
            com.futebadosparcas.util.AppLogger.w("GetGameDetails") {
                "Erro ao obter confirmações para jogo ${params.gameId}: ${e.message}"
            }
            emptyList()
        }

        // Obter times
        val teams = try {
            gameRepository.getGameTeams(params.gameId).getOrNull() ?: emptyList()
        } catch (e: Exception) {
            com.futebadosparcas.util.AppLogger.w("GetGameDetails") {
                "Erro ao obter times para jogo ${params.gameId}: ${e.message}"
            }
            emptyList()
        }

        // Calcular estatísticas
        val statistics = GameStatistics(
            totalConfirmed = confirmations.size,
            totalGoalkeepers = confirmations.count { it.position == "GOALKEEPER" },
            totalFieldPlayers = confirmations.count { it.position == "FIELD" },
            totalCasualPlayers = confirmations.count { it.isCasualPlayer },
            totalPaid = confirmations.count { it.paymentStatus == "PAID" },
            totalPending = confirmations.count { it.paymentStatus == "PENDING" },
            spotsAvailable = (game.maxPlayers - confirmations.size).coerceAtLeast(0),
            goalkeeperSpotsAvailable = (game.maxGoalkeepers -
                confirmations.count { it.position == "GOALKEEPER" }).coerceAtLeast(0)
        )

        return GameDetails(
            game = game,
            confirmations = confirmations,
            teams = teams,
            statistics = statistics
        )
    }
}

/**
 * Parâmetros para obter detalhes do jogo
 */
data class GetGameDetailsParams(
    val gameId: String
)

/**
 * Detalhes completos do jogo com participantes
 */
data class GameDetails(
    val game: Game,
    val confirmations: List<GameConfirmation>,
    val teams: List<Team>,
    val statistics: GameStatistics
) {
    /**
     * Retorna confirmação de um usuário específico, se existir
     */
    fun getPlayerConfirmation(userId: String): GameConfirmation? {
        return confirmations.find { it.userId == userId }
    }

    /**
     * Verifica se o jogo está cheio
     */
    fun isFull(): Boolean {
        return statistics.spotsAvailable == 0
    }

    /**
     * Verifica se há vagas para goleiros
     */
    fun hasGoalkeeperSpots(): Boolean {
        return statistics.goalkeeperSpotsAvailable > 0
    }

    /**
     * Retorna a lista de jogadores de campo confirmados
     */
    fun getFieldPlayers(): List<GameConfirmation> {
        return confirmations.filter { it.position == "FIELD" }
    }

    /**
     * Retorna a lista de goleiros confirmados
     */
    fun getGoalkeepers(): List<GameConfirmation> {
        return confirmations.filter { it.position == "GOALKEEPER" }
    }

    /**
     * Retorna a lista de jogadores casualistas
     */
    fun getCasualPlayers(): List<GameConfirmation> {
        return confirmations.filter { it.isCasualPlayer }
    }

    /**
     * Retorna a lista de jogadores que já pagaram
     */
    fun getPaidPlayers(): List<GameConfirmation> {
        return confirmations.filter { it.paymentStatus == "PAID" }
    }
}

/**
 * Estatísticas do jogo
 */
data class GameStatistics(
    val totalConfirmed: Int,
    val totalGoalkeepers: Int,
    val totalFieldPlayers: Int,
    val totalCasualPlayers: Int,
    val totalPaid: Int,
    val totalPending: Int,
    val spotsAvailable: Int,
    val goalkeeperSpotsAvailable: Int
) {
    /**
     * Percentual de ocupação do jogo
     */
    fun occupancyPercentage(maxPlayers: Int): Float {
        return if (maxPlayers > 0) {
            ((totalConfirmed / maxPlayers.toFloat()) * 100f).coerceIn(0f, 100f)
        } else {
            0f
        }
    }

    /**
     * Percentual de pagamento
     */
    fun paymentPercentage(): Float {
        return if (totalConfirmed > 0) {
            ((totalPaid / totalConfirmed.toFloat()) * 100f).coerceIn(0f, 100f)
        } else {
            0f
        }
    }
}
