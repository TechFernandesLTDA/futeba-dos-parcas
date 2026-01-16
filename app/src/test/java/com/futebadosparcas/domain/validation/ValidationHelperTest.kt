package com.futebadosparcas.domain.validation

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import java.util.Date

/**
 * Testes unitários para ValidationHelper.
 * Cobre todas as funções de validação para strings, números, ratings e timestamps.
 */
@DisplayName("ValidationHelper Tests")
class ValidationHelperTest {

    // ==================== TESTES DE EMAIL ====================

    @Nested
    @DisplayName("Validação de Email")
    inner class EmailValidation {

        @Test
        @DisplayName("Email válido deve retornar true")
        fun `valid email should return true`() {
            assertTrue(ValidationHelper.isValidEmail("test@example.com"))
            assertTrue(ValidationHelper.isValidEmail("user.name@domain.org"))
            assertTrue(ValidationHelper.isValidEmail("user+tag@company.co.br"))
        }

        @Test
        @DisplayName("Email inválido deve retornar false")
        fun `invalid email should return false`() {
            assertFalse(ValidationHelper.isValidEmail("invalid"))
            assertFalse(ValidationHelper.isValidEmail("@domain.com"))
            assertFalse(ValidationHelper.isValidEmail("user@"))
            assertFalse(ValidationHelper.isValidEmail("user@domain"))
            assertFalse(ValidationHelper.isValidEmail("user domain.com"))
        }

        @Test
        @DisplayName("Email nulo ou vazio deve retornar true (opcional)")
        fun `null or empty email should return true`() {
            assertTrue(ValidationHelper.isValidEmail(null))
            assertTrue(ValidationHelper.isValidEmail(""))
            assertTrue(ValidationHelper.isValidEmail("   "))
        }

        @Test
        @DisplayName("validateEmail deve retornar Valid para email correto")
        fun `validateEmail should return Valid for correct email`() {
            val result = ValidationHelper.validateEmail("test@example.com")
            assertTrue(result is ValidationResult.Valid)
        }

        @Test
        @DisplayName("validateEmail deve retornar Invalid para email incorreto")
        fun `validateEmail should return Invalid for incorrect email`() {
            val result = ValidationHelper.validateEmail("invalid-email")
            assertTrue(result is ValidationResult.Invalid)
            assertEquals("email", (result as ValidationResult.Invalid).field)
        }
    }

    // ==================== TESTES DE NOME ====================

    @Nested
    @DisplayName("Validação de Nome")
    inner class NameValidation {

        @Test
        @DisplayName("Nome válido deve retornar true")
        fun `valid name should return true`() {
            assertTrue(ValidationHelper.isValidName("João"))
            assertTrue(ValidationHelper.isValidName("Maria Silva"))
            assertTrue(ValidationHelper.isValidName("AB")) // min 2 chars
        }

        @Test
        @DisplayName("Nome muito curto deve retornar false")
        fun `too short name should return false`() {
            assertFalse(ValidationHelper.isValidName("A"))
            assertFalse(ValidationHelper.isValidName(""))
        }

        @Test
        @DisplayName("Nome muito longo deve retornar false")
        fun `too long name should return false`() {
            val longName = "A".repeat(101)
            assertFalse(ValidationHelper.isValidName(longName))
        }

        @Test
        @DisplayName("Nome nulo deve retornar false")
        fun `null name should return false`() {
            assertFalse(ValidationHelper.isValidName(null))
        }

        @Test
        @DisplayName("validateName deve retornar Invalid com código correto")
        fun `validateName should return Invalid with correct code`() {
            val result = ValidationHelper.validateName("A", "name")
            assertTrue(result is ValidationResult.Invalid)
            assertEquals(ValidationErrorCode.INVALID_LENGTH, (result as ValidationResult.Invalid).code)
        }
    }

    // ==================== TESTES DE RATING (0-5) ====================

