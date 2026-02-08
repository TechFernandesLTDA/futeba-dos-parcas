package com.futebadosparcas.domain.model

/**
 * Type aliases para tipos de ID recorrentes no dominio.
 *
 * Melhora legibilidade das assinaturas de funcoes e repositorios,
 * tornando explicito o que cada String representa.
 *
 * Uso:
 * ```kotlin
 * // Antes:
 * fun getUser(userId: String): User
 * fun getGame(gameId: String): Game
 *
 * // Depois:
 * fun getUser(userId: UserId): User
 * fun getGame(gameId: GameId): Game
 * ```
 *
 * Nota: typealiases sao aliases de compilacao e NAO criam tipos novos.
 * Servem apenas para documentacao e legibilidade.
 */

/** ID unico de usuario */
typealias UserId = String

/** ID unico de jogo/partida */
typealias GameId = String

/** ID unico de grupo */
typealias GroupId = String

/** ID unico de temporada */
typealias SeasonId = String

/** ID unico de local */
typealias LocationId = String

/** ID unico de quadra/campo */
typealias FieldId = String

/** ID unico de badge */
typealias BadgeId = String

/** ID unico de agenda/schedule */
typealias ScheduleId = String

/** Timestamp em milissegundos (epoch) */
typealias EpochMillis = Long

/** URL como String */
typealias UrlString = String
