package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GameJoinRequest
import kotlinx.coroutines.flow.Flow

/**
 * Repository para gerenciar solicitações de participação em jogos públicos
 */
interface GameRequestRepository {
    /**
     * Criar uma solicitação de participação em jogo público
     * @param gameId ID do jogo
     * @param message Mensagem do jogador para o dono do jogo
     * @param position Posição preferida (FIELD ou GOALKEEPER)
     * @return Result com a solicitação criada
     */
    suspend fun requestJoinGame(
        gameId: String,
        message: String,
        position: String? = null
    ): Result<GameJoinRequest>

    /**
     * Buscar solicitações pendentes de um jogo específico
     * @param gameId ID do jogo
     * @return Result com lista de solicitações pendentes
     */
    suspend fun getPendingRequests(gameId: String): Result<List<GameJoinRequest>>

    /**
     * Flow de solicitações pendentes (real-time)
     * @param gameId ID do jogo
     * @return Flow com lista de solicitações pendentes
     */
    fun getPendingRequestsFlow(gameId: String): Flow<List<GameJoinRequest>>

    /**
     * Buscar todas as solicitações de um jogo (pendentes, aprovadas, rejeitadas)
     * @param gameId ID do jogo
     * @return Result com todas as solicitações
     */
    suspend fun getAllRequests(gameId: String): Result<List<GameJoinRequest>>

    /**
     * Aprovar uma solicitação de participação
     * @param requestId ID da solicitação
     * @return Result com Unit em caso de sucesso
     */
    suspend fun approveRequest(requestId: String): Result<Unit>

    /**
     * Rejeitar uma solicitação de participação
     * @param requestId ID da solicitação
     * @param reason Motivo da rejeição (opcional)
     * @return Result com Unit em caso de sucesso
     */
    suspend fun rejectRequest(requestId: String, reason: String? = null): Result<Unit>

    /**
     * Buscar solicitações do usuário atual
     * @return Result com lista de solicitações do usuário
     */
    suspend fun getUserRequests(): Result<List<GameJoinRequest>>

    /**
     * Flow de solicitações do usuário (real-time)
     * @return Flow com lista de solicitações do usuário
     */
    fun getUserRequestsFlow(): Flow<List<GameJoinRequest>>

    /**
     * Verificar se usuário já tem solicitação pendente para um jogo
     * @param gameId ID do jogo
     * @return Result com true se já existe solicitação pendente
     */
    suspend fun hasActiveCampaignRequest(gameId: String): Result<Boolean>

    /**
     * Cancelar solicitação pendente
     * @param requestId ID da solicitação
     * @return Result com Unit em caso de sucesso
     */
    suspend fun cancelRequest(requestId: String): Result<Unit>
}
