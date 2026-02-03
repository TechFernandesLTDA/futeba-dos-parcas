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
    @Suppress("unused") private val PHONE_PATTERN: Pattern = Pattern.compile(
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

    /** Pattern para validação de CEP brasileiro (com ou sem hífen) */
    private val CEP_PATTERN: Pattern = Pattern.compile(
        "^\\d{5}-?\\d{3}$"
    )

    // ==================== VALIDAÇÕES DE CEP ====================

    /**
     * Verifica se o CEP tem formato válido (brasileiro).
     * Aceita com ou sem hífen: "12345678" ou "12345-678"
     *
     * @param cep CEP a ser validado
     * @return true se o formato é válido
     */
    fun isValidCep(cep: String?): Boolean {
        if (cep.isNullOrBlank()) return false
        return CEP_PATTERN.matcher(cep.trim()).matches()
    }

    /**
     * Valida CEP com resultado detalhado.
     *
     * @param cep CEP a ser validado
     * @param fieldName Nome do campo para mensagem de erro
     * @param required Se o campo é obrigatório
     * @return ValidationResult indicando se é válido ou inválido
     */
    fun validateCep(
        cep: String?,
        fieldName: String = "cep",
        required: Boolean = false
    ): ValidationResult {
        if (cep.isNullOrBlank()) {
            return if (required) {
                ValidationResult.invalid(
                    fieldName,
                    "CEP é obrigatório",
                    ValidationErrorCode.REQUIRED_FIELD
                )
            } else {
                ValidationResult.Valid
            }
        }

        if (!CEP_PATTERN.matcher(cep.trim()).matches()) {
            return ValidationResult.invalid(
                fieldName,
                "CEP inválido. Use o formato 12345-678 ou 12345678",
                ValidationErrorCode.INVALID_CEP
            )
        }

        return ValidationResult.Valid
    }

    /**
     * Formata CEP inserindo hífen automaticamente.
     * "12345678" → "12345-678"
     * "12345-678" → "12345-678" (mantém se já formatado)
     *
     * @param cep CEP a ser formatado (apenas dígitos ou já formatado)
     * @return CEP formatado com hífen ou string original se inválido
     */
    fun formatCep(cep: String?): String {
        if (cep.isNullOrBlank()) return ""

        val digitsOnly = cep.replace(Regex("[^0-9]"), "")

        return when {
            digitsOnly.length == 8 -> "${digitsOnly.substring(0, 5)}-${digitsOnly.substring(5)}"
            digitsOnly.length < 8 -> digitsOnly // Retorna parcial enquanto digita
            else -> digitsOnly.take(8).let { "${it.substring(0, 5)}-${it.substring(5)}" }
        }
    }

    /**
     * Remove formatação do CEP, mantendo apenas dígitos.
     * Útil para armazenamento no banco de dados.
     * "12345-678" → "12345678"
     *
     * @param cep CEP a ser sanitizado
     * @return CEP apenas com dígitos
     */
    fun sanitizeCep(cep: String?): String {
        if (cep.isNullOrBlank()) return ""
        return cep.replace(Regex("[^0-9]"), "")
    }

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
            return ValidationResult.invalid(
                "goals",
                "Máximo de $MAX_GOALS_PER_GAME gols por jogo",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        if (assists < 0) {
            return ValidationResult.invalid(
                "assists",
                "Assistências não pode ser negativo",
                ValidationErrorCode.NEGATIVE_VALUE
            )
        }
        if (assists > MAX_ASSISTS_PER_GAME) {
            return ValidationResult.invalid(
                "assists",
                "Máximo de $MAX_ASSISTS_PER_GAME assistências por jogo",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        if (saves < 0) {
            return ValidationResult.invalid(
                "saves",
                "Defesas não pode ser negativo",
                ValidationErrorCode.NEGATIVE_VALUE
            )
        }
        if (saves > MAX_SAVES_PER_GAME) {
            return ValidationResult.invalid(
                "saves",
                "Máximo de $MAX_SAVES_PER_GAME defesas por jogo",
                ValidationErrorCode.OUT_OF_RANGE
            )
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
            return ValidationResult.invalid(
                "xp",
                "Máximo de $MAX_XP_PER_GAME XP por jogo",
                ValidationErrorCode.OUT_OF_RANGE
            )
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

    // ==================== VALIDAÇÕES DE JOGO ====================

    /** Mínimo de jogadores para criar um jogo */
    const val MIN_PLAYERS_PER_GAME = 4

    /** Máximo de jogadores por jogo */
    const val MAX_PLAYERS_PER_GAME = 30

    /** Máximo de jogadores por time */
    const val MAX_PLAYERS_PER_TEAM = 15

    /** Duração mínima do jogo em minutos */
    const val MIN_GAME_DURATION_MINUTES = 15

    /** Duração máxima do jogo em minutos */
    const val MAX_GAME_DURATION_MINUTES = 240

    /** Máximo de membros por grupo */
    const val MAX_GROUP_MEMBERS = 100

    /** Valor mínimo de pagamento */
    const val MIN_PAYMENT_VALUE = 0.01

    /** Valor máximo de pagamento */
    const val MAX_PAYMENT_VALUE = 10000.0

    /**
     * Validação 1: Número de jogadores no jogo.
     * Verifica se a quantidade está entre o mínimo e máximo permitido.
     */
    fun validatePlayerCount(
        count: Int,
        fieldName: String = "jogadores"
    ): ValidationResult {
        if (count < MIN_PLAYERS_PER_GAME) {
            return ValidationResult.invalid(
                fieldName,
                "Mínimo de $MIN_PLAYERS_PER_GAME jogadores para um jogo",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        if (count > MAX_PLAYERS_PER_GAME) {
            return ValidationResult.invalid(
                fieldName,
                "Máximo de $MAX_PLAYERS_PER_GAME jogadores por jogo",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Validação 2: Equilíbrio de times.
     * Verifica se a diferença entre times é aceitável (máximo 1 jogador).
     */
    fun validateTeamBalance(
        teamASize: Int,
        teamBSize: Int
    ): ValidationResult {
        val diff = kotlin.math.abs(teamASize - teamBSize)
        if (diff > 1) {
            return ValidationResult.invalid(
                "teams",
                "Times devem ter no máximo 1 jogador de diferença (atual: $diff)",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        if (teamASize <= 0 || teamBSize <= 0) {
            return ValidationResult.invalid(
                "teams",
                "Cada time deve ter pelo menos 1 jogador",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Validação 3: Duração do jogo.
     * Verifica se a duração está dentro dos limites permitidos.
     */
    fun validateGameDuration(
        durationMinutes: Int,
        fieldName: String = "duração"
    ): ValidationResult {
        if (durationMinutes < MIN_GAME_DURATION_MINUTES) {
            return ValidationResult.invalid(
                fieldName,
                "Duração mínima de $MIN_GAME_DURATION_MINUTES minutos",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        if (durationMinutes > MAX_GAME_DURATION_MINUTES) {
            return ValidationResult.invalid(
                fieldName,
                "Duração máxima de $MAX_GAME_DURATION_MINUTES minutos",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Validação 4: Data do jogo é futura.
     * Jogos só podem ser agendados para datas futuras.
     */
    fun validateGameDate(
        gameDate: Date?,
        fieldName: String = "data do jogo"
    ): ValidationResult {
        if (gameDate == null) {
            return ValidationResult.invalid(
                fieldName,
                "Data do jogo é obrigatória",
                ValidationErrorCode.REQUIRED_FIELD
            )
        }
        if (!isFutureDate(gameDate)) {
            return ValidationResult.invalid(
                fieldName,
                "Data do jogo deve ser no futuro",
                ValidationErrorCode.INVALID_TIMESTAMP
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Validação 5: Valor de pagamento.
     * Valida valores monetários para caixinha/pagamentos.
     */
    fun validatePaymentValue(
        value: Double?,
        fieldName: String = "valor"
    ): ValidationResult {
        if (value == null) {
            return ValidationResult.invalid(
                fieldName,
                "Valor é obrigatório",
                ValidationErrorCode.REQUIRED_FIELD
            )
        }
        if (value < MIN_PAYMENT_VALUE) {
            return ValidationResult.invalid(
                fieldName,
                "Valor deve ser maior que R$ ${String.format("%.2f", MIN_PAYMENT_VALUE)}",
                ValidationErrorCode.NEGATIVE_VALUE
            )
        }
        if (value > MAX_PAYMENT_VALUE) {
            return ValidationResult.invalid(
                fieldName,
                "Valor máximo é R$ ${String.format("%.2f", MAX_PAYMENT_VALUE)}",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Validação 6: Tamanho do grupo.
     * Verifica se o número de membros não excede o limite.
     */
    fun validateGroupSize(
        memberCount: Int,
        fieldName: String = "membros"
    ): ValidationResult {
        if (memberCount <= 0) {
            return ValidationResult.invalid(
                fieldName,
                "Grupo deve ter pelo menos 1 membro",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        if (memberCount > MAX_GROUP_MEMBERS) {
            return ValidationResult.invalid(
                fieldName,
                "Máximo de $MAX_GROUP_MEMBERS membros por grupo",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Validação 7: ID de documento Firestore.
     * IDs devem ser strings não-vazias sem caracteres especiais perigosos.
     */
    fun isValidDocumentId(id: String?): Boolean {
        if (id.isNullOrBlank()) return false
        if (id.length > 128) return false
        // IDs não devem conter / ou . (reservados pelo Firestore)
        if (id.contains('/') || id.contains("..")) return false
        return true
    }

    /**
     * Validação 8: Coordenadas geográficas.
     * Latitude: -90 a 90, Longitude: -180 a 180.
     */
    fun validateCoordinates(
        latitude: Double?,
        longitude: Double?
    ): ValidationResult {
        if (latitude == null || longitude == null) {
            return ValidationResult.invalid(
                "coordenadas",
                "Coordenadas são obrigatórias",
                ValidationErrorCode.REQUIRED_FIELD
            )
        }
        if (latitude < -90.0 || latitude > 90.0) {
            return ValidationResult.invalid(
                "latitude",
                "Latitude deve estar entre -90 e 90",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        if (longitude < -180.0 || longitude > 180.0) {
            return ValidationResult.invalid(
                "longitude",
                "Longitude deve estar entre -180 e 180",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Validação 9: Score do jogo.
     * Scores não podem ser negativos e devem ter limites razoáveis.
     */
    fun validateGameScore(
        teamAScore: Int,
        teamBScore: Int
    ): ValidationResult {
        if (teamAScore < 0 || teamBScore < 0) {
            return ValidationResult.invalid(
                "placar",
                "Placar não pode ser negativo",
                ValidationErrorCode.NEGATIVE_VALUE
            )
        }
        val maxScore = 50 // Limite razoável para pelada
        if (teamAScore > maxScore || teamBScore > maxScore) {
            return ValidationResult.invalid(
                "placar",
                "Placar máximo é $maxScore gols por time",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Validação 10: URL da foto de perfil.
     * Verifica se é uma URL válida e de domínio permitido.
     */
    fun isValidPhotoUrl(url: String?): Boolean {
        if (url.isNullOrBlank()) return true // Foto é opcional
        if (url.length > 2048) return false
        // Aceitar apenas URLs https ou de Firebase Storage
        return url.startsWith("https://") ||
            url.startsWith("gs://")
    }

    /**
     * Validação 11: Número de times no jogo.
     * Para formação de times: mínimo 2, máximo 4.
     */
    fun validateTeamCount(
        teamCount: Int,
        fieldName: String = "times"
    ): ValidationResult {
        if (teamCount < 2) {
            return ValidationResult.invalid(
                fieldName,
                "Mínimo de 2 times",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        if (teamCount > 4) {
            return ValidationResult.invalid(
                fieldName,
                "Máximo de 4 times",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Validação 12: Streak de jogador.
     * Streak não pode ser negativo e tem limite de sanidade.
     */
    fun validateStreak(
        streak: Int,
        fieldName: String = "streak"
    ): ValidationResult {
        if (streak < 0) {
            return ValidationResult.invalid(
                fieldName,
                "Streak não pode ser negativo",
                ValidationErrorCode.NEGATIVE_VALUE
            )
        }
        val maxStreak = 365 // Máximo 1 ano seguido
        if (streak > maxStreak) {
            return ValidationResult.invalid(
                fieldName,
                "Streak máximo é $maxStreak jogos consecutivos",
                ValidationErrorCode.OUT_OF_RANGE
            )
        }
        return ValidationResult.Valid
    }

    /**
     * Validação completa para criação de jogo.
     * Combina múltiplas validações em uma chamada.
     */
    fun validateGameCreation(
        title: String?,
        playerCount: Int,
        gameDate: Date?,
        durationMinutes: Int
    ): List<ValidationResult.Invalid> {
        return ValidationResult.combineAll(
            validateName(title, "título do jogo", min = 3, max = 100),
            validatePlayerCount(playerCount),
            validateGameDate(gameDate),
            validateGameDuration(durationMinutes)
        )
    }
}
