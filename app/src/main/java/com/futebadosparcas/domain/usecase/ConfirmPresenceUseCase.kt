package com.futebadosparcas.domain.usecase

import com.futebadosparcas.data.datasource.FirebaseDataSource
import com.futebadosparcas.data.model.*
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import javax.inject.Inject

/**
 * Use Case para confirmar presença em jogos.
 *
 * Responsabilidades:
 * - Validar se usuário pode confirmar presença
 * - Verificar limite de jogadores/goleiros
 * - Criar confirmação no Firebase
 * - Atualizar contadores do jogo
 */
class ConfirmPresenceUseCase @Inject constructor(
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
        position: String = PlayerPosition.FIELD.name,
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

        // 2. Buscar detalhes do jogo
        val gameResult = firebaseDataSource.getGameById(gameId)
        if (gameResult.isFailure) {
            return Result.failure(gameResult.exceptionOrNull()!!)
        }
        val game = gameResult.getOrNull()!!

        // 3. Validar status do jogo
        if (game.getStatusEnum() !in listOf(GameStatus.SCHEDULED, GameStatus.CONFIRMED)) {
            return Result.failure(
                IllegalStateException("Não é possível confirmar presença neste jogo (status: ${game.status})")
            )
        }

        // 4. Verificar se já confirmou
        val confirmationsResult = firebaseDataSource.getGameConfirmations(gameId)
        if (confirmationsResult.isFailure) {
            return Result.failure(confirmationsResult.exceptionOrNull()!!)
        }

        val existingConfirmations = confirmationsResult.getOrNull()!!
        val alreadyConfirmed = existingConfirmations.any { it.userId == userId }

        if (alreadyConfirmed) {
            return Result.failure(
                IllegalStateException("Você já confirmou presença neste jogo")
            )
        }

        // 5. Verificar limite de jogadores
        val positionEnum = try {
            PlayerPosition.valueOf(position)
        } catch (e: Exception) {
            PlayerPosition.FIELD
        }

        val confirmedCount = existingConfirmations.filter {
            it.getStatusEnum() == ConfirmationStatus.CONFIRMED
        }

        val isGoalkeeper = positionEnum == PlayerPosition.GOALKEEPER
        val currentCount = if (isGoalkeeper) {
            confirmedCount.count { it.getPositionEnum() == PlayerPosition.GOALKEEPER }
        } else {
            confirmedCount.count { it.getPositionEnum() != PlayerPosition.GOALKEEPER }
        }

        val maxAllowed = if (isGoalkeeper) game.maxGoalkeepers else game.maxPlayers

        if (currentCount >= maxAllowed) {
            val positionName = if (isGoalkeeper) "goleiros" else "jogadores de linha"
            return Result.failure(
                IllegalStateException("Limite de $positionName atingido ($currentCount/$maxAllowed)")
            )
        }

        // 6. Criar confirmação
        val confirmationResult = firebaseDataSource.confirmPresence(
            gameId = gameId,
            userId = userId,
            userName = userName,
            userPhoto = userPhoto,
            position = position,
            isCasualPlayer = isCasualPlayer
        )

        if (confirmationResult.isFailure) {
            return confirmationResult
        }

        // 7. Atualizar contadores do jogo
        val updates = mutableMapOf<String, Any>()
        if (isGoalkeeper) {
            updates["goalkeepers_count"] = currentCount + 1
        } else {
            updates["players_count"] = currentCount + 1
        }

        // Adicionar usuário à lista de jogadores se não estiver
        if (!game.players.contains(userId)) {
            updates["players"] = game.players + userId
        }

        val updateResult = firebaseDataSource.updateGame(gameId, updates)
        if (updateResult.isFailure) {
            AppLogger.w(TAG) {
                "Confirmação criada mas falha ao atualizar contadores: ${updateResult.exceptionOrNull()?.message}"
            }
        }

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

        // 2. Buscar confirmação existente
        val confirmationsResult = firebaseDataSource.getGameConfirmations(gameId)
        if (confirmationsResult.isFailure) {
            return Result.failure(confirmationsResult.exceptionOrNull()!!)
        }

        val confirmations = confirmationsResult.getOrNull()!!
        val userConfirmation = confirmations.find { it.userId == userId }
            ?: return Result.failure(IllegalStateException("Confirmação não encontrada"))

        // 3. Buscar detalhes do jogo
        val gameResult = firebaseDataSource.getGameById(gameId)
        if (gameResult.isFailure) {
            return Result.failure(gameResult.exceptionOrNull()!!)
        }
        val game = gameResult.getOrNull()!!

        // 4. Validar se pode cancelar
        if (game.getStatusEnum() !in listOf(GameStatus.SCHEDULED, GameStatus.CONFIRMED)) {
            return Result.failure(
                IllegalStateException("Não é possível cancelar confirmação neste jogo (status: ${game.status})")
            )
        }

        // 5. Cancelar confirmação
        val cancelResult = firebaseDataSource.cancelConfirmation(gameId, userId)
        if (cancelResult.isFailure) {
            return cancelResult
        }

        // 6. Atualizar contadores do jogo
        val isGoalkeeper = userConfirmation.getPositionEnum() == PlayerPosition.GOALKEEPER
        val updates = mutableMapOf<String, Any>()

        if (isGoalkeeper) {
            updates["goalkeepers_count"] = (game.goalkeepersCount - 1).coerceAtLeast(0)
        } else {
            updates["players_count"] = (game.playersCount - 1).coerceAtLeast(0)
        }

        // Remover usuário da lista de jogadores
        if (game.players.contains(userId)) {
            updates["players"] = game.players.filter { it != userId }
        }

        val updateResult = firebaseDataSource.updateGame(gameId, updates)
        if (updateResult.isFailure) {
            AppLogger.w(TAG) {
                "Confirmação cancelada mas falha ao atualizar contadores: ${updateResult.exceptionOrNull()?.message}"
            }
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
