package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.Team
import kotlinx.coroutines.flow.Flow

/**
 * Repositório responsável por gerenciamento de times
 */
interface GameTeamRepository {
    suspend fun generateTeams(
        gameId: String,
        numberOfTeams: Int = 2,
        balanceTeams: Boolean = true
    ): Result<List<Team>>
    suspend fun getGameTeams(gameId: String): Result<List<Team>>
    fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>>
    suspend fun clearGameTeams(gameId: String): Result<Unit>
    suspend fun updateTeams(teams: List<Team>): Result<Unit>
}
