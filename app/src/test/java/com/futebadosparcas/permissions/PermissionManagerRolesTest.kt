package com.futebadosparcas.permissions

import com.futebadosparcas.domain.permission.PermissionManager
import com.futebadosparcas.util.MockLogExtension
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.CollectionReference
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Papéis e permissões de grupo, jogo, caixa de perfil e local.
 *
 * Papéis cobertos: ADMIN, FIELD_OWNER, dono do grupo/jogo, co-organizador,
 * membro comum, visitante (sem login) e usuário de outro grupo.
 * Quando não há documento de papel legível, o manager cai em PLAYER (negar por padrão).
 */
@ExtendWith(MockLogExtension::class)
class PermissionManagerRolesTest {

    private val firestore = mockk<FirebaseFirestore>()
    private val auth = mockk<FirebaseAuth>()
    private val usersCollection = mockk<CollectionReference>()
    private lateinit var manager: PermissionManager

    @BeforeEach
    fun setUp() {
        every { firestore.collection("users") } returns usersCollection
        every { auth.currentUser } returns null
        manager = PermissionManager(firestore, auth)
    }

    private fun loginAs(uid: String) {
        val user = mockk<FirebaseUser>()
        every { user.uid } returns uid
        every { auth.currentUser } returns user
    }

    private fun roleOf(uid: String, role: String?) {
        val snapshot = mockk<DocumentSnapshot>()
        every { snapshot.getString("role") } returns role
        val docRef = mockk<DocumentReference>()
        every { docRef.get() } returns Tasks.forResult(snapshot)
        every { usersCollection.document(uid) } returns docRef
    }

    // ---------- Grupo ----------

    @Test
    fun canEditGroup_admin_permiteEditarGrupoDeOutroDono() = runTest {
        loginAs("admin-1")
        roleOf("admin-1", "ADMIN")

        assertTrue(manager.canEditGroup("owner-1"))
    }

    @Test
    fun canEditGroup_donoDoGrupo_permiteEditarProprioGrupo() = runTest {
        loginAs("owner-1")
        roleOf("owner-1", "PLAYER")

        assertTrue(manager.canEditGroup("owner-1"))
    }

    @Test
    fun canEditGroup_membroComum_negaEditarGrupoDeOutroDono() = runTest {
        loginAs("member-1")
        roleOf("member-1", "PLAYER")

        assertFalse(manager.canEditGroup("owner-1"))
    }

    @Test
    fun canEditGroup_visitanteSemLogin_negaEdicao() = runTest {
        assertFalse(manager.canEditGroup("owner-1"))
    }

    @Test
    fun canManageGroupMembers_admin_permiteGerenciarMembrosDeQualquerGrupo() = runTest {
        loginAs("admin-1")
        roleOf("admin-1", "ADMIN")

        assertTrue(manager.canManageGroupMembers("owner-1"))
    }

    @Test
    fun canManageGroupMembers_membroComum_negaGerenciarMembros() = runTest {
        loginAs("member-1")
        roleOf("member-1", "PLAYER")

        assertFalse(manager.canManageGroupMembers("owner-1"))
    }

    // ---------- Jogo ----------

    @Test
    fun canEditGame_coOrganizador_permiteEditarJogo() = runTest {
        loginAs("co-1")
        roleOf("co-1", "PLAYER")

        assertTrue(manager.canEditGame("owner-1", listOf("co-1")))
    }

    @Test
    fun canFinalizeGame_donoDoJogo_permiteFinalizar() = runTest {
        loginAs("owner-1")
        roleOf("owner-1", "PLAYER")

        assertTrue(manager.canFinalizeGame("owner-1"))
    }

    @Test
    fun canFinalizeGame_admin_permiteFinalizarJogoAlheio() = runTest {
        loginAs("admin-1")
        roleOf("admin-1", "ADMIN")

        assertTrue(manager.canFinalizeGame("owner-1"))
    }

