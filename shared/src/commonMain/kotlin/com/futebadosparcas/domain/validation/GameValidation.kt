package com.futebadosparcas.domain.validation

/**
 * Constantes e validacoes de criacao/edicao de jogo, fonte-unica cross-platform (Android/iOS).
 *
 * Paridade com o Web: `web/src/utils/validationConstants.ts` (GAME_VALIDATION).
 * Mantenha os ranges alinhados manualmente entre este objeto e o arquivo TS
 * (o Web nao consegue importar Kotlin). Decisao SDD: spec #2400.
 */
object GameValidation {
    // Goleiros: alinhado com web MIN_GOALKEEPERS=0 / MAX_GOALKEEPERS=4
    const val MIN_GOALKEEPERS = 0
    const val MAX_GOALKEEPERS = 4
    const val DEFAULT_MAX_GOALKEEPERS = 3

    // Times: alinhado com web MIN_TEAMS=2 / MAX_TEAMS=4
    const val MIN_NUMBER_OF_TEAMS = 2
    const val MAX_NUMBER_OF_TEAMS = 4
    const val DEFAULT_NUMBER_OF_TEAMS = 2

    /** Retorna true se o numero maximo de goleiros esta no range valido (0..4). */
    fun isGoalkeepersValid(value: Int): Boolean =
        value in MIN_GOALKEEPERS..MAX_GOALKEEPERS

    /** Retorna true se o numero de times esta no range valido (2..4). */
    fun isNumberOfTeamsValid(value: Int): Boolean =
        value in MIN_NUMBER_OF_TEAMS..MAX_NUMBER_OF_TEAMS

    /** Limita um valor de goleiros ao range valido (clamp). */
    fun coerceGoalkeepers(value: Int): Int =
        value.coerceIn(MIN_GOALKEEPERS, MAX_GOALKEEPERS)

    /** Limita um valor de times ao range valido (clamp). */
    fun coerceNumberOfTeams(value: Int): Int =
        value.coerceIn(MIN_NUMBER_OF_TEAMS, MAX_NUMBER_OF_TEAMS)
}
