package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.domain.model.Team
import kotlinx.coroutines.flow.Flow

/**
 * Interface de repositorio de jogos.
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 */
interface GameRepository {

    /**
     * Busca um jogo por ID.
     */
    suspend fun getGameById(gameId: String): Result<Game>

    /**
     * Observa um jogo em tempo real.
     */
    fun observeGame(gameId: String): Flow<Game?>

    /**
     * Lista jogos por grupo.
     */
    suspend fun getGamesByGroup(groupId: String, limit: Int = 20): Result<List<Game>>

    /**
     * Lista jogos por data.
     */
    suspend fun getGamesByDate(date: String): Result<List<Game>>

    /**
     * Lista proximos jogos do usuario.
     */
    suspend fun getUpcomingGames(userId: String, limit: Int = 10): Result<List<Game>>

    /**
     * Lista jogos recentes do usuario.
     */
    suspend fun getRecentGames(userId: String, limit: Int = 10): Result<List<Game>>

    /**
     * Cria um novo jogo.
     */
    suspend fun createGame(game: Game): Result<String>

    /**
     * Atualiza um jogo existente.
     */
    suspend fun updateGame(game: Game): Result<Unit>

    /**
     * Atualiza o status do jogo.
     */
    suspend fun updateGameStatus(gameId: String, status: GameStatus): Result<Unit>

    /**
     * Atualiza o placar do jogo.
     */
    suspend fun updateScore(gameId: String, team1Score: Int, team2Score: Int): Result<Unit>

    /**
     * Busca confirmacoes de um jogo.
     */
    suspend fun getConfirmations(gameId: String): Result<List<GameConfirmation>>

    /**
     * Observa confirmacoes em tempo real.
     */
    fun observeConfirmations(gameId: String): Flow<List<GameConfirmation>>

    /**
     * Confirma presenca em um jogo.
     */
    suspend fun confirmPresence(gameId: String, userId: String, position: String): Result<Unit>

    /**
     * Cancela presenca em um jogo.
     */
    suspend fun cancelPresence(gameId: String, userId: String): Result<Unit>

    /**
     * Busca times de um jogo.
     */
    suspend fun getTeams(gameId: String): Result<List<Team>>

    /**
     * Salva times de um jogo.
     */
    suspend fun saveTeams(gameId: String, teams: List<Team>): Result<Unit>
}
