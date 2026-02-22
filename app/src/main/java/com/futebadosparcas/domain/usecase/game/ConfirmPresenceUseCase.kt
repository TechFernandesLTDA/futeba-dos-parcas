package com.futebadosparcas.domain.usecase.game

import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.util.toAndroidGameConfirmation

/**
 * Use case para confirmar presença do usuário em um jogo.
 * Valida os parâmetros e delega a confirmação ao repositório.
 */
class ConfirmPresenceUseCase constructor(
    private val gameRepository: GameRepository
) {
    /**
     * Confirma a presença do usuário em um jogo.
     *
     * @param gameId ID do jogo
     * @param position Posição do jogador (FIELD ou GOALKEEPER)
     * @param isCasual Se o jogador é casual (não conta para estatísticas)
     * @return Result com a confirmação criada
     */
    suspend operator fun invoke(
        gameId: String,
        position: String = "FIELD",
        isCasual: Boolean = false
    ): Result<GameConfirmation> {
        // Validação de parâmetros
        if (gameId.isBlank()) {
            return Result.failure(IllegalArgumentException("ID do jogo não pode estar vazio"))
        }

        if (position.isBlank()) {
            return Result.failure(IllegalArgumentException("Posição não pode estar vazia"))
        }

        val validPositions = listOf("FIELD", "GOALKEEPER")
        if (position !in validPositions) {
            return Result.failure(
                IllegalArgumentException("Posição inválida. Use FIELD ou GOALKEEPER")
            )
        }

        // Repository retorna domain.model, converter para data.model
        return gameRepository.confirmPresence(gameId, position, isCasual)
            .map { it.toAndroidGameConfirmation() }
    }
}
