package com.futebadosparcas.ui.games

import com.futebadosparcas.R
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.data.repository.WaitlistRepository
import com.futebadosparcas.domain.model.CancellationReason
import com.futebadosparcas.domain.model.ConfirmationStatus
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.GameEventType
import com.futebadosparcas.domain.model.LiveScore
import com.futebadosparcas.domain.model.PlayerPosition
import com.futebadosparcas.domain.model.Team
import com.futebadosparcas.domain.permission.PermissionManager
import com.futebadosparcas.domain.repository.GameExperienceRepository
import com.futebadosparcas.domain.repository.GameRepository
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.domain.repository.ScheduleRepository
import com.futebadosparcas.domain.usecase.ConfirmationResult
import com.futebadosparcas.domain.usecase.ConfirmationUseCase
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.coVerify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
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

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GameDetailViewModel Tests")
@ExtendWith(MockLogExtension::class)
class GameDetailViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var gameRepository: GameRepository
    private lateinit var authRepository: AuthRepository
    private lateinit var gameExperienceRepository: GameExperienceRepository
    private lateinit var scheduleRepository: ScheduleRepository
    private lateinit var groupRepository: GroupRepository
    private lateinit var notificationRepository: NotificationRepository
    private lateinit var waitlistRepository: WaitlistRepository
    private lateinit var confirmationUseCase: ConfirmationUseCase
    private lateinit var permissionManager: PermissionManager
    private lateinit var viewModel: GameDetailViewModel

    private val testGame = Game(
        id = "game-1", date = "2026-06-01", time = "20:00", endTime = "22:00",
        ownerId = "owner-1", ownerName = "Joao", status = "SCHEDULED",
        locationId = "loc-1", locationName = "Quadra", fieldId = "field-1",
        fieldName = "Quadra 1", gameType = "Society"
    )
    private val testConfirmations = listOf(
        GameConfirmation(gameId = "game-1", userId = "user-2", userName = "Pedro", status = "PENDING"),
        GameConfirmation(gameId = "game-1", userId = "user-3", userName = "Ana", status = "CONFIRMED")
    )

    private fun createViewModel() = GameDetailViewModel(
        gameRepository, authRepository, gameExperienceRepository,
        scheduleRepository, groupRepository, notificationRepository,
        waitlistRepository, confirmationUseCase, permissionManager
    )

    private fun setupGameFlows(
        gameResult: Result<Game> = Result.success(testGame),
        confirmationsResult: Result<List<GameConfirmation>> = Result.success(testConfirmations)
    ) {
        val gameFlow = MutableStateFlow(gameResult)
        val confirmationsFlow = MutableStateFlow(confirmationsResult)
        val eventsFlow: MutableStateFlow<Result<List<GameEvent>>> = MutableStateFlow(Result.success(emptyList()))
        val teamsFlow: MutableStateFlow<Result<List<Team>>> = MutableStateFlow(Result.success(emptyList()))
        val liveScoreFlow: MutableStateFlow<LiveScore?> = MutableStateFlow(null)

        every { gameRepository.getGameDetailsFlow("game-1") } returns gameFlow
        every { gameRepository.getGameConfirmationsFlow("game-1") } returns confirmationsFlow
        every { gameRepository.getGameEventsFlow("game-1") } returns eventsFlow
        every { gameRepository.getGameTeamsFlow("game-1") } returns teamsFlow
        every { gameRepository.getLiveScoreFlow("game-1") } returns liveScoreFlow
        every { waitlistRepository.getWaitlistFlow("game-1") } returns flowOf(Result.success(emptyList()))
        coEvery { permissionManager.isAdmin() } returns false
        coEvery { permissionManager.canEditGame(any(), any()) } returns false
        every { authRepository.getCurrentUserId() } returns "user-1"
        coEvery { authRepository.getCurrentUser() } returns Result.success(
            com.futebadosparcas.domain.model.User(id = "user-1", name = "Maria")
        )
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        gameRepository = mockk(relaxed = true)
        authRepository = mockk(relaxed = true)
        gameExperienceRepository = mockk(relaxed = true)
        scheduleRepository = mockk(relaxed = true)
        groupRepository = mockk(relaxed = true)
        notificationRepository = mockk(relaxed = true)
        waitlistRepository = mockk(relaxed = true)
        confirmationUseCase = mockk(relaxed = true)
        permissionManager = mockk(relaxed = true)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Nested
    @DisplayName("loadGameDetails")
    inner class LoadGameDetailsTests {

        @Test
        @DisplayName("loadGameDetails com ID vazio retorna Error")
        fun `loadGameDetails with empty id returns Error`() {
            viewModel = createViewModel()
            viewModel.loadGameDetails("")
            assertInstanceOf(GameDetailUiState.Error::class.java, viewModel.uiState.value)
        }

        @Test
        @DisplayName("loadGameDetails carrega jogo com sucesso")
        fun `loadGameDetails loads game successfully`() = runTest(testDispatcher) {
            setupGameFlows()

            viewModel = createViewModel()
            viewModel.loadGameDetails("game-1")
            advanceUntilIdle()

            val state = viewModel.uiState.value
            assertInstanceOf(GameDetailUiState.Success::class.java, state)
            val success = state as GameDetailUiState.Success
            assertEquals("game-1", success.game.id)
            assertFalse(success.confirmations.isEmpty())
        }

        @Test
        @DisplayName("loadGameDetails com erro no jogo retorna Error")
        fun `loadGameDetails with game error returns Error`() = runTest(testDispatcher) {
            setupGameFlows(gameResult = Result.failure(RuntimeException("Jogo nao encontrado")))

            viewModel = createViewModel()
            viewModel.loadGameDetails("game-1")
            advanceUntilIdle()

            assertInstanceOf(GameDetailUiState.Error::class.java, viewModel.uiState.value)
        }

        @Test
        @DisplayName("loadGameDetails marca usuario como confirmado")
        fun `loadGameDetails marks user as confirmed`() = runTest(testDispatcher) {
            val confirmationsWithUser = testConfirmations + GameConfirmation(
                gameId = "game-1", userId = "user-1", userName = "Maria", status = "CONFIRMED"
            )
            setupGameFlows(confirmationsResult = Result.success(confirmationsWithUser))

            viewModel = createViewModel()
            viewModel.loadGameDetails("game-1")
            advanceUntilIdle()

            val state = viewModel.uiState.value as GameDetailUiState.Success
            assertTrue(state.isUserConfirmed)
        }

        @Test
        @DisplayName("loadGameDetails marca usuario como PENDING")
        fun `loadGameDetails marks user as pending`() = runTest(testDispatcher) {
            val confirmationsWithUser = listOf(GameConfirmation(
                gameId = "game-1", userId = "user-1", userName = "Maria", status = "PENDING"
            ))
            setupGameFlows(confirmationsResult = Result.success(confirmationsWithUser))

            viewModel = createViewModel()
            viewModel.loadGameDetails("game-1")
            advanceUntilIdle()

            val state = viewModel.uiState.value as GameDetailUiState.Success
            assertFalse(state.isUserConfirmed)
            assertTrue(state.isUserPending)
        }
    }

    @Nested
    @DisplayName("toggleConfirmation")
    inner class ToggleConfirmationTests {

        @Test
        @DisplayName("toggleConfirmation confirma presenca quando nao confirmado")
        fun `toggleConfirmation confirms presence`() = runTest(testDispatcher) {
            val mockConfirmation = mockk<com.futebadosparcas.domain.model.GameConfirmation>(relaxed = true)
            coEvery { gameRepository.confirmPresence(any<String>(), any<String>(), any<Boolean>()) } returns Result.success(mockConfirmation)
            coEvery { gameRepository.cancelConfirmation(any()) } returns Result.success(Unit)
            setupLoadedState()
            advanceUntilIdle()

            viewModel.toggleConfirmation("game-1")
            advanceUntilIdle()

            coVerify { gameRepository.confirmPresence("game-1", PlayerPosition.LINE.name, false) }
        }

        @Test
        @DisplayName("toggleConfirmation cancela confirmacao quando ja confirmado")
        fun `toggleConfirmation cancels confirmation`() = runTest(testDispatcher) {
            coEvery { gameRepository.confirmPresence(any<String>(), any<String>(), any<Boolean>()) } returns Result.success(mockk(relaxed = true))
            coEvery { gameRepository.cancelConfirmation(any()) } returns Result.success(Unit)
            setupLoadedState(isUserConfirmed = true)
            advanceUntilIdle()

            viewModel.toggleConfirmation("game-1")
            advanceUntilIdle()

            coVerify { gameRepository.cancelConfirmation("game-1") }
        }

        @Test
        @DisplayName("convite pendente e recusado sem tentar confirmar")
        fun `decline pending invitation cancels confirmation`() = runTest(testDispatcher) {
            coEvery { gameRepository.cancelConfirmation(any()) } returns Result.success(Unit)
            val pending = listOf(
                GameConfirmation(
                    gameId = "game-1",
                    userId = "user-1",
                    userName = "Maria",
                    status = "PENDING"
                )
            )
            setupGameFlows(confirmationsResult = Result.success(pending))
            viewModel = createViewModel()
            viewModel.loadGameDetails("game-1")
            advanceUntilIdle()

            viewModel.declineInvitation("game-1")
            advanceUntilIdle()

            coVerify(exactly = 1) { gameRepository.cancelConfirmation("game-1") }
            coVerify(exactly = 0) {
                gameRepository.confirmPresence(any<String>(), any<String>(), any<Boolean>())
            }
        }

        @Test
        @DisplayName("toggle trata PENDING defensivamente como cancelamento")
        fun `toggle pending invitation cancels confirmation`() = runTest(testDispatcher) {
            coEvery { gameRepository.cancelConfirmation(any()) } returns Result.success(Unit)
            val pending = listOf(
                GameConfirmation(
                    gameId = "game-1",
                    userId = "user-1",
                    userName = "Maria",
                    status = "PENDING"
                )
            )
            setupGameFlows(confirmationsResult = Result.success(pending))
            viewModel = createViewModel()
            viewModel.loadGameDetails("game-1")
            advanceUntilIdle()

            viewModel.toggleConfirmation("game-1")
            advanceUntilIdle()

            coVerify(exactly = 1) { gameRepository.cancelConfirmation("game-1") }
        }

        @Test
        @DisplayName("toques concorrentes iniciam somente uma confirmacao")
        fun `concurrent confirmation taps start once`() = runTest(testDispatcher) {
            val result = CompletableDeferred<Result<GameConfirmation>>()
            coEvery {
                gameRepository.confirmPresence(any<String>(), any<String>(), any<Boolean>())
            } coAnswers { result.await() }
            setupLoadedState()
            advanceUntilIdle()

            viewModel.toggleConfirmation("game-1")
            runCurrent()
            assertTrue((viewModel.uiState.value as GameDetailUiState.Success).isPresenceSubmitting)

            viewModel.toggleConfirmation("game-1")
            runCurrent()
            coVerify(exactly = 1) {
                gameRepository.confirmPresence("game-1", PlayerPosition.LINE.name, false)
            }

            result.complete(Result.success(mockk(relaxed = true)))
            advanceUntilIdle()
            assertFalse((viewModel.uiState.value as GameDetailUiState.Success).isPresenceSubmitting)
        }

        @Test
        @DisplayName("falha de presenca oferece retry da mesma mutacao")
        fun `presence failure can retry`() = runTest(testDispatcher) {
            coEvery {
                gameRepository.confirmPresence(any<String>(), any<String>(), any<Boolean>())
            } returnsMany listOf(
                Result.failure(IllegalStateException("offline")),
                Result.success(mockk(relaxed = true))
            )
            setupLoadedState()
            advanceUntilIdle()

            viewModel.toggleConfirmation("game-1")
            advanceUntilIdle()
            val failed = viewModel.uiState.value as GameDetailUiState.Success
            assertTrue(failed.canRetryLastMutation)
            assertEquals(R.string.game_detail_error_update_presence_generic, failed.userMessageResId)

            viewModel.retryLastMutation()
            advanceUntilIdle()

            coVerify(exactly = 2) {
                gameRepository.confirmPresence("game-1", PlayerPosition.LINE.name, false)
            }
            assertFalse((viewModel.uiState.value as GameDetailUiState.Success).canRetryLastMutation)
        }
    }

    @Nested
    @DisplayName("removePlayer")
    inner class RemovePlayerTests {

        @Test
        @DisplayName("falha preserva jogador e retry remove apos sucesso")
        fun `remove failure preserves player and retry succeeds`() = runTest(testDispatcher) {
            coEvery { gameRepository.removePlayerFromGame("game-1", "user-3") } returnsMany listOf(
                Result.failure(IllegalStateException("sem rede")),
                Result.success(Unit)
            )
            setupLoadedState()
            advanceUntilIdle()

            viewModel.removePlayer("game-1", "user-3")
            advanceUntilIdle()
            val failed = viewModel.uiState.value as GameDetailUiState.Success
            assertTrue(failed.confirmations.any { it.userId == "user-3" })
            assertTrue(failed.canRetryLastMutation)
            assertEquals(R.string.game_detail_error_remove_player, failed.userMessageResId)

            viewModel.retryLastMutation()
            advanceUntilIdle()
            val succeeded = viewModel.uiState.value as GameDetailUiState.Success

            coVerify(exactly = 2) { gameRepository.removePlayerFromGame("game-1", "user-3") }
            assertFalse(succeeded.confirmations.any { it.userId == "user-3" })
            assertFalse(succeeded.canRetryLastMutation)
        }

        @Test
        @DisplayName("toques repetidos removem o mesmo jogador uma unica vez")
        fun `duplicate remove taps start once`() = runTest(testDispatcher) {
            val result = CompletableDeferred<Result<Unit>>()
            coEvery { gameRepository.removePlayerFromGame("game-1", "user-3") } coAnswers {
                result.await()
            }
            setupLoadedState()
            advanceUntilIdle()

            viewModel.removePlayer("game-1", "user-3")
            runCurrent()
            assertTrue(
                "user-3" in (viewModel.uiState.value as GameDetailUiState.Success).removingPlayerIds
            )
            viewModel.removePlayer("game-1", "user-3")
            runCurrent()

            coVerify(exactly = 1) { gameRepository.removePlayerFromGame("game-1", "user-3") }
            result.complete(Result.success(Unit))
            advanceUntilIdle()
        }
    }

    @Nested
    @DisplayName("deleteGame e restoreGame")
    inner class DeleteAndRestoreTests {

        @Test
        @DisplayName("deleteGame marca jogo como deletado")
        fun `deleteGame marks game as deleted`() = runTest(testDispatcher) {
            coEvery { gameRepository.softDeleteGame(any()) } returns Result.success(Unit)
            setupLoadedState()
            advanceUntilIdle()

            viewModel.deleteGame("game-1")
            advanceUntilIdle()

            assertEquals(GameDetailUiState.GameDeleted, viewModel.uiState.value)
        }

        @Test
        @DisplayName("deleteGame com erro mostra mensagem")
        fun `deleteGame with error shows message`() = runTest(testDispatcher) {
            coEvery { gameRepository.softDeleteGame(any()) } returns Result.failure(RuntimeException("Erro"))
            setupLoadedState()
            advanceUntilIdle()

            viewModel.deleteGame("game-1")
            advanceUntilIdle()

            val state = viewModel.uiState.value as? GameDetailUiState.Success
            assertNotNull(state)
            assertEquals("Erro ao cancelar jogo", state?.userMessage)
        }
    }

    @Nested
    @DisplayName("addToWaitlist e removeFromWaitlist")
    inner class WaitlistTests {

        @Test
        @DisplayName("addToWaitlist adiciona a lista de espera")
        fun `addToWaitlist adds to waitlist`() = runTest(testDispatcher) {
            coEvery { confirmationUseCase.confirmPresence(any(), any(), any()) } returns Result.success(
                ConfirmationResult(success = true, addedToWaitlist = true, waitlistPosition = 2)
            )
            setupLoadedState()
            advanceUntilIdle()

            viewModel.addToWaitlist("game-1", "FIELD")
            advanceUntilIdle()

            val state = viewModel.uiState.value as? GameDetailUiState.Success
            assertNotNull(state)
            assertTrue(state?.userMessage?.contains("lista de espera") == true)
        }

        @Test
        @DisplayName("removeFromWaitlist remove da lista de espera")
        fun `removeFromWaitlist removes from waitlist`() = runTest(testDispatcher) {
            coEvery { waitlistRepository.removeFromWaitlist(any(), any()) } returns Result.success(Unit)
            setupLoadedState()
            advanceUntilIdle()

            viewModel.removeFromWaitlist("game-1")
            advanceUntilIdle()

            coVerify { waitlistRepository.removeFromWaitlist("game-1", "user-1") }
        }
    }

    @Nested
    @DisplayName("markOnTheWay e cancelWithReason")
    inner class PresenceActionsTests {

        @Test
        @DisplayName("markOnTheWay marca como a caminho")
        fun `markOnTheWay marks as on the way`() = runTest(testDispatcher) {
            coEvery { confirmationUseCase.markOnTheWay(any(), any()) } returns Result.success(Unit)
            setupLoadedState()
            advanceUntilIdle()

            viewModel.markOnTheWay("game-1", 15)
            advanceUntilIdle()

            coVerify { confirmationUseCase.markOnTheWay("game-1", 15) }
        }

        @Test
        @DisplayName("cancelWithReason cancela presenca com motivo")
        fun `cancelWithReason cancels presence with reason`() = runTest(testDispatcher) {
            coEvery { confirmationUseCase.cancelWithReason(any(), any(), any()) } returns Result.success(Unit)
            setupLoadedState()
            advanceUntilIdle()

            viewModel.cancelWithReason("game-1", CancellationReason.OTHER, "Trabalho")
            advanceUntilIdle()

            coVerify { confirmationUseCase.cancelWithReason("game-1", CancellationReason.OTHER, "Trabalho") }
        }
    }

    @Nested
    @DisplayName("clearUserMessage")
    inner class ClearMessageTests {

        @Test
        @DisplayName("clearUserMessage limpa mensagem do usuario")
        fun `clearUserMessage clears user message`() = runTest(testDispatcher) {
            setupLoadedState()
            viewModel.loadGameDetails("game-1")
            advanceUntilIdle()

            viewModel.clearUserMessage()
            advanceUntilIdle()

            val clearedState = viewModel.uiState.value as? GameDetailUiState.Success
            assertNull(clearedState?.userMessage)
        }
    }

    private fun setupLoadedState(isUserConfirmed: Boolean = false) {
        if (isUserConfirmed) {
            val confsWithUser = testConfirmations + GameConfirmation(
                gameId = "game-1", userId = "user-1", userName = "Maria", status = "CONFIRMED"
            )
            setupGameFlows(confirmationsResult = Result.success(confsWithUser))
        } else {
            setupGameFlows()
        }
        viewModel = createViewModel()
        viewModel.loadGameDetails("game-1")
    }
}
