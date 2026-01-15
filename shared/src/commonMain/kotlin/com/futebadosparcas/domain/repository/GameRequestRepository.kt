package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.GameJoinRequest
import kotlinx.coroutines.flow.Flow

/**
 * Repository para gerenciar solicitacoes de participacao em jogos publicos.
 * Interface KMP para ser usada em Android e iOS.
 */
interface GameRequestRepository {
    /**
     * Criar uma solicitacao de participacao em jogo publico.
     */
    suspend fun requestJoinGame(
        gameId: String,
        message: String,
        position: String? = null
    ): Result<GameJoinRequest>

    /**
     * Buscar solicitacoes pendentes de um jogo especifico.
     */
    suspend fun getPendingRequests(gameId: String): Result<List<GameJoinRequest>>

    /**
     * Flow de solicitacoes pendentes (real-time).
     */
    fun getPendingRequestsFlow(gameId: String): Flow<List<GameJoinRequest>>

    /**
     * Buscar todas as solicitacoes de um jogo.
     */
    suspend fun getAllRequests(gameId: String): Result<List<GameJoinRequest>>

    /**
     * Aprovar uma solicitacao de participacao.
     */
    suspend fun approveRequest(requestId: String): Result<Unit>

    /**
     * Rejeitar uma solicitacao de participacao.
     */
    suspend fun rejectRequest(requestId: String, reason: String? = null): Result<Unit>

    /**
     * Buscar solicitacoes do usuario atual.
     */
    suspend fun getUserRequests(): Result<List<GameJoinRequest>>

    /**
     * Flow de solicitacoes do usuario (real-time).
     */
    fun getUserRequestsFlow(): Flow<List<GameJoinRequest>>

    /**
     * Verificar se usuario ja tem solicitacao pendente para um jogo.
     */
    suspend fun hasActiveRequest(gameId: String): Result<Boolean>

    /**
     * Cancelar solicitacao pendente.
     */
    suspend fun cancelRequest(requestId: String): Result<Unit>
}
