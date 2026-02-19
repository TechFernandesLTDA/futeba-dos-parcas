package com.futebadosparcas.domain.usecase.user

import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.domain.usecase.SuspendUseCase
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.tasks.await

/**
 * Get User Profile Use Case
 *
 * Busca o perfil completo do usuário incluindo dados pessoais, estatísticas e informações de gamificação.
 *
 * Responsabilidades:
 * - Buscar dados do usuário no Firestore
 * - Buscar estatísticas do usuário em paralelo
 * - Combinar informações em um objeto de perfil completo
 * - Retornar perfil com todos os dados
 *
 * Uso:
 * ```kotlin
 * val result = getUserProfileUseCase(GetUserProfileParams(userId = "user-123"))
 *
 * result.fold(
 *     onSuccess = { profile ->
 *         println("Perfil: ${profile.user.name}")
 *         println("Jogos jogados: ${profile.statistics.totalGames}")
 *     },
 *     onFailure = { error ->
 *         println("Erro: ${error.message}")
 *     }
 * )
 * ```
 */
class GetUserProfileUseCase constructor(
    private val firestore: FirebaseFirestore
) : SuspendUseCase<GetUserProfileParams, UserProfile>() {

    companion object {
        private const val TAG = "GetUserProfileUseCase"
    }

    override suspend fun execute(params: GetUserProfileParams): UserProfile = coroutineScope {
        AppLogger.d(TAG) {
            "Buscando perfil completo do usuário: userId=${params.userId}"
        }

        // Validar parâmetros
        require(params.userId.isNotBlank()) {
            "ID do usuário é obrigatório"
        }

        // Buscar dados do usuário e estatísticas em paralelo
        val userDeferred = async {
            fetchUser(params.userId)
        }
        val statisticsDeferred = async {
            fetchStatistics(params.userId)
        }

        val results = awaitAll(userDeferred, statisticsDeferred)
        val user = results[0] as User
        val statistics = results[1] as UserStatistics?

        AppLogger.d(TAG) {
            "Perfil completo do usuário carregado: userId=${params.userId}"
        }

        UserProfile(
            user = user,
            statistics = statistics
        )
    }

    private suspend fun fetchUser(userId: String): User {
        val userSnapshot = firestore.collection("users")
            .document(userId)
            .get()
            .await()

        val user = userSnapshot.toObject(User::class.java)
            ?: throw IllegalStateException("Usuário não encontrado: $userId")

        AppLogger.d(TAG) {
            "Dados do usuário carregados: name=${user.name}, level=${user.level}"
        }

        return user
    }

    private suspend fun fetchStatistics(userId: String): UserStatistics? {
        return try {
            val statsSnapshot = firestore.collection("statistics")
                .document(userId)
                .get()
                .await()

            val statistics = statsSnapshot.toObject(UserStatistics::class.java)

            if (statistics != null) {
                AppLogger.d(TAG) {
                    "Estatísticas carregadas: totalGames=${statistics.totalGames}, totalGoals=${statistics.totalGoals}"
                }
            }

            statistics
        } catch (e: Exception) {
            AppLogger.w(TAG) {
                "Erro ao buscar estatísticas do usuário: ${e.message}"
            }
            null
        }
    }
}

/**
 * Parâmetros para buscar perfil do usuário
 *
 * @param userId ID do usuário cujo perfil será buscado
 */
data class GetUserProfileParams(
    val userId: String
)

/**
 * Perfil completo do usuário
 *
 * Combine dados do usuário com suas estatísticas e informações de gamificação.
 *
 * @param user Dados do usuário (perfil, configurações, ratings)
 * @param statistics Estatísticas de jogo do usuário (opcional, pode ser null se ainda não existir)
 */
data class UserProfile(
    val user: User,
    val statistics: UserStatistics? = null
) {
    /**
     * Retorna a estatística de presença do usuário, ou 0.0 se não houver dados.
     */
    val presenceRate: Double
        get() = statistics?.presenceRate ?: 0.0

    /**
     * Retorna a taxa de vitória do usuário, ou 0.0 se não houver dados.
     */
    val winRate: Double
        get() = statistics?.winRate ?: 0.0

    /**
     * Retorna a média de gols por jogo, ou 0.0 se não houver dados.
     */
    val avgGoalsPerGame: Double
        get() = statistics?.avgGoalsPerGame ?: 0.0

    /**
     * Retorna a média de assistências por jogo, ou 0.0 se não houver dados.
     */
    val avgAssistsPerGame: Double
        get() = statistics?.avgAssistsPerGame ?: 0.0

    /**
     * Retorna a taxa MVP (melhor jogador) do usuário, ou 0.0 se não houver dados.
     */
    val mvpRate: Double
        get() = statistics?.mvpRate ?: 0.0

    /**
     * Retorna o total de jogos do usuário, ou 0 se não houver dados.
     */
    val totalGames: Int
        get() = statistics?.totalGames ?: 0

    /**
     * Retorna o total de gols do usuário, ou 0 se não houver dados.
     */
    val totalGoals: Int
        get() = statistics?.totalGoals ?: 0

    /**
     * Retorna o total de cartões do usuário, ou 0 se não houver dados.
     */
    val totalCards: Int
        get() = statistics?.totalCards ?: 0

    /**
     * Verifica se o usuário tem dados de estatísticas registrados.
     */
    val hasStatistics: Boolean
        get() = statistics != null && statistics.totalGames > 0
}
