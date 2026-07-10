package com.futebadosparcas.domain.usecase

import com.futebadosparcas.data.datasource.FirebaseDataSource
import com.futebadosparcas.domain.model.*
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth

/**
 * Use Case para confirmar presença em jogos.
 *
 * Responsabilidades:
 * - Validar se usuário pode confirmar presença
 * - Verificar limite de jogadores/goleiros
 * - Criar confirmação no Firebase
 * - Atualizar contadores do jogo
 */
class ConfirmPresenceUseCase constructor(
    private val firebaseDataSource: FirebaseDataSource,
    private val auth: FirebaseAuth
) {
    companion object {
        private const val TAG = "ConfirmPresenceUseCase"
    }

    /**
     * Confirma presença do usuário em um jogo.
     *
     * @param gameId ID do jogo
     * @param position Posição (FIELD ou GOALKEEPER)
     * @param isCasualPlayer Se é jogador casual (não membro do grupo)
     * @return Result com a confirmação criada
     */
    suspend fun execute(
        gameId: String,
        position: String = PlayerPosition.LINE.name,
        isCasualPlayer: Boolean = false
    ): Result<GameConfirmation> {
        AppLogger.d(TAG) {
            "Confirmando presença: gameId=$gameId, position=$position, casual=$isCasualPlayer"
        }

        // 1. Obter usuário atual
        val currentUser = auth.currentUser
            ?: return Result.failure(IllegalStateException("Usuário não autenticado"))

        val userId = currentUser.uid
        val userName = currentUser.displayName ?: "Jogador"
        val userPhoto = currentUser.photoUrl?.toString()

        // O callable valida status, horario, idempotencia e capacidade dentro
        // da mesma transaction que grava confirmation + contadores do jogo.
        val confirmationResult = firebaseDataSource.confirmPresence(
            gameId = gameId,
            userId = userId,
            userName = userName,
            userPhoto = userPhoto,
            position = position,
            isCasualPlayer = isCasualPlayer
        )

        AppLogger.d(TAG) { "Presença confirmada com sucesso: ${confirmationResult.getOrNull()?.id}" }
        return confirmationResult
    }

    /**
     * Cancela confirmação de presença.
     *
     * @param gameId ID do jogo
     * @return Result indicando sucesso ou falha
     */
    suspend fun cancel(gameId: String): Result<Unit> {
        AppLogger.d(TAG) { "Cancelando confirmação: gameId=$gameId" }

        // 1. Obter usuário atual
        val userId = auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Usuário não autenticado"))

        // A exclusao/cancelamento dispara onConfirmationWrite, que aplica o
        // delta uma unica vez. Nao atualizar games diretamente no cliente.
        val cancelResult = firebaseDataSource.cancelConfirmation(gameId, userId)
        if (cancelResult.isFailure) {
            return cancelResult
        }

        AppLogger.d(TAG) { "Confirmação cancelada com sucesso" }
        return Result.success(Unit)
    }

    /**
     * Atualiza status de pagamento da confirmação.
     *
     * @param gameId ID do jogo
     * @param userId ID do usuário (opcional, usa o atual se null)
     * @param isPaid Se o pagamento foi realizado
     * @return Result indicando sucesso ou falha
     */
    suspend fun updatePaymentStatus(
        gameId: String,
        userId: String? = null,
        isPaid: Boolean
    ): Result<Unit> {
        val targetUserId = userId ?: auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Usuário não autenticado"))

        AppLogger.d(TAG) {
            "Atualizando pagamento: gameId=$gameId, userId=$targetUserId, paid=$isPaid"
        }

        return firebaseDataSource.updatePaymentStatus(gameId, targetUserId, isPaid)
    }
}
