package com.futebadosparcas.data.datasource

import com.futebadosparcas.data.model.*
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.Query
import kotlinx.coroutines.flow.Flow

/**
 * Interface abstrata para acesso aos dados do Firebase.
 *
 * Esta abstração permite:
 * - Mock em testes unitários
 * - Trocar implementação (ex: Firebase -> Supabase)
 * - Centralizar retry logic e tratamento de erros
 * - Facilitar migração para KMP (Platform-specific implementations)
 */
interface FirebaseDataSource {

    // ========== GAMES ==========

    /**
     * Busca jogos futuros ordenados por data
     */
    suspend fun getUpcomingGames(limit: Int = 50): Result<List<Game>>

    /**
     * Busca jogos futuros em tempo real
     */
    fun getUpcomingGamesFlow(limit: Int = 50): Flow<Result<List<Game>>>

    /**
     * Busca detalhes de um jogo
     */
    suspend fun getGameById(gameId: String): Result<Game>

    /**
     * Busca detalhes de um jogo em tempo real
     */
    fun getGameByIdFlow(gameId: String): Flow<Result<Game>>

    /**
     * Busca jogos confirmados do usuário atual
     */
    suspend fun getConfirmedGamesForUser(userId: String): Result<List<Game>>

    /**
     * Busca jogos de um grupo específico
     */
    suspend fun getGamesByGroup(groupId: String, limit: Int = 50): Result<List<Game>>

    /**
     * Busca jogos públicos
     */
    suspend fun getPublicGames(limit: Int = 20): Result<List<Game>>

    /**
     * Cria um novo jogo
     */
    suspend fun createGame(game: Game): Result<Game>

    /**
     * Atualiza um jogo existente
     */
    suspend fun updateGame(gameId: String, updates: Map<String, Any>): Result<Unit>

    /**
     * Deleta um jogo
     */
    suspend fun deleteGame(gameId: String): Result<Unit>

    // ========== GAME CONFIRMATIONS ==========

    /**
     * Busca confirmações de presença de um jogo
     */
    suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>>

    /**
     * Busca confirmações de presença em tempo real
     */
    fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>>

    /**
     * Confirma presença em um jogo
     */
    suspend fun confirmPresence(
        gameId: String,
        userId: String,
        userName: String,
        userPhoto: String?,
        position: String,
        isCasualPlayer: Boolean
    ): Result<GameConfirmation>

    /**
     * Cancela confirmação de presença
     */
    suspend fun cancelConfirmation(gameId: String, userId: String): Result<Unit>

    /**
     * Atualiza status de pagamento
     */
    suspend fun updatePaymentStatus(
        gameId: String,
        userId: String,
        isPaid: Boolean
    ): Result<Unit>

    // ========== TEAMS ==========

    /**
     * Busca times de um jogo
     */
    suspend fun getGameTeams(gameId: String): Result<List<Team>>

    /**
     * Busca times em tempo real
     */
    fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>>

    /**
     * Salva times gerados
     */
    suspend fun saveTeams(gameId: String, teams: List<Team>): Result<Unit>

    /**
     * Remove times de um jogo
     */
    suspend fun clearGameTeams(gameId: String): Result<Unit>

    // ========== STATISTICS ==========

    /**
     * Busca estatísticas de um usuário
     */
    suspend fun getUserStatistics(userId: String): Result<UserStatistics>

    /**
     * Busca estatísticas em tempo real
     */
    fun getUserStatisticsFlow(userId: String): Flow<Result<UserStatistics>>

    /**
     * Atualiza estatísticas do usuário
     */
    suspend fun updateUserStatistics(userId: String, updates: Map<String, Any>): Result<Unit>

    // ========== RANKING ==========

    /**
     * Busca ranking por categoria
     */
    suspend fun getRanking(
        category: String,
        orderByField: String,
        limit: Int
    ): Result<List<DocumentSnapshot>>

    /**
     * Busca ranking com deltas (períodos)
     */
    suspend fun getRankingDeltas(
        period: String,
        periodKey: String,
        orderByField: String,
        limit: Int
    ): Result<List<DocumentSnapshot>>

    /**
     * Busca logs de XP do usuário
     */
    suspend fun getUserXpLogs(userId: String, limit: Int): Result<List<XpLog>>

    // ========== USERS ==========

    /**
     * Busca usuário por ID
     */
    suspend fun getUserById(userId: String): Result<User>

    /**
     * Busca múltiplos usuários por IDs (batch)
     */
    suspend fun getUsersByIds(userIds: List<String>): Result<List<User>>

    /**
     * Busca usuário atual autenticado
     */
    suspend fun getCurrentUser(): Result<User>

    /**
     * Atualiza perfil do usuário
     */
    suspend fun updateUser(userId: String, updates: Map<String, Any>): Result<Unit>

    /**
     * Pesquisa usuários por nome
     */
    suspend fun searchUsers(query: String, limit: Int): Result<List<User>>

    // ========== GROUPS ==========

    /**
     * Busca grupos do usuário
     */
    suspend fun getUserGroups(userId: String): Result<List<UserGroup>>

    /**
     * Busca grupos em tempo real
     */
    fun getUserGroupsFlow(userId: String): Flow<Result<List<UserGroup>>>

    /**
     * Busca detalhes de um grupo
     */
    suspend fun getGroupById(groupId: String): Result<UserGroup>

    // ========== UTILITY ==========

    /**
     * Executa transação no Firestore
     */
    suspend fun <T> runTransaction(block: suspend () -> T): Result<T>

    /**
     * Executa batch write
     */
    suspend fun executeBatch(operations: List<BatchOperation>): Result<Unit>
}

/**
 * Representa uma operação de batch write
 */
sealed class BatchOperation {
    data class Set(
        val collection: String,
        val documentId: String,
        val data: Map<String, Any>
    ) : BatchOperation()

    data class Update(
        val collection: String,
        val documentId: String,
        val updates: Map<String, Any>
    ) : BatchOperation()

    data class Delete(
        val collection: String,
        val documentId: String
    ) : BatchOperation()
}
