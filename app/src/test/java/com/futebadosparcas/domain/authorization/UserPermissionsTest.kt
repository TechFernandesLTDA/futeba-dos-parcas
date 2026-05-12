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
                    UserPermissions.Action.EDIT_GAME,
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
                    UserPermissions.Action.EDIT_GAME,
                    "player-123"
                )
            )
        }

        @Test
        @DisplayName("Não-dono não pode gerenciar recurso de outro")
        fun `non-owner cannot manage other's resource`() {
            val player = createUser(id = "player-123", role = UserRole.PLAYER.name)
            // Player tem EDIT_GAME (flag global) mas não é dono nem admin
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
                    UserPermissions.Action.EDIT_GAME,
                    "owner-123"
                )
            )
        }

        @Test
        @DisplayName("ResourceOwnerId null - verifica apenas permissão (CREATE_GAME)")
        fun `null resourceOwnerId checks only permission`() {
            val fieldOwner = createUser(role = UserRole.FIELD_OWNER.name)
            // CREATE_GAME é flag global de FIELD_OWNER; usado p/ assertar fallback de permissão.
            assertTrue(
                UserPermissions.canManageResource(
                    fieldOwner,
                    UserPermissions.Action.CREATE_GAME,
                    null
                )
            )
        }

        @Test
        @DisplayName("GAP-1: FIELD_OWNER NÃO-dono não pode EDIT_GAME (rule só permite owner/admin)")
        fun `field owner non-owner cannot edit game without ownership`() {
            val fieldOwner = createUser(id = "fo-1", role = UserRole.FIELD_OWNER.name)
            // FIELD_OWNER tentando editar jogo de outro: bloqueado (alinhado ao backend)
            assertFalse(
                UserPermissions.canManageResource(
                    fieldOwner,
                    UserPermissions.Action.EDIT_GAME,
                    "other-owner-id"
                )
            )
        }

        @Test
        @DisplayName("GAP-1: FIELD_OWNER dono PODE EDIT_GAME via canManageResource")
        fun `field owner as game owner can edit via canManageResource`() {
            val fieldOwner = createUser(id = "fo-1", role = UserRole.FIELD_OWNER.name)
            // Dono do recurso passa pelo ownership check independente da flag global.
            assertTrue(
                UserPermissions.canManageResource(
                    fieldOwner,
                    UserPermissions.Action.EDIT_GAME,
                    "fo-1"
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

            assertTrue(user.canManageResource(UserPermissions.Action.EDIT_GAME, "user-123"))
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
                "CREATE_GAME", "EDIT_GAME", "DELETE_ANY_GAME",
                "CONFIRM_OWN_PRESENCE", "EDIT_GAME_STATS",
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

    // ==================== MATRIZ EXAUSTIVA POR ROLE ====================

    /**
     * Source-of-truth do esperado por role. Sincronizar com `UserPermissions.rolePermissions`.
     * Falha aqui = mudou matriz e esqueceu de atualizar testes (ou vice-versa).
     */
    @Nested
    @DisplayName("Permission matrix (exhaustive)")
    inner class PermissionMatrixTests {

        private val adminExpected: Set<UserPermissions.Action> =
            UserPermissions.Action.entries.toSet()

        // GAP-1: EDIT_GAME e EDIT_GAME_STATS REMOVIDAS do matrix global do FIELD_OWNER.
        // Backend rule só permite owner/admin; FIELD_OWNER genérico NÃO consegue.
        // Caller deve usar canManageResource(EDIT_GAME, game.ownerId) para ownership.
        private val fieldOwnerExpected: Set<UserPermissions.Action> = setOf(
            UserPermissions.Action.CREATE_GAME,
            UserPermissions.Action.CREATE_LOCATION,
            UserPermissions.Action.MANAGE_OWN_LOCATIONS,
            UserPermissions.Action.CREATE_GROUP,
            UserPermissions.Action.MANAGE_GROUP_CASHBOX,
            UserPermissions.Action.VIEW_GLOBAL_STATS
        )

        private val playerExpected: Set<UserPermissions.Action> = setOf(
            UserPermissions.Action.CREATE_GAME,
            UserPermissions.Action.EDIT_GAME,
            UserPermissions.Action.CONFIRM_OWN_PRESENCE,
            UserPermissions.Action.CREATE_GROUP
            // Issue #1039: MANAGE_GROUP_CASHBOX removida do PLAYER no matrix global.
            // Player admin de grupo específico tem acesso via checagem no caller.
        )

        @Test
        @DisplayName("ADMIN: matriz exata (23 allow, 0 deny)")
        fun `admin matrix`() {
            val admin = createUser(role = UserRole.ADMIN.name)
            UserPermissions.Action.entries.forEach { action ->
                val expected = action in adminExpected
                assertEquals(
                    expected,
                    UserPermissions.hasPermission(admin, action),
                    "ADMIN $action: esperado=$expected"
                )
            }
        }

        @Test
        @DisplayName("FIELD_OWNER: matriz exata (6 allow, 17 deny)")
        fun `field owner matrix`() {
            val fieldOwner = createUser(role = UserRole.FIELD_OWNER.name)
            UserPermissions.Action.entries.forEach { action ->
                val expected = action in fieldOwnerExpected
                assertEquals(
                    expected,
                    UserPermissions.hasPermission(fieldOwner, action),
                    "FIELD_OWNER $action: esperado=$expected"
                )
            }
        }

        @Test
        @DisplayName("PLAYER: matriz exata (4 allow, 19 deny)")
        fun `player matrix`() {
            val player = createUser(role = UserRole.PLAYER.name)
            UserPermissions.Action.entries.forEach { action ->
                val expected = action in playerExpected
                assertEquals(
                    expected,
                    UserPermissions.hasPermission(player, action),
                    "PLAYER $action: esperado=$expected"
                )
            }
        }

        @Test
        @DisplayName("ADMIN tem superset de FIELD_OWNER e PLAYER")
        fun `admin is superset of other roles`() {
            assertTrue(
                fieldOwnerExpected.all { it in adminExpected },
                "ADMIN deve conter todas as permissões de FIELD_OWNER"
            )
            assertTrue(
                playerExpected.all { it in adminExpected },
                "ADMIN deve conter todas as permissões de PLAYER"
            )
        }

        @Test
        @DisplayName("FIELD_OWNER NÃO pode acessar admin panel nem mudar role")
        fun `field owner has no admin actions`() {
            val fieldOwner = createUser(role = UserRole.FIELD_OWNER.name)
            val adminOnly = listOf(
                UserPermissions.Action.MANAGE_USERS,
                UserPermissions.Action.VIEW_ALL_USERS,
                UserPermissions.Action.CHANGE_USER_ROLE,
                // GAP-1: EDIT_GAME/EDIT_GAME_STATS NÃO são flags globais do FIELD_OWNER;
                // ownership é validado via canManageResource (não pela flag).
                UserPermissions.Action.EDIT_GAME,
                UserPermissions.Action.EDIT_GAME_STATS,
                UserPermissions.Action.DELETE_ANY_GAME,
                UserPermissions.Action.EDIT_ANY_LOCATION,
                UserPermissions.Action.DELETE_ANY_LOCATION,
                UserPermissions.Action.EDIT_ANY_GROUP,
                UserPermissions.Action.DELETE_ANY_GROUP,
                UserPermissions.Action.EDIT_RANKINGS,
                UserPermissions.Action.ADJUST_XP,
                UserPermissions.Action.MANAGE_NOTIFICATIONS,
                UserPermissions.Action.ACCESS_ADMIN_PANEL,
                UserPermissions.Action.MANAGE_BADGES,
                UserPermissions.Action.MANAGE_CHALLENGES
            )
            adminOnly.forEach { action ->
                assertFalse(
                    UserPermissions.hasPermission(fieldOwner, action),
                    "FIELD_OWNER NÃO deve ter $action"
                )
            }
        }

        @Test
        @DisplayName("PLAYER NÃO pode gerenciar locais nem ver stats globais")
        fun `player has no field owner or admin actions`() {
            val player = createUser(role = UserRole.PLAYER.name)
            val notForPlayer = listOf(
                UserPermissions.Action.CREATE_LOCATION,
                UserPermissions.Action.MANAGE_OWN_LOCATIONS,
                UserPermissions.Action.EDIT_ANY_LOCATION,
                UserPermissions.Action.DELETE_ANY_LOCATION,
                UserPermissions.Action.VIEW_GLOBAL_STATS,
                UserPermissions.Action.EDIT_GAME_STATS,
                UserPermissions.Action.MANAGE_USERS,
                UserPermissions.Action.ACCESS_ADMIN_PANEL,
                UserPermissions.Action.ADJUST_XP
            )
            notForPlayer.forEach { action ->
                assertFalse(
                    UserPermissions.hasPermission(player, action),
                    "PLAYER NÃO deve ter $action"
                )
            }
        }
    }

    // ==================== USUARIO NAO AUTENTICADO / ROLE INVALIDO ====================

    @Nested
    @DisplayName("Edge cases")
    inner class EdgeCaseTests {

        @Test
        @DisplayName("Role string invalido deve cair em PLAYER (default)")
        fun `invalid role string defaults to PLAYER`() {
            val user = createUser(role = "INVALID_ROLE_XYZ")
            assertTrue(
                UserPermissions.hasPermission(user, UserPermissions.Action.CREATE_GAME),
                "Role invalido deve ter perms de PLAYER"
            )
            assertFalse(
                UserPermissions.hasPermission(user, UserPermissions.Action.MANAGE_USERS),
                "Role invalido NAO deve ter perms admin"
            )
        }

        @Test
        @DisplayName("Role string vazio deve cair em PLAYER (default)")
        fun `empty role string defaults to PLAYER`() {
            val user = createUser(role = "")
            assertFalse(UserPermissions.isAdmin(user))
            assertFalse(UserPermissions.isFieldOwner(user))
        }

        @Test
        @DisplayName("Role e case-insensitive (UserRole.fromString usa ignoreCase=true)")
        fun `role is case-insensitive`() {
            // UserRole.fromString normaliza com ignoreCase=true.
            // Documenta o comportamento atual: 'admin', 'Admin', 'ADMIN' equivalem.
            assertTrue(UserPermissions.isAdmin(createUser(role = "admin")))
            assertTrue(UserPermissions.isAdmin(createUser(role = "Admin")))
            assertTrue(UserPermissions.isAdmin(createUser(role = "ADMIN")))
            assertTrue(UserPermissions.isFieldOwner(createUser(role = "field_owner")))
        }
    }
}
