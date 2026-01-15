package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.Team
import kotlinx.coroutines.flow.Flow

/**
 * Repository responsavel por gerenciamento de times.
 * Interface KMP para ser usada em Android e iOS.
 */
interface GameTeamRepository {
    /**
     * Gera times automaticamente (balanceados ou aleatorios).
     */
    suspend fun generateTeams(
        gameId: String,
        numberOfTeams: Int = 2,
        balanceTeams: Boolean = true
    ): Result<List<Team>>

    /**
     * Busca times de um jogo.
     */
    suspend fun getGameTeams(gameId: String): Result<List<Team>>

    /**
     * Flow de times de um jogo em tempo real.
     */
    fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>>

    /**
     * Limpa times de um jogo.
     */
    suspend fun clearGameTeams(gameId: String): Result<Unit>

    /**
     * Atualiza times de um jogo.
     */
    suspend fun updateTeams(teams: List<Team>): Result<Unit>
}
