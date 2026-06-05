package com.futebadosparcas.ui.groups

import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.model.Group
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.domain.usecase.group.ArchiveGroupUseCase
import com.futebadosparcas.domain.usecase.group.DeleteGroupUseCase
import com.futebadosparcas.domain.usecase.group.LeaveGroupParams
import com.futebadosparcas.domain.usecase.group.LeaveGroupUseCase
import com.futebadosparcas.domain.usecase.group.ManageMembersUseCase
import com.futebadosparcas.domain.usecase.group.TransferOwnershipUseCase
import com.futebadosparcas.domain.usecase.group.UpdateGroupUseCase
import com.futebadosparcas.util.MockLogExtension
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.coVerify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GroupDetailViewModel Tests")
@ExtendWith(MockLogExtension::class)
class GroupDetailViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var groupRepository: GroupRepository
    private lateinit var userRepository: UserRepository
    private lateinit var auth: FirebaseAuth
    private lateinit var updateGroupUseCase: UpdateGroupUseCase
    private lateinit var archiveGroupUseCase: ArchiveGroupUseCase
    private lateinit var deleteGroupUseCase: DeleteGroupUseCase
    private lateinit var leaveGroupUseCase: LeaveGroupUseCase
    private lateinit var manageMembersUseCase: ManageMembersUseCase
    private lateinit var transferOwnershipUseCase: TransferOwnershipUseCase
    private lateinit var viewModel: GroupDetailViewModel

    private val testGroup = Group(id = "group-1", name = "Pelada do Parque", description = "Grupo de futebol")
    private val testMembers = listOf(
        GroupMember(id = "m1", userId = "user-1", userName = "Joao", role = GroupMemberRole.OWNER.name),
        GroupMember(id = "m2", userId = "user-2", userName = "Maria", role = GroupMemberRole.ADMIN.name),
        GroupMember(id = "m3", userId = "user-3", userName = "Pedro", role = GroupMemberRole.MEMBER.name)
    )

    private fun createViewModel() = GroupDetailViewModel(
        groupRepository, userRepository, auth, updateGroupUseCase,
        archiveGroupUseCase, deleteGroupUseCase, leaveGroupUseCase,
        manageMembersUseCase, transferOwnershipUseCase
    )

    private fun setupGroupFlows() {
        val groupFlow = MutableStateFlow<Result<Group>>(Result.success(testGroup))
        val membersFlow = MutableStateFlow(testMembers)
        every { groupRepository.getGroupFlow("group-1") } returns groupFlow
        every { groupRepository.getOrderedGroupMembersFlow("group-1") } returns membersFlow
        coEvery { userRepository.getUsersByIds(any()) } returns Result.success(
            listOf(
                User(id = "user-1", name = "Joao"),
                User(id = "user-2", name = "Maria"),
                User(id = "user-3", name = "Pedro")
            )
        )
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        groupRepository = mockk(relaxed = true)
        userRepository = mockk(relaxed = true)
        auth = mockk(relaxed = true)
        updateGroupUseCase = mockk(relaxed = true)
        archiveGroupUseCase = mockk(relaxed = true)
        deleteGroupUseCase = mockk(relaxed = true)
        leaveGroupUseCase = mockk(relaxed = true)
        manageMembersUseCase = mockk(relaxed = true)
        transferOwnershipUseCase = mockk(relaxed = true)

        val firebaseUser = mockk<FirebaseUser>(relaxed = true)
        every { firebaseUser.uid } returns "user-1"
        every { auth.currentUser } returns firebaseUser
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Nested
    @DisplayName("Estado Inicial")
    inner class InitialStateTests {

        @Test
        @DisplayName("Estado inicial deve ser Loading")
        fun `initial state is Loading`() {
            viewModel = createViewModel()
            assertEquals(GroupDetailUiState.Loading, viewModel.uiState.value)
            assertEquals(GroupActionState.Idle, viewModel.actionState.value)
        }
    }

    @Nested
    @DisplayName("loadGroup")
    inner class LoadGroupTests {

        @Test
        @DisplayName("loadGroup carrega grupo com sucesso")
        fun `loadGroup loads group successfully`() = runTest(testDispatcher) {
            setupGroupFlows()

            viewModel = createViewModel()
            viewModel.loadGroup("group-1")
            advanceUntilIdle()

            val state = viewModel.uiState.value
            assertInstanceOf(GroupDetailUiState.Success::class.java, state)
            val success = state as GroupDetailUiState.Success
            assertEquals("group-1", success.group.id)
            assertEquals(3, success.members.size)
        }

        @Test
        @DisplayName("loadGroup com grupo null retorna Error")
        fun `loadGroup with null group returns Error`() = runTest(testDispatcher) {
            val groupFlow = MutableStateFlow<Result<Group>>(Result.failure(RuntimeException("Grupo nao encontrado")))
            val membersFlow = MutableStateFlow(emptyList<GroupMember>())
            every { groupRepository.getGroupFlow("group-1") } returns groupFlow
            every { groupRepository.getOrderedGroupMembersFlow("group-1") } returns membersFlow

            viewModel = createViewModel()
            viewModel.loadGroup("group-1")
            advanceUntilIdle()

            assertInstanceOf(GroupDetailUiState.Error::class.java, viewModel.uiState.value)
        }

        @Test
        @DisplayName("loadGroup identifica papel do usuario atual")
        fun `loadGroup identifies current user role`() = runTest(testDispatcher) {
            setupGroupFlows()

            viewModel = createViewModel()
            viewModel.loadGroup("group-1")
            advanceUntilIdle()

            val state = viewModel.uiState.value as GroupDetailUiState.Success
            assertEquals(GroupMemberRole.OWNER, state.myRole)
        }
    }

    @Nested
    @DisplayName("updateGroup")
    inner class UpdateGroupTests {

        @Test
        @DisplayName("updateGroup com nome curto retorna erro de validacao")
        fun `updateGroup with short name returns validation error`() {
            viewModel = createViewModel()
            viewModel.updateGroup("ab", "descricao")
            assertInstanceOf(GroupActionState.Error::class.java, viewModel.actionState.value)
        }

        @Test
        @DisplayName("updateGroup com sucesso atualiza grupo")
        fun `updateGroup successfully updates group`() = runTest(testDispatcher) {
            setupGroupFlows()
            viewModel = createViewModel()
            viewModel.loadGroup("group-1")
            advanceUntilIdle()

            coEvery { updateGroupUseCase.invoke(any(), any(), any(), any(), any()) } returns Result.success(Unit)

            viewModel.updateGroup("Novo Nome", "Nova descricao")
            advanceUntilIdle()

            coVerify { updateGroupUseCase("group-1", "Novo Nome", "Nova descricao", null, null) }
        }

        @Test
        @DisplayName("updateGroup com erro propaga falha")
        fun `updateGroup with error propagates failure`() = runTest(testDispatcher) {
            setupGroupFlows()
            viewModel = createViewModel()
            viewModel.loadGroup("group-1")
            advanceUntilIdle()

            coEvery { updateGroupUseCase.invoke(any(), any(), any(), any(), any()) } returns Result.failure(RuntimeException("Erro"))

            viewModel.updateGroup("Novo Nome", "Nova descricao")
            advanceUntilIdle()

            assertInstanceOf(GroupActionState.Error::class.java, viewModel.actionState.value)
        }
    }

    @Nested
    @DisplayName("leaveGroup")
    inner class LeaveGroupTests {

        @Test
        @DisplayName("leaveGroup sai do grupo com sucesso")
        fun `leaveGroup leaves group successfully`() = runTest(testDispatcher) {
            setupGroupFlows()
            viewModel = createViewModel()
            viewModel.loadGroup("group-1")
            advanceUntilIdle()

            coEvery { leaveGroupUseCase.invoke(any()) } returns Result.success(Unit)

            viewModel.leaveGroup()
            advanceUntilIdle()

            assertEquals(GroupDetailUiState.LeftGroup, viewModel.uiState.value)
        }

        @Test
        @DisplayName("leaveGroup com erro propaga falha")
        fun `leaveGroup with error propagates failure`() = runTest(testDispatcher) {
            setupGroupFlows()
            viewModel = createViewModel()
            viewModel.loadGroup("group-1")
            advanceUntilIdle()

            coEvery { leaveGroupUseCase.invoke(any()) } returns Result.failure(RuntimeException("Erro ao sair"))

            viewModel.leaveGroup()
            advanceUntilIdle()

            assertInstanceOf(GroupActionState.Error::class.java, viewModel.actionState.value)
        }
    }

    @Nested
    @DisplayName("archiveGroup e deleteGroup")
    inner class ArchiveDeleteTests {

        @Test
        @DisplayName("archiveGroup arquiva grupo com sucesso")
        fun `archiveGroup archives group successfully`() = runTest(testDispatcher) {
            setupGroupFlows()
            viewModel = createViewModel()
            viewModel.loadGroup("group-1")
            advanceUntilIdle()

            coEvery { archiveGroupUseCase.invoke(any()) } returns Result.success(Unit)

            viewModel.archiveGroup()
            advanceUntilIdle()

            coVerify { archiveGroupUseCase("group-1") }
        }

        @Test
        @DisplayName("deleteGroup exclui grupo com sucesso")
        fun `deleteGroup deletes group successfully`() = runTest(testDispatcher) {
            setupGroupFlows()
            viewModel = createViewModel()
            viewModel.loadGroup("group-1")
            advanceUntilIdle()

            coEvery { deleteGroupUseCase.invoke(any()) } returns Result.success(Unit)

            viewModel.deleteGroup()
            advanceUntilIdle()

            assertEquals(GroupActionState.GroupDeleted, viewModel.actionState.value)
        }
    }

    @Nested
    @DisplayName("Promocao e Rebaixamento de Membros")
    inner class MemberManagementTests {

        @Test
        @DisplayName("promoteMember promove membro a admin")
        fun `promoteMember promotes member to admin`() = runTest(testDispatcher) {
            setupGroupFlows()
            viewModel = createViewModel()
            viewModel.loadGroup("group-1")
            advanceUntilIdle()

            val memberToPromote = testMembers[2]
            coEvery { manageMembersUseCase.promoteMember(any(), any()) } returns Result.success(Unit)

            viewModel.promoteMember(memberToPromote)
            advanceUntilIdle()

            coVerify { manageMembersUseCase.promoteMember("group-1", memberToPromote) }
        }

        @Test
        @DisplayName("demoteMember rebaixa admin a membro")
        fun `demoteMember demotes admin to member`() = runTest(testDispatcher) {
            setupGroupFlows()
            viewModel = createViewModel()
            viewModel.loadGroup("group-1")
            advanceUntilIdle()

            val memberToDemote = testMembers[1]
            coEvery { manageMembersUseCase.demoteMember(any(), any()) } returns Result.success(Unit)

            viewModel.demoteMember(memberToDemote)
            advanceUntilIdle()

            coVerify { manageMembersUseCase.demoteMember("group-1", memberToDemote) }
        }

        @Test
        @DisplayName("getMembersEligibleForPromotion retorna apenas MEMBER")
        fun `getMembersEligibleForPromotion returns only MEMBER`() = runTest(testDispatcher) {
            setupGroupFlows()
            viewModel = createViewModel()
            viewModel.loadGroup("group-1")
            advanceUntilIdle()

            val eligible = viewModel.getMembersEligibleForPromotion()
            assertEquals(1, eligible.size)
            assertTrue(eligible.all { it.getRoleEnum() == GroupMemberRole.MEMBER })
        }

        @Test
        @DisplayName("getMembersEligibleForTransfer retorna todos menos OWNER")
        fun `getMembersEligibleForTransfer returns all except OWNER`() = runTest(testDispatcher) {
            setupGroupFlows()
            viewModel = createViewModel()
            viewModel.loadGroup("group-1")
            advanceUntilIdle()

            val eligible = viewModel.getMembersEligibleForTransfer()
            assertFalse(eligible.any { it.getRoleEnum() == GroupMemberRole.OWNER })
            assertTrue(eligible.any { it.getRoleEnum() == GroupMemberRole.ADMIN })
            assertTrue(eligible.any { it.getRoleEnum() == GroupMemberRole.MEMBER })
        }
    }
}
