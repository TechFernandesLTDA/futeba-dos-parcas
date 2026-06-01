package com.futebadosparcas.domain.usecase

/**
 * Use Case para validacao de dados de criacao/edicao de jogo.
 * Logica pura, compartilhavel entre plataformas.
 *
 * Centraliza todas as regras de validacao de jogo para garantir
 * consistencia entre Android e iOS.
 */
object ValidateGameDataUseCase {

    // Limites de validacao centralizados
    const val MIN_PLAYERS = 2
    const val MAX_PLAYERS = 50
    const val MIN_TEAMS = 2
    const val MAX_TEAMS = 4
    const val MIN_GOALKEEPERS = 0
    const val MAX_DAILY_PRICE = 500.0
    const val MAX_LOCATION_NAME_LENGTH = 100
    const val DEFAULT_GOALKEEPERS = 3
    const val DEFAULT_TEAMS = 2

    /** Regex para formato de horario HH:mm */
    private val TIME_FORMAT_REGEX = Regex("^([01]?\\d|2[0-3]):[0-5]\\d$")

    /** Resultado de validacao com multiplos erros possiveis */
    data class GameValidationResult(
        val errors: List<String> = emptyList()
    ) {
        val isValid: Boolean get() = errors.isEmpty()
        val firstError: String? get() = errors.firstOrNull()

        /**
         * Combina com outro resultado de validacao.
         */
        operator fun plus(other: GameValidationResult): GameValidationResult {
            return GameValidationResult(errors + other.errors)
        }
    }

    /**
     * Valida todos os campos de um jogo.
     *
     * @param date Data do jogo (formato: "dd/MM/yyyy" ou similar)
     * @param time Horario do jogo (formato: "HH:mm")
     * @param maxPlayers Numero maximo de jogadores
     * @param maxGoalkeepers Numero maximo de goleiros
     * @param numberOfTeams Numero de times
     * @param dailyPrice Preco por jogador
     * @param locationName Nome do local
     * @return Resultado com lista de erros (vazia se valido)
     */
    operator fun invoke(
        date: String,
        time: String,
        maxPlayers: Int,
        maxGoalkeepers: Int = DEFAULT_GOALKEEPERS,
        numberOfTeams: Int = DEFAULT_TEAMS,
        dailyPrice: Double = 0.0,
        locationName: String = ""
    ): GameValidationResult {
        val errors = mutableListOf<String>()

        if (date.isBlank()) {
            errors.add("Data do jogo e obrigatoria")
        } else if (!isFutureDate(date)) {
            errors.add("Data do jogo deve ser no futuro")
        }

        // Validar horario
        if (time.isBlank()) {
            errors.add("Horario do jogo e obrigatorio")
        } else if (!isValidTimeFormat(time)) {
            errors.add("Formato de horario invalido (use HH:mm)")
        }

        // Validar jogadores
        if (maxPlayers < MIN_PLAYERS) {
            errors.add("Numero minimo de jogadores e $MIN_PLAYERS")
        }
        if (maxPlayers > MAX_PLAYERS) {
            errors.add("Numero maximo de jogadores e $MAX_PLAYERS")
        }

        // Validar goleiros
        if (maxGoalkeepers < MIN_GOALKEEPERS) {
            errors.add("Numero de goleiros nao pode ser negativo")
        }
        if (maxGoalkeepers > maxPlayers / 2) {
            errors.add("Numero de goleiros nao pode exceder metade dos jogadores")
        }

        // Validar times
        if (numberOfTeams < MIN_TEAMS) {
            errors.add("Numero minimo de times e $MIN_TEAMS")
        }
        if (numberOfTeams > MAX_TEAMS) {
            errors.add("Numero maximo de times e $MAX_TEAMS")
        }

        // Validar preco
        if (dailyPrice < 0) {
            errors.add("Preco nao pode ser negativo")
        }
        if (dailyPrice > MAX_DAILY_PRICE) {
            errors.add("Preco maximo e R$ ${MAX_DAILY_PRICE.toInt()},00")
        }

        // Validar local
        if (locationName.isBlank()) {
            errors.add("Nome do local e obrigatorio")
        } else if (locationName.length > MAX_LOCATION_NAME_LENGTH) {
            errors.add("Nome do local deve ter no maximo $MAX_LOCATION_NAME_LENGTH caracteres")
        }

        return GameValidationResult(errors)
    }

    /**
     * Valida apenas o horario no formato HH:mm.
     */
    fun validateTime(time: String): ValidationResult {
        if (time.isBlank()) {
            return ValidationResult.Error("Horario e obrigatorio")
        }
        if (!isValidTimeFormat(time)) {
            return ValidationResult.Error("Formato invalido (use HH:mm)")
        }
        return ValidationResult.Success(time)
    }

    /**
     * Valida numero de jogadores.
     */
    fun validateMaxPlayers(maxPlayers: Int): ValidationResult {
        return when {
            maxPlayers < MIN_PLAYERS -> ValidationResult.Error("Minimo $MIN_PLAYERS jogadores")
            maxPlayers > MAX_PLAYERS -> ValidationResult.Error("Maximo $MAX_PLAYERS jogadores")
            else -> ValidationResult.Success(maxPlayers.toString())
        }
    }

    /**
     * Valida preco diario.
     */
    fun validateDailyPrice(price: Double): ValidationResult {
        return when {
            price < 0 -> ValidationResult.Error("Preco nao pode ser negativo")
            price > MAX_DAILY_PRICE -> ValidationResult.Error("Preco maximo e R$ ${MAX_DAILY_PRICE.toInt()},00")
            else -> ValidationResult.Success(price.toString())
        }
    }

    /**
     * Verifica se o formato de horario e valido (HH:mm).
     */
    private fun isValidTimeFormat(time: String): Boolean {
        return time.matches(TIME_FORMAT_REGEX)
    }

    private fun isFutureDate(date: String): Boolean {
        val parts = date.split("/")
        if (parts.size != 3) return true
        val day = parts[0].toIntOrNull() ?: return true
        val month = parts[1].toIntOrNull() ?: return true
        val year = parts[2].toIntOrNull() ?: return true
        val today = kotlinx.datetime.Clock.System.now()
            .toEpochMilliseconds()
        val inputDays = kotlinx.datetime.LocalDate(year, month, day).toEpochDays()
        val todayDays = (today / (24 * 60 * 60 * 1000)).toInt()
        return inputDays >= todayDays - 1
    }
}
