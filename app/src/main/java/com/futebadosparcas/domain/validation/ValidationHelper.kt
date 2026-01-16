package com.futebadosparcas.domain.validation

import java.util.Date
import java.util.regex.Pattern

/**
 * Utilitário central de validação para o app Futeba dos Parças.
 *
 * Contém funções de validação para strings, números, timestamps e dados de negócio.
 * Projetado para ser KMP-ready (sem dependências Android-específicas).
 *
 * Uso:
 * ```kotlin
 * // Validação simples (boolean)
 * if (!ValidationHelper.isValidEmail(email)) { ... }
 *
 * // Validação com resultado detalhado
 * val result = ValidationHelper.validateEmail(email, "email")
 * if (result is ValidationResult.Invalid) {
 *     showError(result.message)
 * }
 * ```
 */
object ValidationHelper {

    // ==================== CONSTANTES ====================

    /** Tamanho mínimo para nomes */
    const val NAME_MIN_LENGTH = 2

    /** Tamanho máximo para nomes */
    const val NAME_MAX_LENGTH = 100

    /** Tamanho máximo para descrições */
    const val DESCRIPTION_MAX_LENGTH = 500

    /** Rating mínimo (0.0) */
    const val RATING_MIN = 0.0

    /** Rating máximo (5.0) */
    const val RATING_MAX = 5.0

    /** League rating mínimo (0.0) */
    const val LEAGUE_RATING_MIN = 0.0

    /** League rating máximo (100.0) */
    const val LEAGUE_RATING_MAX = 100.0

    /** Nível mínimo do jogador */
    const val LEVEL_MIN = 0

    /** Nível máximo do jogador */
    const val LEVEL_MAX = 10

    /** XP mínimo */
    const val XP_MIN = 0L

    /** Anti-cheat: máximo de gols por jogo */
    const val MAX_GOALS_PER_GAME = 15

    /** Anti-cheat: máximo de assistências por jogo */
    const val MAX_ASSISTS_PER_GAME = 10

    /** Anti-cheat: máximo de defesas por jogo */
    const val MAX_SAVES_PER_GAME = 30

    /** Anti-cheat: máximo de XP por jogo */
    const val MAX_XP_PER_GAME = 500

    // ==================== REGEX PATTERNS ====================

    /** Pattern para validação de email (RFC 5322 simplificado) */
    private val EMAIL_PATTERN: Pattern = Pattern.compile(
        "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
    )

    /** Pattern para validação de telefone brasileiro */
    private val PHONE_PATTERN: Pattern = Pattern.compile(
        "^\\+?55?\\s?\\(?\\d{2}\\)?\\s?9?\\d{4}[-.\\s]?\\d{4}$"
    )

    /** Pattern para nomes (letras Unicode, números, espaços, hífen, underscore, apóstrofo) */
    private val NAME_PATTERN: Pattern = Pattern.compile(
        "^[\\p{L}\\p{N}\\s\\-_']+$"
    )

    /** Pattern para detectar tags HTML/scripts (para sanitização) */
    private val HTML_PATTERN: Pattern = Pattern.compile(
        "<[^>]*>|&[a-zA-Z]+;",
        Pattern.CASE_INSENSITIVE
    )

    // ==================== VALIDAÇÕES DE STRING ====================

    /**
     * Verifica se o email tem formato válido.
     *
     * @param email Email a ser validado
     * @return true se o formato é válido
     */
    fun isValidEmail(email: String?): Boolean {
        if (email.isNullOrBlank()) return false
        return EMAIL_PATTERN.matcher(email.trim()).matches()
    }

