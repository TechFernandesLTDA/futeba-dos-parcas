package com.futebadosparcas.ui.groups

import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.domain.usecase.group.ArchiveGroupUseCase
import com.futebadosparcas.domain.usecase.group.DeleteGroupUseCase
import com.futebadosparcas.domain.usecase.group.LeaveGroupUseCase
import com.futebadosparcas.domain.usecase.group.ManageMembersUseCase
import com.futebadosparcas.domain.usecase.group.TransferOwnershipUseCase
import com.futebadosparcas.domain.usecase.group.UpdateGroupUseCase
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para GroupDetailViewModel.
 * Verifica carregamento de grupo, gerenciamento de membros,
 * permissoes, validacoes e tratamento de erros.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GroupDetailViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
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

    private fun createViewModel(): GroupDetailViewModel {
        return GroupDetailViewModel(
            groupRepository,
            userRepository,
            auth,
            updateGroupUseCase,
            archiveGroupUseCase,
            deleteGroupUseCase,
            leaveGroupUseCase,
            manageMembersUseCase,
            transferOwnershipUseCase
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

        // Setup default mock de usuario autenticado
        val mockUser = mockk<FirebaseUser>(relaxed = true)
        every { mockUser.uid } returns "user123"
        every { auth.currentUser } returns mockUser

        // Setup default de getUsersByIds (retorna vazio para nao complicar)
        coEvery { userRepository.getUsersByIds(any()) } returns Result.success(emptyList())
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("Estado inicial deve ser Loading")
    fun `initial state should be Loading`() {
        // When - Quando criar ViewModel
        viewModel = createViewModel()

        // Then - Estado deve ser Loading
        assertTrue(viewModel.uiState.value is GroupDetailUiState.Loading)
    }

    @Test
    @DisplayName("Deve carregar grupo com sucesso")
    fun `loadGroup_validGroupId_showsSuccess`() = runTest {
        // Given - Dado grupo valido com membros
        val testGroup = createTestGroup("group-1")
        val testMembers = listOf(
            createTestMember("user123", "Jogador 1", GroupMemberRole.OWNER),
            createTestMember("user456", "Jogador 2", GroupMemberRole.MEMBER)
        )

        every { groupRepository.getGroupFlow("group-1") } returns flowOf(Result.success(testGroup))
        every { groupRepository.getOrderedGroupMembersFlow("group-1") } returns flowOf(testMembers)

        viewModel = createViewModel()

        // When - Quando carregar grupo
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // Then - Estado deve ser Success
        val state = viewModel.uiState.value
        assertTrue(state is GroupDetailUiState.Success, "Estado esperado: Success, obtido: ${state::class.simpleName}")
        val successState = state as GroupDetailUiState.Success
        assertEquals("group-1", successState.group.id)
        assertEquals(2, successState.members.size)
        assertEquals(GroupMemberRole.OWNER, successState.myRole)
    }

    @Test
    @DisplayName("Deve retornar Error quando grupo nao encontrado")
    fun `loadGroup_groupNotFound_showsError`() = runTest {
        // Given - Dado grupo nao encontrado (Result.failure gera getOrNull() = null)
        every { groupRepository.getGroupFlow("invalid") } returns flowOf(
            Result.failure(Exception("Grupo nao encontrado"))
        )
        every { groupRepository.getOrderedGroupMembersFlow("invalid") } returns flowOf(emptyList())

        viewModel = createViewModel()

        // When - Quando carregar grupo inexistente
        viewModel.loadGroup("invalid")
        advanceUntilIdle()

        // Then - Estado deve ser Error
        val state = viewModel.uiState.value
        assertTrue(state is GroupDetailUiState.Error)
    }

    @Test
    @DisplayName("Deve retornar Error quando repositorio falha")
    fun `loadGroup_repositoryFails_showsError`() = runTest {
        // Given - Dado erro no repositorio
        every { groupRepository.getGroupFlow("group-1") } returns flowOf(Result.failure(Exception("Erro de rede")))
        every { groupRepository.getOrderedGroupMembersFlow("group-1") } returns flowOf(emptyList())

        viewModel = createViewModel()

        // When - Quando carregar grupo
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // Then - Estado deve ser Error
        val state = viewModel.uiState.value
        assertTrue(state is GroupDetailUiState.Error)
    }

    @Test
    @DisplayName("Deve validar nome do grupo ao atualizar - nome curto")
    fun `updateGroup_shortName_showsError`() = runTest {
        // Given - Dado ViewModel com grupo carregado como Owner
        setupSuccessState(myRole = GroupMemberRole.OWNER)
        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // When - Quando atualizar com nome muito curto (< 3 caracteres)
        viewModel.updateGroup(name = "AB", description = "desc")

        // Then - actionState deve ser Error
        val actionState = viewModel.actionState.value
        assertTrue(actionState is GroupActionState.Error)
        assertTrue((actionState as GroupActionState.Error).message.contains("3 e 50 caracteres"))
    }

    @Test
    @DisplayName("Deve validar permissao ao atualizar grupo - membro comum")
    fun `updateGroup_memberRole_showsPermissionError`() = runTest {
        // Given - Dado ViewModel com grupo carregado como MEMBER (sem permissao)
        setupSuccessState(myRole = GroupMemberRole.MEMBER)
        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // When - Quando tentar atualizar sem permissao
        viewModel.updateGroup(name = "Novo Nome Valido", description = "desc")

        // Then - actionState deve ser Error de permissao
        val actionState = viewModel.actionState.value
        assertTrue(actionState is GroupActionState.Error)
        // A mensagem real usa "permissão" com acento
        assertTrue((actionState as GroupActionState.Error).message.contains("permiss"))
    }

    @Test
    @DisplayName("Deve arquivar grupo com sucesso quando e Owner")
    fun `archiveGroup_asOwner_succeeds`() = runTest {
        // Given - Dado ViewModel como Owner
        setupSuccessState(myRole = GroupMemberRole.OWNER)
        coEvery { archiveGroupUseCase(any()) } returns Result.success(Unit)

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // When - Quando arquivar
        viewModel.archiveGroup()
        advanceUntilIdle()

        // Then - actionState deve ser Success
        val actionState = viewModel.actionState.value
        assertTrue(actionState is GroupActionState.Success)
    }

    @Test
    @DisplayName("Deve negar arquivamento quando nao e Owner")
    fun `archiveGroup_asMember_showsError`() = runTest {
        // Given - Dado ViewModel como MEMBER
        setupSuccessState(myRole = GroupMemberRole.MEMBER)

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // When - Quando tentar arquivar
        viewModel.archiveGroup()

        // Then - Deve negar
        val actionState = viewModel.actionState.value
        assertTrue(actionState is GroupActionState.Error)
        assertTrue((actionState as GroupActionState.Error).message.contains("dono"))
    }

    @Test
    @DisplayName("Deve excluir grupo com sucesso quando e Owner")
    fun `deleteGroup_asOwner_showsGroupDeleted`() = runTest {
        // Given - Dado ViewModel como Owner
        setupSuccessState(myRole = GroupMemberRole.OWNER)
        coEvery { deleteGroupUseCase(any()) } returns Result.success(Unit)

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // When - Quando excluir
        viewModel.deleteGroup()
        advanceUntilIdle()

        // Then - actionState deve ser GroupDeleted
        assertTrue(viewModel.actionState.value is GroupActionState.GroupDeleted)
    }

    @Test
    @DisplayName("Deve negar exclusao quando nao e Owner")
    fun `deleteGroup_asAdmin_showsPermissionError`() = runTest {
        // Given - Dado ViewModel como ADMIN
        setupSuccessState(myRole = GroupMemberRole.ADMIN)

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // When - Quando tentar excluir
        viewModel.deleteGroup()

        // Then - Deve negar
        val actionState = viewModel.actionState.value
        assertTrue(actionState is GroupActionState.Error)
        assertTrue((actionState as GroupActionState.Error).message.contains("dono"))
    }

    @Test
    @DisplayName("Deve promover membro a admin com sucesso")
    fun `promoteMember_memberRole_succeeds`() = runTest {
        // Given - Dado ViewModel como Owner e membro elegivel
        setupSuccessState(myRole = GroupMemberRole.OWNER)
        coEvery { manageMembersUseCase.promoteMember(any(), any()) } returns Result.success(Unit)

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        val memberToPromote = createTestMember("user456", "Jogador 2", GroupMemberRole.MEMBER)

        // When - Quando promover membro
        viewModel.promoteMember(memberToPromote)
        advanceUntilIdle()

        // Then - actionState deve ser Success
        val actionState = viewModel.actionState.value
        assertTrue(actionState is GroupActionState.Success)
    }

    @Test
    @DisplayName("Deve rejeitar promocao de admin - ja e admin")
    fun `promoteMember_alreadyAdmin_showsError`() = runTest {
        // Given - Dado ViewModel como Owner
        setupSuccessState(myRole = GroupMemberRole.OWNER)

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        val adminMember = createTestMember("user789", "Admin", GroupMemberRole.ADMIN)

        // When - Quando tentar promover admin
        viewModel.promoteMember(adminMember)

        // Then - Deve rejeitar
        val actionState = viewModel.actionState.value
        assertTrue(actionState is GroupActionState.Error)
    }

    @Test
    @DisplayName("Deve rebaixar admin a membro com sucesso")
    fun `demoteMember_adminRole_succeeds`() = runTest {
        // Given - Dado ViewModel como Owner e admin para rebaixar
        setupSuccessState(myRole = GroupMemberRole.OWNER)
        coEvery { manageMembersUseCase.demoteMember(any(), any()) } returns Result.success(Unit)

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        val adminToDemote = createTestMember("user789", "Admin", GroupMemberRole.ADMIN)

        // When - Quando rebaixar
        viewModel.demoteMember(adminToDemote)
        advanceUntilIdle()

        // Then - actionState deve ser Success
        assertTrue(viewModel.actionState.value is GroupActionState.Success)
    }

    @Test
    @DisplayName("Deve rejeitar rebaixamento de membro comum")
    fun `demoteMember_memberRole_showsError`() = runTest {
        // Given - Dado ViewModel como Owner
        setupSuccessState(myRole = GroupMemberRole.OWNER)

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        val regularMember = createTestMember("user456", "Membro", GroupMemberRole.MEMBER)

        // When - Quando tentar rebaixar membro comum
        viewModel.demoteMember(regularMember)

        // Then - Deve rejeitar
        assertTrue(viewModel.actionState.value is GroupActionState.Error)
    }

    @Test
    @DisplayName("Deve impedir remocao do Owner")
    fun `removeMember_ownerRole_showsError`() = runTest {
        // Given - Dado ViewModel como Admin
        setupSuccessState(myRole = GroupMemberRole.ADMIN)

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        val ownerMember = createTestMember("ownerUser", "Dono", GroupMemberRole.OWNER)

        // When - Quando tentar remover owner
        viewModel.removeMember(ownerMember)

        // Then - Deve impedir
        assertTrue(viewModel.actionState.value is GroupActionState.Error)
    }

    @Test
    @DisplayName("Deve sair do grupo com sucesso")
    fun `leaveGroup_succeeds`() = runTest {
        // Given - Dado ViewModel com grupo carregado
        setupSuccessState(myRole = GroupMemberRole.MEMBER)
        coEvery { leaveGroupUseCase(any()) } returns Result.success(Unit)

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // When - Quando sair do grupo
        viewModel.leaveGroup()
        advanceUntilIdle()

        // Then - Estado deve ser LeftGroup
        assertTrue(viewModel.uiState.value is GroupDetailUiState.LeftGroup)
    }

    @Test
    @DisplayName("Deve falhar ao sair do grupo quando repositorio falha")
    fun `leaveGroup_repositoryFails_showsError`() = runTest {
        // Given - Dado erro ao sair do grupo
        setupSuccessState(myRole = GroupMemberRole.MEMBER)
        coEvery { leaveGroupUseCase(any()) } returns Result.failure(Exception("Erro"))

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // When - Quando tentar sair
        viewModel.leaveGroup()
        advanceUntilIdle()

        // Then - actionState deve ser Error
        assertTrue(viewModel.actionState.value is GroupActionState.Error)
    }

    @Test
    @DisplayName("Deve listar membros elegiveis para promocao")
    fun `getMembersEligibleForPromotion_returnsOnlyMembers`() = runTest {
        // Given - Dado grupo com mix de roles
        setupSuccessState(myRole = GroupMemberRole.OWNER)

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // When - Quando buscar elegiveis para promocao
        val eligible = viewModel.getMembersEligibleForPromotion()

        // Then - Deve retornar apenas MEMBER (nao OWNER ou ADMIN)
        assertTrue(eligible.all { it.getRoleEnum() == GroupMemberRole.MEMBER })
    }

    @Test
    @DisplayName("Deve listar membros elegiveis para transferencia")
    fun `getMembersEligibleForTransfer_excludesOwner`() = runTest {
        // Given - Dado grupo com mix de roles
        setupSuccessState(myRole = GroupMemberRole.OWNER)

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // When - Quando buscar elegiveis para transferencia
        val eligible = viewModel.getMembersEligibleForTransfer()

        // Then - Nao deve incluir OWNER
        assertTrue(eligible.none { it.getRoleEnum() == GroupMemberRole.OWNER })
    }

    @Test
    @DisplayName("Deve resetar actionState para Idle")
    fun `resetActionState_setsToIdle`() = runTest {
        // Given - Dado ViewModel com actionState nao-Idle
        setupSuccessState(myRole = GroupMemberRole.MEMBER)
        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // Simular um erro
        viewModel.archiveGroup() // Sem permissao = gera erro
        assertTrue(viewModel.actionState.value is GroupActionState.Error)

        // When - Quando resetar
        viewModel.resetActionState()

        // Then - Deve ser Idle
        assertTrue(viewModel.actionState.value is GroupActionState.Idle)
    }

    @Test
    @DisplayName("retryLastOperation deve recarregar dados do grupo")
    fun `retryLastOperation_reloadsGroup`() = runTest {
        // Given - Dado ViewModel com grupo carregado
        val testGroup = createTestGroup("group-1")
        val testMembers = listOf(
            createTestMember("user123", "Jogador 1", GroupMemberRole.OWNER)
        )

        every { groupRepository.getGroupFlow("group-1") } returns flowOf(Result.success(testGroup))
        every { groupRepository.getOrderedGroupMembersFlow("group-1") } returns flowOf(testMembers)

        viewModel = createViewModel()
        viewModel.loadGroup("group-1")
        advanceUntilIdle()

        // When - Quando fazer retry
        viewModel.retryLastOperation()
        advanceUntilIdle()

        // Then - Deve recarregar com sucesso
        val state = viewModel.uiState.value
        assertTrue(state is GroupDetailUiState.Success || state is GroupDetailUiState.Loading)
    }

    // === Helper Functions ===

    private fun setupSuccessState(myRole: GroupMemberRole) {
        val testGroup = createTestGroup("group-1")
        val testMembers = listOf(
            createTestMember("user123", "Jogador 1", myRole),
            createTestMember("user456", "Jogador 2", GroupMemberRole.MEMBER),
            createTestMember("user789", "Jogador 3", GroupMemberRole.ADMIN)
        )

        every { groupRepository.getGroupFlow("group-1") } returns flowOf(Result.success(testGroup))
        every { groupRepository.getOrderedGroupMembersFlow("group-1") } returns flowOf(testMembers)
    }

    private fun createTestGroup(
        id: String,
        name: String = "Pelada dos Amigos"
    ): Group {
        return Group(
            id = id,
            name = name,
            description = "Grupo de teste"
        )
    }

    private fun createTestMember(
        userId: String,
        userName: String,
        role: GroupMemberRole
    ): GroupMember {
        return GroupMember(
            id = userId,
            userId = userId,
            userName = userName,
            role = role.name
        )
    }
}
