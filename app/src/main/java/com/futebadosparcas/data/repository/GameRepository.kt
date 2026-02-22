package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.Game
<<<<<<< HEAD
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.Team
=======
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.Team
>>>>>>> f3237fc2328fe3c708bd99fb005154a8d51298a3
import com.futebadosparcas.ui.games.GameWithConfirmations

/**
 * Representa um conflito de horário encontrado
 */
data class TimeConflict(
    val conflictingGame: Game,
    val overlapMinutes: Int
)

enum class GameFilterType {
    ALL,
    OPEN,
    MY_GAMES,
    LIVE
}

/**
 * Resultado de uma query paginada
 */
data class PaginatedGames(
    val games: List<GameWithConfirmations>,
    val lastGameId: String?, // Cursor para proxima pagina
    val hasMore: Boolean
)

interface GameRepository {
    suspend fun getUpcomingGames(): Result<List<Game>>
    suspend fun getAllGames(): Result<List<Game>>
    suspend fun getAllGamesWithConfirmationCount(): Result<List<GameWithConfirmations>>
    fun getAllGamesWithConfirmationCountFlow(): kotlinx.coroutines.flow.Flow<Result<List<GameWithConfirmations>>>
    suspend fun getConfirmedUpcomingGamesForUser(): Result<List<Game>>
    
    // Novas queries otimizadas para UI (Fase 1)
    fun getLiveAndUpcomingGamesFlow(): kotlinx.coroutines.flow.Flow<Result<List<GameWithConfirmations>>>
    fun getHistoryGamesFlow(limit: Int = 20): kotlinx.coroutines.flow.Flow<Result<List<GameWithConfirmations>>>
    suspend fun getGamesByFilter(filterType: GameFilterType): Result<List<GameWithConfirmations>>

    // Paginacao cursor-based para historico
    suspend fun getHistoryGamesPaginated(
        pageSize: Int = 20,
        lastGameId: String? = null
    ): Result<PaginatedGames>
    suspend fun getGameDetails(gameId: String): Result<Game>
    fun getGameDetailsFlow(gameId: String): kotlinx.coroutines.flow.Flow<Result<Game>>
    suspend fun createGame(game: Game): Result<Game>
    suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>>
    fun getGameConfirmationsFlow(gameId: String): kotlinx.coroutines.flow.Flow<Result<List<GameConfirmation>>>
    suspend fun confirmPresence(
        gameId: String,
        position: String = "FIELD",
        isCasual: Boolean = false
    ): Result<GameConfirmation>
    suspend fun getGoalkeeperCount(gameId: String): Result<Int>
    suspend fun cancelConfirmation(gameId: String): Result<Unit>
    suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit>
    suspend fun updateGameStatus(gameId: String, status: String): Result<Unit>
    suspend fun updateGameConfirmationStatus(gameId: String, isOpen: Boolean): Result<Unit>
    suspend fun updatePaymentStatus(gameId: String, userId: String, isPaid: Boolean): Result<Unit>
    suspend fun generateTeams(
        gameId: String,
        numberOfTeams: Int = 2,
        balanceTeams: Boolean = true
    ): Result<List<Team>>
    suspend fun getGameTeams(gameId: String): Result<List<Team>>
    fun getGameTeamsFlow(gameId: String): kotlinx.coroutines.flow.Flow<Result<List<Team>>>
    suspend fun clearGameTeams(gameId: String): Result<Unit>
    suspend fun updateTeams(teams: List<Team>): Result<Unit>
    suspend fun updateGame(game: Game): Result<Unit>
    suspend fun deleteGame(gameId: String): Result<Unit>
    suspend fun clearAll(): Result<Unit>

    /**
     * Verifica se há conflito de horário para uma quadra específica.
     * Retorna lista de jogos conflitantes (vazia se não houver conflito).
     *
     * @param fieldId ID da quadra
     * @param date Data do jogo (formato YYYY-MM-DD)
     * @param startTime Hora de início (formato HH:mm)
     * @param endTime Hora de término (formato HH:mm)
     * @param excludeGameId ID do jogo a excluir da verificação (para edição)
     */
    suspend fun checkTimeConflict(
        fieldId: String,
        date: String,
        startTime: String,
        endTime: String,
        excludeGameId: String? = null
    ): Result<List<TimeConflict>>

    /**
     * Busca todos os jogos agendados para uma quadra em uma data específica.
     */
    suspend fun getGamesByFieldAndDate(fieldId: String, date: String): Result<List<Game>>

    // Live Game Events
    fun getGameEventsFlow(gameId: String): kotlinx.coroutines.flow.Flow<Result<List<com.futebadosparcas.data.model.GameEvent>>>
    fun getLiveScoreFlow(gameId: String): kotlinx.coroutines.flow.Flow<com.futebadosparcas.data.model.LiveGameScore?>
    suspend fun summonPlayers(gameId: String, confirmations: List<GameConfirmation>): Result<Unit>
    suspend fun sendGameEvent(gameId: String, event: com.futebadosparcas.data.model.GameEvent): Result<Unit>
    suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit>

    // Public Games Discovery (FASE 1 - Sistema de Privacidade)
    /**
     * Buscar jogos públicos (visibilidade PUBLIC_CLOSED ou PUBLIC_OPEN)
     * @param limit Número máximo de jogos a retornar
     * @return Result com lista de jogos públicos ordenados por data
     */
    suspend fun getPublicGames(limit: Int = 20): Result<List<Game>>

    /**
     * Flow de jogos públicos em tempo real
     * @param limit Número máximo de jogos a retornar
     * @return Flow com lista de jogos públicos
     */
    fun getPublicGamesFlow(limit: Int = 20): kotlinx.coroutines.flow.Flow<List<Game>>

    /**
     * Buscar jogos públicos próximos à localização do usuário
     * @param userLat Latitude do usuário
     * @param userLng Longitude do usuário
     * @param radiusKm Raio de busca em quilômetros
     * @param limit Número máximo de jogos a retornar
     * @return Result com lista de jogos públicos próximos
     */
    suspend fun getNearbyPublicGames(
        userLat: Double,
        userLng: Double,
        radiusKm: Double = 10.0,
        limit: Int = 20
    ): Result<List<Game>>

    /**
     * Buscar jogos públicos que aceitam solicitações externas
     * @param limit Número máximo de jogos a retornar
     * @return Result com lista de jogos PUBLIC_OPEN
     */
    suspend fun getOpenPublicGames(limit: Int = 20): Result<List<Game>>

    /**
     * Aceita um convite para jogo (atualiza status de PENDING para CONFIRMED).
     */
    suspend fun acceptInvitation(
        gameId: String,
        position: String = "FIELD"
    ): Result<GameConfirmation>

    /**
     * Confirma presenca de um jogador como owner/admin (Issue #40).
     */
    suspend fun confirmPlayerAsOwner(gameId: String, userId: String): Result<Unit>

    /**
     * Atualiza pagamento parcial de um jogador.
     */
    suspend fun updatePartialPayment(gameId: String, userId: String, amount: Double): Result<Unit>

    // === SOFT DELETE (P2 #40) ===

    /**
     * Realiza soft delete de um jogo (marca deleted_at e deleted_by em vez de excluir).
     *
     * @param gameId ID do jogo a ser soft-deletado
     * @return Result<Unit>
     */
    suspend fun softDeleteGame(gameId: String): Result<Unit>

    /**
     * Restaura um jogo soft-deletado (limpa deleted_at e deleted_by).
     *
     * @param gameId ID do jogo a ser restaurado
     * @return Result<Unit>
     */
    suspend fun restoreGame(gameId: String): Result<Unit>
}