    @Nested
    @DisplayName("Validação de Rating (0-5)")
    inner class RatingValidation {

        @ParameterizedTest
        @ValueSource(doubles = [0.0, 1.0, 2.5, 3.0, 4.5, 5.0])
        @DisplayName("Rating válido (0-5) deve retornar true")
        fun `valid rating should return true`(rating: Double) {
            assertTrue(ValidationHelper.isValidRating(rating))
        }

        @ParameterizedTest
        @ValueSource(doubles = [-0.1, -1.0, 5.1, 6.0, 100.0])
        @DisplayName("Rating inválido deve retornar false")
        fun `invalid rating should return false`(rating: Double) {
            assertFalse(ValidationHelper.isValidRating(rating))
        }

        @Test
        @DisplayName("Rating nulo deve retornar true (opcional)")
        fun `null rating should return true`() {
            assertTrue(ValidationHelper.isValidRating(null))
        }

        @Test
        @DisplayName("normalizeRating deve clampar valor")
        fun `normalizeRating should clamp value`() {
            assertEquals(0.0, ValidationHelper.normalizeRating(-1.0))
            assertEquals(5.0, ValidationHelper.normalizeRating(10.0))
            assertEquals(3.0, ValidationHelper.normalizeRating(3.0))
        }
    }

    // ==================== TESTES DE LEAGUE RATING (0-100) ====================

    @Nested
    @DisplayName("Validação de League Rating (0-100)")
    inner class LeagueRatingValidation {

        @ParameterizedTest
        @ValueSource(doubles = [0.0, 25.0, 50.0, 75.0, 100.0])
        @DisplayName("League rating válido (0-100) deve retornar true")
        fun `valid league rating should return true`(rating: Double) {
            assertTrue(ValidationHelper.isValidLeagueRating(rating))
        }

        @ParameterizedTest
        @ValueSource(doubles = [-0.1, -10.0, 100.1, 150.0])
        @DisplayName("League rating inválido deve retornar false")
        fun `invalid league rating should return false`(rating: Double) {
            assertFalse(ValidationHelper.isValidLeagueRating(rating))
        }

        @Test
        @DisplayName("normalizeLeagueRating deve clampar valor")
        fun `normalizeLeagueRating should clamp value`() {
            assertEquals(0.0, ValidationHelper.normalizeLeagueRating(-10.0))
            assertEquals(100.0, ValidationHelper.normalizeLeagueRating(150.0))
            assertEquals(55.5, ValidationHelper.normalizeLeagueRating(55.5))
        }
    }

    // ==================== TESTES DE LEVEL (0-10) ====================

    @Nested
    @DisplayName("Validação de Level (0-10)")
    inner class LevelValidation {

        @ParameterizedTest
        @ValueSource(ints = [0, 1, 5, 10])
        @DisplayName("Level válido (0-10) deve retornar true")
        fun `valid level should return true`(level: Int) {
            assertTrue(ValidationHelper.isValidLevel(level))
        }

        @ParameterizedTest
        @ValueSource(ints = [-1, -5, 11, 100])
        @DisplayName("Level inválido deve retornar false")
        fun `invalid level should return false`(level: Int) {
            assertFalse(ValidationHelper.isValidLevel(level))
        }

        @Test
        @DisplayName("Level nulo deve retornar true (opcional)")
        fun `null level should return true`() {
            assertTrue(ValidationHelper.isValidLevel(null))
        }

        @Test
        @DisplayName("normalizeLevel deve clampar valor")
        fun `normalizeLevel should clamp value`() {
            assertEquals(0, ValidationHelper.normalizeLevel(-5))
            assertEquals(10, ValidationHelper.normalizeLevel(15))
            assertEquals(7, ValidationHelper.normalizeLevel(7))
        }
    }

    // ==================== TESTES DE XP ====================

    @Nested
    @DisplayName("Validação de XP")
    inner class XPValidation {

        @Test
        @DisplayName("XP positivo deve retornar true")
        fun `positive xp should return true`() {
            assertTrue(ValidationHelper.isNonNegative(0L))
            assertTrue(ValidationHelper.isNonNegative(100L))
            assertTrue(ValidationHelper.isNonNegative(999999L))
        }

        @Test
        @DisplayName("XP negativo deve retornar false")
        fun `negative xp should return false`() {
            assertFalse(ValidationHelper.isNonNegative(-1L))
            assertFalse(ValidationHelper.isNonNegative(-100L))
        }
    }

    // ==================== TESTES ANTI-CHEAT ====================

