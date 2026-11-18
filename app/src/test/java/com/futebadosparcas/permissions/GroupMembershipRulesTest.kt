package com.futebadosparcas.permissions

import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.GroupMemberStatus
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.model.Group
import com.futebadosparcas.domain.usecase.group.CreateGroupUseCase
import com.futebadosparcas.domain.usecase.group.JoinGroupParams
import com.futebadosparcas.domain.usecase.group.JoinGroupUseCase
import com.futebadosparcas.domain.usecase.group.LeaveGroupParams
import com.futebadosparcas.domain.usecase.group.LeaveGroupUseCase
import com.futebadosparcas.domain.usecase.group.ManageMembersUseCase
import com.futebadosparcas.domain.usecase.group.TransferOwnershipUseCase
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Criação, entrada e saída de grupo, e gestão de membros (promover, rebaixar, remover, transferir).
 *
 * O papel efetivo de quem chama vem do repositório (`getMyRoleInGroup`). Cada caso
 * negado aqui nunca chega ao repositório de escrita.
 */
@ExtendWith(MockLogExtension::class)
class GroupMembershipRulesTest {

    private lateinit var groupRepository: GroupRepository
    private val grupo = Group(id = "group-1", name = "Pelada FC", ownerId = "owner-1")

    @BeforeEach
    fun setUp() {
        groupRepository = mockk(relaxed = true)
    }

    private fun membro(
        userId: String,
        role: GroupMemberRole,
        status: GroupMemberStatus = GroupMemberStatus.ACTIVE,
        nome: String = userId
    ) = GroupMember(userId = userId, userName = nome, role = role.name, status = status.name)

    // ---------- Criação de grupo ----------

