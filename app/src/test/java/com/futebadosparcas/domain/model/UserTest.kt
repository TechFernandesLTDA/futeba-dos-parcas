package com.futebadosparcas.domain.model

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.junit.jupiter.params.provider.ValueSource

/**
 * Testes unitários para User e UserRole.
 * Cobre roles, ratings, permissões e campos de exibição.
 */
@DisplayName("User Tests")
class UserTest {

    // ==================== HELPER FUNCTIONS ====================

    private fun createUser(
        id: String = "user-123",
        name: String = "Test User",
        nickname: String? = null,
        role: String = UserRole.PLAYER.name,
        strikerRating: Double = 0.0,
        midRating: Double = 0.0,
        defenderRating: Double = 0.0,
        gkRating: Double = 0.0,
        autoStrikerRating: Double = 0.0,
        autoMidRating: Double = 0.0,
        autoDefenderRating: Double = 0.0,
        autoGkRating: Double = 0.0,
        autoRatingSamples: Int = 0
    ) = User(
        id = id,
        name = name,
        nickname = nickname,
        role = role,
        strikerRating = strikerRating,
        midRating = midRating,
        defenderRating = defenderRating,
        gkRating = gkRating,
        autoStrikerRating = autoStrikerRating,
        autoMidRating = autoMidRating,
        autoDefenderRating = autoDefenderRating,
        autoGkRating = autoGkRating,
        autoRatingSamples = autoRatingSamples
    )

    // ==================== TESTES DE UserRole ====================

    @Nested
    @DisplayName("UserRole")
    inner class UserRoleTests {

        @Test
        @DisplayName("fromString deve converter corretamente")
        fun `fromString should convert correctly`() {
            assertEquals(UserRole.ADMIN, UserRole.fromString("ADMIN"))
            assertEquals(UserRole.FIELD_OWNER, UserRole.fromString("FIELD_OWNER"))
            assertEquals(UserRole.PLAYER, UserRole.fromString("PLAYER"))
        }

        @Test
        @DisplayName("fromString deve ser case insensitive")
        fun `fromString should be case insensitive`() {
            assertEquals(UserRole.ADMIN, UserRole.fromString("admin"))
            assertEquals(UserRole.ADMIN, UserRole.fromString("Admin"))
            assertEquals(UserRole.FIELD_OWNER, UserRole.fromString("field_owner"))
        }

        @Test
        @DisplayName("fromString null deve retornar PLAYER")
        fun `fromString null should return PLAYER`() {
            assertEquals(UserRole.PLAYER, UserRole.fromString(null))
        }

        @Test
        @DisplayName("fromString inválido deve retornar PLAYER")
        fun `fromString invalid should return PLAYER`() {
            assertEquals(UserRole.PLAYER, UserRole.fromString("INVALID"))
            assertEquals(UserRole.PLAYER, UserRole.fromString(""))
        }

        @Test
        @DisplayName("Todos os roles devem ter displayName")
        fun `all roles should have displayName`() {
            UserRole.entries.forEach { role ->
                assertTrue(role.displayName.isNotEmpty())
            }
        }

        @Test
        @DisplayName("Todos os roles devem ter description")
        fun `all roles should have description`() {
            UserRole.entries.forEach { role ->
                assertTrue(role.description.isNotEmpty())
            }
        }
    }

    // ==================== TESTES DE getRoleEnum ====================

    @Nested
    @DisplayName("getRoleEnum")
    inner class GetRoleEnumTests {

        @Test
        @DisplayName("Deve retornar role correto")
        fun `should return correct role`() {
            val admin = createUser(role = UserRole.ADMIN.name)
            val fieldOwner = createUser(role = UserRole.FIELD_OWNER.name)
            val player = createUser(role = UserRole.PLAYER.name)

            assertEquals(UserRole.ADMIN, admin.getRoleEnum())
            assertEquals(UserRole.FIELD_OWNER, fieldOwner.getRoleEnum())
            assertEquals(UserRole.PLAYER, player.getRoleEnum())
        }

        @Test
        @DisplayName("Role inválido deve retornar PLAYER")
        fun `invalid role should return PLAYER`() {
            val user = createUser(role = "INVALID")
            assertEquals(UserRole.PLAYER, user.getRoleEnum())
        }
    }

    // ==================== TESTES DE isAdmin ====================

    @Nested
    @DisplayName("isAdmin")
    inner class IsAdminTests {

        @Test
        @DisplayName("Admin deve retornar true")
        fun `admin should return true`() {
            val admin = createUser(role = UserRole.ADMIN.name)
            assertTrue(admin.isAdmin())
        }

        @Test
        @DisplayName("Non-admin deve retornar false")
        fun `non-admin should return false`() {
            val fieldOwner = createUser(role = UserRole.FIELD_OWNER.name)
            val player = createUser(role = UserRole.PLAYER.name)

            assertFalse(fieldOwner.isAdmin())
            assertFalse(player.isAdmin())
        }
    }

