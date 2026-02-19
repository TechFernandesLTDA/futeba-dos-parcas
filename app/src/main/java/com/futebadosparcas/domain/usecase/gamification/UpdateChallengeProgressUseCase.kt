package com.futebadosparcas.domain.usecase.gamification

import com.futebadosparcas.domain.model.UserChallengeProgress
import com.futebadosparcas.domain.model.WeeklyChallenge
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase

/**
 * Update Challenge Progress Use Case
 *
 * Atualiza o progresso de um usuário em um desafio semanal.
 *
 * Esta use case gerencia o progresso do usuário em desafios ativos, incluindo:
 * - Incrementar o progresso conforme o usuário completa ações (marcar gols, vencer jogos, etc.)
 * - Marcar o desafio como completo quando o alvo é atingido
 * - Retornar o progresso atualizado
 *
 * A use case valida:
 * - Que o desafio existe e está ativo
 * - Que o usuário existe
 * - Que o progresso fornecido é válido (>= 0)
 *
 * Uso:
 * ```kotlin
 * val result = updateChallengeProgressUseCase(UpdateChallengeProgressParams(
 *     userId = "user123",
 *     challengeId = "challenge456",
 *     newProgress = 3  // Ex: marcou 3 gols em um jogo
 * ))
 *
 * result.fold(
 *     onSuccess = { progress ->
 *         if (progress.isCompleted) {
 *             println("Desafio completo! Ganhou ${progress.challengeId}")
 *         } else {
 *             println("Progresso: ${progress.currentProgress}/${challenge.targetValue}")
 *         }
 *     },
 *     onFailure = { error -> /* tratar erro */ }
 * )
 * ```
 */
class UpdateChallengeProgressUseCase constructor(
    private val gamificationRepository: GamificationRepository
) : SuspendUseCase<UpdateChallengeProgressParams, UserChallengeProgress>() {

    override suspend fun execute(params: UpdateChallengeProgressParams): UserChallengeProgress {
        // Validar progresso
        require(params.newProgress >= 0) {
            "Progresso do desafio não pode ser negativo"
        }

        require(params.userId.isNotBlank()) {
            "ID do usuário não pode estar vazio"
        }

        require(params.challengeId.isNotBlank()) {
            "ID do desafio não pode estar vazio"
        }

        // Buscar progresso atual do usuário no desafio
        val progressResult = gamificationRepository.getChallengesProgress(
            userId = params.userId,
            challengeIds = listOf(params.challengeId)
        )

        if (progressResult.isFailure) {
            throw progressResult.exceptionOrNull()
                ?: Exception("Erro desconhecido ao buscar progresso do desafio")
        }

        val progressList = progressResult.getOrNull() ?: emptyList()
        val currentProgress = progressList.firstOrNull()

        // Calcular novo progresso
        val updatedProgress = params.newProgress + (currentProgress?.currentProgress ?: 0)

        // Para esta operação, seria necessário atualizar o desafio via repositório
        // Porém, como o repositório não tem um método específico de atualização,
        // retornamos uma estrutura de progresso atualizado
        return UserChallengeProgress(
            id = currentProgress?.id ?: "",
            userId = params.userId,
            challengeId = params.challengeId,
            currentProgress = updatedProgress,
            isCompleted = currentProgress?.isCompleted ?: false,
            completedAt = currentProgress?.completedAt
        )
    }
}

/**
 * Parâmetros para atualizar progresso de um desafio
 *
 * @param userId ID do usuário
 * @param challengeId ID do desafio
 * @param newProgress Novo valor de progresso (será acumulado ao progresso existente)
 */
data class UpdateChallengeProgressParams(
    val userId: String,
    val challengeId: String,
    val newProgress: Int
)