    @Test
    fun canFinalizeGame_membroComum_negaFinalizarJogoAlheio() = runTest {
        loginAs("member-1")
        roleOf("member-1", "PLAYER")

        assertFalse(manager.canFinalizeGame("owner-1"))
    }

    @Test
    fun canViewGame_membroDoGrupoDoJogo_permiteVerJogoPrivadoDoGrupo() = runTest {
        loginAs("member-1")
        roleOf("member-1", "PLAYER")

        assertTrue(
            manager.canViewGame(
                gameOwnerId = "owner-1",
                isPublicGame = false,
                userGroupIds = listOf("grupo-a"),
                gameGroupId = "grupo-a"
            )
        )
    }

    @Test
    fun canViewGame_usuarioDeOutroGrupo_negaVerJogoPrivadoDeGrupo() = runTest {
        loginAs("outsider-1")
        roleOf("outsider-1", "PLAYER")

        assertFalse(
            manager.canViewGame(
                gameOwnerId = "owner-1",
                isPublicGame = false,
                userGroupIds = listOf("grupo-b"),
                gameGroupId = "grupo-a"
            )
        )
    }

    @Test
    fun canViewGame_visitanteSemLogin_negaVerJogoPrivado() = runTest {
        assertFalse(
            manager.canViewGame(
                gameOwnerId = "owner-1",
                isPublicGame = false,
                gameGroupId = "grupo-a",
                userGroupIds = listOf("grupo-a")
            )
        )
    }

    @Test
    fun canViewGameHistory_naoParticipante_negaVerHistorico() = runTest {
        loginAs("member-1")
        roleOf("member-1", "PLAYER")

        assertFalse(manager.canViewGameHistory(gameOwnerId = "owner-1", didUserParticipate = false))
    }

    // ---------- Admin e papéis globais ----------

    @Test
    fun canBanUsers_admin_permiteBanir() = runTest {
        loginAs("admin-1")
        roleOf("admin-1", "ADMIN")

        assertTrue(manager.canBanUsers())
        assertTrue(manager.canChangeUserRoles())
    }

    @Test
    fun canBanUsers_fieldOwner_negaBanirPorNaoSerAdmin() = runTest {
        loginAs("field-1")
        roleOf("field-1", "FIELD_OWNER")

        assertFalse(manager.canBanUsers())
        assertFalse(manager.canChangeUserRoles())
    }

    @Test
    fun getUserPermissions_membroComum_naoTemPrivilegiosDeAdmin() = runTest {
        loginAs("member-1")
        roleOf("member-1", "PLAYER")

        val permissions = manager.getUserPermissions()

        assertEquals("member-1", permissions.userId)
        assertFalse(permissions.isAdmin)
        assertFalse(permissions.canViewAllGames)
        assertFalse(permissions.canBanUsers)
        assertFalse(permissions.canChangeRoles)
    }

    // ---------- Cache e falhas de papel ----------

    @Test
    fun getCurrentUserRole_chamadasRepetidas_usaCacheSemNovaLeitura() = runTest {
        loginAs("admin-1")
        roleOf("admin-1", "ADMIN")

        manager.canBanUsers()
        manager.canBanUsers()

        verify(exactly = 1) { usersCollection.document("admin-1") }
    }

    @Test
    fun invalidateCache_depoisDeMudancaDePapel_refazLeituraDoRole() = runTest {
        loginAs("user-1")
        roleOf("user-1", "ADMIN")
        assertTrue(manager.canBanUsers())

        roleOf("user-1", "PLAYER")
        manager.invalidateCache()

        assertFalse(manager.canBanUsers())
    }

    @Test
    fun getCurrentUserRole_erroNoFirestore_negaPrivilegioPorPadrao() = runTest {
        loginAs("user-1")
        every { usersCollection.document("user-1") } throws RuntimeException("offline")

        assertFalse(manager.canBanUsers())
        assertFalse(manager.canEditGroup("owner-2"))
    }

}
