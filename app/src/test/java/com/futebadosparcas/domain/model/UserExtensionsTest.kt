package com.futebadosparcas.domain.model

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Testes unitarios para UserExtensions.
 *
 * Cobre helpers de permissao baseados em ownership e role:
 * - canViewAllGames / canViewAllHistory / canEditAllGames / canJoinAllGames
 * - hasGamePermission, hasUserPermission, hasLocationPermission, hasGroupPermission
 */
@DisplayName("UserExtensions Tests")
class UserExtensionsTest {

    // ==================== HELPERS ====================

    private fun user(id: String = "user-1", role: UserRole = UserRole.PLAYER) = User(
        id = id,
        email = "test@example.com",
        name = "Test User",
        role = role.name
    )

    private fun game(
        id: String = "game-1",
        ownerId: String = "owner-1",
        coOrganizers: List<String> = emptyList()
    ) = Game(
        id = id,
        ownerId = ownerId,
        coOrganizers = coOrganizers
    )

    // ==================== canViewAllGames ====================

    @Nested
    @DisplayName("canViewAllGames")
    inner class CanViewAllGamesTests {

        @Test
        @DisplayName("ADMIN pode ver todos os jogos")
        fun `admin can view all games`() {
            assertTrue(user(role = UserRole.ADMIN).canViewAllGames)
        }

        @Test
        @DisplayName("FIELD_OWNER pode ver todos os jogos")
        fun `field owner can view all games`() {
            assertTrue(user(role = UserRole.FIELD_OWNER).canViewAllGames)
        }

        @Test
        @DisplayName("PLAYER NAO pode ver todos os jogos")
        fun `player cannot view all games`() {
            assertFalse(user(role = UserRole.PLAYER).canViewAllGames)
        }
    }

    // ==================== canViewAllHistory ====================

    @Nested
    @DisplayName("canViewAllHistory")
    inner class CanViewAllHistoryTests {

        @Test
        fun `admin can view all history`() {
            assertTrue(user(role = UserRole.ADMIN).canViewAllHistory)
        }

        @Test
        fun `field owner can view all history`() {
            assertTrue(user(role = UserRole.FIELD_OWNER).canViewAllHistory)
        }

        @Test
        fun `player cannot view all history`() {
            assertFalse(user(role = UserRole.PLAYER).canViewAllHistory)
        }
    }

    // ==================== canEditAllGames ====================

    @Nested
    @DisplayName("canEditAllGames")
    inner class CanEditAllGamesTests {

        @Test
        fun `only admin can edit all games`() {
            assertTrue(user(role = UserRole.ADMIN).canEditAllGames)
            assertFalse(user(role = UserRole.FIELD_OWNER).canEditAllGames)
            assertFalse(user(role = UserRole.PLAYER).canEditAllGames)
        }
    }

    // ==================== canJoinAllGames ====================

    @Nested
    @DisplayName("canJoinAllGames")
    inner class CanJoinAllGamesTests {

        @Test
        fun `only admin can join any game`() {
            assertTrue(user(role = UserRole.ADMIN).canJoinAllGames)
            assertFalse(user(role = UserRole.FIELD_OWNER).canJoinAllGames)
            assertFalse(user(role = UserRole.PLAYER).canJoinAllGames)
        }
    }

    // ==================== hasGamePermission ====================

    @Nested
    @DisplayName("hasGamePermission")
    inner class HasGamePermissionTests {

        @Test
        @DisplayName("ADMIN pode em qualquer jogo")
        fun `admin has permission on any game`() {
            val admin = user(id = "admin-1", role = UserRole.ADMIN)
            val randomGame = game(ownerId = "stranger-1", coOrganizers = listOf("co-1", "co-2"))
            assertTrue(admin.hasGamePermission(randomGame))
        }

        @Test
        @DisplayName("Dono do jogo (PLAYER) tem permissao")
        fun `game owner has permission`() {
            val owner = user(id = "owner-x", role = UserRole.PLAYER)
            val ownGame = game(ownerId = "owner-x")
            assertTrue(owner.hasGamePermission(ownGame))
        }

        @Test
        @DisplayName("Co-organizador tem permissao")
        fun `co-organizer has permission`() {
            val coOrg = user(id = "co-1", role = UserRole.PLAYER)
            val sharedGame = game(ownerId = "other-owner", coOrganizers = listOf("co-1"))
            assertTrue(coOrg.hasGamePermission(sharedGame))
        }

        @Test
        @DisplayName("Random PLAYER NAO tem permissao em jogo de outro")
        fun `random player has no permission`() {
            val random = user(id = "random-1", role = UserRole.PLAYER)
            val foreignGame = game(ownerId = "another-owner", coOrganizers = listOf("co-x"))
            assertFalse(random.hasGamePermission(foreignGame))
        }

        @Test
        @DisplayName("FIELD_OWNER nao-dono nao tem permissao automatica em jogo de outro")
        fun `field owner has no automatic game permission`() {
            val fo = user(id = "fo-1", role = UserRole.FIELD_OWNER)
            val foreignGame = game(ownerId = "owner-x")
            assertFalse(fo.hasGamePermission(foreignGame))
        }
    }

