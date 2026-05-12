package com.futebadosparcas.domain.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Testes compartilhados para o modelo User e enum UserRole.
 * Executam em Android (JVM) e iOS (Native).
 */
class UserTest {

    // ---- UserRole ----

    @Test
    fun userRole_fromString_admin_retornaAdmin() {
        assertEquals(UserRole.ADMIN, UserRole.fromString("ADMIN"))
    }

    @Test
    fun userRole_fromString_fieldOwner_retornaFieldOwner() {
        assertEquals(UserRole.FIELD_OWNER, UserRole.fromString("FIELD_OWNER"))
    }

    @Test
    fun userRole_fromString_player_retornaPlayer() {
        assertEquals(UserRole.PLAYER, UserRole.fromString("PLAYER"))
    }

    @Test
    fun userRole_fromString_null_retornaPlayer() {
        // Fallback para PLAYER quando role desconhecida
        assertEquals(UserRole.PLAYER, UserRole.fromString(null))
    }

    @Test
    fun userRole_fromString_invalido_retornaPlayer() {
        assertEquals(UserRole.PLAYER, UserRole.fromString("UNKNOWN"))
    }

    @Test
    fun userRole_fromString_caseInsensitive_retornaCorreto() {
        assertEquals(UserRole.ADMIN, UserRole.fromString("admin"))
        assertEquals(UserRole.PLAYER, UserRole.fromString("player"))
    }

    @Test
    fun userRole_displayName_admin_naoEstaVazio() {
        assertTrue(UserRole.ADMIN.displayName.isNotBlank())
    }

    @Test
    fun userRole_description_player_naoEstaVazia() {
        assertTrue(UserRole.PLAYER.description.isNotBlank())
    }

    // ---- User.getRoleEnum ----

    @Test
    fun user_getRoleEnum_roleAdmin_retornaAdmin() {
        val user = User(id = "u1", role = "ADMIN")
        assertEquals(UserRole.ADMIN, user.getRoleEnum())
    }

    @Test
    fun user_getRoleEnum_rolePlayer_retornaPlayer() {
        val user = User(id = "u1", role = "PLAYER")
        assertEquals(UserRole.PLAYER, user.getRoleEnum())
    }

    @Test
    fun user_getRoleEnum_roleFieldOwner_retornaFieldOwner() {
        val user = User(id = "u1", role = "FIELD_OWNER")
        assertEquals(UserRole.FIELD_OWNER, user.getRoleEnum())
    }

    @Test
    fun user_getRoleEnum_roleInvalido_retornaPlayer() {
        // Campo role corrompido no Firestore -> fallback seguro para PLAYER
        val user = User(id = "u1", role = "INVALID_ROLE")
        assertEquals(UserRole.PLAYER, user.getRoleEnum())
    }

    // ---- User.isAdmin / isFieldOwner ----

    @Test
    fun user_isAdmin_roleAdmin_retornaTrue() {
        val user = User(id = "u1", role = "ADMIN")
        assertTrue(user.isAdmin())
    }

    @Test
    fun user_isAdmin_rolePlayer_retornaFalse() {
        val user = User(id = "u1", role = "PLAYER")
        assertFalse(user.isAdmin())
    }

    @Test
    fun user_isFieldOwner_roleFieldOwner_retornaTrue() {
        val user = User(id = "u1", role = "FIELD_OWNER")
        assertTrue(user.isFieldOwner())
    }

    @Test
    fun user_isFieldOwner_roleAdmin_retornaTrue() {
        // ADMIN tambem e considerado FIELD_OWNER (acesso total)
        val user = User(id = "u1", role = "ADMIN")
        assertTrue(user.isFieldOwner())
    }

    @Test
    fun user_isFieldOwner_rolePlayer_retornaFalse() {
        val user = User(id = "u1", role = "PLAYER")
        assertFalse(user.isFieldOwner())
    }

    // ---- User.getDisplayName ----

    @Test
    fun user_getDisplayName_semApelido_retornaNome() {
        val user = User(id = "u1", name = "Joao Silva", nickname = null)
        assertEquals("Joao Silva", user.getDisplayName())
    }

    @Test
    fun user_getDisplayName_comApelido_retornaApelido() {
        val user = User(id = "u1", name = "Joao Silva", nickname = "Joaozinho")
        assertEquals("Joaozinho", user.getDisplayName())
    }

    @Test
    fun user_getDisplayName_apelidoEmBranco_retornaNome() {
        val user = User(id = "u1", name = "Joao Silva", nickname = "   ")
        assertEquals("Joao Silva", user.getDisplayName())
    }

    // ---- User defaults ----

    @Test
    fun user_roleDefault_ePlayer() {
        val user = User(id = "u1")
        assertEquals(UserRole.PLAYER.name, user.role)
    }

    @Test
    fun user_experiencePoints_default_eZero() {
        val user = User(id = "u1")
        assertEquals(0L, user.experiencePoints)
    }

    @Test
    fun user_level_default_e1() {
        val user = User(id = "u1")
        assertEquals(1, user.level)
    }
}
