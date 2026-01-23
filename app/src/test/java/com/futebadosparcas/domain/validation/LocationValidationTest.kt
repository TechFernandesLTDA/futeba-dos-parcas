package com.futebadosparcas.domain.validation

import com.futebadosparcas.data.model.Location
import com.google.common.truth.Truth.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import java.util.Date

/**
 * Testes unitarios para validacao de Location.
 *
 * Cobre validacoes de nome, rating, ownerId, timestamps, CEP e coordenadas.
 */
@DisplayName("Location Validation Tests")
class LocationValidationTest {

    // ==================== TEST DATA FACTORY ====================

    /**
     * Cria um Location valido para testes.
     * Usado como base e modificado conforme necessario.
     */
    private fun createValidLocation(
        id: String = "test-location-id",
        name: String = "Campo de Futebol Apollo",
        address: String = "Rua das Flores, 123",
        cep: String = "80000-000",
        city: String = "Curitiba",
        state: String = "PR",
        neighborhood: String = "Centro",
        ownerId: String = "test-owner-id",
        rating: Double = 4.5,
        latitude: Double? = -25.4284,
        longitude: Double? = -49.2733,
        createdAt: Date? = Date(System.currentTimeMillis() - 1000),
        updatedAt: Date? = Date(System.currentTimeMillis())
    ): Location {
        return Location(
            id = id,
            name = name,
            address = address,
            cep = cep,
            city = city,
            state = state,
            neighborhood = neighborhood,
            ownerId = ownerId,
            rating = rating,
            latitude = latitude,
            longitude = longitude,
            createdAt = createdAt,
            updatedAt = updatedAt
        )
    }

    // ==================== 1. VALID LOCATION PASSES VALIDATION ====================

    @Nested
    @DisplayName("Validacao de Location Valido")
    inner class ValidLocationValidation {

        @Test
        @DisplayName("Location valido deve passar validacao")
        fun `valid location passes validation`() {
            // Given
            val location = createValidLocation()

            // When
            val errors = location.validate()

            // Then
            assertThat(errors).isEmpty()
            assertThat(location.isValid()).isTrue()
        }

        @Test
        @DisplayName("Location valido com todos campos deve passar validacao")
        fun `valid location with all fields passes validation`() {
            // Given
            val location = Location(
                id = "loc-123",
                name = "Arena Society Premium",
                address = "Av. Brasil, 1500",
                cep = "82000-000",
                street = "Av. Brasil",
                number = "1500",
                complement = "Bloco A",
                district = "Centro",
                city = "Curitiba",
                state = "PR",
                country = "Brasil",
                neighborhood = "Centro",
                region = "Sul",
                latitude = -25.4284,
                longitude = -49.2733,
                ownerId = "owner-456",
                rating = 4.8,
                ratingCount = 50,
                description = "Arena com 3 quadras de society",
                phone = "(41) 99999-9999",
                website = "https://arenasociety.com.br",
                createdAt = Date(System.currentTimeMillis() - 86400000),
                updatedAt = Date()
            )

            // When
            val errors = location.validate()

            // Then
            assertThat(errors).isEmpty()
            assertThat(location.isValid()).isTrue()
        }
    }

    // ==================== 2-4. NAME VALIDATION ====================