    // ==================== hasUserPermission ====================

    @Nested
    @DisplayName("hasUserPermission")
    inner class HasUserPermissionTests {

        @Test
        fun `admin can manage any user`() {
            val admin = user(id = "admin-1", role = UserRole.ADMIN)
            assertTrue(admin.hasUserPermission("any-target-id"))
        }

        @Test
        fun `user can manage self`() {
            val u = user(id = "user-x", role = UserRole.PLAYER)
            assertTrue(u.hasUserPermission("user-x"))
        }

        @Test
        fun `player cannot manage other user`() {
            val p = user(id = "player-1", role = UserRole.PLAYER)
            assertFalse(p.hasUserPermission("other-user"))
        }

        @Test
        fun `field owner cannot manage other user`() {
            val fo = user(id = "fo-1", role = UserRole.FIELD_OWNER)
            assertFalse(fo.hasUserPermission("other-user"))
        }
    }

    // ==================== hasLocationPermission ====================

    @Nested
    @DisplayName("hasLocationPermission")
    inner class HasLocationPermissionTests {

        @Test
        @DisplayName("ADMIN pode em qualquer local")
        fun `admin can manage any location`() {
            val admin = user(id = "admin-1", role = UserRole.ADMIN)
            assertTrue(admin.hasLocationPermission("any-owner"))
        }

        @Test
        @DisplayName("FIELD_OWNER pode em local proprio")
        fun `field owner can manage own location`() {
            val fo = user(id = "fo-x", role = UserRole.FIELD_OWNER)
            assertTrue(fo.hasLocationPermission("fo-x"))
        }

        @Test
        @DisplayName("FIELD_OWNER NAO pode em local de outro")
        fun `field owner cannot manage other field owner's location`() {
            val fo = user(id = "fo-1", role = UserRole.FIELD_OWNER)
            assertFalse(fo.hasLocationPermission("fo-2"))
        }

        @Test
        @DisplayName("PLAYER nao pode gerenciar local mesmo se for dono nominal")
        fun `player cannot manage location`() {
            val p = user(id = "p-1", role = UserRole.PLAYER)
            // Mesmo passando p-1 como ownerId, PLAYER nao tem hasLocationPermission
            assertFalse(p.hasLocationPermission("p-1"))
            assertFalse(p.hasLocationPermission("other"))
        }
    }

    // ==================== hasGroupPermission ====================

    @Nested
    @DisplayName("hasGroupPermission")
    inner class HasGroupPermissionTests {

        @Test
        @DisplayName("Stub atual: sempre true para qualquer role (TODO no codigo)")
        fun `always true for any role - placeholder`() {
            assertTrue(user(role = UserRole.ADMIN).hasGroupPermission("g-1"))
            assertTrue(user(role = UserRole.FIELD_OWNER).hasGroupPermission("g-1"))
            assertTrue(user(role = UserRole.PLAYER).hasGroupPermission("g-1"))
        }
    }

    // ==================== isAdmin extension property ====================

    @Nested
    @DisplayName("User.isAdmin extension")
    inner class IsAdminPropertyTests {

        @Test
        fun `admin role returns true`() {
            assertTrue(user(role = UserRole.ADMIN).isAdmin)
        }

        @Test
        fun `field owner role returns false`() {
            assertFalse(user(role = UserRole.FIELD_OWNER).isAdmin)
        }

        @Test
        fun `player role returns false`() {
            assertFalse(user(role = UserRole.PLAYER).isAdmin)
        }
    }
}
