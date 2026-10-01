package com.futebadosparcas.domain.model

import kotlinx.serialization.Serializable

/**
 * Combina um jogo com suas informacoes de confirmacao.
 * Usado para listas otimizadas de jogos.
 */
@Serializable
data class GameWithConfirmations(
    val game: Game,
    val confirmedCount: Int,
    val isUserConfirmed: Boolean = false
)

/**
 * Resultado de uma query paginada de jogos.
 */
@Serializable
data class PaginatedGames(
    val games: List<GameWithConfirmations>,
    val lastGameId: String?, // Cursor para proxima pagina
    val hasMore: Boolean
)

/**
 * Representa um conflito de horario encontrado.
 *
 * FIX #4127: nao carrega mais o `Game` inteiro (que, via LIST direta em
 * games, expunha metadados de jogos privados de outros grupos). O conflito
 * agora traz apenas o horario ocupado — a UI mostra "Horario ocupado
 * (HH:mm-HH:mm)", igual ao web.
 */
@Serializable
data class TimeConflict(
    val conflictingTime: String,
    val conflictingEndTime: String,
    val overlapMinutes: Int
)

/**
 * FIX #4127: slot ocupado sanitizado da callable `getFieldAvailability`
 * (sem ids, dono ou coordenadas — a autoridade de disponibilidade de
 * quadra migrou do web no fix #3688).
 */
@Serializable
data class FieldBusySlot(
    val date: String,
    val startMinutes: Int,
    val endMinutes: Int
)

/**
 * Tipos de filtro para listagem de jogos.
 */
@Serializable
enum class GameFilterType {
    ALL,           // Todos os jogos
    OPEN,          // Jogos abertos para confirmacao
    MY_GAMES,      // Jogos onde o usuario confirmou
    LIVE           // Jogos em andamento
}

/**
 * Filtro ortogonal de listagem de jogos (FASE 3).
 *
 * Combina o filtro de status ([type]) com um filtro opcional de genero
 * ([gender]). [gender] nulo significa "sem filtro de genero" (todos).
 * Mantido ortogonal a [GameFilterType] para nao explodir o enum existente.
 */
@Serializable
data class GameListFilter(
    val type: GameFilterType = GameFilterType.ALL,
    val gender: GameGender? = null
)

/**
 * Consolida dados de um jogo com suas confirmacoes e eventos.
 * Otimizacao para reduzir queries sequenciais (~300-400ms) para paralelas (~150-200ms).
 */
@Serializable
data class GameDetailConsolidated(
    val game: Game,
    val confirmations: List<GameConfirmation>,
    val events: List<GameEvent>,
    val teams: List<Team> = emptyList()
)