    @Nested
    @DisplayName("Validação Anti-Cheat")
    inner class AntiCheatValidation {

        @Test
        @DisplayName("Estatísticas válidas devem passar")
        fun `valid game stats should pass`() {
            val result = ValidationHelper.validateGameStats(5, 3, 10)
            assertTrue(result is ValidationResult.Valid)
        }

        @Test
        @DisplayName("Gols acima do limite devem falhar")
        fun `goals above limit should fail`() {
            val result = ValidationHelper.validateGameStats(20, 3, 10)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals("goals", (result as ValidationResult.Invalid).field)
            assertEquals(ValidationErrorCode.ANTI_CHEAT, result.code)
        }

        @Test
        @DisplayName("Assistências acima do limite devem falhar")
        fun `assists above limit should fail`() {
            val result = ValidationHelper.validateGameStats(5, 15, 10)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals("assists", (result as ValidationResult.Invalid).field)
        }

        @Test
        @DisplayName("Defesas acima do limite devem falhar")
        fun `saves above limit should fail`() {
            val result = ValidationHelper.validateGameStats(5, 3, 50)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals("saves", (result as ValidationResult.Invalid).field)
        }

        @Test
        @DisplayName("Valores negativos devem falhar")
        fun `negative values should fail`() {
            val result = ValidationHelper.validateGameStats(-1, 3, 10)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals(ValidationErrorCode.NEGATIVE_VALUE, (result as ValidationResult.Invalid).code)
        }

        @Test
        @DisplayName("XP acima do limite deve falhar")
        fun `xp above limit should fail`() {
            val result = ValidationHelper.validateXP(600)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals(ValidationErrorCode.ANTI_CHEAT, (result as ValidationResult.Invalid).code)
        }

        @Test
        @DisplayName("capXP deve limitar ao máximo")
        fun `capXP should limit to max`() {
            assertEquals(500, ValidationHelper.capXP(600))
            assertEquals(300, ValidationHelper.capXP(300))
            assertEquals(0, ValidationHelper.capXP(-10))
        }
    }

    // ==================== TESTES DE TIMESTAMP ====================

    @Nested
    @DisplayName("Validação de Timestamp")
    inner class TimestampValidation {

        @Test
        @DisplayName("Timestamps em ordem válida devem passar")
        fun `timestamps in valid order should pass`() {
            val createdAt = Date(System.currentTimeMillis() - 1000)
            val updatedAt = Date(System.currentTimeMillis())

            val result = ValidationHelper.validateTimestampOrder(createdAt, updatedAt)
            assertTrue(result is ValidationResult.Valid)
        }

        @Test
        @DisplayName("Timestamps em ordem inválida devem falhar")
        fun `timestamps in invalid order should fail`() {
            val createdAt = Date(System.currentTimeMillis())
            val updatedAt = Date(System.currentTimeMillis() - 1000)

            val result = ValidationHelper.validateTimestampOrder(createdAt, updatedAt)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals(ValidationErrorCode.INVALID_TIMESTAMP, (result as ValidationResult.Invalid).code)
        }

        @Test
        @DisplayName("Timestamps iguais devem passar")
        fun `equal timestamps should pass`() {
            val now = Date(System.currentTimeMillis())

            val result = ValidationHelper.validateTimestampOrder(now, now)
            assertTrue(result is ValidationResult.Valid)
        }

        @Test
        @DisplayName("Timestamps nulos devem passar")
        fun `null timestamps should pass`() {
            assertTrue(ValidationHelper.validateTimestampOrder(null, null) is ValidationResult.Valid)
            assertTrue(ValidationHelper.validateTimestampOrder(Date(), null) is ValidationResult.Valid)
            assertTrue(ValidationHelper.validateTimestampOrder(null, Date()) is ValidationResult.Valid)
        }
    }

    // ==================== TESTES DE SANITIZAÇÃO ====================

    @Nested
    @DisplayName("Sanitização de Texto")
    inner class TextSanitization {

        @Test
        @DisplayName("Deve remover tags HTML")
        fun `should remove HTML tags`() {
            val input = "<script>alert('xss')</script>Hello"
            val result = ValidationHelper.sanitizeText(input)
            assertEquals("Hello", result)
        }

        @Test
        @DisplayName("Deve remover entidades HTML")
        fun `should remove HTML entities`() {
            val input = "Hello&nbsp;World"
            val result = ValidationHelper.sanitizeText(input)
            assertEquals("HelloWorld", result)
        }

        @Test
        @DisplayName("Deve manter texto limpo")
        fun `should keep clean text`() {
            val input = "Hello World 123"
            val result = ValidationHelper.sanitizeText(input)
            assertEquals("Hello World 123", result)
        }

        @Test
        @DisplayName("Texto nulo deve retornar string vazia")
        fun `null text should return empty string`() {
            assertEquals("", ValidationHelper.sanitizeText(null))
        }
    }