    @Nested
    @DisplayName("Validacao de Nome")
    inner class NameValidation {

        @Test
        @DisplayName("Nome vazio deve falhar validacao")
        fun `empty name fails validation`() {
            // Given
            val location = createValidLocation(name = "")

            // When
            val errors = location.validate()

            // Then
            assertThat(errors).isNotEmpty()
            assertThat(errors.any { it.field == "name" }).isTrue()
            assertThat(location.isValid()).isFalse()
        }

        @Test
        @DisplayName("Nome em branco deve falhar validacao")
        fun `blank name fails validation`() {
            // Given
            val location = createValidLocation(name = "   ")

            // When
            val errors = location.validate()

            // Then
            assertThat(errors).isNotEmpty()
            assertThat(errors.any { it.field == "name" }).isTrue()
        }

        @Test
        @DisplayName("Nome muito curto (< 2 chars) deve falhar validacao")
        fun `name too short fails validation`() {
            // Given
            val location = createValidLocation(name = "A")

            // When
            val errors = location.validate()

            // Then
            assertThat(errors).isNotEmpty()
            assertThat(errors.any { it.field == "name" }).isTrue()
            assertThat(errors.first { it.field == "name" }.code)
                .isEqualTo(ValidationErrorCode.INVALID_LENGTH)
        }

        @Test
        @DisplayName("Nome com exatamente 2 caracteres deve passar validacao")
        fun `name with exactly 2 characters passes validation`() {
            // Given
            val location = createValidLocation(name = "AB")

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "name" }).isTrue()
        }

        @Test
        @DisplayName("Nome muito longo (> 100 chars) deve falhar validacao")
        fun `name too long fails validation`() {
            // Given
            val longName = "A".repeat(101)
            val location = createValidLocation(name = longName)

            // When
            val errors = location.validate()

            // Then
            assertThat(errors).isNotEmpty()
            assertThat(errors.any { it.field == "name" }).isTrue()
            assertThat(errors.first { it.field == "name" }.code)
                .isEqualTo(ValidationErrorCode.INVALID_LENGTH)
        }

        @Test
        @DisplayName("Nome com exatamente 100 caracteres deve passar validacao")
        fun `name with exactly 100 characters passes validation`() {
            // Given
            val maxLengthName = "A".repeat(100)
            val location = createValidLocation(name = maxLengthName)

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "name" }).isTrue()
        }
    }

    // ==================== 5-7. RATING VALIDATION ====================

    @Nested
    @DisplayName("Validacao de Rating (0-5)")
    inner class RatingValidation {

        @Test
        @DisplayName("Rating abaixo de 0 deve falhar validacao")
        fun `rating below 0 fails validation`() {
            // Given
            val location = createValidLocation(rating = -0.1)

            // When
            val errors = location.validate()

            // Then
            assertThat(errors).isNotEmpty()
            assertThat(errors.any { it.field == "rating" }).isTrue()
        }

        @Test
        @DisplayName("Rating negativo deve falhar validacao")
        fun `rating negative value fails validation`() {
            // Given
            val location = createValidLocation(rating = -5.0)

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.any { it.field == "rating" }).isTrue()
        }

        @Test
        @DisplayName("Rating acima de 5 deve falhar validacao")
        fun `rating above 5 fails validation`() {
            // Given
            val location = createValidLocation(rating = 5.1)

            // When
            val errors = location.validate()

            // Then
            assertThat(errors).isNotEmpty()
            assertThat(errors.any { it.field == "rating" }).isTrue()
        }

        @Test
        @DisplayName("Rating muito acima do limite deve falhar validacao")
        fun `rating way above limit fails validation`() {
            // Given
            val location = createValidLocation(rating = 100.0)

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.any { it.field == "rating" }).isTrue()
        }

        @Test
        @DisplayName("Rating no minimo 0 deve passar validacao")
        fun `rating at minimum 0 passes validation`() {
            // Given
            val location = createValidLocation(rating = 0.0)

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "rating" }).isTrue()
        }

        @Test
        @DisplayName("Rating no maximo 5 deve passar validacao")
        fun `rating at maximum 5 passes validation`() {
            // Given
            val location = createValidLocation(rating = 5.0)

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "rating" }).isTrue()
        }

        @Test
        @DisplayName("Rating no meio do range deve passar validacao")
        fun `rating in middle range passes validation`() {
            // Given
            val ratingsToTest = listOf(0.5, 1.0, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5)

            ratingsToTest.forEach { rating ->
                // When
                val location = createValidLocation(rating = rating)
                val errors = location.validate()

                // Then
                assertThat(errors.none { it.field == "rating" })
                    .isTrue()
            }
        }
    }

    // ==================== 8. OWNER ID VALIDATION ====================

    @Nested
    @DisplayName("Validacao de OwnerId")
    inner class OwnerIdValidation {

        @Test
        @DisplayName("OwnerId ausente deve falhar validacao")
        fun `missing ownerId fails validation`() {
            // Given
            val location = createValidLocation(ownerId = "")

            // When
            val errors = location.validate()

            // Then
            assertThat(errors).isNotEmpty()
            assertThat(errors.any { it.field == "owner_id" }).isTrue()
            assertThat(location.isValid()).isFalse()
        }

        @Test
        @DisplayName("OwnerId em branco deve falhar validacao")
        fun `blank ownerId fails validation`() {
            // Given
            val location = createValidLocation(ownerId = "   ")

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.any { it.field == "owner_id" }).isTrue()
        }
    }

    // ==================== 9-10. TIMESTAMP VALIDATION ====================

    @Nested
    @DisplayName("Validacao de Timestamps")
    inner class TimestampValidation {

        @Test
        @DisplayName("Ordem invalida de timestamps (updatedAt < createdAt) deve falhar")
        fun `invalid timestamp order updatedAt before createdAt fails validation`() {
            // Given
            val now = System.currentTimeMillis()
            val createdAt = Date(now)
            val updatedAt = Date(now - 86400000) // 1 day before createdAt

            val location = createValidLocation(
                createdAt = createdAt,
                updatedAt = updatedAt
            )

            // When
            val errors = location.validate()

            // Then
            assertThat(errors).isNotEmpty()
            assertThat(errors.any { it.field == "timestamps" }).isTrue()
            assertThat(errors.first { it.field == "timestamps" }.code)
                .isEqualTo(ValidationErrorCode.INVALID_TIMESTAMP)
        }

        @Test
        @DisplayName("CreatedAt significativamente depois de updatedAt deve falhar")
        fun `createdAt significantly after updatedAt fails validation`() {
            // Given
            val location = createValidLocation(
                createdAt = Date(System.currentTimeMillis() + 100000),
                updatedAt = Date(System.currentTimeMillis())
            )

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.any { it.field == "timestamps" }).isTrue()
        }

        @Test
        @DisplayName("Timestamps validos (createdAt <= updatedAt) deve passar")
        fun `valid timestamps createdAt before updatedAt passes validation`() {
            // Given
            val now = System.currentTimeMillis()
            val location = createValidLocation(
                createdAt = Date(now - 1000),
                updatedAt = Date(now)
            )

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "timestamps" }).isTrue()
        }

        @Test
        @DisplayName("Timestamps iguais deve passar validacao")
        fun `equal timestamps passes validation`() {
            // Given
            val now = Date()
            val location = createValidLocation(
                createdAt = now,
                updatedAt = now
            )

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "timestamps" }).isTrue()
        }

        @Test
        @DisplayName("Timestamps nulos deve passar validacao")
        fun `null timestamps passes validation`() {
            // Given
            val location = createValidLocation(
                createdAt = null,
                updatedAt = null
            )

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "timestamps" }).isTrue()
        }

        @Test
        @DisplayName("Apenas createdAt definido deve passar validacao")
        fun `only createdAt set passes validation`() {
            // Given
            val location = createValidLocation(
                createdAt = Date(),
                updatedAt = null
            )

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "timestamps" }).isTrue()
        }

        @Test
        @DisplayName("Apenas updatedAt definido deve passar validacao")
        fun `only updatedAt set passes validation`() {
            // Given
            val location = createValidLocation(
                createdAt = null,
                updatedAt = Date()
            )

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "timestamps" }).isTrue()
        }
    }

    // ==================== 11-13. CEP VALIDATION ====================

    @Nested
    @DisplayName("Validacao de CEP")
    inner class CepValidation {

        @Test
        @DisplayName("CEP vazio eh permitido (campo opcional)")
        fun `empty CEP is allowed`() {
            // Given
            val location = createValidLocation(cep = "")

            // When
            val errors = location.validate()

            // Then
            // CEP nao eh validado pelo metodo validate() atual do Location
            // Verificamos que a validacao passa para campos opcionais
            assertThat(location.isValid()).isTrue()
        }

        @Test
        @DisplayName("Location sem CEP deve passar validacao")
        fun `location with no CEP passes validation`() {
            // Given
            val location = Location(
                id = "loc-1",
                name = "Campo sem CEP",
                ownerId = "owner-1",
                rating = 3.0
            )

            // When
            val errors = location.validate()

            // Then
            assertThat(errors).isEmpty()
        }

        @Test
        @DisplayName("CEP invalido com letras nao afeta validacao atual")
        fun `invalid CEP format with letters does not affect current validation`() {
            // Given - CEP validation is not implemented in Location.validate() currently
            // This test documents expected behavior if CEP validation were added
            val location = createValidLocation(cep = "ABCDE-FGH")

            // When
            val errors = location.validate()

            // Then - Currently passes since CEP is not validated
            // If CEP validation is added, this test should be updated
            assertThat(errors.none { it.field == "cep" }).isTrue()
        }

        @Test
        @DisplayName("CEP com tamanho errado nao afeta validacao atual")
        fun `CEP with wrong length does not affect current validation`() {
            // Given
            val location = createValidLocation(cep = "123")

            // When
            val errors = location.validate()

            // Then
            // CEP validation not implemented, documenting current behavior
            assertThat(errors.none { it.field == "cep" }).isTrue()
        }

        @Test
        @DisplayName("CEP valido com hifen deve passar")
        fun `valid CEP format with hyphen passes`() {
            // Given
            val location = createValidLocation(cep = "80000-000")

            // When
            val errors = location.validate()

            // Then
            assertThat(location.isValid()).isTrue()
        }

        @Test
        @DisplayName("CEP valido sem hifen deve passar")
        fun `valid CEP format without hyphen passes`() {
            // Given
            val location = createValidLocation(cep = "80000000")

            // When
            val errors = location.validate()

            // Then
            assertThat(location.isValid()).isTrue()
        }

        @Test
        @DisplayName("Varios formatos de CEP validos devem passar")
        fun `various valid CEP formats pass`() {
            // Given
            val validCeps = listOf(
                "01310-100", // Sao Paulo
                "22041-001", // Rio de Janeiro
                "80000-000", // Curitiba
                "30130-000"  // Belo Horizonte
            )

            validCeps.forEach { cep ->
                // When
                val location = createValidLocation(cep = cep)
                val errors = location.validate()

                // Then
                assertThat(location.isValid()).isTrue()
            }
        }
    }

    // ==================== 14. SPECIAL CHARACTERS IN NAME ====================

    @Nested
    @DisplayName("Caracteres Especiais no Nome")
    inner class SpecialCharactersInName {

        @Test
        @DisplayName("Caracteres especiais no nome sao permitidos")
        fun `special characters in name are allowed`() {
            // Given - ValidationHelper.NAME_PATTERN allows: letters, numbers, spaces, hyphen, underscore, apostrophe
            val location = createValidLocation(name = "Campo D'Arthur - Unidade 1")

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "name" }).isTrue()
            assertThat(location.isValid()).isTrue()
        }

        @Test
        @DisplayName("Nome com hifen eh permitido")
        fun `name with hyphen is allowed`() {
            // Given
            val location = createValidLocation(name = "Arena Sul-Americana")

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "name" }).isTrue()
        }

        @Test
        @DisplayName("Nome com underscore eh permitido")
        fun `name with underscore is allowed`() {
            // Given
            val location = createValidLocation(name = "Arena_Premium_1")

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "name" }).isTrue()
        }

        @Test
        @DisplayName("Nome com apostrofo eh permitido")
        fun `name with apostrophe is allowed`() {
            // Given
            val location = createValidLocation(name = "Campo do Joao's")

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "name" }).isTrue()
        }

        @Test
        @DisplayName("Nome com numeros eh permitido")
        fun `name with numbers is allowed`() {
            // Given
            val location = createValidLocation(name = "Arena 2000 Premium")

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "name" }).isTrue()
        }

        @Test
        @DisplayName("Nome com caracteres acentuados eh permitido")
        fun `name with accented characters is allowed`() {
            // Given
            val location = createValidLocation(name = "Ginasio Sao Jose da Praca")

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "name" }).isTrue()
        }

        @Test
        @DisplayName("Nome com letras unicode eh permitido")
        fun `name with unicode letters is allowed`() {
            // Given
            val location = createValidLocation(name = "Arena Futebol Portao")

            // When
            val errors = location.validate()

            // Then
            assertThat(errors.none { it.field == "name" }).isTrue()
        }
    }

    // ==================== 15. NULL COORDINATES ====================

    @Nested
    @DisplayName("Validacao de Coordenadas")
    inner class CoordinatesValidation {

        @Test
        @DisplayName("Coordenadas nulas sao permitidas")
        fun `null coordinates are allowed`() {
            // Given
            val location = createValidLocation(
                latitude = null,
                longitude = null
            )

            // When
            val errors = location.validate()

            // Then
            assertThat(location.isValid()).isTrue()
        }

        @Test
        @DisplayName("Location sem coordenadas deve passar validacao")
        fun `location without coordinates passes validation`() {
            // Given
            val location = Location(
                id = "loc-no-coords",
                name = "Campo sem Coordenadas",
                ownerId = "owner-1",
                rating = 4.0,
                latitude = null,
                longitude = null
            )

            // When
            val errors = location.validate()

            // Then
            assertThat(errors).isEmpty()
        }

        @Test
        @DisplayName("Latitude nula com longitude valida deve passar")
        fun `null latitude with valid longitude passes validation`() {
            // Given
            val location = createValidLocation(
                latitude = null,
                longitude = -49.2733
            )

            // When
            val errors = location.validate()

            // Then
            // Coordenadas parciais sao permitidas no modelo atual
            assertThat(location.isValid()).isTrue()
        }

        @Test
        @DisplayName("Latitude valida com longitude nula deve passar")
        fun `valid latitude with null longitude passes validation`() {
            // Given
            val location = createValidLocation(
                latitude = -25.4284,
                longitude = null
            )

            // When
            val errors = location.validate()

            // Then
            assertThat(location.isValid()).isTrue()
        }

        @Test
        @DisplayName("Coordenadas validas devem passar validacao")
        fun `valid coordinates pass validation`() {
            // Given
            val location = createValidLocation(
                latitude = -25.4284,
                longitude = -49.2733
            )

            // When
            val errors = location.validate()

            // Then
            assertThat(location.isValid()).isTrue()
        }
    }

    // ==================== CASOS DE BORDA ADICIONAIS ====================

    @Nested
    @DisplayName("Casos de Borda e Normalizacao")
    inner class EdgeCasesAndNormalization {

        @Test
        @DisplayName("Multiplos erros de validacao sao reportados")
        fun `multiple validation errors are reported`() {
            // Given - Location with multiple invalid fields
            val location = Location(
                id = "loc-invalid",
                name = "", // Invalid: empty
                ownerId = "", // Invalid: empty
                rating = 10.0, // Invalid: above 5
                createdAt = Date(System.currentTimeMillis()),
                updatedAt = Date(System.currentTimeMillis() - 100000) // Invalid: before createdAt
            )

            // When
            val errors = location.validate()

            // Then - Should report all errors
            assertThat(errors.size).isAtLeast(3)
            assertThat(errors.map { it.field }).containsAtLeast("name", "owner_id", "rating")
        }

        @Test
        @DisplayName("Rating eh normalizado via coerceIn no bloco init")
        fun `rating is normalized via coerceIn in init block`() {
            // Given - The Location init block has rating.coerceIn() but it doesn't reassign
            // This documents the current behavior
            val location = createValidLocation(rating = 10.0)

            // When/Then
            // Note: The init block calls coerceIn but doesn't reassign the value
            // So validation still sees the original value
            assertThat(location.rating).isEqualTo(10.0)
            assertThat(location.validate().any { it.field == "rating" }).isTrue()
        }

        @Test
        @DisplayName("RatingCount eh normalizado para nao-negativo no bloco init")
        fun `ratingCount is normalized to non-negative in init block`() {
            // Given - Create location with negative ratingCount
            val location = Location(
                id = "loc-1",
                name = "Test Location",
                ownerId = "owner-1",
                ratingCount = -5 // Should be normalized to 0
            )

            // Then - ratingCount should be 0 due to coerceAtLeast(0) in init
            assertThat(location.ratingCount).isEqualTo(0)
        }

        @Test
        @DisplayName("MinGameDurationMinutes eh normalizado para pelo menos 30 no bloco init")
        fun `minGameDurationMinutes is normalized to at least 30 in init block`() {
            // Given
            val location = Location(
                id = "loc-1",
                name = "Test Location",
                ownerId = "owner-1",
                minGameDurationMinutes = 10 // Should be normalized to 30
            )

            // Then
            assertThat(location.minGameDurationMinutes).isEqualTo(30)
        }
    }

    // ==================== TESTES DE METODOS AUXILIARES ====================

    @Nested
    @DisplayName("Metodos Auxiliares do Location")
    inner class HelperMethods {

        @Test
        @DisplayName("isOwner retorna true para o proprietario")
        fun `isOwner returns true for owner`() {
            // Given
            val location = createValidLocation(ownerId = "user-123")

            // Then
            assertThat(location.isOwner("user-123")).isTrue()
            assertThat(location.isOwner("other-user")).isFalse()
        }

        @Test
        @DisplayName("isManager retorna true para gerentes")
        fun `isManager returns true for managers`() {
            // Given
            val location = Location(
                id = "loc-1",
                name = "Test Location",
                ownerId = "owner-1",
                managers = listOf("manager-1", "manager-2")
            )

            // Then
            assertThat(location.isManager("manager-1")).isTrue()
            assertThat(location.isManager("manager-2")).isTrue()
            assertThat(location.isManager("other-user")).isFalse()
        }

        @Test
        @DisplayName("canManage retorna true para proprietario ou gerentes")
        fun `canManage returns true for owner or managers`() {
            // Given
            val location = Location(
                id = "loc-1",
                name = "Test Location",
                ownerId = "owner-1",
                managers = listOf("manager-1")
            )

            // Then
            assertThat(location.canManage("owner-1")).isTrue()
            assertThat(location.canManage("manager-1")).isTrue()
            assertThat(location.canManage("random-user")).isFalse()
        }

        @Test
        @DisplayName("getFullAddress retorna endereco formatado quando city e state estao definidos")
        fun `getFullAddress returns formatted address when city and state are set`() {
            // Given
            val location = createValidLocation(
                address = "Rua das Flores, 123",
                city = "Curitiba",
                state = "PR"
            )

            // When
            val fullAddress = location.getFullAddress()

            // Then
            assertThat(fullAddress).isEqualTo("Rua das Flores, 123 - Curitiba, PR")
        }

        @Test
        @DisplayName("getFullAddress retorna apenas address quando city ou state estao vazios")
        fun `getFullAddress returns only address when city or state is empty`() {
            // Given
            val location = createValidLocation(
                address = "Rua das Flores, 123",
                city = "",
                state = ""
            )

            // When
            val fullAddress = location.getFullAddress()

            // Then
            assertThat(fullAddress).isEqualTo("Rua das Flores, 123")
        }
    }
}
