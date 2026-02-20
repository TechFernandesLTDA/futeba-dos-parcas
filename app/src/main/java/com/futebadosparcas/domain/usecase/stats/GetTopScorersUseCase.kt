package com.futebadosparcas.domain.usecase.stats

import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.domain.usecase.SuspendUseCase
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await

/**
 * Get Top Scorers Use Case
 *
 * Busca o ranking de artilheiros (top scorers).
 *
 * Responsabilidades:
 * - Buscar estatísticas de todos os jogadores
 * - Ordenar por número de gols
 * - Aplicar filtros opcionais (limite, mínimo de jogos)
 * - Retornar lista ordenada de artilheiros
 *
 * Uso:
 * ```kotlin
 * val result = getTopScorersUseCase(GetTopScorersParams(
 *     limit = 10,
 *     minGames = 3
 * ))
 *
 * result.fold(
 *     onSuccess = { scorers ->
 *         scorers.forEach { stats ->
 *             println("${stats.id}: ${stats.totalGoals} gols")
 *         }
 *     },
 *     onFailure = { error ->
 *         println("Erro: ${error.message}")
 *     }
 * )
 * ```
 */
class GetTopScorersUseCase constructor(
    private val firestore: FirebaseFirestore
) : SuspendUseCase<GetTopScorersParams, List<UserStatistics>>() {

    companion object {
        private const val TAG = "GetTopScorersUseCase"
        private const val DEFAULT_LIMIT = 10
        private const val MIN_LIMIT = 1
        private const val MAX_LIMIT = 100
    }

    override suspend fun execute(params: GetTopScorersParams): List<UserStatistics> {
        AppLogger.d(TAG) {
            "Buscando top scorers: limit=${params.limit}, minGames=${params.minGames}"
        }

        // Validar parâmetros
        require(params.limit in MIN_LIMIT..MAX_LIMIT) {
            "Limite deve estar entre $MIN_LIMIT e $MAX_LIMIT"
        }

        require(params.minGames >= 0) {
            "Número mínimo de jogos não pode ser negativo"
        }

        // Buscar estatísticas ordenadas por gols
        val snapshot = firestore.collection("statistics")
            .orderBy("total_goals", Query.Direction.DESCENDING)
            .limit(params.limit.toLong())
            .get()
            .await()

        val allStats = snapshot.toObjects(UserStatistics::class.java)

        // Filtrar por mínimo de jogos se necessário
        return if (params.minGames > 0) {
            allStats.filter { it.totalGames >= params.minGames }
        } else {
            allStats
        }
    }
}

/**
 * Parâmetros para buscar top scorers
 *
 * @param limit Número máximo de jogadores a retornar (padrão: 10, máximo: 100)
 * @param minGames Número mínimo de jogos para ser incluído no ranking (padrão: 0)
 */
data class GetTopScorersParams(
    val limit: Int = 10,
    val minGames: Int = 0
)