    /**
     * Valida email com resultado detalhado.
     */
    fun validateEmail(email: String?, fieldName: String = "email"): ValidationResult {
        if (email.isNullOrBlank()) {
            return ValidationResult.invalid(
                fieldName,
                "Email é obrigatório",
                ValidationErrorCode.REQUIRED_FIELD
            )
        }
        if (!EMAIL_PATTERN.matcher(email.trim()).matches()) {
            return ValidationResult.invalid(
                fieldName,
                "Formato de email inválido",
                ValidationErrorCode.INVALID_EMAIL
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Verifica se o nome tem formato e tamanho válidos.
     *
     * @param name Nome a ser validado
     * @param min Tamanho mínimo (default: 2)
     * @param max Tamanho máximo (default: 100)
     * @return true se válido
     */
    fun isValidName(name: String?, min: Int = NAME_MIN_LENGTH, max: Int = NAME_MAX_LENGTH): Boolean {
        if (name.isNullOrBlank()) return false
        val trimmed = name.trim()
        if (trimmed.length < min || trimmed.length > max) return false
        return NAME_PATTERN.matcher(trimmed).matches()
    }

    /**
     * Valida nome com resultado detalhado.
     */
    fun validateName(
        name: String?,
        fieldName: String = "nome",
        min: Int = NAME_MIN_LENGTH,
        max: Int = NAME_MAX_LENGTH,
        required: Boolean = true
    ): ValidationResult {
        if (name.isNullOrBlank()) {
            return if (required) {
                ValidationResult.invalid(
                    fieldName,
                    "Nome é obrigatório",
                    ValidationErrorCode.REQUIRED_FIELD
                )
            } else {
                ValidationResult.Valid
            }
        }

        val trimmed = name.trim()
        if (trimmed.length < min) {
            return ValidationResult.invalid(
                fieldName,
                "Nome deve ter pelo menos $min caracteres",
                ValidationErrorCode.INVALID_LENGTH
            )
        }
        if (trimmed.length > max) {
            return ValidationResult.invalid(
                fieldName,
                "Nome deve ter no máximo $max caracteres",
                ValidationErrorCode.INVALID_LENGTH
            )
        }
        if (!NAME_PATTERN.matcher(trimmed).matches()) {
            return ValidationResult.invalid(
                fieldName,
                "Nome contém caracteres inválidos",
                ValidationErrorCode.INVALID_FORMAT
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Verifica se o tamanho da string está dentro do limite.
     */
    fun isValidLength(value: String?, min: Int = 0, max: Int = Int.MAX_VALUE): Boolean {
        if (value == null) return min == 0
        return value.length in min..max
    }

    /**
     * Valida tamanho de string com resultado detalhado.
     */
    fun validateLength(
        value: String?,
        fieldName: String,
        min: Int = 0,
        max: Int = DESCRIPTION_MAX_LENGTH,
        required: Boolean = false
    ): ValidationResult {
        if (value.isNullOrEmpty()) {
            return if (required && min > 0) {
                ValidationResult.invalid(
                    fieldName,
                    "$fieldName é obrigatório",
                    ValidationErrorCode.REQUIRED_FIELD
                )
            } else {
                ValidationResult.Valid
            }
        }

        if (value.length < min) {
            return ValidationResult.invalid(
                fieldName,
                "$fieldName deve ter pelo menos $min caracteres",
                ValidationErrorCode.INVALID_LENGTH
            )
        }
        if (value.length > max) {
            return ValidationResult.invalid(
                fieldName,
                "$fieldName deve ter no máximo $max caracteres",
                ValidationErrorCode.INVALID_LENGTH
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Verifica se o telefone tem formato válido (brasileiro).
     */
    fun isValidPhone(phone: String?): Boolean {
        if (phone.isNullOrBlank()) return false
        val cleaned = phone.replace("[^+0-9]".toRegex(), "")
        return cleaned.length in 10..14
    }

    /**
     * Remove tags HTML e scripts de texto para prevenir XSS.
     *
     * @param text Texto a ser sanitizado
     * @return Texto sem tags HTML
     */
    fun sanitizeText(text: String?): String {
        if (text.isNullOrEmpty()) return ""
        return HTML_PATTERN.matcher(text).replaceAll("").trim()
    }

    /**
     * Sanitiza e valida texto de entrada.
     */
    fun sanitizeAndValidate(
        text: String?,
        fieldName: String,
        maxLength: Int = DESCRIPTION_MAX_LENGTH
    ): Pair<String, ValidationResult> {
        val sanitized = sanitizeText(text)
        val validation = validateLength(sanitized, fieldName, 0, maxLength)
        return Pair(sanitized, validation)
    }

    // ==================== VALIDAÇÕES NUMÉRICAS ====================

    /**
     * Verifica se o rating está no range válido (0.0 - 5.0).
     */
    fun isValidRating(rating: Double?): Boolean {
        if (rating == null) return true // nullable é válido
        return rating in RATING_MIN..RATING_MAX
    }

    /**
     * Valida rating com resultado detalhado.
     */
    fun validateRating(rating: Double?, fieldName: String = "rating"): ValidationResult {
        if (rating == null) return ValidationResult.Valid
        if (rating < RATING_MIN || rating > RATING_MAX) {
            return ValidationResult.invalid(
                fieldName,
                "Rating deve estar entre $RATING_MIN e $RATING_MAX",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Normaliza rating para o range válido (0.0 - 5.0).
     */
    fun normalizeRating(rating: Double): Double {
        return rating.coerceIn(RATING_MIN, RATING_MAX)
    }

    /**
     * Verifica se o league rating está no range válido (0.0 - 100.0).
     */
    fun isValidLeagueRating(rating: Double?): Boolean {
        if (rating == null) return true
        return rating in LEAGUE_RATING_MIN..LEAGUE_RATING_MAX
    }

    /**
     * Valida league rating com resultado detalhado.
     */
    fun validateLeagueRating(rating: Double?, fieldName: String = "league_rating"): ValidationResult {
        if (rating == null) return ValidationResult.Valid
        if (rating < LEAGUE_RATING_MIN || rating > LEAGUE_RATING_MAX) {
            return ValidationResult.invalid(
                fieldName,
                "League rating deve estar entre $LEAGUE_RATING_MIN e $LEAGUE_RATING_MAX",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Normaliza league rating para o range válido (0.0 - 100.0).
     */
    fun normalizeLeagueRating(rating: Double): Double {
        return rating.coerceIn(LEAGUE_RATING_MIN, LEAGUE_RATING_MAX)
    }

    /**
     * Verifica se o nível está no range válido (0 - 10).
     */
    fun isValidLevel(level: Int?): Boolean {
        if (level == null) return true
        return level in LEVEL_MIN..LEVEL_MAX
    }

    /**
     * Valida nível com resultado detalhado.
     */
    fun validateLevel(level: Int?, fieldName: String = "level"): ValidationResult {
        if (level == null) return ValidationResult.Valid
        if (level < LEVEL_MIN || level > LEVEL_MAX) {
            return ValidationResult.invalid(
                fieldName,
                "Nível deve estar entre $LEVEL_MIN e $LEVEL_MAX",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Verifica se o valor é positivo (> 0).
     */
    fun isPositive(amount: Double?): Boolean {
        if (amount == null) return false
        return amount > 0
    }

    /**
     * Valida valor positivo com resultado detalhado.
     */
    fun validatePositive(amount: Double?, fieldName: String): ValidationResult {
        if (amount == null) {
            return ValidationResult.invalid(
                fieldName,
                "$fieldName é obrigatório",
                ValidationErrorCode.REQUIRED_FIELD
            )
        }
        if (amount <= 0) {
            return ValidationResult.invalid(
                fieldName,
                "$fieldName deve ser maior que zero",
                ValidationErrorCode.NEGATIVE_VALUE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Verifica se o valor é não-negativo (>= 0).
     */
    fun isNonNegative(value: Int?): Boolean {
        if (value == null) return true
        return value >= 0
    }

    /**
     * Valida valor não-negativo com resultado detalhado.
     */
    fun validateNonNegative(value: Int?, fieldName: String): ValidationResult {
        if (value == null) return ValidationResult.Valid
        if (value < 0) {
            return ValidationResult.invalid(
                fieldName,
                "$fieldName não pode ser negativo",
                ValidationErrorCode.NEGATIVE_VALUE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Verifica se o XP é válido (>= 0).
     */
    fun isValidXP(xp: Long?): Boolean {
        if (xp == null) return true
        return xp >= XP_MIN
    }

    // ==================== VALIDAÇÕES ANTI-CHEAT ====================

    /**
     * Valida estatísticas de jogo contra limites anti-cheat.
     */
    fun validateGameStats(
        goals: Int,
        assists: Int,
        saves: Int
    ): ValidationResult {
        if (goals < 0) {
            return ValidationResult.invalid("goals", "Gols não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE)
        }
        if (goals > MAX_GOALS_PER_GAME) {
            return ValidationResult.invalid("goals", "Máximo de $MAX_GOALS_PER_GAME gols por jogo", ValidationErrorCode.OUT_OF_RANGE)
        }
        if (assists < 0) {
            return ValidationResult.invalid("assists", "Assistências não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE)
        }
        if (assists > MAX_ASSISTS_PER_GAME) {
            return ValidationResult.invalid("assists", "Máximo de $MAX_ASSISTS_PER_GAME assistências por jogo", ValidationErrorCode.OUT_OF_RANGE)
        }
        if (saves < 0) {
            return ValidationResult.invalid("saves", "Defesas não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE)
        }
        if (saves > MAX_SAVES_PER_GAME) {
            return ValidationResult.invalid("saves", "Máximo de $MAX_SAVES_PER_GAME defesas por jogo", ValidationErrorCode.OUT_OF_RANGE)
        }
        return ValidationResult.Valid
    }

    /**
     * Valida XP contra limite anti-cheat.
     */
    fun validateXPGain(xp: Int): ValidationResult {
        if (xp < 0) {
            return ValidationResult.invalid("xp", "XP não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE)
        }
        if (xp > MAX_XP_PER_GAME) {
            return ValidationResult.invalid("xp", "Máximo de $MAX_XP_PER_GAME XP por jogo", ValidationErrorCode.OUT_OF_RANGE)
        }
        return ValidationResult.Valid
    }

    // ==================== VALIDAÇÕES DE TIMESTAMP ====================

    /**
     * Verifica se a ordem de timestamps é válida (createdAt <= updatedAt).
     */
    fun isValidTimestampOrder(createdAt: Date?, updatedAt: Date?): Boolean {
        if (createdAt == null || updatedAt == null) return true
        return !createdAt.after(updatedAt)
    }

    /**
     * Valida ordem de timestamps com resultado detalhado.
     */
    fun validateTimestampOrder(createdAt: Date?, updatedAt: Date?): ValidationResult {
        if (createdAt == null || updatedAt == null) return ValidationResult.Valid
        if (createdAt.after(updatedAt)) {
            return ValidationResult.invalid(
                "timestamps",
                "Data de criação não pode ser posterior à data de atualização",
                ValidationErrorCode.INVALID_TIMESTAMP
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Verifica se a data é futura.
     */
    fun isFutureDate(date: Date?): Boolean {
        if (date == null) return false
        return date.after(Date())
    }

    /**
     * Verifica se a data é passada.
     */
    fun isPastDate(date: Date?): Boolean {
        if (date == null) return false
        return date.before(Date())
    }

    // ==================== VALIDAÇÃO EM LOTE ====================

    /**
     * Valida uma lista de itens e retorna todos os erros.
     */
    fun <T> validateBatch(
        items: List<T>,
        validator: (T) -> ValidationResult
    ): List<ValidationResult.Invalid> {
        return items.mapNotNull { item ->
            val result = validator(item)
            if (result is ValidationResult.Invalid) result else null
        }
    }

    /**
     * Verifica se todos os itens de uma lista são válidos.
     */
    fun <T> areAllValid(
        items: List<T>,
        validator: (T) -> Boolean
    ): Boolean {
        return items.all { validator(it) }
    }
}
