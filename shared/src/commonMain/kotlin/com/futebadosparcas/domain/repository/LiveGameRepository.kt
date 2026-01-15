package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.GameEventType
import com.futebadosparcas.domain.model.LivePlayerStats
import com.futebadosparcas.domain.model.LiveScore
import kotlinx.coroutines.flow.Flow

/**
 * Repositório para gerenciamento de jogos ao vivo.
 *
 * Responsável por:
 * - Iniciar/finalizar jogos ao vivo
 * - Gerenciar placar em tempo real
 * - Registrar eventos (gols, assistências, cartões, defesas)
 * - Acompanhar estatísticas dos jogadores
 * - Controlar permissões (apenas owner ou jogadores confirmados podem adicionar eventos)
 */
interface LiveGameRepository {

    /**
     * Inicia um jogo ao vivo, criando o documento de placar.
     *
     * @param gameId ID do jogo
     * @param team1Id ID do time 1
     * @param team2Id ID do time 2
     * @return Result<LiveScore> com o placar inicial criado
     */
    suspend fun startLiveGame(gameId: String, team1Id: String, team2Id: String): Result<LiveScore>

    /**
     * Observa o placar do jogo em tempo real.
     *
     * @param gameId ID do jogo
     * @return Flow<LiveScore?> com atualizações do placar (null se não existir)
     */
    fun observeLiveScore(gameId: String): Flow<LiveScore?>

    /**
     * Adiciona um evento ao jogo (gol, cartão, defesa, etc).
     * Apenas owner ou jogadores confirmados podem adicionar eventos.
     *
     * @param gameId ID do jogo
     * @param eventType Tipo do evento (GOAL, ASSIST, SAVE, YELLOW_CARD, RED_CARD)
     * @param playerId ID do jogador
     * @param playerName Nome do jogador
     * @param teamId ID do time
     * @param assistedById ID do jogador que fez a assistência (opcional)
     * @param assistedByName Nome do jogador que fez a assistência (opcional)
     * @param minute Minuto do jogo em que o evento ocorreu
     * @return Result<GameEvent> com o evento criado
     */
    suspend fun addGameEvent(
        gameId: String,
        eventType: GameEventType,
        playerId: String,
        playerName: String,
        teamId: String,
        assistedById: String? = null,
        assistedByName: String? = null,
        minute: Int = 0
    ): Result<GameEvent>

    /**
     * Deleta um evento do jogo e reverte as estatísticas correspondentes.
     * Para GOAL: decrementa placar do time e gols do jogador
     * Para ASSIST: decrementa assistências do assistente
     * Para YELLOW_CARD/RED_CARD: decrementa cartões do jogador
     * Para SAVE: decrementa defesas do jogador
     * Apenas owner ou jogadores confirmados podem deletar eventos.
     *
     * @param gameId ID do jogo
     * @param eventId ID do evento a ser deletado
     * @return Result<Unit>
     */
    suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit>

    /**
     * Observa os eventos do jogo em tempo real.
     *
     * @param gameId ID do jogo
     * @return Flow<List<GameEvent>> com lista de eventos ordenados por data de criação (mais recentes primeiro)
     */
    fun observeGameEvents(gameId: String): Flow<List<GameEvent>>

    /**
     * Observa as estatísticas dos jogadores em tempo real.
     *
     * @param gameId ID do jogo
     * @return Flow<List<LivePlayerStats>> com estatísticas de todos os jogadores
     */
    fun observeLivePlayerStats(gameId: String): Flow<List<LivePlayerStats>>

    /**
     * Finaliza o jogo, marcando timestamp de finalização.
     *
     * @param gameId ID do jogo
     * @return Result<Unit>
     */
    suspend fun finishGame(gameId: String): Result<Unit>

    /**
     * Busca as estatísticas finais do jogo.
     *
     * @param gameId ID do jogo
     * @return Result<List<LivePlayerStats>> com estatísticas de todos os jogadores
     */
    suspend fun getFinalStats(gameId: String): Result<List<LivePlayerStats>>

    /**
     * Limpa TODOS os dados de jogos ao vivo (apenas para debug/teste).
     * ATENÇÃO: Esta operação é irreversível e afeta TODOS os jogos.
     *
     * @return Result<Unit>
     */
    suspend fun clearAll(): Result<Unit>
}
