package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.FieldBusySlot
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameDetailConsolidated
import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.GameFilterType
import com.futebadosparcas.domain.model.GameGender
import com.futebadosparcas.domain.model.GameWithConfirmations
import com.futebadosparcas.domain.model.PaginatedGames
import com.futebadosparcas.domain.model.Team
import com.futebadosparcas.domain.model.TimeConflict
import kotlinx.coroutines.flow.Flow

/**
 * Repositorio responsavel por queries e busca de jogos.
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 *
 * NOTA: Durante a migracao KMP, a implementacao Android pode retornar
 * tipos Android (com.futebadosparcas.data.model.*) que sao convertidos
 * para os tipos KMP (com.futebadosparcas.domain.model.) nos adaptadores.
 */
interface GameQueryRepository {
    /**
     * Busca jogos proximos (SCHEDULED e CONFIRMED).
     */
    suspend fun getUpcomingGames(): Result<List<Game>>

    /**
     * Busca todos os jogos.
     */
    suspend fun getAllGames(): Result<List<Game>>

    /**
     * Busca jogos opcionalmente filtrados por genero (FASE 3 — jogos
     * masculinos/femininos/mistos).
     *
     * [gender] nulo = sem filtro de genero (retorna [getAllGames]).
     * Filtro ortogonal: a implementacao aplica `whereEqualTo("gender", ...)`
     * no Firestore quando nao-nulo.
     *
     * NOTA: jogos legados sem o campo `gender` NAO sao retornados por uma
     * query de igualdade no Firestore. Para incluir jogos legados ao filtrar
     * por MIXED, prefira filtro client-side via [GameGender.fromString].
     *
     * Implementacao padrao delega para [getAllGames] (sem filtro) para manter
     * a mudanca aditiva e nao quebrar implementadores existentes.
     */
    suspend fun getGamesByGender(gender: GameGender?): Result<List<Game>> =
        getAllGames()

    /**
     * Busca todos os jogos com contagem de confirmacoes.
     */
    suspend fun getAllGamesWithConfirmationCount(): Result<List<GameWithConfirmations>>

    /**
     * Flow de todos os jogos com contagem de confirmacoes em tempo real.
     */
    fun getAllGamesWithConfirmationCountFlow(): Flow<Result<List<GameWithConfirmations>>>

    /**
     * Busca jogos confirmados pelo usuario.
     */
    suspend fun getConfirmedUpcomingGamesForUser(): Result<List<Game>>

    /**
     * Flow de jogos ao vivo e proximos.
     */
    fun getLiveAndUpcomingGamesFlow(): Flow<Result<List<GameWithConfirmations>>>

    /**
     * Flow de jogos de historico.
     */
    fun getHistoryGamesFlow(limit: Int = 20): Flow<Result<List<GameWithConfirmations>>>

    /**
     * Busca jogos por tipo de filtro.
     */
    suspend fun getGamesByFilter(filterType: GameFilterType): Result<List<GameWithConfirmations>>

    /**
     * Busca detalhes de um jogo.
     */
    suspend fun getGameDetails(gameId: String): Result<Game>

    /**
     * Flow de detalhes de um jogo em tempo real.
     */
    fun getGameDetailsFlow(gameId: String): Flow<Result<Game>>

    /**
     * Busca detalhes consolidados de um jogo (game + confirmacoes + events + teams).
     * Executa queries em paralelo para melhor performance (~150-200ms ao inves de ~300-400ms).
     */
    suspend fun getGameDetailConsolidated(gameId: String): Result<GameDetailConsolidated>

    /**
     * Busca jogos de historico com paginacao cursor-based.
     */
    suspend fun getHistoryGamesPaginated(
        pageSize: Int = 20,
        lastGameId: String? = null
    ): Result<PaginatedGames>

    // ========== Public Games Discovery (FASE 1 - Sistema de Privacidade) ==========

    /**
     * Buscar jogos publicos (visibilidade PUBLIC_CLOSED ou PUBLIC_OPEN).
     */
    suspend fun getPublicGames(limit: Int = 20): Result<List<Game>>

    /**
     * Flow de jogos publicos em tempo real.
     */
    fun getPublicGamesFlow(limit: Int = 20): Flow<List<Game>>

    /**
     * Buscar jogos publicos proximos a localizacao do usuario.
     */
    suspend fun getNearbyPublicGames(
        userLat: Double,
        userLng: Double,
        radiusKm: Double = 10.0,
        limit: Int = 20
    ): Result<List<Game>>

    /**
     * Buscar jogos publicos que aceitam solicitacoes externas (PUBLIC_OPEN).
     */
    suspend fun getOpenPublicGames(limit: Int = 20): Result<List<Game>>

    // ========== Field and Time Conflict ==========

    /**
     * Verifica se ha conflito de horario para uma quadra especifica.
     * Retorna lista de jogos conflitantes (vazia se nao houver conflito).
     */
    suspend fun checkTimeConflict(
        fieldId: String,
        date: String,
        startTime: String,
        endTime: String,
        excludeGameId: String? = null
    ): Result<List<TimeConflict>>

    /**
     * FIX #4127: disponibilidade de quadra via callable `getFieldAvailability`
     * (sanitizada, sem metadados de jogos privados). A LIST direta em games
     * vazava doc privado de outro grupo e, com as rules do #4126, viraria
     * double-booking silencioso.
     */
    suspend fun getFieldBusySlots(
        fieldId: String,
        startDate: String,
        endDate: String,
        excludeGameId: String? = null
    ): Result<List<FieldBusySlot>>
}
