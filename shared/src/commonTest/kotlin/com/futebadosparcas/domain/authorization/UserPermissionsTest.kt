package com.futebadosparcas.domain.authorization

import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.UserRole
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Testes compartilhados para UserPermissions — matriz de permissoes por role.
 * Cobre ADMIN (acesso total), FIELD_OWNER (subconjunto) e PLAYER (minimo).
 * Executam em Android (JVM) e iOS (Native).
 */
class UserPermissionsTest {

    private fun adminUser() = User(id = "admin-1", role = UserRole.ADMIN.name)
    private fun fieldOwnerUser() = User(id = "fo-1", role = UserRole.FIELD_OWNER.name)
    private fun playerUser() = User(id = "player-1", role = UserRole.PLAYER.name)

    // ---- ADMIN ----

    @Test
    fun admin_isAdmin_retornaTrue() {
        assertTrue(UserPermissions.isAdmin(adminUser()))
    }

    @Test
    fun admin_hasPermission_manageUsers_retornaTrue() {
        assertTrue(UserPermissions.hasPermission(adminUser(), UserPermissions.Action.MANAGE_USERS))
    }

    @Test
    fun admin_hasPermission_deleteAnyGame_retornaTrue() {
        assertTrue(UserPermissions.hasPermission(adminUser(), UserPermissions.Action.DELETE_ANY_GAME))
    }

    @Test
    fun admin_hasPermission_editRankings_retornaTrue() {
        assertTrue(UserPermissions.hasPermission(adminUser(), UserPermissions.Action.EDIT_RANKINGS))
    }

    @Test
    fun admin_hasPermission_accessAdminPanel_retornaTrue() {
        assertTrue(UserPermissions.hasPermission(adminUser(), UserPermissions.Action.ACCESS_ADMIN_PANEL))
    }

    @Test
    fun admin_hasPermission_adjustXp_retornaTrue() {
        assertTrue(UserPermissions.hasPermission(adminUser(), UserPermissions.Action.ADJUST_XP))
    }

    @Test
    fun admin_isFieldOwner_retornaTrue() {
        assertTrue(UserPermissions.isFieldOwner(adminUser()))
    }

    // ---- FIELD_OWNER ----

    @Test
    fun fieldOwner_isAdmin_retornaFalse() {
        assertFalse(UserPermissions.isAdmin(fieldOwnerUser()))
    }

    @Test
    fun fieldOwner_isFieldOwner_retornaTrue() {
        assertTrue(UserPermissions.isFieldOwner(fieldOwnerUser()))
    }

    @Test
    fun fieldOwner_hasPermission_createGame_retornaTrue() {
        assertTrue(UserPermissions.hasPermission(fieldOwnerUser(), UserPermissions.Action.CREATE_GAME))
    }

    @Test
    fun fieldOwner_hasPermission_createLocation_retornaTrue() {
        assertTrue(UserPermissions.hasPermission(fieldOwnerUser(), UserPermissions.Action.CREATE_LOCATION))
    }

    @Test
    fun fieldOwner_hasPermission_manageOwnLocations_retornaTrue() {
        assertTrue(UserPermissions.hasPermission(fieldOwnerUser(), UserPermissions.Action.MANAGE_OWN_LOCATIONS))
    }

    @Test
    fun fieldOwner_hasPermission_viewGlobalStats_retornaTrue() {
        assertTrue(UserPermissions.hasPermission(fieldOwnerUser(), UserPermissions.Action.VIEW_GLOBAL_STATS))
    }

    @Test
    fun fieldOwner_hasPermission_manageUsers_retornaFalse() {
        assertFalse(UserPermissions.hasPermission(fieldOwnerUser(), UserPermissions.Action.MANAGE_USERS))
    }

    @Test
    fun fieldOwner_hasPermission_editRankings_retornaFalse() {
        assertFalse(UserPermissions.hasPermission(fieldOwnerUser(), UserPermissions.Action.EDIT_RANKINGS))
    }

    @Test
    fun fieldOwner_hasPermission_accessAdminPanel_retornaFalse() {
        assertFalse(UserPermissions.hasPermission(fieldOwnerUser(), UserPermissions.Action.ACCESS_ADMIN_PANEL))
    }

    // ---- PLAYER ----

    @Test
    fun player_isAdmin_retornaFalse() {
        assertFalse(UserPermissions.isAdmin(playerUser()))
    }

    @Test
    fun player_isFieldOwner_retornaFalse() {
        assertFalse(UserPermissions.isFieldOwner(playerUser()))
    }

    @Test
    fun player_hasPermission_createGame_retornaTrue() {
        assertTrue(UserPermissions.hasPermission(playerUser(), UserPermissions.Action.CREATE_GAME))
    }

    @Test
    fun player_hasPermission_confirmOwnPresence_retornaTrue() {
        assertTrue(UserPermissions.hasPermission(playerUser(), UserPermissions.Action.CONFIRM_OWN_PRESENCE))
    }

    @Test
    fun player_hasPermission_createGroup_retornaTrue() {
        assertTrue(UserPermissions.hasPermission(playerUser(), UserPermissions.Action.CREATE_GROUP))
    }

