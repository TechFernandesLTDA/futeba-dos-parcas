package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.GameFilterType
import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.domain.model.GameWithConfirmations
import com.futebadosparcas.domain.model.LiveScore
import com.futebadosparcas.domain.model.PaginatedGames
import com.futebadosparcas.domain.model.Team
import com.futebadosparcas.domain.model.TimeConflict
import kotlinx.coroutines.flow.Flow

/**
 * Interface de repositorio de jogos (versao KMP completa).
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 */
interface GameRepository {

    // ========== BASIC QUERIES ==========

    /**
     * Busca jogos proximos (futuros).
     */
    suspend fun getUpcomingGames(): Result<List<Game>>

    /**
     * Busca todos os jogos (sem filtro).
     */
    suspend fun getAllGames(): Result<List<Game>>

    /**
     * Busca todos os jogos com contagem de confirmacoes.
     */
    suspend fun getAllGamesWithConfirmationCount(): Result<List<GameWithConfirmations>>

    /**
     * Flow de todos os jogos com contagem de confirmacoes.
     */
    fun getAllGamesWithConfirmationCountFlow(): Flow<Result<List<GameWithConfirmations>>>

    /**
     * Busca jogos confirmados pelo usuario atual.
     */
    suspend fun getConfirmedUpcomingGamesForUser(): Result<List<Game>>

    // ========== OPTIMIZED UI QUERIES (Fase 1) ==========

    /**
     * Flow de jogos ao vivo e proximos (otimizado para UI).
     */
    fun getLiveAndUpcomingGamesFlow(): Flow<Result<List<GameWithConfirmations>>>

    /**
     * Flow de historico de jogos (otimizado para UI).
     */
    fun getHistoryGamesFlow(limit: Int = 20): Flow<Result<List<GameWithConfirmations>>>

    /**
     * Busca jogos por tipo de filtro.
     */
    suspend fun getGamesByFilter(filterType: GameFilterType): Result<List<GameWithConfirmations>>

    // ========== PAGINATION ==========

    /**
     * Busca jogos do historico com paginacao cursor-based.
     */
    suspend fun getHistoryGamesPaginated(
        pageSize: Int = 20,
        lastGameId: String? = null
    ): Result<PaginatedGames>

    // ========== GAME DETAILS ==========

    /**
     * Busca detalhes de um jogo por ID.
     */
    suspend fun getGameDetails(gameId: String): Result<Game>

    /**
     * Observa um jogo em tempo real por ID.
     */
    fun getGameDetailsFlow(gameId: String): Flow<Result<Game>>

    /**
     * Busca um jogo por ID (metodo simples).
     */
    suspend fun getGameById(gameId: String): Result<Game>

    /**
     * Observa um jogo em tempo real (metodo simples).
     */
    fun observeGame(gameId: String): Flow<Game?>

    // ========== GAME CREATION/UPDATE ==========

    /**
     * Cria um novo jogo.
     */
    suspend fun createGame(game: Game): Result<Game>

    /**
     * Atualiza um jogo existente.
     */
    suspend fun updateGame(game: Game): Result<Unit>

    /**
     * Atualiza o status do jogo.
     */
    suspend fun updateGameStatus(gameId: String, status: String): Result<Unit>

    /**
     * Atualiza o status do jogo (usando enum).
     */
    suspend fun updateGameStatus(gameId: String, status: GameStatus): Result<Unit>

    /**
     * Atualiza o placar do jogo.
     */
    suspend fun updateScore(gameId: String, team1Score: Int, team2Score: Int): Result<Unit>

    /**
     * Deleta um jogo.
     */
    suspend fun deleteGame(gameId: String): Result<Unit>

    /**
     * Limpa todos os dados (cache local).
     */
    suspend fun clearAll(): Result<Unit>

    // ========== CONFIRMATIONS ==========

    /**
     * Busca confirmacoes de um jogo.
     */
    suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>>

    /**
     * Flow de confirmacoes de um jogo.
     */
    fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>>

    /**
     * Confirma presenca em um jogo.
     */
    suspend fun confirmPresence(
        gameId: String,
        position: String = "FIELD",
        isCasual: Boolean = false
    ): Result<GameConfirmation>

    /**
     * Confirma presenca em um jogo (metodo simples).
     */
    suspend fun confirmPresence(gameId: String, userId: String, position: String): Result<Unit>

    /**
     * Cancela confirmacao de presenca.
     */
    suspend fun cancelConfirmation(gameId: String): Result<Unit>

    /**
     * Cancela presenca em um jogo (metodo simples).
     */
    suspend fun cancelPresence(gameId: String, userId: String): Result<Unit>

    /**
     * Remove um jogador de um jogo (admin).
     */
    suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit>

    /**
     * Busca quantidade de goleiros confirmados.
     */
    suspend fun getGoalkeeperCount(gameId: String): Result<Int>

    /**
     * Atualiza status de abertura de confirmacoes.
     */
    suspend fun updateGameConfirmationStatus(gameId: String, isOpen: Boolean): Result<Unit>

    /**
     * Atualiza status de pagamento de um jogador.
     */
    suspend fun updatePaymentStatus(gameId: String, userId: String, isPaid: Boolean): Result<Unit>

    // ========== TEAMS ==========

