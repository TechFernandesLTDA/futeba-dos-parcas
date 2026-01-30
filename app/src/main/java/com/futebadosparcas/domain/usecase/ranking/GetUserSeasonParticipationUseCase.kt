package com.futebadosparcas.domain.usecase.ranking

import com.futebadosparcas.domain.model.SeasonParticipation
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import com.google.firebase.auth.FirebaseAuth
import javax.inject.Inject

/**
 * Get User Season Participation Use Case
 *
 * Busca a participação do usuário autenticado na temporada ativa.
 *
 * Responsabilidades:
 * - Validar se o usuário está autenticado
 * - Obter temporada ativa
 * - Buscar participação do usuário na temporada
 * - Retornar dados completos da participação ou null se não participar
 *
 * Tratamento de Erros:
 * - Se usuário não estiver autenticado, falha com IllegalStateException
 * - Se não houver temporada ativa, falha com mensagem clara
 * - Se a busca falhar, propaga erro do repositório
 *
 * Retorno Null:
 * - Use case retorna null se o usuário não possui participação na temporada
 * - Verificar onSuccess com participação?.let { } ou verificar se é null
 *
 * Usage:
 * ```kotlin
 * val result = getUserSeasonParticipationUseCase(GetUserSeasonParticipationParams())
 *
 * result.fold(
 *     onSuccess = { participation ->
 *         if (participation != null) {
 *             println("Posição: ${participation.points} pontos")
 *             println("Divisão: ${participation.division}")
 *             println("Taxa de vitória: ${participation.getWinRate() * 100}%")
 *         } else {
 *             println("Usuário não participa da temporada atual")
 *         }
 *     },
 *     onFailure = { error ->
 *         println("Erro ao buscar participação: ${error.message}")
 *     }
 * )
 * ```
 */
class GetUserSeasonParticipationUseCase @Inject constructor(
    private val gamificationRepository: GamificationRepository,
    private val auth: FirebaseAuth
) : SuspendUseCase<GetUserSeasonParticipationParams, SeasonParticipation?>() {

    override suspend fun execute(params: GetUserSeasonParticipationParams): SeasonParticipation? {
        // Validar autenticação
        val userId = auth.currentUser?.uid
            ?: throw IllegalStateException("Usuário não autenticado")

        // Buscar temporada ativa
        val seasonResult = gamificationRepository.getActiveSeason()
        val season = seasonResult.getOrNull()
            ?: throw IllegalStateException("Nenhuma temporada ativa encontrada")

        // Buscar participação do usuário
        val participationResult = gamificationRepository.getUserParticipation(userId, season.id)
        return participationResult.getOrThrow()
    }
}

/**
 * Parâmetros para GetUserSeasonParticipationUseCase
 *
 * Classe vazia fornecida para consistência com padrão de SuspendUseCase.
 * Não requer parâmetros específicos pois usa autenticação do Firebase.
 */
data class GetUserSeasonParticipationParams(
    val placeholder: Boolean = true
)
