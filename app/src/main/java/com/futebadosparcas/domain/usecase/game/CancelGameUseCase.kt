package com.futebadosparcas.domain.usecase.game

import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import javax.inject.Inject

/**
 * Cancel Game Use Case
 *
 * Cancela um jogo agendado. Apenas o dono ou admin podem cancelar.
 *
 * Regras de negócio:
 * - Apenas o dono do jogo pode cancelar
 * - Jogo deve estar em status SCHEDULED ou CONFIRMED
 * - Não permite cancelamento de jogos LIVE ou FINISHED
 * - Atualiza status para CANCELLED
 *
 * Usage:
 * ```kotlin
 * val result = cancelGameUseCase(CancelGameParams(
 *     gameId = "game123",
 *     cancelledById = "user456",
 *     reason = "Quadra indisponível"
 * ))
 *
 * result.fold(
 *     onSuccess = { /* jogo cancelado */ },
 *     onFailure = { error -> /* handle error */ }
 * )
 * ```
 */
class CancelGameUseCase @Inject constructor(
    private val gameRepository: GameRepository
) : SuspendUseCase<CancelGameParams, Unit>() {

    override suspend fun execute(params: CancelGameParams) {
        // Validar parâmetros obrigatórios
        require(params.gameId.isNotBlank()) { "ID do jogo é obrigatório" }
        require(params.cancelledById.isNotBlank()) { "ID de quem cancela é obrigatório" }

        // Obter jogo atual
        val game = gameRepository.getGameDetails(params.gameId).getOrThrow()

        // Validar se o usuário é o dono do jogo
        require(game.ownerId == params.cancelledById) {
            "Apenas o dono do jogo pode cancelar"
        }

        // Validar se o jogo está em status permitido para cancelamento
        val currentStatus = try {
            GameStatus.valueOf(game.status)
        } catch (e: Exception) {
            GameStatus.SCHEDULED
        }

        require(
            currentStatus == GameStatus.SCHEDULED || currentStatus == GameStatus.CONFIRMED
        ) {
            "Não é possível cancelar um jogo em status ${game.status}. " +
            "Apenas jogos SCHEDULED ou CONFIRMED podem ser cancelados."
        }

        // Atualizar status para CANCELLED
        game.status = GameStatus.CANCELLED.name
        gameRepository.updateGame(game).getOrThrow()
    }
}

/**
 * Parâmetros para cancelamento de jogo
 */
data class CancelGameParams(
    val gameId: String,
    val cancelledById: String,
    val reason: String? = null
)
