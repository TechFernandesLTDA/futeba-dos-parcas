package com.futebadosparcas.domain.usecase.livegame

import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.LiveGameRepository
import com.futebadosparcas.util.AppLogger

/**
 * Use Case para finalizar um jogo ao vivo.
 *
 * Responsabilidades:
 * - Finalizar o placar ao vivo no LiveGameRepository
 * - Atualizar o status do jogo para FINISHED no GameRepository
 * - Garantir que ambas operações são executadas em sequência
 *
 * Nota: O processamento de XP, badges e estatísticas é feito
 * via Cloud Function (onGameFinished trigger), não no cliente.
 */
class FinishLiveGameUseCase(
    private val liveGameRepository: LiveGameRepository,
    private val gameRepository: GameRepository
) {

    companion object {
        private const val TAG = "FinishLiveGameUseCase"
    }

    /**
     * Finaliza o jogo ao vivo e atualiza o status.
     *
     * @param gameId ID do jogo a ser finalizado
     * @return Result com Unit em sucesso ou o erro
     */
    suspend operator fun invoke(gameId: String): Result<Unit> {
        if (gameId.isEmpty()) {
            return Result.failure(IllegalArgumentException("ID do jogo não pode ser vazio"))
        }

        AppLogger.d(TAG) { "Finalizando jogo ao vivo: $gameId" }

        // 1. Finalizar placar ao vivo
        val finishResult = liveGameRepository.finishGame(gameId)
        if (finishResult.isFailure) {
            AppLogger.e(TAG, "Erro ao finalizar placar ao vivo", finishResult.exceptionOrNull())
            return finishResult
        }

        // 2. Atualizar status do jogo para FINISHED
        val statusResult = gameRepository.updateGameStatus(gameId, "FINISHED")
        if (statusResult.isFailure) {
            AppLogger.e(TAG, "Erro ao atualizar status do jogo", statusResult.exceptionOrNull())
            return statusResult
        }

        AppLogger.d(TAG) { "Jogo $gameId finalizado com sucesso" }
        return Result.success(Unit)
    }
}
