package com.futebadosparcas.domain.authorization

import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.UserRole
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Testes unitários para UserPermissions.
 * Cobre matriz de permissões, verificações de admin e ownership.
 */
@DisplayName("UserPermissions Tests")
class UserPermissionsTest {

    // ==================== HELPER FUNCTIONS ====================

    private fun createUser(
        id: String = "user-123",
        role: String = UserRole.PLAYER.name
    ) = User(
        id = id,
        email = "test@example.com",
        name = "Test User",
        role = role
    )

    // ==================== TESTES DE hasPermission ====================

    @Nested
    @DisplayName("hasPermission")
    inner class HasPermissionTests {

        @Test
        @DisplayName("Admin deve ter todas as permissões")
        fun `admin should have all permissions`() {
            val admin = createUser(role = UserRole.ADMIN.name)

            UserPermissions.Action.entries.forEach { action ->
                assertTrue(
                    UserPermissions.hasPermission(admin, action),
                    "Admin deveria ter permissão para $action"
                )
            }
        }

        @Test
        @DisplayName("Usuário null deve retornar false")
        fun `null user should return false`() {
            assertFalse(UserPermissions.hasPermission(null, UserPermissions.Action.CREATE_GAME))
        }

        @Test
        @DisplayName("Player deve ter permissão CREATE_GAME")
        fun `player should have CREATE_GAME permission`() {
            val player = createUser(role = UserRole.PLAYER.name)
            assertTrue(UserPermissions.hasPermission(player, UserPermissions.Action.CREATE_GAME))
        }

        @Test
        @DisplayName("Player NÃO deve ter permissão MANAGE_USERS")
        fun `player should NOT have MANAGE_USERS permission`() {
            val player = createUser(role = UserRole.PLAYER.name)
            assertFalse(UserPermissions.hasPermission(player, UserPermissions.Action.MANAGE_USERS))
        }

        @Test
        @DisplayName("Player NÃO deve ter permissão ACCESS_ADMIN_PANEL")
        fun `player should NOT have ACCESS_ADMIN_PANEL permission`() {
            val player = createUser(role = UserRole.PLAYER.name)
            assertFalse(UserPermissions.hasPermission(player, UserPermissions.Action.ACCESS_ADMIN_PANEL))
        }

        @Test
        @DisplayName("Field Owner deve ter permissão CREATE_LOCATION")
        fun `field owner should have CREATE_LOCATION permission`() {
            val fieldOwner = createUser(role = UserRole.FIELD_OWNER.name)
            assertTrue(UserPermissions.hasPermission(fieldOwner, UserPermissions.Action.CREATE_LOCATION))
        }

        @Test
        @DisplayName("Field Owner deve ter permissão MANAGE_OWN_LOCATIONS")
        fun `field owner should have MANAGE_OWN_LOCATIONS permission`() {
            val fieldOwner = createUser(role = UserRole.FIELD_OWNER.name)
            assertTrue(UserPermissions.hasPermission(fieldOwner, UserPermissions.Action.MANAGE_OWN_LOCATIONS))
        }

        @Test
        @DisplayName("Field Owner NÃO deve ter permissão EDIT_ANY_LOCATION")
        fun `field owner should NOT have EDIT_ANY_LOCATION permission`() {
            val fieldOwner = createUser(role = UserRole.FIELD_OWNER.name)
            assertFalse(UserPermissions.hasPermission(fieldOwner, UserPermissions.Action.EDIT_ANY_LOCATION))
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
            assertTrue(UserPermissions.isAdmin(admin))
        }

        @Test
        @DisplayName("Player deve retornar false")
        fun `player should return false`() {
            val player = createUser(role = UserRole.PLAYER.name)
            assertFalse(UserPermissions.isAdmin(player))
        }

        @Test
        @DisplayName("Field Owner deve retornar false")
        fun `field owner should return false`() {
            val fieldOwner = createUser(role = UserRole.FIELD_OWNER.name)
            assertFalse(UserPermissions.isAdmin(fieldOwner))
        }

        @Test
        @DisplayName("Null deve retornar false")
        fun `null should return false`() {
            assertFalse(UserPermissions.isAdmin(null))
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
            assertTrue(UserPermissions.isFieldOwner(fieldOwner))
        }

        @Test
        @DisplayName("Admin também deve ser considerado Field Owner")
        fun `admin should also be considered field owner`() {
            val admin = createUser(role = UserRole.ADMIN.name)
            assertTrue(UserPermissions.isFieldOwner(admin))
        }

        @Test
        @DisplayName("Player deve retornar false")
        fun `player should return false`() {
            val player = createUser(role = UserRole.PLAYER.name)
            assertFalse(UserPermissions.isFieldOwner(player))
        }

        @Test
        @DisplayName("Null deve retornar false")
        fun `null should return false`() {
            assertFalse(UserPermissions.isFieldOwner(null))
        }
    }

