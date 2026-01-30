package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.GameConfirmation
import kotlinx.coroutines.flow.Flow

/**
 * Repositorio responsavel por confirmacoes de presenca em jogos.
 * Interface KMP para ser usada em Android e iOS.
 */
interface GameConfirmationRepository {
    /**
     * Busca confirmacoes de um jogo.
     */
    suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>>

    /**
     * Flow que observa confirmacoes de um jogo em tempo real.
     */
    fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>>

    /**
     * Confirma presenca de usuario atual em um jogo.
     */
    suspend fun confirmPresence(
        gameId: String,
        position: String = "FIELD",
        isCasual: Boolean = false
    ): Result<GameConfirmation>

    /**
     * Conta numero de goleiros confirmados em um jogo.
     */
    suspend fun getGoalkeeperCount(gameId: String): Result<Int>

    /**
     * Cancela confirmacao do usuario atual em um jogo.
     */
    suspend fun cancelConfirmation(gameId: String): Result<Unit>

    /**
     * Remove um jogador de um jogo (admin).
     */
    suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit>

    /**
     * Atualiza status de pagamento de um jogador.
     */
    suspend fun updatePaymentStatus(gameId: String, userId: String, isPaid: Boolean): Result<Unit>

    /**
     * Convoca jogadores para um jogo.
     */
    suspend fun summonPlayers(gameId: String, confirmations: List<GameConfirmation>): Result<Unit>

    /**
     * Busca IDs de confirmacoes de um usuario.
     */
    suspend fun getUserConfirmationIds(userId: String): Set<String>

    /**
     * Busca IDs de jogos confirmados por um usuario.
     */
    suspend fun getConfirmedGameIds(userId: String): List<String>

    /**
     * Flow que observa confirmacoes de um usuario em tempo real.
     */
    fun getUserConfirmationsFlow(userId: String): Flow<Set<String>>

    /**
     * Aceita um convite para jogo (atualiza status de PENDING para CONFIRMED).
     */
    suspend fun acceptInvitation(
        gameId: String,
        position: String = "FIELD"
    ): Result<GameConfirmation>

    /**
     * Atualiza o status da confirmacao (para aceitar/recusar convite).
     */
    suspend fun updateConfirmationStatus(
        gameId: String,
        status: String
    ): Result<Unit>

    /**
     * Atualiza o status da confirmacao de um usuario especifico (admin).
     */
    suspend fun updateConfirmationStatusForUser(
        gameId: String,
        userId: String,
        status: String
    ): Result<Unit>
}