    @Test
    fun player_hasPermission_manageGroupCashbox_retornaFalse() {
        // PLAYER nao tem permissao global de cashbox (#1039)
        assertFalse(UserPermissions.hasPermission(playerUser(), UserPermissions.Action.MANAGE_GROUP_CASHBOX))
    }

    @Test
    fun player_hasPermission_manageUsers_retornaFalse() {
        assertFalse(UserPermissions.hasPermission(playerUser(), UserPermissions.Action.MANAGE_USERS))
    }

    @Test
    fun player_hasPermission_viewGlobalStats_retornaFalse() {
        assertFalse(UserPermissions.hasPermission(playerUser(), UserPermissions.Action.VIEW_GLOBAL_STATS))
    }

    // ---- null user ----

    @Test
    fun nullUser_hasPermission_retornaFalse() {
        assertFalse(UserPermissions.hasPermission(null, UserPermissions.Action.CREATE_GAME))
    }

    @Test
    fun nullUser_isAdmin_retornaFalse() {
        assertFalse(UserPermissions.isAdmin(null))
    }

    @Test
    fun nullUser_isFieldOwner_retornaFalse() {
        assertFalse(UserPermissions.isFieldOwner(null))
    }

    // ---- canManageResource ----

    @Test
    fun canManageResource_admin_semOwnership_retornaTrue() {
        assertTrue(
            UserPermissions.canManageResource(
                adminUser(),
                UserPermissions.Action.EDIT_GAME,
                "outro-user-id"
            )
        )
    }

    @Test
    fun canManageResource_player_ownerDoRecurso_retornaTrue() {
        val player = playerUser()
        assertTrue(
            UserPermissions.canManageResource(
                player,
                UserPermissions.Action.EDIT_GAME,
                player.id
            )
        )
    }

    @Test
    fun canManageResource_player_naoOwner_semPermissaoGlobal_retornaFalse() {
        // Player sem ownership de DELETE_ANY_GAME (nao tem a permissao global)
        assertFalse(
            UserPermissions.canManageResource(
                playerUser(),
                UserPermissions.Action.DELETE_ANY_GAME,
                "outro-user-id"
            )
        )
    }

    // ---- canEditUser ----

    @Test
    fun canEditUser_admin_editaQualquerUsuario_retornaTrue() {
        assertTrue(UserPermissions.canEditUser(adminUser(), playerUser()))
    }

    @Test
    fun canEditUser_player_editaProprioUsuario_retornaTrue() {
        val player = User(id = "player-1", role = UserRole.PLAYER.name)
        assertTrue(UserPermissions.canEditUser(player, player))
    }

    @Test
    fun canEditUser_player_editaOutroUsuario_retornaFalse() {
        val player = playerUser()
        val target = User(id = "player-2", role = UserRole.PLAYER.name)
        assertFalse(UserPermissions.canEditUser(player, target))
    }

    // ---- canDeleteResource ----

    @Test
    fun canDeleteResource_admin_retornaTrue() {
        assertTrue(UserPermissions.canDeleteResource(adminUser(), "outro-owner"))
    }

    @Test
    fun canDeleteResource_ownerDoRecurso_retornaTrue() {
        val player = playerUser()
        assertTrue(UserPermissions.canDeleteResource(player, player.id))
    }

    @Test
    fun canDeleteResource_naoOwner_retornaFalse() {
        assertFalse(UserPermissions.canDeleteResource(playerUser(), "outro-owner"))
    }

    // ---- isLocationManager ----

    @Test
    fun isLocationManager_userNaLista_retornaTrue() {
        val location = Location(id = "loc-1", managers = listOf("manager-1", "manager-2"))
        assertTrue(UserPermissions.isLocationManager(location, "manager-1"))
    }

    @Test
    fun isLocationManager_userForaDaLista_retornaFalse() {
        val location = Location(id = "loc-1", managers = listOf("manager-1"))
        assertFalse(UserPermissions.isLocationManager(location, "manager-999"))
    }

    @Test
    fun isLocationManager_locationNull_retornaFalse() {
        assertFalse(UserPermissions.isLocationManager(null, "manager-1"))
    }

    // ---- Alias deprecated: EDIT_ANY_GAME == EDIT_GAME ----

    @Test
    fun action_editAnyGame_alias_aponta_para_editGame() {
        @Suppress("DEPRECATION")
        val alias = UserPermissions.Action.EDIT_ANY_GAME
        assertEquals(UserPermissions.Action.EDIT_GAME, alias)
    }

    // ---- Extensoes de User ----

    @Test
    fun user_extension_isAdmin_admin_retornaTrue() {
        assertTrue(adminUser().isAdmin)
    }

    @Test
    fun user_extension_isFieldOwner_fieldOwner_retornaTrue() {
        assertTrue(fieldOwnerUser().isFieldOwner)
    }

    @Test
    fun user_extension_hasPermission_player_createGame_retornaTrue() {
        assertTrue(playerUser().hasPermission(UserPermissions.Action.CREATE_GAME))
    }
}