    // ==================== TESTES DE canManageResource ====================

    @Nested
    @DisplayName("canManageResource")
    inner class CanManageResourceTests {

        @Test
        @DisplayName("Admin pode gerenciar qualquer recurso")
        fun `admin can manage any resource`() {
            val admin = createUser(id = "admin-1", role = UserRole.ADMIN.name)
            assertTrue(
                UserPermissions.canManageResource(
                    admin,
                    UserPermissions.Action.EDIT_ANY_GAME,
                    "other-user-123"
                )
            )
        }

        @Test
        @DisplayName("Dono pode gerenciar seu próprio recurso")
        fun `owner can manage own resource`() {
            val player = createUser(id = "player-123", role = UserRole.PLAYER.name)
            assertTrue(
                UserPermissions.canManageResource(
                    player,
                    UserPermissions.Action.EDIT_ANY_GAME,
                    "player-123"
                )
            )
        }

        @Test
        @DisplayName("Não-dono não pode gerenciar recurso de outro")
        fun `non-owner cannot manage other's resource`() {
            val player = createUser(id = "player-123", role = UserRole.PLAYER.name)
            // Player tem EDIT_ANY_GAME mas não é dono nem admin
            val result = UserPermissions.canManageResource(
                player,
                UserPermissions.Action.DELETE_ANY_GAME,
                "other-user-456"
            )
            // Player não tem DELETE_ANY_GAME e não é dono
            assertFalse(result)
        }

        @Test
        @DisplayName("Null user não pode gerenciar recurso")
        fun `null user cannot manage resource`() {
            assertFalse(
                UserPermissions.canManageResource(
                    null,
                    UserPermissions.Action.EDIT_ANY_GAME,
                    "owner-123"
                )
            )
        }

        @Test
        @DisplayName("ResourceOwnerId null - verifica apenas permissão")
        fun `null resourceOwnerId checks only permission`() {
            val fieldOwner = createUser(role = UserRole.FIELD_OWNER.name)
            assertTrue(
                UserPermissions.canManageResource(
                    fieldOwner,
                    UserPermissions.Action.EDIT_ANY_GAME,
                    null
                )
            )
        }
    }

    // ==================== TESTES DE canEditUser ====================

    @Nested
    @DisplayName("canEditUser")
    inner class CanEditUserTests {

        @Test
        @DisplayName("Admin pode editar qualquer usuário")
        fun `admin can edit any user`() {
            val admin = createUser(id = "admin-1", role = UserRole.ADMIN.name)
            val targetUser = createUser(id = "user-2", role = UserRole.PLAYER.name)

            assertTrue(UserPermissions.canEditUser(admin, targetUser))
        }

        @Test
        @DisplayName("Usuário pode editar próprio perfil")
        fun `user can edit own profile`() {
            val user = createUser(id = "user-123", role = UserRole.PLAYER.name)
            val sameUser = createUser(id = "user-123", role = UserRole.PLAYER.name)

            assertTrue(UserPermissions.canEditUser(user, sameUser))
        }

        @Test
        @DisplayName("Player não pode editar outro usuário")
        fun `player cannot edit other user`() {
            val player = createUser(id = "player-1", role = UserRole.PLAYER.name)
            val otherUser = createUser(id = "player-2", role = UserRole.PLAYER.name)

            assertFalse(UserPermissions.canEditUser(player, otherUser))
        }

        @Test
        @DisplayName("Null actor não pode editar")
        fun `null actor cannot edit`() {
            val targetUser = createUser()
            assertFalse(UserPermissions.canEditUser(null, targetUser))
        }

        @Test
        @DisplayName("Null target não pode ser editado")
        fun `null target cannot be edited`() {
            val actor = createUser(role = UserRole.ADMIN.name)
            assertFalse(UserPermissions.canEditUser(actor, null))
        }

        @Test
        @DisplayName("Ambos null retorna false")
        fun `both null returns false`() {
            assertFalse(UserPermissions.canEditUser(null, null))
        }
    }

    // ==================== TESTES DE canDeleteResource ====================