    // ==================== TESTES DE isFieldOwner ====================

    @Nested
    @DisplayName("isFieldOwner")
    inner class IsFieldOwnerTests {

        @Test
        @DisplayName("Field Owner deve retornar true")
        fun `field owner should return true`() {
            val fieldOwner = createUser(role = UserRole.FIELD_OWNER.name)
            assertTrue(fieldOwner.isFieldOwner())
        }

        @Test
        @DisplayName("Admin também deve retornar true")
        fun `admin should also return true`() {
            val admin = createUser(role = UserRole.ADMIN.name)
            assertTrue(admin.isFieldOwner())
        }

        @Test
        @DisplayName("Player deve retornar false")
        fun `player should return false`() {
            val player = createUser(role = UserRole.PLAYER.name)
            assertFalse(player.isFieldOwner())
        }
    }

    // ==================== TESTES DE getDisplayName ====================

    @Nested
    @DisplayName("getDisplayName")
    inner class GetDisplayNameTests {

        @Test
        @DisplayName("Com nickname deve retornar nickname")
        fun `with nickname should return nickname`() {
            val user = createUser(name = "João Silva", nickname = "Joãozinho")
            assertEquals("Joãozinho", user.getDisplayName())
        }

        @Test
        @DisplayName("Sem nickname deve retornar name")
        fun `without nickname should return name`() {
            val user = createUser(name = "João Silva", nickname = null)
            assertEquals("João Silva", user.getDisplayName())
        }

        @Test
        @DisplayName("Nickname vazio deve retornar name")
        fun `empty nickname should return name`() {
            val user = createUser(name = "João Silva", nickname = "")
            assertEquals("João Silva", user.getDisplayName())
        }

        @Test
        @DisplayName("Nickname com espaços deve retornar name")
        fun `blank nickname should return name`() {
            val user = createUser(name = "João Silva", nickname = "   ")
            assertEquals("João Silva", user.getDisplayName())
        }
    }

    // ==================== TESTES DE getAutoRatingConfidence ====================

    @Nested
    @DisplayName("getAutoRatingConfidence")
    inner class GetAutoRatingConfidenceTests {

        @Test
        @DisplayName("0 samples deve retornar 0")
        fun `0 samples should return 0`() {
            val user = createUser(autoRatingSamples = 0)
            assertEquals(0.0, user.getAutoRatingConfidence(), 0.001)
        }

        @Test
        @DisplayName("10 samples deve retornar 0.5")
        fun `10 samples should return 0_5`() {
            val user = createUser(autoRatingSamples = 10)
            assertEquals(0.5, user.getAutoRatingConfidence(), 0.001)
        }

        @Test
        @DisplayName("20+ samples deve retornar 1.0")
        fun `20 plus samples should return 1`() {
            val user = createUser(autoRatingSamples = 20)
            assertEquals(1.0, user.getAutoRatingConfidence(), 0.001)

            val user2 = createUser(autoRatingSamples = 50)
            assertEquals(1.0, user2.getAutoRatingConfidence(), 0.001)
        }

        @Test
        @DisplayName("Samples negativos deve retornar 0")
        fun `negative samples should return 0`() {
            val user = createUser(autoRatingSamples = -5)
            assertEquals(0.0, user.getAutoRatingConfidence(), 0.001)
        }
    }

    // ==================== TESTES DE getManualRating ====================

    @Nested
    @DisplayName("getManualRating")
    inner class GetManualRatingTests {

        @Test
        @DisplayName("Deve retornar rating correto para cada role")
        fun `should return correct rating for each role`() {
            val user = createUser(
                strikerRating = 4.5,
                midRating = 3.5,
                defenderRating = 2.5,
                gkRating = 1.5
            )

            assertEquals(4.5, user.getManualRating(PlayerRatingRole.STRIKER), 0.001)
            assertEquals(3.5, user.getManualRating(PlayerRatingRole.MID), 0.001)
            assertEquals(2.5, user.getManualRating(PlayerRatingRole.DEFENDER), 0.001)
            assertEquals(1.5, user.getManualRating(PlayerRatingRole.GOALKEEPER), 0.001)
        }
    }

    // ==================== TESTES DE getAutoRating ====================

    @Nested
    @DisplayName("getAutoRating")
    inner class GetAutoRatingTests {

        @Test
        @DisplayName("Deve retornar auto rating correto para cada role")
        fun `should return correct auto rating for each role`() {
            val user = createUser(
                autoStrikerRating = 4.0,
                autoMidRating = 3.0,
                autoDefenderRating = 2.0,
                autoGkRating = 1.0
            )

            assertEquals(4.0, user.getAutoRating(PlayerRatingRole.STRIKER), 0.001)
            assertEquals(3.0, user.getAutoRating(PlayerRatingRole.MID), 0.001)
            assertEquals(2.0, user.getAutoRating(PlayerRatingRole.DEFENDER), 0.001)
            assertEquals(1.0, user.getAutoRating(PlayerRatingRole.GOALKEEPER), 0.001)
        }
    }

