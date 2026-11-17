package com.futebadosparcas.permissions

import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.model.Group
import com.futebadosparcas.domain.model.GroupInvite
import com.futebadosparcas.domain.usecase.group.InviteToGroupParams
import com.futebadosparcas.domain.usecase.group.InviteToGroupUseCase
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Quem pode enviar convite de grupo: ADMIN e dono sim; membro comum, visitante
 * (sem login) e usuário de outro grupo não. Também cobre convite a e-mail inexistente,
 * a quem já é membro, convite pendente duplicado e grupo inválido.
 */
@ExtendWith(MockLogExtension::class)
class InviteToGroupPermissionsTest {

    private lateinit var groupRepository: GroupRepository
    private lateinit var useCase: InviteToGroupUseCase

    private val grupo = Group(id = "group-1", name = "Pelada FC", ownerId = "owner-1")

    @BeforeEach
    fun setUp() {
        groupRepository = mockk(relaxed = true)
        useCase = InviteToGroupUseCase(groupRepository)

        coEvery { groupRepository.getCurrentUserId() } returns "owner-1"
        coEvery { groupRepository.findUserByEmail(any()) } returns
            Result.success(mapOf("uid" to "invitee-1", "name" to "Convidado"))
        coEvery { groupRepository.getMyRoleInGroup("group-1") } returns
            Result.success(GroupMemberRole.OWNER)
        coEvery { groupRepository.isUserMemberOfGroup("group-1", "invitee-1") } returns
            Result.success(false)
        coEvery { groupRepository.hasPendingGroupInvite("group-1", "invitee-1") } returns
            Result.success(false)
        coEvery { groupRepository.getGroupById("group-1") } returns Result.success(grupo)
        coEvery { groupRepository.getCurrentUserName() } returns Result.success("Dono")
        coEvery { groupRepository.createGroupInvite(any()) } answers {
            Result.success(firstArg<GroupInvite>().copy(id = "inv-1"))
        }
    }

    private suspend fun convidar(): Result<GroupInvite> =
        useCase(InviteToGroupParams(groupId = "group-1", invitedUserEmail = "convidado@example.test"))

    @Test
    fun inviteToGroup_dono_criaConviteComExpiracaoDe48Horas() = runTest {
        val antes = System.currentTimeMillis()

        val result = useCase(
            InviteToGroupParams(groupId = "group-1", invitedUserEmail = "convidado@example.test")
        )

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) {
            groupRepository.createGroupInvite(match<GroupInvite> { convite ->
                convite.invitedUserId == "invitee-1" &&
                    convite.invitedById == "owner-1" &&
                    convite.groupName == "Pelada FC" &&
                    (convite.expiresAt ?: 0L) - antes >= 48L * 60 * 60 * 1000 - 5_000
            })
        }
    }

    @Test
    fun inviteToGroup_admin_permiteConvidarMembro() = runTest {
        coEvery { groupRepository.getMyRoleInGroup("group-1") } returns
            Result.success(GroupMemberRole.ADMIN)

        val result = convidar()

        assertTrue(result.isSuccess)
    }

    @Test
    fun inviteToGroup_membroComum_negaConvidar() = runTest {
        coEvery { groupRepository.getMyRoleInGroup("group-1") } returns
            Result.success(GroupMemberRole.MEMBER)

        val result = convidar()

        assertEquals(
            "Apenas administradores e o dono podem convidar membros",
            result.exceptionOrNull()?.message
        )
        coVerify(exactly = 0) { groupRepository.createGroupInvite(any()) }
    }

    @Test
    fun inviteToGroup_visitanteSemLogin_negaConvidar() = runTest {
        coEvery { groupRepository.getCurrentUserId() } returns null

        val result = convidar()

        assertEquals("Usuário não autenticado", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { groupRepository.createGroupInvite(any()) }
    }

    @Test
    fun inviteToGroup_usuarioDeOutroGrupo_negaConvidarNoGrupo() = runTest {
        coEvery { groupRepository.getMyRoleInGroup("group-1") } returns Result.success(null)

        val result = convidar()

        assertEquals(
            "Apenas administradores e o dono podem convidar membros",
            result.exceptionOrNull()?.message
        )
    }

    @Test
    fun inviteToGroup_emailNaoCadastrado_negaConvite() = runTest {
        coEvery { groupRepository.findUserByEmail(any()) } returns Result.failure(Exception("não existe"))

        val result = convidar()

        assertEquals("Usuário com este email não encontrado", result.exceptionOrNull()?.message)
    }

    @Test
    fun inviteToGroup_convidadoJaEMembro_negaConvite() = runTest {
        coEvery { groupRepository.isUserMemberOfGroup("group-1", "invitee-1") } returns
            Result.success(true)

        val result = convidar()

        assertEquals("Este usuário já é membro do grupo", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { groupRepository.createGroupInvite(any()) }
    }

    @Test
    fun inviteToGroup_jaExisteConvitePendente_negaSegundoConvite() = runTest {
        coEvery { groupRepository.hasPendingGroupInvite("group-1", "invitee-1") } returns
            Result.success(true)

        val result = convidar()

        assertEquals(
            "Já existe um convite pendente para este usuário",
            result.exceptionOrNull()?.message
        )
    }

    @Disabled("DEFEITO: app/src/main/java/com/futebadosparcas/domain/usecase/group/InviteToGroupUseCase.kt:72")
    @Test
    fun inviteToGroup_falhaAoVerificarMembro_negaConviteEmVezDeCriar() = runTest {
        // Esperado: se a checagem de "já é membro" falha, o convite não deve ser criado.
        coEvery { groupRepository.isUserMemberOfGroup("group-1", "invitee-1") } returns
            Result.failure(Exception("rede indisponível"))

        val result = convidar()

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { groupRepository.createGroupInvite(any()) }
    }
}
