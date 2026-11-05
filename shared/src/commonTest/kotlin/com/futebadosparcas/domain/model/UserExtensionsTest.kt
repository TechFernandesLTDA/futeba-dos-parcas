package com.futebadosparcas.domain.model

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Testes de CARACTERIZAÇÃO para UserExtensions.kt (A3 do plano).
 *
 * Eles descrevem o que o código faz HOJE, não o que deveria fazer.
 * Se um teste aqui falhar após uma mudança, a mudança alterou comportamento:
 * decida conscientemente se é o novo comportamento desejado.
 */
class UserExtensionsTest {

    private fun user(id: String = "u1", role: String = UserRole.PLAYER.name) =
        User(id = id, role = role)

    private fun game(ownerId: String = "owner", coOrganizers: List<String> = emptyList()) =
        Game(id = "g1", ownerId = ownerId, coOrganizers = coOrganizers)

    // ---------------------------------------------------------------
    // Propriedades de papel (compatibilidade legada)
    // ---------------------------------------------------------------

    @Test
    fun isAdminProperty_admin_retornaTrue() {
        assertTrue(user(role = "ADMIN").isAdmin)
    }

    @Test
    fun isAdminProperty_fieldOwnerOuPlayer_retornaFalse() {
        assertFalse(user(role = "FIELD_OWNER").isAdmin)
        assertFalse(user(role = "PLAYER").isAdmin)
    }

    @Test
    fun isAdminProperty_roleEmMinusculas_retornaTrue() {
        // UserRole.fromString ignora caixa
        assertTrue(user(role = "admin").isAdmin)
    }

    @Test
    fun isAdminProperty_roleDesconhecido_tratadoComoPlayer() {
        // fromString cai em PLAYER para valores desconhecidos
        assertFalse(user(role = "SUPERUSER").isAdmin)
    }

    @Test
    fun canViewAllGames_admin_retornaTrue() {
        assertTrue(user(role = "ADMIN").canViewAllGames)
    }

    @Test
    fun canViewAllGames_fieldOwner_retornaTrue() {
        assertTrue(user(role = "FIELD_OWNER").canViewAllGames)
    }

    @Test
    fun canViewAllGames_player_retornaFalse() {
        assertFalse(user(role = "PLAYER").canViewAllGames)
    }

    @Test
    fun canViewAllHistory_fieldOwner_retornaTrue() {
        assertTrue(user(role = "FIELD_OWNER").canViewAllHistory)
    }

    @Test
    fun canViewAllHistory_player_retornaFalse() {
        assertFalse(user(role = "PLAYER").canViewAllHistory)
    }

    @Test
    fun canEditAllGames_fieldOwner_retornaFalse() {
        // Só ADMIN edita todos os jogos, diferente de canViewAllGames
        assertFalse(user(role = "FIELD_OWNER").canEditAllGames)
    }

    @Test
    fun canEditAllGames_admin_retornaTrue() {
        assertTrue(user(role = "ADMIN").canEditAllGames)
    }

    @Test
    fun canJoinAllGames_fieldOwner_retornaFalse() {
        assertFalse(user(role = "FIELD_OWNER").canJoinAllGames)
    }

    @Test
    fun canJoinAllGames_admin_retornaTrue() {
        assertTrue(user(role = "ADMIN").canJoinAllGames)
    }

    // ---------------------------------------------------------------
    // hasGamePermission: admin, dono ou co-organizador
    // ---------------------------------------------------------------

    @Test
    fun hasGamePermission_admin_retornaTrueMesmoSemVinculo() {
        assertTrue(user(id = "x", role = "ADMIN").hasGamePermission(game()))
    }

    @Test
    fun hasGamePermission_donoDoJogo_retornaTrue() {
        assertTrue(user(id = "owner").hasGamePermission(game(ownerId = "owner")))
    }

    @Test
    fun hasGamePermission_coOrganizador_retornaTrue() {
        assertTrue(user(id = "co1").hasGamePermission(game(coOrganizers = listOf("co1"))))
    }

    @Test
    fun hasGamePermission_jogadorSemVinculo_retornaFalse() {
        assertFalse(user(id = "p1").hasGamePermission(game(ownerId = "owner")))
    }

    @Test
    fun hasGamePermission_fieldOwnerSemVinculo_retornaFalse() {
        // FIELD_OWNER não é admin, então não ganha permissão sobre jogo alheio
        assertFalse(user(id = "fo", role = "FIELD_OWNER").hasGamePermission(game(ownerId = "owner")))
    }

    // ---------------------------------------------------------------
    // hasGroupPermission: placeholder com TODO
    // ---------------------------------------------------------------

    // HOJE RESPONDE SEMPRE TRUE (D17 do plano)
    @Test
    fun hasGroupPermission_jogadorForaDoGrupo_retornaTrueHoje() {
        // HOJE RESPONDE SEMPRE TRUE (D17 do plano)
        assertTrue(user(id = "estranho", role = "PLAYER").hasGroupPermission("grupo-qualquer"))
    }

    // HOJE RESPONDE SEMPRE TRUE (D17 do plano)
    @Test
    fun hasGroupPermission_groupIdVazio_retornaTrueHoje() {
        // HOJE RESPONDE SEMPRE TRUE (D17 do plano)
        assertTrue(user(id = "x", role = "PLAYER").hasGroupPermission(""))
    }

    // ---------------------------------------------------------------
    // hasUserPermission: admin ou si mesmo
    // ---------------------------------------------------------------

    @Test
    fun hasUserPermission_admin_sobreQualquerUsuario_retornaTrue() {
        assertTrue(user(id = "adm", role = "ADMIN").hasUserPermission("outro"))
    }

    @Test
    fun hasUserPermission_simMesmo_retornaTrue() {
        assertTrue(user(id = "u1").hasUserPermission("u1"))
    }

    @Test
    fun hasUserPermission_outroUsuarioNaoAdmin_retornaFalse() {
        assertFalse(user(id = "u1", role = "PLAYER").hasUserPermission("u2"))
    }

    @Test
    fun hasUserPermission_fieldOwnerSobreOutro_retornaFalse() {
        // FIELD_OWNER não gerencia outros usuários
        assertFalse(user(id = "fo", role = "FIELD_OWNER").hasUserPermission("u2"))
    }

    // ---------------------------------------------------------------
    // hasLocationPermission: admin, ou field owner dono do local
    // ---------------------------------------------------------------

    @Test
    fun hasLocationPermission_admin_sobreQualquerLocal_retornaTrue() {
        assertTrue(user(id = "adm", role = "ADMIN").hasLocationPermission("outro-dono"))
    }

    @Test
    fun hasLocationPermission_fieldOwnerDono_retornaTrue() {
        assertTrue(user(id = "fo", role = "FIELD_OWNER").hasLocationPermission("fo"))
    }

    @Test
    fun hasLocationPermission_fieldOwnerDeOutroLocal_retornaFalse() {
        assertFalse(user(id = "fo", role = "FIELD_OWNER").hasLocationPermission("outro-dono"))
    }

    @Test
    fun hasLocationPermission_playerDonoDoId_retornaFalse() {
        // Mesmo com id igual ao ownerId, PLAYER não é FIELD_OWNER
        assertFalse(user(id = "p1", role = "PLAYER").hasLocationPermission("p1"))
    }
}
