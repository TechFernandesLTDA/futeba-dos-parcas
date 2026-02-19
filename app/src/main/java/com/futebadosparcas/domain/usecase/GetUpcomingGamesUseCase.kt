package com.futebadosparcas.domain.usecase

import com.futebadosparcas.data.datasource.FirebaseDataSource
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Use Case para buscar jogos futuros.
 *
 * Responsabilidades:
 * - Buscar jogos com data futura
 * - Filtrar por status (SCHEDULED, CONFIRMED)
 * - Ordenar por data
 * - Fornecer Flow reativo para UI
 */
class GetUpcomingGamesUseCase constructor(
    private val firebaseDataSource: FirebaseDataSource
) {
    companion object {
        private const val TAG = "GetUpcomingGamesUseCase"
        private const val DEFAULT_LIMIT = 50
    }

    /**
     * Busca jogos futuros (one-time query).
     *
     * @param limit Número máximo de jogos
     * @param includeConfirmed Incluir jogos já confirmados
     * @return Result com lista de jogos futuros
     */
    suspend fun execute(
        limit: Int = DEFAULT_LIMIT,
        includeConfirmed: Boolean = true
    ): Result<List<Game>> {
        AppLogger.d(TAG) { "Executando: limit=$limit, includeConfirmed=$includeConfirmed" }

        return firebaseDataSource.getUpcomingGames(limit)
            .map { games ->
                filterAndSortGames(games, includeConfirmed)
            }
    }

    /**
     * Busca jogos futuros em tempo real (Flow).
     *
     * @param limit Número máximo de jogos
     * @param includeConfirmed Incluir jogos já confirmados
     * @return Flow com lista de jogos futuros
     */
    fun executeFlow(
        limit: Int = DEFAULT_LIMIT,
        includeConfirmed: Boolean = true
    ): Flow<Result<List<Game>>> {
        AppLogger.d(TAG) { "Iniciando flow: limit=$limit, includeConfirmed=$includeConfirmed" }

        return firebaseDataSource.getUpcomingGamesFlow(limit)
            .map { result ->
                result.map { games ->
                    filterAndSortGames(games, includeConfirmed)
                }
            }
    }

    /**
     * Filtra e ordena jogos conforme regras de negócio.
     */
    private fun filterAndSortGames(
        games: List<Game>,
        includeConfirmed: Boolean
    ): List<Game> {
        return games
            .filter { game ->
                // Filtrar jogos cancelados
                game.getStatusEnum() != GameStatus.CANCELLED &&
                // Filtrar jogos finalizados
                game.getStatusEnum() != GameStatus.FINISHED &&
                // Filtrar jogos confirmados se necessário
                (includeConfirmed || game.getStatusEnum() == GameStatus.SCHEDULED)
            }
            .sortedBy { it.dateTime }
            .also { filtered ->
                AppLogger.d(TAG) {
                    "Filtrados ${filtered.size} jogos de ${games.size} totais"
                }
            }
    }

    /**
     * Busca apenas jogos com lista aberta (status = SCHEDULED).
     *
     * @param limit Número máximo de jogos
     * @return Result com lista de jogos com lista aberta
     */
    suspend fun getOpenGames(limit: Int = DEFAULT_LIMIT): Result<List<Game>> {
        AppLogger.d(TAG) { "Buscando jogos com lista aberta (limit=$limit)" }

        return firebaseDataSource.getUpcomingGames(limit)
            .map { games ->
                games.filter { it.getStatusEnum() == GameStatus.SCHEDULED }
                    .sortedBy { it.dateTime }
            }
    }

    /**
     * Busca jogos de um grupo específico.
     *
     * @param groupId ID do grupo
     * @param limit Número máximo de jogos
     * @return Result com lista de jogos do grupo
     */
    suspend fun getGroupGames(
        groupId: String,
        limit: Int = DEFAULT_LIMIT
    ): Result<List<Game>> {
        AppLogger.d(TAG) { "Buscando jogos do grupo: $groupId" }

        return firebaseDataSource.getGamesByGroup(groupId, limit)
            .map { games ->
                games.filter { it.getStatusEnum() != GameStatus.CANCELLED }
                    .sortedByDescending { it.dateTime }
            }
    }

    /**
     * Busca jogos públicos disponíveis.
     *
     * @param limit Número máximo de jogos
     * @return Result com lista de jogos públicos
     */
    suspend fun getPublicGames(limit: Int = 20): Result<List<Game>> {
        AppLogger.d(TAG) { "Buscando jogos públicos (limit=$limit)" }

        return firebaseDataSource.getPublicGames(limit)
            .map { games ->
                games.filter {
                    it.isPubliclyVisible() &&
                    it.getStatusEnum() != GameStatus.CANCELLED
                }
                .sortedBy { it.dateTime }
            }
    }
}