    /**
     * Gera times automaticamente (balanceados).
     */
    suspend fun generateTeams(
        gameId: String,
        numberOfTeams: Int = 2,
        balanceTeams: Boolean = true
    ): Result<List<Team>>

    /**
     * Busca times de um jogo.
     */
    suspend fun getGameTeams(gameId: String): Result<List<Team>>

    /**
     * Busca times de um jogo (metodo simples).
     */
    suspend fun getTeams(gameId: String): Result<List<Team>>

    /**
     * Flow de times de um jogo.
     */
    fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>>

    /**
     * Limpa times de um jogo.
     */
    suspend fun clearGameTeams(gameId: String): Result<Unit>

    /**
     * Salva times de um jogo (metodo simples).
     */
    suspend fun saveTeams(gameId: String, teams: List<Team>): Result<Unit>

    /**
     * Atualiza times de um jogo.
     */
    suspend fun updateTeams(teams: List<Team>): Result<Unit>

    // ========== TIME CONFLICTS ==========

    /**
     * Verifica se ha conflito de horario para uma quadra especifica.
     * Retorna lista de jogos conflitantes (vazia se não houver conflito).
     */
    suspend fun checkTimeConflict(
        fieldId: String,
        date: String,
        startTime: String,
        endTime: String,
        excludeGameId: String? = null
    ): Result<List<TimeConflict>>

    /**
     * Busca todos os jogos agendados para uma quadra em uma data especifica.
     */
    suspend fun getGamesByFieldAndDate(fieldId: String, date: String): Result<List<Game>>

    // ========== LIVE GAME EVENTS ==========

    /**
     * Flow de eventos de jogo em tempo real.
     */
    fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>>

    /**
     * Flow de placar ao vivo.
     */
    fun getLiveScoreFlow(gameId: String): Flow<LiveScore?>

    /**
     * Convoca jogadores para um jogo (notificacao).
     */
    suspend fun summonPlayers(gameId: String, confirmations: List<GameConfirmation>): Result<Unit>

    /**
     * Envia um evento de jogo.
     */
    suspend fun sendGameEvent(gameId: String, event: GameEvent): Result<Unit>

    /**
     * Deleta um evento de jogo.
     */
    suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit>

    // ========== PUBLIC GAMES DISCOVERY (FASE 1) ==========

    /**
     * Buscar jogos publicos (visibilidade PUBLIC_CLOSED ou PUBLIC_OPEN).
     */
    suspend fun getPublicGames(limit: Int = 20): Result<List<Game>>

    /**
     * Flow de jogos publicos em tempo real.
     */
    fun getPublicGamesFlow(limit: Int = 20): Flow<List<Game>>

    /**
     * Buscar jogos publicos proximos à localizacao do usuario.
     */
    suspend fun getNearbyPublicGames(
        userLat: Double,
        userLng: Double,
        radiusKm: Double = 10.0,
        limit: Int = 20
    ): Result<List<Game>>

    /**
     * Buscar jogos publicos que aceitam solicitacoes externas.
     */
    suspend fun getOpenPublicGames(limit: Int = 20): Result<List<Game>>

    // ========== ADDITIONAL QUERIES ==========

    /**
     * Lista jogos por grupo.
     */
    suspend fun getGamesByGroup(groupId: String, limit: Int = 20): Result<List<Game>>

    /**
     * Lista jogos por data.
     */
    suspend fun getGamesByDate(date: String): Result<List<Game>>

    /**
     * Lista proximos jogos do usuario (metodo simples).
     */
    suspend fun getUpcomingGames(userId: String, limit: Int = 10): Result<List<Game>>

    /**
     * Lista jogos recentes do usuario.
     */
    suspend fun getRecentGames(userId: String, limit: Int = 10): Result<List<Game>>

    /**
     * Observa confirmacoes em tempo real (metodo simples).
     */
    fun observeConfirmations(gameId: String): Flow<List<GameConfirmation>>

    // ========== INVITATION & MANAGEMENT ==========

    /**
     * Aceita um convite para jogo pendente.
     *
     * @param gameId ID do jogo
     * @param position Posicao preferida do jogador
     */
    suspend fun acceptInvitation(gameId: String, position: String = "FIELD"): Result<GameConfirmation>

    /**
     * Confirma um jogador como organizador/dono do jogo.
     *
     * @param gameId ID do jogo
     * @param userId ID do usuario a confirmar
     */
    suspend fun confirmPlayerAsOwner(gameId: String, userId: String): Result<Unit>

    // ========== SOFT DELETE & RESTORE (P2 #40) ==========

    /**
     * Marca um jogo como deletado (soft delete).
     * Permite restauracao posterior.
     *
     * @param gameId ID do jogo
     */
    suspend fun softDeleteGame(gameId: String): Result<Unit>

    /**
     * Restaura um jogo soft-deletado.
     * Disponivel apenas para admins/owners.
     *
     * @param gameId ID do jogo
     */
    suspend fun restoreGame(gameId: String): Result<Unit>

    // ========== PAYMENT MANAGEMENT ==========

    /**
     * Atualiza pagamento parcial de um jogador.
     *
     * @param gameId ID do jogo
     * @param userId ID do usuario
     * @param amount Valor pago
     */
    suspend fun updatePartialPayment(gameId: String, userId: String, amount: Double): Result<Unit>
}