    // ==================== TESTES DE VALIDAÇÃO DE COMPRIMENTO ====================

    @Nested
    @DisplayName("Validação de Comprimento")
    inner class LengthValidation {

        @Test
        @DisplayName("Texto dentro do range deve passar")
        fun `text within range should pass`() {
            val result = ValidationHelper.validateLength("Hello", "field", 1, 10)
            assertTrue(result is ValidationResult.Valid)
        }

        @Test
        @DisplayName("Texto abaixo do mínimo deve falhar")
        fun `text below minimum should fail`() {
            val result = ValidationHelper.validateLength("Hi", "field", 5, 10)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals(ValidationErrorCode.INVALID_LENGTH, (result as ValidationResult.Invalid).code)
        }

        @Test
        @DisplayName("Texto acima do máximo deve falhar")
        fun `text above maximum should fail`() {
            val result = ValidationHelper.validateLength("Hello World!", "field", 1, 5)
            assertTrue(result is ValidationResult.Invalid)
        }

        @Test
        @DisplayName("Texto nulo com min > 0 deve falhar")
        fun `null text with min greater than 0 should fail`() {
            val result = ValidationHelper.validateLength(null, "field", 1, 10)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals(ValidationErrorCode.REQUIRED_FIELD, (result as ValidationResult.Invalid).code)
        }

        @Test
        @DisplayName("Texto nulo com min = 0 deve passar")
        fun `null text with min equals 0 should pass`() {
            val result = ValidationHelper.validateLength(null, "field", 0, 10)
            assertTrue(result is ValidationResult.Valid)
        }
    }

    // ==================== TESTES DE VALIDAÇÃO DE VALORES POSITIVOS ====================

    @Nested
    @DisplayName("Validação de Valores Positivos")
    inner class PositiveValueValidation {

        @Test
        @DisplayName("Valor positivo deve passar")
        fun `positive value should pass`() {
            assertTrue(ValidationHelper.isPositive(0.01))
            assertTrue(ValidationHelper.isPositive(100.0))
        }

        @Test
        @DisplayName("Zero deve falhar para isPositive")
        fun `zero should fail for isPositive`() {
            assertFalse(ValidationHelper.isPositive(0.0))
        }

        @Test
        @DisplayName("Valor negativo deve falhar")
        fun `negative value should fail`() {
            assertFalse(ValidationHelper.isPositive(-1.0))
        }

        @Test
        @DisplayName("validatePositiveAmount deve retornar resultado correto")
        fun `validatePositiveAmount should return correct result`() {
            val validResult = ValidationHelper.validatePositiveAmount(50.0, "amount")
            assertTrue(validResult is ValidationResult.Valid)

            val invalidResult = ValidationHelper.validatePositiveAmount(0.0, "amount")
            assertTrue(invalidResult is ValidationResult.Invalid)
            assertEquals(ValidationErrorCode.NEGATIVE_VALUE, (invalidResult as ValidationResult.Invalid).code)
        }
    }

    // ==================== TESTES DE CONSTANTES ====================

    @Nested
    @DisplayName("Constantes de Validação")
    inner class ValidationConstants {

        @Test
        @DisplayName("Constantes devem ter valores corretos")
        fun `constants should have correct values`() {
            assertEquals(0.0, ValidationHelper.RATING_MIN)
            assertEquals(5.0, ValidationHelper.RATING_MAX)
            assertEquals(0.0, ValidationHelper.LEAGUE_RATING_MIN)
            assertEquals(100.0, ValidationHelper.LEAGUE_RATING_MAX)
            assertEquals(0, ValidationHelper.LEVEL_MIN)
            assertEquals(10, ValidationHelper.LEVEL_MAX)
            assertEquals(0L, ValidationHelper.XP_MIN)
            assertEquals(15, ValidationHelper.MAX_GOALS_PER_GAME)
            assertEquals(10, ValidationHelper.MAX_ASSISTS_PER_GAME)
            assertEquals(30, ValidationHelper.MAX_SAVES_PER_GAME)
            assertEquals(500, ValidationHelper.MAX_XP_PER_GAME)
        }
    }
}
