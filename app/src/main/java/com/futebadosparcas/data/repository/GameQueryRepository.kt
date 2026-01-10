package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.GameEvent
import com.futebadosparcas.data.model.Team
import com.futebadosparcas.ui.games.GameWithConfirmations
import kotlinx.coroutines.flow.Flow

/**
 * Resultado de uma query paginada
 */
data class PaginatedGames(
    val games: List<GameWithConfirmations>,
    val lastGameId: String?, // Cursor para proxima pagina
    val hasMore: Boolean
)

/**
 * ✅ OTIMIZAÇÃO #2: Consolidação de dados do jogo com confirmações e eventos
 * Reduz de 3 queries sequenciais (~300-400ms) para queries paralelas (~150-200ms)
 */
data class GameDetailConsolidated(
    val game: Game,
    val confirmations: List<GameConfirmation>,
    val events: List<GameEvent>,
    val teams: List<Team> = emptyList()
)

/**
 * Repositório responsável por queries e busca de jogos
 */
interface GameQueryRepository {
    suspend fun getUpcomingGames(): Result<List<Game>>
    suspend fun getAllGames(): Result<List<Game>>
    suspend fun getAllGamesWithConfirmationCount(): Result<List<GameWithConfirmations>>
    fun getAllGamesWithConfirmationCountFlow(): Flow<Result<List<GameWithConfirmations>>>
    suspend fun getConfirmedUpcomingGamesForUser(): Result<List<Game>>

    // Novas queries otimizadas para UI (Fase 1)
    fun getLiveAndUpcomingGamesFlow(): Flow<Result<List<GameWithConfirmations>>>
    fun getHistoryGamesFlow(limit: Int = 20): Flow<Result<List<GameWithConfirmations>>>
    suspend fun getGamesByFilter(filterType: GameFilterType): Result<List<GameWithConfirmations>>
    suspend fun getGameDetails(gameId: String): Result<Game>
    fun getGameDetailsFlow(gameId: String): Flow<Result<Game>>

    // ✅ OTIMIZAÇÃO #2: Consolidado queries paralelas para game + confirmations + events
    suspend fun getGameDetailConsolidated(gameId: String): Result<GameDetailConsolidated>

    // Paginacao cursor-based para historico de jogos
    suspend fun getHistoryGamesPaginated(
        pageSize: Int = 20,
        lastGameId: String? = null
    ): Result<PaginatedGames>

    // Public Games Discovery (FASE 1 - Sistema de Privacidade)
    suspend fun getPublicGames(limit: Int = 20): Result<List<Game>>
    fun getPublicGamesFlow(limit: Int = 20): Flow<List<Game>>
    suspend fun getNearbyPublicGames(
        userLat: Double,
        userLng: Double,
        radiusKm: Double = 10.0,
        limit: Int = 20
    ): Result<List<Game>>
    suspend fun getOpenPublicGames(limit: Int = 20): Result<List<Game>>

    // Field and Time Conflict
    suspend fun checkTimeConflict(
        fieldId: String,
        date: String,
        startTime: String,
        endTime: String,
        excludeGameId: String? = null
    ): Result<List<TimeConflict>>
    suspend fun getGamesByFieldAndDate(fieldId: String, date: String): Result<List<Game>>
}