    // ==================== TESTES DE getEffectiveRating ====================

    @Nested
    @DisplayName("getEffectiveRating")
    inner class GetEffectiveRatingTests {

        @Test
        @DisplayName("Sem auto rating deve retornar manual")
        fun `without auto rating should return manual`() {
            val user = createUser(
                strikerRating = 4.0,
                autoStrikerRating = 0.0,
                autoRatingSamples = 0
            )
            assertEquals(4.0, user.getEffectiveRating(PlayerRatingRole.STRIKER), 0.001)
        }

        @Test
        @DisplayName("Sem manual rating deve retornar auto")
        fun `without manual rating should return auto`() {
            val user = createUser(
                strikerRating = 0.0,
                autoStrikerRating = 3.5,
                autoRatingSamples = 10
            )
            assertEquals(3.5, user.getEffectiveRating(PlayerRatingRole.STRIKER), 0.001)
        }

        @Test
        @DisplayName("Com ambos deve calcular média ponderada")
        fun `with both should calculate weighted average`() {
            // 10 samples = 50% confidence
            // manual * 0.5 + auto * 0.5
            val user = createUser(
                strikerRating = 4.0,
                autoStrikerRating = 3.0,
                autoRatingSamples = 10
            )
            // (4.0 * 0.5) + (3.0 * 0.5) = 3.5
            assertEquals(3.5, user.getEffectiveRating(PlayerRatingRole.STRIKER), 0.001)
        }

        @Test
        @DisplayName("Rating efetivo deve ser capeado em 5.0")
        fun `effective rating should be capped at 5`() {
            val user = createUser(
                strikerRating = 5.0,
                autoStrikerRating = 5.0,
                autoRatingSamples = 20
            )
            assertTrue(user.getEffectiveRating(PlayerRatingRole.STRIKER) <= 5.0)
        }
    }

    // ==================== TESTES DE getOverallRating ====================

    @Nested
    @DisplayName("getOverallRating")
    inner class GetOverallRatingTests {

        @Test
        @DisplayName("Sem ratings deve retornar 0")
        fun `without ratings should return 0`() {
            val user = createUser()
            assertEquals(0.0, user.getOverallRating(), 0.001)
        }

        @Test
        @DisplayName("Com um rating deve retornar esse rating")
        fun `with one rating should return that rating`() {
            val user = createUser(strikerRating = 4.0)
            assertEquals(4.0, user.getOverallRating(), 0.001)
        }

        @Test
        @DisplayName("Com múltiplos ratings deve retornar média")
        fun `with multiple ratings should return average`() {
            val user = createUser(
                strikerRating = 4.0,
                midRating = 3.0,
                defenderRating = 2.0
            )
            // (4 + 3 + 2) / 3 = 3.0
            assertEquals(3.0, user.getOverallRating(), 0.001)
        }

        @Test
        @DisplayName("Goleiro não entra na média geral")
        fun `goalkeeper rating should not be included in overall`() {
            val user = createUser(
                strikerRating = 4.0,
                gkRating = 5.0
            )
            // Apenas striker conta (4.0)
            assertEquals(4.0, user.getOverallRating(), 0.001)
        }
    }

    // ==================== TESTES DE DATA CLASS ====================

    @Nested
    @DisplayName("Data Class Properties")
    inner class DataClassPropertiesTests {

        @Test
        @DisplayName("Default values devem ser corretos")
        fun `default values should be correct`() {
            val user = User()

            assertEquals("", user.id)
            assertEquals("", user.email)
            assertEquals("", user.name)
            assertNull(user.phone)
            assertNull(user.nickname)
            assertNull(user.photoUrl)
            assertEquals(UserRole.PLAYER.name, user.role)
            assertTrue(user.isSearchable)
            assertTrue(user.isProfilePublic)
            assertEquals(0.0, user.strikerRating)
            assertEquals(0.0, user.midRating)
            assertEquals(0.0, user.defenderRating)
            assertEquals(0.0, user.gkRating)
            assertEquals(1, user.level)
            assertEquals(0L, user.experiencePoints)
            assertTrue(user.milestonesAchieved.isEmpty())
        }

        @Test
        @DisplayName("Copy deve funcionar corretamente")
        fun `copy should work correctly`() {
            val original = createUser(name = "Original")
            val copied = original.copy(name = "Copied")

            assertEquals("Original", original.name)
            assertEquals("Copied", copied.name)
        }
    }
}
