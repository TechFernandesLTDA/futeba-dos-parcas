package com.futebadosparcas.ui.groups

import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.UserGroup
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.usecase.group.ArchiveGroupUseCase
import com.futebadosparcas.domain.usecase.group.CreateGroupUseCase
import com.futebadosparcas.domain.usecase.group.DeleteGroupUseCase
import com.futebadosparcas.domain.usecase.group.GetGroupsUseCase
import com.futebadosparcas.domain.usecase.group.LeaveGroupUseCase
import com.futebadosparcas.domain.usecase.group.ManageMembersUseCase
import com.futebadosparcas.domain.usecase.group.TransferOwnershipUseCase
import com.futebadosparcas.domain.usecase.group.UpdateGroupUseCase
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para GroupsViewModel.
 * Verifica carregamento da lista de grupos, busca/filtro,
 * criacao, exclusao, e acoes de gerenciamento de grupos.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GroupsViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class GroupsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var groupRepository: GroupRepository
    private lateinit var createGroupUseCase: CreateGroupUseCase
    private lateinit var updateGroupUseCase: UpdateGroupUseCase
    private lateinit var archiveGroupUseCase: ArchiveGroupUseCase
    private lateinit var deleteGroupUseCase: DeleteGroupUseCase
    private lateinit var leaveGroupUseCase: LeaveGroupUseCase
    private lateinit var manageMembersUseCase: ManageMembersUseCase
    private lateinit var transferOwnershipUseCase: TransferOwnershipUseCase
    private lateinit var getGroupsUseCase: GetGroupsUseCase

    private lateinit var viewModel: GroupsViewModel

    private fun createViewModel(): GroupsViewModel {
        return GroupsViewModel(
            groupRepository,
            createGroupUseCase,
            updateGroupUseCase,
            archiveGroupUseCase,
            deleteGroupUseCase,
            leaveGroupUseCase,
            manageMembersUseCase,
            transferOwnershipUseCase,
            getGroupsUseCase
        )
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        groupRepository = mockk(relaxed = true)
        createGroupUseCase = mockk(relaxed = true)
        updateGroupUseCase = mockk(relaxed = true)
        archiveGroupUseCase = mockk(relaxed = true)
        deleteGroupUseCase = mockk(relaxed = true)
        leaveGroupUseCase = mockk(relaxed = true)
        manageMembersUseCase = mockk(relaxed = true)
        transferOwnershipUseCase = mockk(relaxed = true)
        getGroupsUseCase = mockk(relaxed = true)

        // Setup default mock - retorna lista vazia
        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(emptyList())
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("Deve carregar grupos com sucesso no init")
    fun `init_withGroups_showsSuccess`() = runTest {
        // Given - Dado grupos disponiveis
        val testGroups = listOf(
            createTestUserGroup("g1", "Pelada dos Amigos"),
            createTestUserGroup("g2", "Futeba Sabado")
        )
        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(testGroups)

        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Estado deve ser Success com 2 grupos
        val state = viewModel.uiState.value
        assertTrue(state is GroupsUiState.Success, "Estado esperado: Success, obtido: ${state::class.simpleName}")
        assertEquals(2, (state as GroupsUiState.Success).groups.size)
    }

    @Test
    @DisplayName("Deve exibir Empty quando nao ha grupos")
    fun `init_noGroups_showsEmpty`() = runTest {
        // Given - Dado nenhum grupo
        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(emptyList())

        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Estado deve ser Empty
        assertTrue(viewModel.uiState.value is GroupsUiState.Empty)
    }

    @Test
    @DisplayName("Deve exibir Error quando flow falha")
    fun `init_flowFails_showsError`() = runTest {
        // Given - Dado flow com erro
        every { getGroupsUseCase.getGroupsFlow() } returns flow { throw RuntimeException("Erro de rede") }

        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Estado deve ser Error
        val state = viewModel.uiState.value
        assertTrue(state is GroupsUiState.Error)
    }

    @Test
    @DisplayName("Deve filtrar grupos por nome na busca")
    fun `searchGroups_withQuery_filtersGroups`() = runTest {
        // Given - Dado grupos carregados
        val testGroups = listOf(
            createTestUserGroup("g1", "Pelada dos Amigos"),
            createTestUserGroup("g2", "Futeba Sabado"),
            createTestUserGroup("g3", "Pelada Domingo")
        )
        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(testGroups)

        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando buscar por "Pelada"
        viewModel.searchGroups("Pelada")

        // Then - Deve filtrar apenas 2 grupos
        val state = viewModel.uiState.value as? GroupsUiState.Success
        assertNotNull(state)
        assertEquals(2, state!!.groups.size)
        assertTrue(state.groups.all { it.groupName.contains("Pelada") })
    }

    @Test
    @DisplayName("Deve fazer busca case-insensitive")
    fun `searchGroups_caseInsensitive_filtersCorrectly`() = runTest {
        // Given - Dado grupos carregados
        val testGroups = listOf(
            createTestUserGroup("g1", "PELADA DOS AMIGOS"),
            createTestUserGroup("g2", "Futeba Sabado")
        )
        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(testGroups)

        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando buscar em minusculas
        viewModel.searchGroups("pelada")

        // Then - Deve encontrar mesmo com case diferente
        val state = viewModel.uiState.value as? GroupsUiState.Success
        assertNotNull(state)
        assertEquals(1, state!!.groups.size)
    }

    @Test
    @DisplayName("Deve exibir todos os grupos quando query esta vazia")
    fun `searchGroups_emptyQuery_showsAllGroups`() = runTest {
        // Given - Dado grupos carregados
        val testGroups = listOf(
            createTestUserGroup("g1", "Pelada 1"),
            createTestUserGroup("g2", "Pelada 2")
        )
        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(testGroups)

        viewModel = createViewModel()
        advanceUntilIdle()

        // Filtrar primeiro
        viewModel.searchGroups("Pelada 1")
        assertEquals(1, (viewModel.uiState.value as GroupsUiState.Success).groups.size)

        // When - Quando limpar busca
        viewModel.searchGroups("")

        // Then - Deve mostrar todos
        assertEquals(2, (viewModel.uiState.value as GroupsUiState.Success).groups.size)
    }

    @Test
    @DisplayName("Deve criar grupo com sucesso")
    fun `createGroup_succeeds_showsCreateGroupSuccess`() = runTest {
        // Given - Dado use case retorna sucesso
        val newGroup = Group(id = "new-g", name = "Novo Grupo", description = "Desc")
        coEvery { createGroupUseCase(any(), any(), any()) } returns Result.success(newGroup)

        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(emptyList())
        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando criar grupo
        viewModel.createGroup("Novo Grupo", "Desc")
        advanceUntilIdle()

        // Then - createGroupState deve ser Success
        val state = viewModel.createGroupState.value
        assertTrue(state is CreateGroupUiState.Success)
        assertEquals("Novo Grupo", (state as CreateGroupUiState.Success).group.name)
    }

    @Test
    @DisplayName("Deve exibir Error quando criacao falha")
    fun `createGroup_fails_showsCreateGroupError`() = runTest {
        // Given - Dado use case falha
        coEvery { createGroupUseCase(any(), any(), any()) } returns Result.failure(Exception("Nome invalido"))

        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(emptyList())
        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando criar grupo
        viewModel.createGroup("", "Desc")
        advanceUntilIdle()

        // Then - createGroupState deve ser Error
        assertTrue(viewModel.createGroupState.value is CreateGroupUiState.Error)
    }

    @Test
    @DisplayName("Deve excluir grupo com sucesso")
    fun `deleteGroup_succeeds_showsGroupDeleted`() = runTest {
        // Given - Dado use case retorna sucesso
        coEvery { deleteGroupUseCase(any()) } returns Result.success(Unit)

        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(emptyList())
        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando excluir grupo
        viewModel.deleteGroup("g1")
        advanceUntilIdle()

        // Then - actionState deve ser GroupDeleted
        assertTrue(viewModel.actionState.value is GroupActionState.GroupDeleted)
    }

    @Test
    @DisplayName("Deve exibir Error quando exclusao falha")
    fun `deleteGroup_fails_showsError`() = runTest {
        // Given - Dado use case falha
        coEvery { deleteGroupUseCase(any()) } returns Result.failure(Exception("Erro"))

        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(emptyList())
        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando excluir grupo
        viewModel.deleteGroup("g1")
        advanceUntilIdle()

        // Then - actionState deve ser Error
        assertTrue(viewModel.actionState.value is GroupActionState.Error)
    }

    @Test
    @DisplayName("Deve sair do grupo com sucesso")
    fun `leaveGroup_succeeds_showsLeftGroup`() = runTest {
        // Given - Dado use case retorna sucesso
        coEvery { leaveGroupUseCase(any()) } returns Result.success(Unit)

        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(emptyList())
        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando sair do grupo
        viewModel.leaveGroup("g1")
        advanceUntilIdle()

        // Then - actionState deve ser LeftGroup
        assertTrue(viewModel.actionState.value is GroupActionState.LeftGroup)
    }

    @Test
    @DisplayName("Deve arquivar grupo com sucesso")
    fun `archiveGroup_succeeds_showsSuccess`() = runTest {
        // Given - Dado use case retorna sucesso
        coEvery { archiveGroupUseCase(any()) } returns Result.success(Unit)

        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(emptyList())
        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando arquivar
        viewModel.archiveGroup("g1")
        advanceUntilIdle()

        // Then - actionState deve ser Success
        val state = viewModel.actionState.value
        assertTrue(state is GroupActionState.Success)
        assertTrue((state as GroupActionState.Success).message.contains("arquivado"))
    }

    @Test
    @DisplayName("Deve resetar createGroupState para Idle")
    fun `resetCreateGroupState_setsToIdle`() = runTest {
        // Given - Dado estado createGroup nao-Idle
        coEvery { createGroupUseCase(any(), any(), any()) } returns Result.failure(Exception("Erro"))

        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(emptyList())
        viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.createGroup("", "")
        advanceUntilIdle()

        assertTrue(viewModel.createGroupState.value is CreateGroupUiState.Error)

        // When - Quando resetar
        viewModel.resetCreateGroupState()

        // Then - Deve ser Idle
        assertTrue(viewModel.createGroupState.value is CreateGroupUiState.Idle)
    }

    @Test
    @DisplayName("Deve resetar actionState para Idle")
    fun `resetActionState_setsToIdle`() = runTest {
        // Given - Dado actionState com erro
        coEvery { deleteGroupUseCase(any()) } returns Result.failure(Exception("Erro"))

        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(emptyList())
        viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.deleteGroup("g1")
        advanceUntilIdle()

        assertTrue(viewModel.actionState.value is GroupActionState.Error)

        // When - Quando resetar
        viewModel.resetActionState()

        // Then - Deve ser Idle
        assertTrue(viewModel.actionState.value is GroupActionState.Idle)
    }

    @Test
    @DisplayName("refreshGroups deve recarregar lista de grupos")
    fun `refreshGroups_reloadsGroupsFlow`() = runTest {
        // Given - Dado ViewModel inicializado
        val initialGroups = listOf(createTestUserGroup("g1", "Pelada 1"))
        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(initialGroups)

        viewModel = createViewModel()
        advanceUntilIdle()

        assertEquals(1, (viewModel.uiState.value as GroupsUiState.Success).groups.size)

        // When - Quando refresh
        val updatedGroups = listOf(
            createTestUserGroup("g1", "Pelada 1"),
            createTestUserGroup("g2", "Pelada 2")
        )
        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(updatedGroups)

        viewModel.refreshGroups()
        advanceUntilIdle()

        // Then - Deve mostrar lista atualizada
        val state = viewModel.uiState.value as? GroupsUiState.Success
        assertNotNull(state)
        assertEquals(2, state!!.groups.size)
    }

    @Test
    @DisplayName("Deve promover membro com sucesso")
    fun `promoteMember_succeeds_showsSuccess`() = runTest {
        // Given - Dado use case retorna sucesso
        val member = GroupMember(
            id = "user456",
            userId = "user456",
            userName = "Jogador 2",
            role = GroupMemberRole.MEMBER.name
        )
        coEvery { manageMembersUseCase.promoteMember("g1", member) } returns Result.success(Unit)

        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(emptyList())
        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando promover
        viewModel.promoteMember("g1", member)
        advanceUntilIdle()

        // Then - actionState deve ser Success
        assertTrue(viewModel.actionState.value is GroupActionState.Success)
    }

    @Test
    @DisplayName("Deve transferir propriedade com sucesso")
    fun `transferOwnership_succeeds_showsSuccess`() = runTest {
        // Given - Dado use case retorna sucesso
        val newOwner = GroupMember(
            id = "user456",
            userId = "user456",
            userName = "Novo Dono",
            role = GroupMemberRole.ADMIN.name
        )
        coEvery { transferOwnershipUseCase("g1", newOwner) } returns Result.success(Unit)

        every { getGroupsUseCase.getGroupsFlow() } returns flowOf(emptyList())
        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando transferir
        viewModel.transferOwnership("g1", newOwner)
        advanceUntilIdle()

        // Then - actionState deve ser Success
        val state = viewModel.actionState.value
        assertTrue(state is GroupActionState.Success)
        assertTrue((state as GroupActionState.Success).message.contains("Novo Dono"))
    }

    // === Helper Functions ===

    private fun createTestUserGroup(
        id: String,
        name: String
    ): UserGroup {
        return UserGroup(
            id = id,
            groupId = id,
            groupName = name
        )
    }
}
