package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

@DisplayName("LeaveGroupUseCase Tests")
@ExtendWith(MockLogExtension::class)
class LeaveGroupUseCaseTest {

    private lateinit var groupRepository: GroupRepository
    private lateinit var useCase: LeaveGroupUseCase

    @BeforeEach
    fun setup() {
        groupRepository = mockk(relaxed = true)
        useCase = LeaveGroupUseCase(groupRepository)
    }

    @Nested
    @DisplayName("execute")
    inner class ExecuteTests {

        @Test
        @DisplayName("Membro sai do grupo com sucesso")
        fun `member leaves group successfully`() = runTest {
            coEvery { groupRepository.getMyRoleInGroup("group-1") } returns Result.success(GroupMemberRole.MEMBER)
            coEvery { groupRepository.leaveGroup("group-1") } returns Result.success(Unit)

            val result = useCase(LeaveGroupParams("group-1"))

            assertTrue(result.isSuccess)
        }

        @Test
        @DisplayName("Admin sai do grupo com sucesso")
        fun `admin leaves group successfully`() = runTest {
            coEvery { groupRepository.getMyRoleInGroup("group-1") } returns Result.success(GroupMemberRole.ADMIN)
            coEvery { groupRepository.leaveGroup("group-1") } returns Result.success(Unit)

            val result = useCase(LeaveGroupParams("group-1"))

            assertTrue(result.isSuccess)
        }

        @Test
        @DisplayName("Owner nao pode sair do grupo sem transferir")
        fun `owner cannot leave without transferring`() = runTest {
            coEvery { groupRepository.getMyRoleInGroup("group-1") } returns Result.success(GroupMemberRole.OWNER)

            val result = useCase(LeaveGroupParams("group-1"))

            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull() is LeaveGroupException)
        }

        @Test
        @DisplayName("Nao membro nao pode sair do grupo")
        fun `non member cannot leave group`() = runTest {
            coEvery { groupRepository.getMyRoleInGroup("group-1") } returns Result.success(null)

            val result = useCase(LeaveGroupParams("group-1"))

            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull() is LeaveGroupException)
            assertEquals("Você não é membro deste grupo", result.exceptionOrNull()?.message)
        }

        @Test
        @DisplayName("Group ID em branco retorna falha")
        fun `blank group id returns failure`() = runTest {
            val result = useCase(LeaveGroupParams(""))

            assertTrue(result.isFailure)
        }

        @Test
        @DisplayName("Erro ao verificar permissao propaga falha")
        fun `permission check error propagates failure`() = runTest {
            coEvery { groupRepository.getMyRoleInGroup("group-1") } returns Result.failure(RuntimeException("Erro de rede"))

            val result = useCase(LeaveGroupParams("group-1"))

            assertTrue(result.isFailure)
            assertEquals("Erro de rede", result.exceptionOrNull()?.message)
        }

        @Test
        @DisplayName("Erro ao sair do grupo propaga falha")
        fun `leave group error propagates failure`() = runTest {
            coEvery { groupRepository.getMyRoleInGroup("group-1") } returns Result.success(GroupMemberRole.MEMBER)
            coEvery { groupRepository.leaveGroup("group-1") } returns Result.failure(RuntimeException("Erro ao sair"))

            val result = useCase(LeaveGroupParams("group-1"))

            assertTrue(result.isFailure)
            assertEquals("Erro ao sair", result.exceptionOrNull()?.message)
        }
    }
}