    @Nested
    @DisplayName("canDeleteResource")
    inner class CanDeleteResourceTests {

        @Test
        @DisplayName("Admin pode excluir qualquer recurso")
        fun `admin can delete any resource`() {
            val admin = createUser(role = UserRole.ADMIN.name)
            assertTrue(UserPermissions.canDeleteResource(admin, "any-owner-id"))
        }

        @Test
        @DisplayName("Dono pode excluir próprio recurso")
        fun `owner can delete own resource`() {
            val user = createUser(id = "user-123")
            assertTrue(UserPermissions.canDeleteResource(user, "user-123"))
        }

        @Test
        @DisplayName("Não-dono não pode excluir recurso de outro")
        fun `non-owner cannot delete other's resource`() {
            val user = createUser(id = "user-123")
            assertFalse(UserPermissions.canDeleteResource(user, "other-user-456"))
        }

        @Test
        @DisplayName("Null user não pode excluir")
        fun `null user cannot delete`() {
            assertFalse(UserPermissions.canDeleteResource(null, "any-id"))
        }
    }

    // ==================== TESTES DE EXTENSÕES ====================

    @Nested
    @DisplayName("User Extensions")
    inner class UserExtensionsTests {

        @Test
        @DisplayName("User.isAdmin extension funciona corretamente")
        fun `User isAdmin extension works correctly`() {
            val admin = createUser(role = UserRole.ADMIN.name)
            val player = createUser(role = UserRole.PLAYER.name)

            assertTrue(admin.isAdmin)
            assertFalse(player.isAdmin)
        }

        @Test
        @DisplayName("User.isFieldOwner extension funciona corretamente")
        fun `User isFieldOwner extension works correctly`() {
            val fieldOwner = createUser(role = UserRole.FIELD_OWNER.name)
            val player = createUser(role = UserRole.PLAYER.name)

            assertTrue(fieldOwner.isFieldOwner)
            assertFalse(player.isFieldOwner)
        }

        @Test
        @DisplayName("User.canManageLocations extension funciona corretamente")
        fun `User canManageLocations extension works correctly`() {
            val admin = createUser(role = UserRole.ADMIN.name)
            val fieldOwner = createUser(role = UserRole.FIELD_OWNER.name)
            val player = createUser(role = UserRole.PLAYER.name)

            assertTrue(admin.canManageLocations)
            assertTrue(fieldOwner.canManageLocations)
            assertFalse(player.canManageLocations)
        }

        @Test
        @DisplayName("User.hasPermission extension funciona corretamente")
        fun `User hasPermission extension works correctly`() {
            val admin = createUser(role = UserRole.ADMIN.name)
            val player = createUser(role = UserRole.PLAYER.name)

            assertTrue(admin.hasPermission(UserPermissions.Action.MANAGE_USERS))
            assertFalse(player.hasPermission(UserPermissions.Action.MANAGE_USERS))
        }

        @Test
        @DisplayName("User.canManageResource extension funciona corretamente")
        fun `User canManageResource extension works correctly`() {
            val user = createUser(id = "user-123")

            assertTrue(user.canManageResource(UserPermissions.Action.EDIT_ANY_GAME, "user-123"))
            assertFalse(user.canManageResource(UserPermissions.Action.DELETE_ANY_GAME, "other-user"))
        }
    }

    // ==================== TESTES DE ACTIONS ====================

    @Nested
    @DisplayName("Actions")
    inner class ActionsTests {

        @Test
        @DisplayName("Deve existir todas as ações esperadas")
        fun `should have all expected actions`() {
            val expectedActions = listOf(
                "MANAGE_USERS", "VIEW_ALL_USERS", "CHANGE_USER_ROLE",
                "CREATE_GAME", "EDIT_ANY_GAME", "DELETE_ANY_GAME",
                "CONFIRM_PRESENCE_ANY_GAME", "EDIT_GAME_STATS",
                "CREATE_LOCATION", "EDIT_ANY_LOCATION", "DELETE_ANY_LOCATION",
                "MANAGE_OWN_LOCATIONS", "CREATE_GROUP", "EDIT_ANY_GROUP",
                "DELETE_ANY_GROUP", "MANAGE_GROUP_CASHBOX",
                "VIEW_GLOBAL_STATS", "EDIT_RANKINGS", "ADJUST_XP",
                "MANAGE_NOTIFICATIONS", "ACCESS_ADMIN_PANEL",
                "MANAGE_BADGES", "MANAGE_CHALLENGES"
            )

            val actualActions = UserPermissions.Action.entries.map { it.name }
            expectedActions.forEach { expected ->
                assertTrue(actualActions.contains(expected), "Action $expected deveria existir")
            }
        }

        @Test
        @DisplayName("Quantidade de actions deve ser 23")
        fun `should have 23 actions`() {
            assertEquals(23, UserPermissions.Action.entries.size)
        }
    }
}
