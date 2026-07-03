package com.futebadosparcas.domain.usecase.livegame

import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.util.AppLogger

/**
 * Use Case para finalizar um jogo ao vivo.
 *
 * Responsabilidades:
 * - Delegar o fechamento para o ciclo server-side validado
 * - Garantir que o cliente não finalize o jogo por write direto
 *
 * Nota: O processamento de XP, badges e estatísticas é feito
 * via Cloud Function (onGameFinished trigger), não no cliente.
 */
class FinishLiveGameUseCase(
    private val gameRepository: GameRepository
) {

    companion object {
        private const val TAG = "FinishLiveGameUseCase"
    }

    /**
     * Finaliza o jogo ao vivo via lifecycle callable.
     *
     * @param gameId ID do jogo a ser finalizado
     * @return Result com Unit em sucesso ou o erro
     */
    suspend operator fun invoke(gameId: String): Result<Unit> {
        if (gameId.isEmpty()) {
            return Result.failure(IllegalArgumentException("ID do jogo não pode ser vazio"))
        }

        AppLogger.d(TAG) { "Finalizando jogo ao vivo: $gameId" }

        val statusResult = gameRepository.updateGameStatus(gameId, "FINISHED")
        if (statusResult.isFailure) {
            AppLogger.e(TAG, "Erro ao finalizar ciclo do jogo", statusResult.exceptionOrNull())
            return statusResult
        }

        AppLogger.d(TAG) { "Jogo $gameId finalizado com sucesso" }
        return Result.success(Unit)
    }
}
