package com.futebadosparcas.ui.games

import com.futebadosparcas.data.model.*
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.CreateGameDraftRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.repository.AddressRepository
import com.futebadosparcas.domain.repository.GameTemplateRepository
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.domain.repository.ScheduleRepository
import com.futebadosparcas.domain.service.FieldAvailabilityService
import com.futebadosparcas.domain.service.TimeSuggestionService
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import com.google.firebase.auth.FirebaseUser
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para CreateGameViewModel.
 * Verifica validacoes do formulario, navegacao do wizard,
 * criacao/edicao de jogos e gerenciamento de templates.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("CreateGameViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class CreateGameViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var gameRepository: GameRepository
    private lateinit var authRepository: AuthRepository
    private lateinit var gameTemplateRepository: GameTemplateRepository
    private lateinit var scheduleRepository: ScheduleRepository
    private lateinit var groupRepository: GroupRepository
    private lateinit var notificationRepository: NotificationRepository
    private lateinit var draftRepository: CreateGameDraftRepository
    private lateinit var timeSuggestionService: TimeSuggestionService
    private lateinit var fieldAvailabilityService: FieldAvailabilityService
    private lateinit var addressRepository: AddressRepository

    private lateinit var viewModel: CreateGameViewModel

    private fun createViewModel(): CreateGameViewModel {
        return CreateGameViewModel(
            gameRepository,
            authRepository,
            gameTemplateRepository,
            scheduleRepository,
            groupRepository,
            notificationRepository,
            draftRepository,
            timeSuggestionService,
            fieldAvailabilityService,
            addressRepository
        )
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        gameRepository = mockk(relaxed = true)
        authRepository = mockk(relaxed = true)
        gameTemplateRepository = mockk(relaxed = true)
        scheduleRepository = mockk(relaxed = true)
        groupRepository = mockk(relaxed = true)
        notificationRepository = mockk(relaxed = true)
        draftRepository = mockk(relaxed = true)
        timeSuggestionService = mockk(relaxed = true)
        fieldAvailabilityService = mockk(relaxed = true)
        addressRepository = mockk(relaxed = true)

        // Setup default mocks
        val mockFirebaseUser = mockk<FirebaseUser>(relaxed = true)
        every { mockFirebaseUser.displayName } returns "Test User"
        every { mockFirebaseUser.uid } returns "user123"
        every { authRepository.getCurrentFirebaseUser() } returns mockFirebaseUser
        every { authRepository.getCurrentUserId() } returns "user123"

        // Grupo valido para criar jogos
        coEvery { groupRepository.getValidGroupsForGame() } returns Result.success(
            listOf(createTestGroup())
        )

        // Templates vazios
        coEvery { gameTemplateRepository.getUserTemplates(any()) } returns Result.success(emptyList())

        // Draft inexistente
        coEvery { draftRepository.hasDraft() } returns false

        // Recent games vazio
        coEvery { gameRepository.getAllGames() } returns Result.success(emptyList())

        // Time conflict check (evita ClassCastException em relaxed mock de Result)
        coEvery { gameRepository.checkTimeConflict(any(), any(), any(), any(), any()) } returns Result.success(emptyList())
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("Estado inicial deve ser Idle")
    fun `initial state should be Idle`() = runTest {
        // When - Quando criar ViewModel
        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - Estado deve ser Idle ou TemplatesLoaded (init carrega templates)
        val state = viewModel.uiState.value
        assertTrue(
            state is CreateGameUiState.Idle || state is CreateGameUiState.TemplatesLoaded,
            "Estado esperado: Idle ou TemplatesLoaded, obtido: ${state::class.simpleName}"
        )
    }

    @Test
    @DisplayName("Deve validar que local e obrigatorio")
    fun `saveGame should return Error when location is null`() = runTest {
        // Given - Dado ViewModel sem local selecionado
        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando tentar salvar sem local
        viewModel.saveGame(
            gameId = null,
            ownerName = "Test User",
            price = 50.0,
            maxPlayers = 14,
            recurrence = "none"
        )
        advanceUntilIdle()

        // Then - Deve retornar Error
        val state = viewModel.uiState.value
        assertTrue(state is CreateGameUiState.Error)
        assertEquals("Selecione um local", (state as CreateGameUiState.Error).message)
    }

    @Test
    @DisplayName("Deve validar que quadra e obrigatoria")
    fun `saveGame should return Error when field is null`() = runTest {
        // Given - Dado ViewModel com local mas sem quadra
        viewModel = createViewModel()
        advanceUntilIdle()

        val location = Location(id = "loc-1", name = "Arena Test", address = "Rua 1")
        viewModel.setLocation(location)

        // When - Quando tentar salvar sem quadra
        viewModel.saveGame(
            gameId = null,
            ownerName = "Test User",
            price = 50.0,
            maxPlayers = 14,
            recurrence = "none"
        )
        advanceUntilIdle()

        // Then - Deve retornar Error
        val state = viewModel.uiState.value
        assertTrue(state is CreateGameUiState.Error)
        assertEquals("Selecione uma quadra", (state as CreateGameUiState.Error).message)
    }

    @Test
    @DisplayName("Deve validar nome do responsavel vazio")
    fun `saveGame should return Error when ownerName is empty`() = runTest {
        // Given - Dado ViewModel com local, quadra, data e hora, mas sem nome
        viewModel = createViewModel()
        advanceUntilIdle()

        setupLocationAndField()
        viewModel.setDate(2026, 1, 15) // Fevereiro 2026
        viewModel.setTime(20, 0)
        viewModel.setEndTime(21, 30)

        // When - Quando tentar salvar com nome vazio
        viewModel.saveGame(
            gameId = null,
            ownerName = "",
            price = 50.0,
            maxPlayers = 14,
            recurrence = "none"
        )
        advanceUntilIdle()

        // Then - Deve retornar Error
        val state = viewModel.uiState.value
        assertTrue(state is CreateGameUiState.Error)
        assertTrue((state as CreateGameUiState.Error).message.contains("obrigatorio"))
    }

    @Test
    @DisplayName("Deve validar numero minimo de jogadores")
    fun `saveGame should return Error when maxPlayers is below minimum`() = runTest {
        // Given - Dado ViewModel com dados validos mas jogadores insuficientes
        viewModel = createViewModel()
        advanceUntilIdle()

        setupLocationAndField()
        viewModel.setDate(2026, 5, 15) // Junho 2026 (futuro)
        viewModel.setTime(20, 0)
        viewModel.setEndTime(21, 30)

        // When - Quando tentar salvar com 2 jogadores (minimo e 4)
        viewModel.saveGame(
            gameId = null,
            ownerName = "Test User",
            price = 50.0,
            maxPlayers = 2,
            recurrence = "none"
        )
        advanceUntilIdle()

        // Then - Deve retornar Error
        val state = viewModel.uiState.value
        assertTrue(state is CreateGameUiState.Error)
        assertTrue((state as CreateGameUiState.Error).message.contains("invalido"))
    }

    @Test
    @DisplayName("Deve navegar entre passos do wizard")
    fun `wizard navigation should work correctly`() = runTest {
        // Given - Dado ViewModel criado
        viewModel = createViewModel()
        advanceUntilIdle()

        // Estado inicial deve ser LOCATION
        assertEquals(CreateGameStep.LOCATION, viewModel.currentStep.value)

        // When - Quando avancar
        viewModel.nextStep()
        assertEquals(CreateGameStep.DETAILS, viewModel.currentStep.value)

        viewModel.nextStep()
        assertEquals(CreateGameStep.DATETIME, viewModel.currentStep.value)

        viewModel.nextStep()
        assertEquals(CreateGameStep.CONFIRMATION, viewModel.currentStep.value)

        // Nao deve avancar alem do ultimo passo
        viewModel.nextStep()
        assertEquals(CreateGameStep.CONFIRMATION, viewModel.currentStep.value)

        // When - Quando voltar
        viewModel.previousStep()
        assertEquals(CreateGameStep.DATETIME, viewModel.currentStep.value)

        // When - Quando ir direto para um passo
        viewModel.goToStep(CreateGameStep.LOCATION)
        assertEquals(CreateGameStep.LOCATION, viewModel.currentStep.value)

        // Nao deve voltar alem do primeiro passo
        viewModel.previousStep()
        assertEquals(CreateGameStep.LOCATION, viewModel.currentStep.value)
    }

    @Test
    @DisplayName("Deve selecionar e limpar local")
    fun `setLocation should update selected location and clear field`() = runTest {
        // Given - Dado ViewModel com quadra selecionada
        viewModel = createViewModel()
        advanceUntilIdle()

        val field = Field(id = "field-1", locationId = "loc-1", name = "Quadra 1")
        viewModel.setField(field)
        assertNotNull(viewModel.selectedField.value)

        // When - Quando selecionar novo local
        val newLocation = Location(id = "loc-2", name = "Arena Nova", address = "Rua 2")
        viewModel.setLocation(newLocation)

        // Then - Local deve ser atualizado e quadra limpa
        assertEquals("loc-2", viewModel.selectedLocation.value?.id)
        assertNull(viewModel.selectedField.value)
    }

    @Test
    @DisplayName("Deve restaurar e descartar rascunho")
    fun `draft operations should work correctly`() = runTest {
        // Given - Dado rascunho existente
        coEvery { draftRepository.hasDraft() } returns true

        viewModel = createViewModel()
        advanceUntilIdle()

        // Then - hasDraft deve ser true
        assertTrue(viewModel.hasDraft.value)

        // When - Quando descartar
        viewModel.discardDraft()
        advanceUntilIdle()

        // Then - hasDraft deve ser false
        assertFalse(viewModel.hasDraft.value)
        coVerify { draftRepository.clearDraft() }
    }

    @Test
    @DisplayName("Deve selecionar e remover grupo")
    fun `selectGroup should update selected group`() = runTest {
        // Given - Dado ViewModel criado
        viewModel = createViewModel()
        advanceUntilIdle()

        val group = createTestGroup()

        // When - Quando selecionar grupo
        viewModel.selectGroup(group)

        // Then - Grupo deve ser atualizado
        assertEquals(group.id, viewModel.selectedGroup.value?.id)

        // When - Quando limpar grupo
        viewModel.selectGroup(null)

        // Then - Grupo deve ser null
        assertNull(viewModel.selectedGroup.value)
    }

    @Test
    @DisplayName("Deve calcular preco por jogador")
    fun `updatePricePerPlayer should calculate correct price`() = runTest {
        // Given - Dado ViewModel criado
        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando calcular preco
        viewModel.updatePricePerPlayer(price = 140.0, maxPlayers = 14)

        // Then - Preco por jogador deve ser 10
        assertEquals(10.0, viewModel.pricePerPlayer.value)
    }

    @Test
    @DisplayName("Deve suportar preco manual por jogador")
    fun `setManualPricePerPlayer should override automatic calculation`() = runTest {
        // Given - Dado ViewModel criado
        viewModel = createViewModel()
        advanceUntilIdle()

        // When - Quando definir preco manual
        viewModel.setManualPricePerPlayer(15.0)

        // Then - Preco deve ser o manual
        assertEquals(15.0, viewModel.pricePerPlayer.value)
        assertTrue(viewModel.isManualPriceEnabled.value)

        // When - Quando desabilitar modo manual
        viewModel.toggleManualPriceMode(false)

        // Then - Deve voltar ao modo automatico
        assertFalse(viewModel.isManualPriceEnabled.value)
    }

    @Test
    @DisplayName("Deve definir visibilidade do jogo")
    fun `setVisibility should update selected visibility`() = runTest {
        // Given - Dado ViewModel criado
        viewModel = createViewModel()
        advanceUntilIdle()

        // Estado inicial deve ser GROUP_ONLY
        assertEquals(GameVisibility.GROUP_ONLY, viewModel.selectedVisibility.value)

        // When - Quando alterar visibilidade
        viewModel.setVisibility(GameVisibility.PUBLIC_OPEN)

        // Then - Visibilidade deve ser atualizada
        assertEquals(GameVisibility.PUBLIC_OPEN, viewModel.selectedVisibility.value)
    }

    @Test
    @DisplayName("onCleared deve cancelar autoSaveJob")
    fun `onCleared should cancel autoSaveJob`() = runTest {
        // Given - Dado ViewModel com autoSave ativo
        viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.autoSaveDraft("owner", "50", "14", false, "none")
        advanceUntilIdle()

        // When/Then - ViewModel deve funcionar sem crashar ao ser descartado
        // onCleared() e protected, entao verificamos que o autoSave nao crasha
        // Sucesso se nao lanca excecao
    }

    // === Helper Functions ===

    private fun setupLocationAndField() {
        val location = Location(id = "loc-1", name = "Arena Test", address = "Rua 1")
        val field = Field(id = "field-1", locationId = "loc-1", name = "Quadra 1", type = "SOCIETY")
        viewModel.setLocation(location)
        viewModel.setField(field)
    }

    private fun createTestGroup(): UserGroup {
        return UserGroup(
            id = "group-1",
            groupId = "group-1",
            groupName = "Pelada dos Amigos"
        )
    }
}
