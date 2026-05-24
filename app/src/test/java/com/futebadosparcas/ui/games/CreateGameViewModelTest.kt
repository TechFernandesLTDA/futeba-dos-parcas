package com.futebadosparcas.ui.games

import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.CreateGameDraftRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.model.Field
import com.futebadosparcas.domain.model.GameVisibility
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.repository.AddressRepository
import com.futebadosparcas.domain.repository.GameTemplateRepository
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.domain.repository.ScheduleRepository
import com.futebadosparcas.domain.service.FieldAvailabilityService
import com.futebadosparcas.domain.service.TimeSuggestionService
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import java.time.LocalDate
import java.time.LocalTime

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("CreateGameViewModel Tests")
@ExtendWith(MockLogExtension::class)
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

        coEvery { authRepository.getCurrentFirebaseUser() } returns null
        coEvery { groupRepository.getValidGroupsForGame() } returns Result.success(emptyList())
        coEvery { gameTemplateRepository.getUserTemplates(any()) } returns Result.success(emptyList())
        coEvery { draftRepository.hasDraft() } returns false
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Nested
    @DisplayName("Estado Inicial")
    inner class InitialStateTests {

        @Test
        @DisplayName("Estado inicial deve ser Idle")
        fun `initial state is Idle`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            assertEquals(CreateGameUiState.Idle, viewModel.uiState.value)
        }

        @Test
        @DisplayName("currentStep inicial eh LOCATION")
        fun `initial currentStep is LOCATION`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            assertEquals(CreateGameStep.LOCATION, viewModel.currentStep.value)
        }

        @Test
        @DisplayName("selectedVisibility inicial eh GROUP_ONLY")
        fun `initial selectedVisibility is GROUP_ONLY`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            assertEquals(GameVisibility.GROUP_ONLY, viewModel.selectedVisibility.value)
        }
    }

    @Nested
    @DisplayName("Wizard Navegacao")
    inner class WizardNavigationTests {

        @Test
        @DisplayName("nextStep avanca para DETAILS")
        fun `nextStep advances to DETAILS`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.nextStep()
            assertEquals(CreateGameStep.DETAILS, viewModel.currentStep.value)
        }

        @Test
        @DisplayName("nextStep no CONFIRMATION nao avanca")
        fun `nextStep at CONFIRMATION does not advance`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.goToStep(CreateGameStep.CONFIRMATION)
            viewModel.nextStep()
            assertEquals(CreateGameStep.CONFIRMATION, viewModel.currentStep.value)
        }

        @Test
        @DisplayName("previousStep volta um passo")
        fun `previousStep goes back one step`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.goToStep(CreateGameStep.DATETIME)
            viewModel.previousStep()
            assertEquals(CreateGameStep.DETAILS, viewModel.currentStep.value)
        }

        @Test
        @DisplayName("previousStep no LOCATION nao volta")
        fun `previousStep at LOCATION does not go back`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.previousStep()
            assertEquals(CreateGameStep.LOCATION, viewModel.currentStep.value)
        }
    }

    @Nested
    @DisplayName("Selecao de Local e Quadra")
    inner class LocationAndFieldTests {

        @Test
        @DisplayName("setLocation atualiza local selecionado")
        fun `setLocation updates selected location`() {
            val location = Location(id = "loc-1", name = "Quadra do Parque", address = "Rua A, 123")
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.setLocation(location)
            assertEquals(location, viewModel.selectedLocation.value)
        }

        @Test
        @DisplayName("setField atualiza quadra selecionada")
        fun `setField updates selected field`() {
            val field = Field(id = "field-1", locationId = "loc-1", name = "Quadra 1")
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.setField(field)
            assertEquals(field, viewModel.selectedField.value)
        }

        @Test
        @DisplayName("setLocation limpa quadra selecionada")
        fun `setLocation clears selected field`() {
            val oldField = Field(id = "field-1", locationId = "loc-1", name = "Quadra 1")
            val newLocation = Location(id = "loc-2", name = "Outra Quadra", address = "Rua B, 456")
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.setField(oldField)
            assertEquals(oldField, viewModel.selectedField.value)

            viewModel.setLocation(newLocation)
            assertNull(viewModel.selectedField.value)
        }
    }

    @Nested
    @DisplayName("Data e Horario")
    inner class DateTimeTests {

        @Test
        @DisplayName("setDate atualiza data selecionada")
        fun `setDate updates selected date`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.setDate(2026, 5, 15)
            assertEquals(LocalDate.of(2026, 6, 15), viewModel.selectedDate.value)
        }

        @Test
        @DisplayName("setTime atualiza horario selecionado")
        fun `setTime updates selected time`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.setTime(20, 0)
            assertEquals(LocalTime.of(20, 0), viewModel.selectedTime.value)
        }

        @Test
        @DisplayName("setEndTime atualiza horario de termino")
        fun `setEndTime updates end time`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.setEndTime(22, 0)
            assertEquals(LocalTime.of(22, 0), viewModel.selectedEndTime.value)
        }
    }

    @Nested
    @DisplayName("Visibilidade e Grupo")
    inner class VisibilityAndGroupTests {

        @Test
        @DisplayName("setVisibility altera visibilidade")
        fun `setVisibility changes visibility`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.setVisibility(GameVisibility.PUBLIC_OPEN)
            assertEquals(GameVisibility.PUBLIC_OPEN, viewModel.selectedVisibility.value)
        }

        @Test
        @DisplayName("selectGroup seleciona grupo")
        fun `selectGroup selects group`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.selectGroup(
                com.futebadosparcas.data.model.UserGroup(id = "grp-1", groupId = "grp-1", groupName = "Pelada")
            )
            assertNotNull(viewModel.selectedGroup.value)
            assertEquals("grp-1", viewModel.selectedGroup.value?.id)
        }
    }

    @Nested
    @DisplayName("Preco por Jogador")
    inner class PriceTests {

        @Test
        @DisplayName("updatePricePerPlayer calcula preco por jogador")
        fun `updatePricePerPlayer calculates price per player`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.updatePricePerPlayer(price = 100.0, maxPlayers = 10)
            assertEquals(10.0, viewModel.pricePerPlayer.value)
        }

        @Test
        @DisplayName("setManualPricePerPlayer define preco manual")
        fun `setManualPricePerPlayer sets manual price`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.setManualPricePerPlayer(25.0)
            assertEquals(25.0, viewModel.pricePerPlayer.value)
        }
    }

    @Nested
    @DisplayName("CEP Lookup")
    inner class CepLookupTests {

        @Test
        @DisplayName("lookupCep com CEP curto nao faz nada")
        fun `lookupCep with short cep does nothing`() {
            viewModel = CreateGameViewModel(
                gameRepository, authRepository, gameTemplateRepository,
                scheduleRepository, groupRepository, notificationRepository,
                draftRepository, timeSuggestionService, fieldAvailabilityService,
                addressRepository
            )

            viewModel.lookupCep("123")
            coVerify(exactly = 0) { addressRepository.getAddressByCep(any()) }
        }
    }
}
