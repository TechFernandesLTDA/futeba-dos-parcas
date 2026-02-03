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
        @DisplayName("Email nulo ou vazio deve retornar false (obrigatório)")
        fun `null or empty email should return false`() {
            // Email é tratado como campo obrigatório na implementação
            assertFalse(ValidationHelper.isValidEmail(null))
            assertFalse(ValidationHelper.isValidEmail(""))
            assertFalse(ValidationHelper.isValidEmail("   "))
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
    }

    // ==================== TESTES DE XP ====================

    @Nested
    @DisplayName("Validação de XP")
    inner class XPValidation {

        @Test
        @DisplayName("XP positivo deve retornar true")
        fun `positive xp should return true`() {
            assertTrue(ValidationHelper.isNonNegative(0))
            assertTrue(ValidationHelper.isNonNegative(100))
            assertTrue(ValidationHelper.isNonNegative(999999))
        }

        @Test
        @DisplayName("XP negativo deve retornar false")
        fun `negative xp should return false`() {
            assertFalse(ValidationHelper.isNonNegative(-1))
            assertFalse(ValidationHelper.isNonNegative(-100))
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
            assertEquals(ValidationErrorCode.OUT_OF_RANGE, result.code)
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
            val result = ValidationHelper.validateXPGain(600)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals(ValidationErrorCode.OUT_OF_RANGE, (result as ValidationResult.Invalid).code)
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
            // O padrão remove apenas as tags, não o conteúdo entre elas
            val input = "<script>alert('xss')</script>Hello"
            val result = ValidationHelper.sanitizeText(input)
            assertEquals("alert('xss')Hello", result)
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
        @DisplayName("Texto nulo com min > 0 e required=true deve falhar")
        fun `null text with min greater than 0 should fail`() {
            // Precisa passar required=true para falhar com texto nulo
            val result = ValidationHelper.validateLength(null, "field", 1, 10, required = true)
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

    // ==================== VALIDAÇÃO 1: CONTAGEM DE JOGADORES ====================

    @Nested
    @DisplayName("Validação de Contagem de Jogadores")
    inner class PlayerCountValidation {

        @Test
        @DisplayName("Contagem válida de jogadores deve passar")
        fun `valid player count should pass`() {
            assertTrue(ValidationHelper.validatePlayerCount(4).isValid())
            assertTrue(ValidationHelper.validatePlayerCount(10).isValid())
            assertTrue(ValidationHelper.validatePlayerCount(22).isValid())
            assertTrue(ValidationHelper.validatePlayerCount(30).isValid())
        }

        @Test
        @DisplayName("Jogadores abaixo do mínimo deve falhar")
        fun `below minimum players should fail`() {
            val result = ValidationHelper.validatePlayerCount(3)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals(ValidationErrorCode.OUT_OF_RANGE, (result as ValidationResult.Invalid).code)
        }

        @Test
        @DisplayName("Jogadores acima do máximo deve falhar")
        fun `above maximum players should fail`() {
            val result = ValidationHelper.validatePlayerCount(31)
            assertTrue(result is ValidationResult.Invalid)
        }
    }

    // ==================== VALIDAÇÃO 2: EQUILÍBRIO DE TIMES ====================

    @Nested
    @DisplayName("Validação de Equilíbrio de Times")
    inner class TeamBalanceValidation {

        @Test
        @DisplayName("Times equilibrados devem passar")
        fun `balanced teams should pass`() {
            assertTrue(ValidationHelper.validateTeamBalance(5, 5).isValid())
            assertTrue(ValidationHelper.validateTeamBalance(5, 6).isValid())
            assertTrue(ValidationHelper.validateTeamBalance(6, 5).isValid())
        }

        @Test
        @DisplayName("Diferença maior que 1 deve falhar")
        fun `difference greater than 1 should fail`() {
            val result = ValidationHelper.validateTeamBalance(5, 8)
            assertTrue(result is ValidationResult.Invalid)
        }

        @Test
        @DisplayName("Time com 0 jogadores deve falhar")
        fun `team with 0 players should fail`() {
            val result = ValidationHelper.validateTeamBalance(0, 5)
            assertTrue(result is ValidationResult.Invalid)
        }
    }

    // ==================== VALIDAÇÃO 3: DURAÇÃO DO JOGO ====================

    @Nested
    @DisplayName("Validação de Duração do Jogo")
    inner class GameDurationValidation {

        @Test
        @DisplayName("Duração válida deve passar")
        fun `valid duration should pass`() {
            assertTrue(ValidationHelper.validateGameDuration(60).isValid())
            assertTrue(ValidationHelper.validateGameDuration(90).isValid())
            assertTrue(ValidationHelper.validateGameDuration(120).isValid())
        }

        @Test
        @DisplayName("Duração abaixo do mínimo deve falhar")
        fun `below minimum duration should fail`() {
            val result = ValidationHelper.validateGameDuration(10)
            assertTrue(result is ValidationResult.Invalid)
        }

        @Test
        @DisplayName("Duração acima do máximo deve falhar")
        fun `above maximum duration should fail`() {
            val result = ValidationHelper.validateGameDuration(300)
            assertTrue(result is ValidationResult.Invalid)
        }
    }

    // ==================== VALIDAÇÃO 4: DATA DO JOGO ====================

    @Nested
    @DisplayName("Validação de Data do Jogo")
    inner class GameDateValidation {

        @Test
        @DisplayName("Data futura deve passar")
        fun `future date should pass`() {
            val futureDate = Date(System.currentTimeMillis() + 86400000) // +1 dia
            assertTrue(ValidationHelper.validateGameDate(futureDate).isValid())
        }

        @Test
        @DisplayName("Data passada deve falhar")
        fun `past date should fail`() {
            val pastDate = Date(System.currentTimeMillis() - 86400000) // -1 dia
            val result = ValidationHelper.validateGameDate(pastDate)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals(ValidationErrorCode.INVALID_TIMESTAMP, (result as ValidationResult.Invalid).code)
        }

        @Test
        @DisplayName("Data nula deve falhar")
        fun `null date should fail`() {
            val result = ValidationHelper.validateGameDate(null)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals(ValidationErrorCode.REQUIRED_FIELD, (result as ValidationResult.Invalid).code)
        }
    }

    // ==================== VALIDAÇÃO 5: VALOR DE PAGAMENTO ====================

    @Nested
    @DisplayName("Validação de Valor de Pagamento")
    inner class PaymentValueValidation {

        @Test
        @DisplayName("Valor válido deve passar")
        fun `valid payment should pass`() {
            assertTrue(ValidationHelper.validatePaymentValue(25.0).isValid())
            assertTrue(ValidationHelper.validatePaymentValue(0.01).isValid())
            assertTrue(ValidationHelper.validatePaymentValue(100.0).isValid())
        }

        @Test
        @DisplayName("Valor zero deve falhar")
        fun `zero value should fail`() {
            val result = ValidationHelper.validatePaymentValue(0.0)
            assertTrue(result is ValidationResult.Invalid)
        }

        @Test
        @DisplayName("Valor acima do máximo deve falhar")
        fun `above maximum should fail`() {
            val result = ValidationHelper.validatePaymentValue(15000.0)
            assertTrue(result is ValidationResult.Invalid)
        }

        @Test
        @DisplayName("Valor nulo deve falhar")
        fun `null value should fail`() {
            val result = ValidationHelper.validatePaymentValue(null)
            assertTrue(result is ValidationResult.Invalid)
        }
    }

    // ==================== VALIDAÇÃO 6: TAMANHO DO GRUPO ====================

    @Nested
    @DisplayName("Validação de Tamanho do Grupo")
    inner class GroupSizeValidation {

        @Test
        @DisplayName("Tamanho válido deve passar")
        fun `valid group size should pass`() {
            assertTrue(ValidationHelper.validateGroupSize(1).isValid())
            assertTrue(ValidationHelper.validateGroupSize(50).isValid())
            assertTrue(ValidationHelper.validateGroupSize(100).isValid())
        }

        @Test
        @DisplayName("Zero membros deve falhar")
        fun `zero members should fail`() {
            val result = ValidationHelper.validateGroupSize(0)
            assertTrue(result is ValidationResult.Invalid)
        }

        @Test
        @DisplayName("Acima do máximo deve falhar")
        fun `above maximum should fail`() {
            val result = ValidationHelper.validateGroupSize(101)
            assertTrue(result is ValidationResult.Invalid)
        }
    }

    // ==================== VALIDAÇÃO 7: DOCUMENT ID ====================

    @Nested
    @DisplayName("Validação de Document ID")
    inner class DocumentIdValidation {

        @Test
        @DisplayName("ID válido deve retornar true")
        fun `valid id should return true`() {
            assertTrue(ValidationHelper.isValidDocumentId("abc123"))
            assertTrue(ValidationHelper.isValidDocumentId("user-id-001"))
            assertTrue(ValidationHelper.isValidDocumentId("xYz_456"))
        }

        @Test
        @DisplayName("ID nulo ou vazio deve retornar false")
        fun `null or empty id should return false`() {
            assertFalse(ValidationHelper.isValidDocumentId(null))
            assertFalse(ValidationHelper.isValidDocumentId(""))
            assertFalse(ValidationHelper.isValidDocumentId("   "))
        }

        @Test
        @DisplayName("ID com barra deve retornar false")
        fun `id with slash should return false`() {
            assertFalse(ValidationHelper.isValidDocumentId("path/to/doc"))
        }

        @Test
        @DisplayName("ID com pontos duplos deve retornar false")
        fun `id with double dots should return false`() {
            assertFalse(ValidationHelper.isValidDocumentId("doc..id"))
        }

        @Test
        @DisplayName("ID muito longo deve retornar false")
        fun `too long id should return false`() {
            assertFalse(ValidationHelper.isValidDocumentId("a".repeat(129)))
        }
    }

    // ==================== VALIDAÇÃO 8: COORDENADAS ====================

    @Nested
    @DisplayName("Validação de Coordenadas")
    inner class CoordinateValidation {

        @Test
        @DisplayName("Coordenadas válidas devem passar")
        fun `valid coordinates should pass`() {
            assertTrue(ValidationHelper.validateCoordinates(-23.55, -46.63).isValid()) // SP
            assertTrue(ValidationHelper.validateCoordinates(0.0, 0.0).isValid())
            assertTrue(ValidationHelper.validateCoordinates(90.0, 180.0).isValid())
            assertTrue(ValidationHelper.validateCoordinates(-90.0, -180.0).isValid())
        }

        @Test
        @DisplayName("Latitude fora do range deve falhar")
        fun `out of range latitude should fail`() {
            val result = ValidationHelper.validateCoordinates(91.0, 0.0)
            assertTrue(result is ValidationResult.Invalid)
        }

        @Test
        @DisplayName("Longitude fora do range deve falhar")
        fun `out of range longitude should fail`() {
            val result = ValidationHelper.validateCoordinates(0.0, 181.0)
            assertTrue(result is ValidationResult.Invalid)
        }

        @Test
        @DisplayName("Coordenadas nulas devem falhar")
        fun `null coordinates should fail`() {
            assertTrue(ValidationHelper.validateCoordinates(null, null) is ValidationResult.Invalid)
            assertTrue(ValidationHelper.validateCoordinates(0.0, null) is ValidationResult.Invalid)
            assertTrue(ValidationHelper.validateCoordinates(null, 0.0) is ValidationResult.Invalid)
        }
    }

    // ==================== VALIDAÇÃO 9: PLACAR ====================

    @Nested
    @DisplayName("Validação de Placar")
    inner class GameScoreValidation {

        @Test
        @DisplayName("Placar válido deve passar")
        fun `valid score should pass`() {
            assertTrue(ValidationHelper.validateGameScore(3, 2).isValid())
            assertTrue(ValidationHelper.validateGameScore(0, 0).isValid())
            assertTrue(ValidationHelper.validateGameScore(10, 8).isValid())
        }

        @Test
        @DisplayName("Placar negativo deve falhar")
        fun `negative score should fail`() {
            val result = ValidationHelper.validateGameScore(-1, 2)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals(ValidationErrorCode.NEGATIVE_VALUE, (result as ValidationResult.Invalid).code)
        }

        @Test
        @DisplayName("Placar excessivo deve falhar")
        fun `excessive score should fail`() {
            val result = ValidationHelper.validateGameScore(51, 2)
            assertTrue(result is ValidationResult.Invalid)
        }
    }

    // ==================== VALIDAÇÃO 10: URL DE FOTO ====================

    @Nested
    @DisplayName("Validação de URL de Foto")
    inner class PhotoUrlValidation {

        @Test
        @DisplayName("URL válida deve retornar true")
        fun `valid url should return true`() {
            assertTrue(ValidationHelper.isValidPhotoUrl("https://example.com/photo.jpg"))
            assertTrue(ValidationHelper.isValidPhotoUrl("gs://bucket/photo.jpg"))
        }

        @Test
        @DisplayName("URL nula ou vazia deve retornar true (opcional)")
        fun `null or empty url should return true`() {
            assertTrue(ValidationHelper.isValidPhotoUrl(null))
            assertTrue(ValidationHelper.isValidPhotoUrl(""))
        }

        @Test
        @DisplayName("URL HTTP sem S deve retornar false")
        fun `http url should return false`() {
            assertFalse(ValidationHelper.isValidPhotoUrl("http://example.com/photo.jpg"))
        }

        @Test
        @DisplayName("URL muito longa deve retornar false")
        fun `too long url should return false`() {
            assertFalse(ValidationHelper.isValidPhotoUrl("https://" + "a".repeat(2050)))
        }
    }

    // ==================== VALIDAÇÃO 11: NÚMERO DE TIMES ====================

    @Nested
    @DisplayName("Validação de Número de Times")
    inner class TeamCountValidation {

        @Test
        @DisplayName("2-4 times deve passar")
        fun `valid team count should pass`() {
            assertTrue(ValidationHelper.validateTeamCount(2).isValid())
            assertTrue(ValidationHelper.validateTeamCount(3).isValid())
            assertTrue(ValidationHelper.validateTeamCount(4).isValid())
        }

        @Test
        @DisplayName("Menos de 2 times deve falhar")
        fun `below 2 teams should fail`() {
            val result = ValidationHelper.validateTeamCount(1)
            assertTrue(result is ValidationResult.Invalid)
        }

        @Test
        @DisplayName("Mais de 4 times deve falhar")
        fun `above 4 teams should fail`() {
            val result = ValidationHelper.validateTeamCount(5)
            assertTrue(result is ValidationResult.Invalid)
        }
    }

    // ==================== VALIDAÇÃO 12: STREAK ====================

    @Nested
    @DisplayName("Validação de Streak")
    inner class StreakValidation {

        @Test
        @DisplayName("Streak válido deve passar")
        fun `valid streak should pass`() {
            assertTrue(ValidationHelper.validateStreak(0).isValid())
            assertTrue(ValidationHelper.validateStreak(10).isValid())
            assertTrue(ValidationHelper.validateStreak(100).isValid())
            assertTrue(ValidationHelper.validateStreak(365).isValid())
        }

        @Test
        @DisplayName("Streak negativo deve falhar")
        fun `negative streak should fail`() {
            val result = ValidationHelper.validateStreak(-1)
            assertTrue(result is ValidationResult.Invalid)
            assertEquals(ValidationErrorCode.NEGATIVE_VALUE, (result as ValidationResult.Invalid).code)
        }

        @Test
        @DisplayName("Streak excessivo deve falhar")
        fun `excessive streak should fail`() {
            val result = ValidationHelper.validateStreak(366)
            assertTrue(result is ValidationResult.Invalid)
        }
    }

    // ==================== VALIDAÇÃO COMPLETA DE JOGO ====================

    @Nested
    @DisplayName("Validação Completa de Criação de Jogo")
    inner class GameCreationValidation {

        @Test
        @DisplayName("Dados válidos devem gerar lista vazia de erros")
        fun `valid data should produce no errors`() {
            val futureDate = Date(System.currentTimeMillis() + 86400000)
            val errors = ValidationHelper.validateGameCreation(
                title = "Pelada de Terça",
                playerCount = 10,
                gameDate = futureDate,
                durationMinutes = 90
            )
            assertTrue(errors.isEmpty())
        }

        @Test
        @DisplayName("Múltiplos erros devem ser capturados")
        fun `multiple errors should be captured`() {
            val pastDate = Date(System.currentTimeMillis() - 86400000)
            val errors = ValidationHelper.validateGameCreation(
                title = "AB", // Muito curto (min 3)
                playerCount = 2, // Abaixo do mínimo (4)
                gameDate = pastDate, // Data passada
                durationMinutes = 5 // Abaixo do mínimo (15)
            )
            assertTrue(errors.size >= 3) // Ao menos 3 erros
        }
    }

    // ==================== TESTES DE CEP ====================

    @Nested
    @DisplayName("Validação de CEP")
    inner class CepValidation {

        @Test
        @DisplayName("CEP válido deve retornar true")
        fun `valid cep should return true`() {
            assertTrue(ValidationHelper.isValidCep("12345-678"))
            assertTrue(ValidationHelper.isValidCep("12345678"))
        }

        @Test
        @DisplayName("CEP inválido deve retornar false")
        fun `invalid cep should return false`() {
            assertFalse(ValidationHelper.isValidCep("1234"))
            assertFalse(ValidationHelper.isValidCep("123456789"))
            assertFalse(ValidationHelper.isValidCep(null))
            assertFalse(ValidationHelper.isValidCep(""))
        }

        @Test
        @DisplayName("formatCep deve formatar corretamente")
        fun `formatCep should format correctly`() {
            assertEquals("12345-678", ValidationHelper.formatCep("12345678"))
            assertEquals("12345-678", ValidationHelper.formatCep("12345-678"))
        }

        @Test
        @DisplayName("sanitizeCep deve remover formatação")
        fun `sanitizeCep should remove formatting`() {
            assertEquals("12345678", ValidationHelper.sanitizeCep("12345-678"))
            assertEquals("", ValidationHelper.sanitizeCep(null))
        }
    }
}
