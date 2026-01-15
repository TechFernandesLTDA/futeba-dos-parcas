package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameSummon
import com.futebadosparcas.domain.model.PlayerPosition
import com.futebadosparcas.domain.model.UpcomingGame
import kotlinx.coroutines.flow.Flow

/**
 * Repository para gerenciar convocatorias de jogadores para jogos.
 * Interface KMP para ser usada em Android e iOS.
 */
interface GameSummonRepository {
    /**
     * Cria convocatorias para todos os membros do grupo ao criar um jogo.
     * Retorna o numero de convocatorias criadas.
     */
    suspend fun createSummonsForGame(
        gameId: String,
        groupId: String,
        gameDate: String,
        locationName: String
    ): Result<Int>

    /**
     * Busca convocatorias pendentes do usuario atual.
     */
    suspend fun getMyPendingSummons(): Result<List<GameSummon>>

    /**
     * Flow de convocatorias pendentes do usuario em tempo real.
     */
    fun getMyPendingSummonsFlow(): Flow<List<GameSummon>>

    /**
     * Busca convocatorias de um jogo especifico.
     */
    suspend fun getGameSummons(gameId: String): Result<List<GameSummon>>

    /**
     * Flow de convocatorias de um jogo em tempo real.
     */
    fun getGameSummonsFlow(gameId: String): Flow<List<GameSummon>>

    /**
     * Aceita uma convocacao e confirma presença.
     */
    suspend fun acceptSummon(gameId: String, position: PlayerPosition): Result<Unit>

    /**
     * Recusa uma convocacao.
     */
    suspend fun declineSummon(gameId: String): Result<Unit>

    /**
     * Busca proximos jogos do usuario (agenda).
     */
    suspend fun getMyUpcomingGames(limit: Int = 10): Result<List<UpcomingGame>>

    /**
     * Flow de proximos jogos em tempo real.
     */
    fun getMyUpcomingGamesFlow(limit: Int = 10): Flow<List<UpcomingGame>>

    /**
     * Cancela presença em um jogo (remove da agenda).
     */
    suspend fun cancelPresence(gameId: String): Result<Unit>

    /**
     * Verifica se o usuario foi convocado para um jogo.
     */
    suspend fun isSummonedForGame(gameId: String): Result<Boolean>

    /**
     * Busca status da convocacao do usuario para um jogo.
     */
    suspend fun getMySummonForGame(gameId: String): Result<GameSummon?>
}