    @Test
    fun createGroup_nomeValido_enviaNomeAparadoAoRepositorio() = runTest {
        coEvery {
            groupRepository.createGroup(any(), any(), any(), any())
        } returns Result.success(grupo)

        val result = CreateGroupUseCase(groupRepository)("  Pelada FC  ", "Quinta à noite")

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) {
            groupRepository.createGroup("Pelada FC", "Quinta à noite", null, null)
        }
    }

    @Test
    fun createGroup_nomeComMenosDeTresCaracteres_bloqueiaSemChamarRepositorio() = runTest {
        val result = CreateGroupUseCase(groupRepository)("ab", "desc")

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { groupRepository.createGroup(any(), any(), any(), any()) }
    }

    @Test
    fun createGroup_nomeComCaractereInvalido_bloqueiaSemChamarRepositorio() = runTest {
        val result = CreateGroupUseCase(groupRepository)("Pelada@FC", "desc")

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { groupRepository.createGroup(any(), any(), any(), any()) }
    }

    @Test
    fun createGroup_visitanteSemLogin_repositorioNegaCriacao() = runTest {
        coEvery {
            groupRepository.createGroup(any(), any(), any(), any())
        } returns Result.failure(Exception("Usuário não autenticado"))

        val result = CreateGroupUseCase(groupRepository)("Pelada FC", "desc")

        assertEquals("Usuário não autenticado", result.exceptionOrNull()?.message)
    }

    // ---------- Entrada em grupo ----------

    @Test
    fun joinGroup_jaEMembro_negaEntradaDuplicada() = runTest {
        coEvery { groupRepository.getGroupById("group-1") } returns Result.success(grupo)
        coEvery { groupRepository.isMemberOfGroup("group-1") } returns Result.success(true)

        val result = JoinGroupUseCase(groupRepository)(JoinGroupParams("group-1"))

        assertEquals("Você já é membro deste grupo", result.exceptionOrNull()?.message)
    }

    @Test
    fun joinGroup_naoMembro_validaGrupoSemGravarMembresia() = runTest {
        // A entrada efetiva acontece pelo convite aceito ou pela Cloud Function;
        // este caso só valida o grupo e não grava nada no repositório.
        coEvery { groupRepository.getGroupById("group-1") } returns Result.success(grupo)
        coEvery { groupRepository.isMemberOfGroup("group-1") } returns Result.success(false)

        val result = JoinGroupUseCase(groupRepository)(JoinGroupParams("group-1"))

        assertEquals("group-1", result.getOrNull()?.id)
        coVerify(exactly = 0) { groupRepository.leaveGroup(any()) }
    }

    // ---------- Saída de grupo ----------

    @Test
    fun leaveGroup_donoSemTransferirPropriedade_negaSaidaSemChamarRepositorio() = runTest {
        coEvery { groupRepository.getMyRoleInGroup("group-1") } returns
            Result.success(GroupMemberRole.OWNER)

        val result = LeaveGroupUseCase(groupRepository)(LeaveGroupParams("group-1"))

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { groupRepository.leaveGroup(any()) }
    }

    @Test
    fun leaveGroup_visitanteNaoMembro_negaSaida() = runTest {
        coEvery { groupRepository.getMyRoleInGroup("group-1") } returns Result.success(null)

        val result = LeaveGroupUseCase(groupRepository)(LeaveGroupParams("group-1"))

        assertEquals("Você não é membro deste grupo", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { groupRepository.leaveGroup(any()) }
    }

    @Test
    fun leaveGroup_membroComum_saiEChamaRepositorioUmaVez() = runTest {
        coEvery { groupRepository.getMyRoleInGroup("group-1") } returns
            Result.success(GroupMemberRole.MEMBER)
        coEvery { groupRepository.leaveGroup("group-1") } returns Result.success(Unit)

        val result = LeaveGroupUseCase(groupRepository)(LeaveGroupParams("group-1"))

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { groupRepository.leaveGroup("group-1") }
    }

    // ---------- Gestão de membros ----------

    @Test
    fun promoteMember_membroComum_delegaPromocaoAoRepositorio() = runTest {
        coEvery { groupRepository.promoteMemberToAdmin("group-1", "m-1") } returns Result.success(Unit)

        val result = ManageMembersUseCase(groupRepository)
            .promoteMember("group-1", membro("m-1", GroupMemberRole.MEMBER))

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { groupRepository.promoteMemberToAdmin("group-1", "m-1") }
    }

    @Test
    fun promoteMember_jaEAdmin_negaPromocao() = runTest {
        val result = ManageMembersUseCase(groupRepository)
            .promoteMember("group-1", membro("a-1", GroupMemberRole.ADMIN))

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { groupRepository.promoteMemberToAdmin(any(), any()) }
    }

    @Test
    fun removeMember_dono_negaRemocaoDoDono() = runTest {
        val result = ManageMembersUseCase(groupRepository)
            .removeMember("group-1", membro("owner-1", GroupMemberRole.OWNER))

        assertEquals("Não é possível remover o dono do grupo", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { groupRepository.removeMember(any(), any()) }
    }

    // ---------- Transferência de propriedade ----------

    @Test
    fun transferOwnership_membroAtivo_delegaTransferencia() = runTest {
        coEvery { groupRepository.transferOwnership("group-1", "m-1") } returns Result.success(Unit)

        val result = TransferOwnershipUseCase(groupRepository)(
            "group-1",
            membro("m-1", GroupMemberRole.MEMBER)
        )

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { groupRepository.transferOwnership("group-1", "m-1") }
    }

    @Test
    fun transferOwnership_paraOProprioDono_negaTransferencia() = runTest {
        val result = TransferOwnershipUseCase(groupRepository)(
            "group-1",
            membro("owner-1", GroupMemberRole.OWNER)
        )

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { groupRepository.transferOwnership(any(), any()) }
    }

    @Test
    fun transferOwnership_membroInativo_negaTransferencia() = runTest {
        val inativo = membro("m-2", GroupMemberRole.MEMBER, status = GroupMemberStatus.INACTIVE)

        val result = TransferOwnershipUseCase(groupRepository)("group-1", inativo)

        assertFalse(result.isSuccess)
        coVerify(exactly = 0) { groupRepository.transferOwnership(any(), any()) }
    }
}
