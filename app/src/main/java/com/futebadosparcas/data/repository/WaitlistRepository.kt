package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GameWaitlist
import com.futebadosparcas.data.model.WaitlistStatus
import kotlinx.coroutines.flow.Flow

/**
 * Repositorio para gerenciar a lista de espera de jogos (Issue #32).
 *
 * Responsabilidades:
 * - Adicionar jogadores a lista de espera quando o jogo estiver lotado
 * - Manter a ordem da fila
 * - Notificar proximo da fila quando houver vaga
 * - Auto-promocao apos timeout
 */
interface WaitlistRepository {

    /**
     * Adiciona um jogador a lista de espera de um jogo.
     *
     * @param gameId ID do jogo
     * @param userId ID do usuario
     * @param userName Nome do usuario
     * @param userPhoto URL da foto (opcional)
     * @param position Posicao desejada (GOALKEEPER ou FIELD)
     * @return Resultado com a entrada na lista de espera ou erro
     */
    suspend fun addToWaitlist(
        gameId: String,
        userId: String,
        userName: String,
        userPhoto: String?,
        position: String
    ): Result<GameWaitlist>

    /**
     * Remove um jogador da lista de espera.
     *
     * @param gameId ID do jogo
     * @param userId ID do usuario
     * @return Resultado de sucesso ou erro
     */
    suspend fun removeFromWaitlist(gameId: String, userId: String): Result<Unit>

    /**
     * Busca a lista de espera de um jogo ordenada por posicao na fila.
     *
     * @param gameId ID do jogo
     * @return Resultado com a lista ordenada
     */
    suspend fun getWaitlist(gameId: String): Result<List<GameWaitlist>>

    /**
     * Observa a lista de espera de um jogo em tempo real.
     *
     * @param gameId ID do jogo
     * @return Flow com a lista de espera
     */
    fun getWaitlistFlow(gameId: String): Flow<Result<List<GameWaitlist>>>

    /**
     * Busca a posicao de um usuario na lista de espera.
     *
     * @param gameId ID do jogo
     * @param userId ID do usuario
     * @return Posicao na fila (1-indexed) ou null se nao estiver na lista
     */
    suspend fun getWaitlistPosition(gameId: String, userId: String): Result<Int?>

    /**
     * Verifica se um usuario esta na lista de espera.
     *
     * @param gameId ID do jogo
     * @param userId ID do usuario
     * @return true se estiver na lista de espera
     */
    suspend fun isInWaitlist(gameId: String, userId: String): Result<Boolean>

    /**
     * Promove o proximo jogador da lista de espera para confirmado.
     * Chamado quando alguem cancela e abre vaga.
     *
     * @param gameId ID do jogo
     * @return Resultado com o jogador promovido ou null se lista vazia
     */
    suspend fun promoteNextInLine(gameId: String): Result<GameWaitlist?>

    /**
     * Notifica o proximo jogador da fila sobre a vaga disponivel.
     *
     * @param gameId ID do jogo
     * @param autoPromoteMinutes Minutos para auto-promocao
     * @return Resultado com a entrada notificada
     */
    suspend fun notifyNextInLine(
        gameId: String,
        autoPromoteMinutes: Int = 30
    ): Result<GameWaitlist?>

    /**
     * Atualiza o status de uma entrada na lista de espera.
     *
     * @param gameId ID do jogo
     * @param userId ID do usuario
     * @param status Novo status
     * @return Resultado de sucesso ou erro
     */
    suspend fun updateWaitlistStatus(
        gameId: String,
        userId: String,
        status: WaitlistStatus
    ): Result<Unit>

    /**
     * Busca entradas que expiraram (nao responderam no tempo limite).
     * Usado por um worker para processar auto-promocao.
     *
     * @return Lista de entradas expiradas
     */
    suspend fun getExpiredEntries(): Result<List<GameWaitlist>>

    /**
     * Processa entradas expiradas, promovendo os proximos da fila.
     *
     * @return Numero de promocoes realizadas
     */
    suspend fun processExpiredEntries(): Result<Int>

    /**
     * Busca o tamanho da lista de espera de um jogo.
     *
     * @param gameId ID do jogo
     * @return Numero de jogadores na lista de espera
     */
    suspend fun getWaitlistCount(gameId: String): Result<Int>
}
