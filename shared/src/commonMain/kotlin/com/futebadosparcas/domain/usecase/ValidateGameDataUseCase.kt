package com.futebadosparcas.domain.usecase

/**
 * Use Case para validacao de dados de criacao/edicao de jogo.
 * Logica pura, compartilhavel entre plataformas.
 *
 * Centraliza todas as regras de validacao de jogo para garantir
 * consistencia entre Android e iOS.
 */
object ValidateGameDataUseCase {

    /** Resultado de validacao com multiplos erros possiveis */
    data class GameValidationResult(
        val errors: List<String> = emptyList()
    ) {
        val isValid: Boolean get() = errors.isEmpty()
        val firstError: String? get() = errors.firstOrNull()
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
        maxGoalkeepers: Int = 3,
        numberOfTeams: Int = 2,
        dailyPrice: Double = 0.0,
        locationName: String = ""
    ): GameValidationResult {
        val errors = mutableListOf<String>()

        // Validar data
        if (date.isBlank()) {
            errors.add("Data do jogo e obrigatoria")
        }

        // Validar horario
        if (time.isBlank()) {
            errors.add("Horario do jogo e obrigatorio")
        } else if (!isValidTimeFormat(time)) {
            errors.add("Formato de horario invalido (use HH:mm)")
        }

        // Validar jogadores
        if (maxPlayers < 4) {
            errors.add("Numero minimo de jogadores e 4")
        }
        if (maxPlayers > 40) {
            errors.add("Numero maximo de jogadores e 40")
        }

        // Validar goleiros
        if (maxGoalkeepers < 0) {
            errors.add("Numero de goleiros nao pode ser negativo")
        }
        if (maxGoalkeepers > maxPlayers / 2) {
            errors.add("Numero de goleiros nao pode exceder metade dos jogadores")
        }

        // Validar times
        if (numberOfTeams < 2) {
            errors.add("Numero minimo de times e 2")
        }
        if (numberOfTeams > 4) {
            errors.add("Numero maximo de times e 4")
        }

        // Validar preco
        if (dailyPrice < 0) {
            errors.add("Preco nao pode ser negativo")
        }
        if (dailyPrice > 500.0) {
            errors.add("Preco maximo e R$ 500,00")
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
            maxPlayers < 4 -> ValidationResult.Error("Minimo 4 jogadores")
            maxPlayers > 40 -> ValidationResult.Error("Maximo 40 jogadores")
            else -> ValidationResult.Success(maxPlayers.toString())
        }
    }

    /**
     * Valida preco diario.
     */
    fun validateDailyPrice(price: Double): ValidationResult {
        return when {
            price < 0 -> ValidationResult.Error("Preco nao pode ser negativo")
            price > 500.0 -> ValidationResult.Error("Preco maximo e R$ 500,00")
            else -> ValidationResult.Success(price.toString())
        }
    }

    /**
     * Verifica se o formato de horario e valido (HH:mm).
     */
    private fun isValidTimeFormat(time: String): Boolean {
        val regex = Regex("^([01]?\\d|2[0-3]):[0-5]\\d$")
        return time.matches(regex)
    }
}
