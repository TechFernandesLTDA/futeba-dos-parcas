package com.futebadosparcas.domain.usecase.game

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase

/**
 * Start Game Use Case
 *
 * Inicia um jogo agendado, mudando seu status para LIVE.
 * Valida que o jogo está em status válido para início.
 *
 * Uso:
 * ```kotlin
 * val result = startGameUseCase(StartGameParams(gameId = "game123"))
 * ```
 */
class StartGameUseCase constructor(
    private val gameRepository: GameRepository
) : SuspendUseCase<StartGameParams, Game>() {

    override suspend fun execute(params: StartGameParams): Game {
        // Validar parâmetros
        require(params.gameId.isNotBlank()) { "ID do jogo é obrigatório" }

        // Buscar jogo
        val game = gameRepository.getGameDetails(params.gameId).getOrNull()
            ?: throw IllegalArgumentException("Jogo não encontrado")

        // Validar status
        val currentStatus = game.getStatusEnum()
        require(currentStatus == GameStatus.SCHEDULED || currentStatus == GameStatus.CONFIRMED) {
            "Jogo não pode ser iniciado. Status atual: $currentStatus"
        }

        // Atualizar status para LIVE
        game.status = GameStatus.LIVE.name

        // Salvar
        gameRepository.updateGame(game)

        return game
    }
}

/**
 * Parâmetros para iniciar jogo
 */
data class StartGameParams(
    val gameId: String
)
