package com.futebadosparcas.ui.games.owner

import com.futebadosparcas.data.model.BlockedPlayer
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
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
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import java.util.Date

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("BlockedPlayersViewModel Tests")
@ExtendWith(MockLogExtension::class)
class BlockedPlayersViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var gameRepository: GameRepository
    private lateinit var groupRepository: GroupRepository
    private lateinit var authRepository: AuthRepository

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        gameRepository = mockk(relaxed = true)
        groupRepository = mockk(relaxed = true)
        authRepository = mockk(relaxed = true)
        every { authRepository.getCurrentUserId() } returns "current_user_123"
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun load_success_filtersAvailablePlayersAndSetsSuccessState() = runTest(testDispatcher) {
        val gameId = "game_1"
        val groupId = "group_1"
        val mockGame = Game(id = gameId, groupId = groupId)

        val blockedPlayer = BlockedPlayer(
            userId = "user_blocked",
            userName = "Blocked Player",
            reason = "Indisciplina",
            blockedBy = "current_user_123",
            blockedAt = Date()
        )
        val confirmation1 = GameConfirmation(userId = "user_blocked", userName = "Blocked Player")
        val confirmation2 = GameConfirmation(userId = "user_active", userName = "Active Player")

        coEvery { gameRepository.getGameDetails(gameId) } returns Result.success(mockGame)
        coEvery { groupRepository.getBlockedPlayers(groupId) } returns Result.success(listOf(blockedPlayer))
        coEvery { gameRepository.getGameConfirmations(gameId) } returns Result.success(listOf(confirmation1, confirmation2))

        val viewModel = BlockedPlayersViewModel(gameRepository, groupRepository, authRepository)
        viewModel.load(gameId)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is BlockedPlayersUiState.Success)
        val successState = state as BlockedPlayersUiState.Success
        assertEquals(1, successState.blockedPlayers.size)
        assertEquals("user_blocked", successState.blockedPlayers.first().userId)
        assertEquals(1, successState.availablePlayers.size)
        assertEquals("user_active", successState.availablePlayers.first().userId)
    }

    @Test
    fun load_emptyBlockedPlayers_setsSuccessStateWithEmptyList() = runTest(testDispatcher) {
        val gameId = "game_1"
        val groupId = "group_1"
        val mockGame = Game(id = gameId, groupId = groupId)
        val confirmation = GameConfirmation(userId = "user_1", userName = "Player 1")

        coEvery { gameRepository.getGameDetails(gameId) } returns Result.success(mockGame)
        coEvery { groupRepository.getBlockedPlayers(groupId) } returns Result.success(emptyList())
        coEvery { gameRepository.getGameConfirmations(gameId) } returns Result.success(listOf(confirmation))

        val viewModel = BlockedPlayersViewModel(gameRepository, groupRepository, authRepository)
        viewModel.load(gameId)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is BlockedPlayersUiState.Success)
        val successState = state as BlockedPlayersUiState.Success
        assertTrue(successState.blockedPlayers.isEmpty())
        assertEquals(1, successState.availablePlayers.size)
    }

    @Test
    fun load_errorGameNotFound_setsErrorState() = runTest(testDispatcher) {
        val gameId = "game_missing"
        coEvery { gameRepository.getGameDetails(gameId) } returns Result.failure(Exception("Jogo não encontrado"))

        val viewModel = BlockedPlayersViewModel(gameRepository, groupRepository, authRepository)
        viewModel.load(gameId)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is BlockedPlayersUiState.Error)
        assertEquals("Jogo não encontrado", (state as BlockedPlayersUiState.Error).message)
    }

    @Test
    fun load_gameWithoutGroupId_setsErrorState() = runTest(testDispatcher) {
        val gameId = "game_no_group"
        val mockGame = Game(id = gameId, groupId = null)
        coEvery { gameRepository.getGameDetails(gameId) } returns Result.success(mockGame)

        val viewModel = BlockedPlayersViewModel(gameRepository, groupRepository, authRepository)
        viewModel.load(gameId)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is BlockedPlayersUiState.Error)
        assertEquals("Jogo não está vinculado a nenhum grupo", (state as BlockedPlayersUiState.Error).message)
    }

    @Test
    fun load_errorBlockedPlayersFailure_setsErrorState() = runTest(testDispatcher) {
        val gameId = "game_1"
        val groupId = "group_1"
        val mockGame = Game(id = gameId, groupId = groupId)
        coEvery { gameRepository.getGameDetails(gameId) } returns Result.success(mockGame)
        coEvery { groupRepository.getBlockedPlayers(groupId) } returns Result.failure(Exception("Falha de rede"))

        val viewModel = BlockedPlayersViewModel(gameRepository, groupRepository, authRepository)
        viewModel.load(gameId)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is BlockedPlayersUiState.Error)
        assertEquals("Falha de rede", (state as BlockedPlayersUiState.Error).message)
    }

    @Test
    fun blockPlayer_success_callsRepositoryAndReloads() = runTest(testDispatcher) {
        val gameId = "game_1"
        val groupId = "group_1"
        val mockGame = Game(id = gameId, groupId = groupId)

        coEvery { gameRepository.getGameDetails(gameId) } returns Result.success(mockGame)
        coEvery { groupRepository.getBlockedPlayers(groupId) } returns Result.success(emptyList())
        coEvery { gameRepository.getGameConfirmations(gameId) } returns Result.success(emptyList())
        coEvery {
            groupRepository.blockPlayer(groupId, "user_to_block", "Player Name", "Falta repetida", "current_user_123")
        } returns Result.success(Unit)

        val viewModel = BlockedPlayersViewModel(gameRepository, groupRepository, authRepository)
        viewModel.load(gameId)
        advanceUntilIdle()

        viewModel.blockPlayer("user_to_block", "Player Name", "Falta repetida")
        advanceUntilIdle()

        coVerify {
            groupRepository.blockPlayer(groupId, "user_to_block", "Player Name", "Falta repetida", "current_user_123")
        }
        coVerify(exactly = 2) { gameRepository.getGameDetails(gameId) }
    }

    @Test
    fun blockPlayer_failure_setsUserMessage() = runTest(testDispatcher) {
        val gameId = "game_1"
        val groupId = "group_1"
        val mockGame = Game(id = gameId, groupId = groupId)

        coEvery { gameRepository.getGameDetails(gameId) } returns Result.success(mockGame)
        coEvery { groupRepository.getBlockedPlayers(groupId) } returns Result.success(emptyList())
        coEvery { gameRepository.getGameConfirmations(gameId) } returns Result.success(emptyList())
        coEvery {
            groupRepository.blockPlayer(any(), any(), any(), any(), any())
        } returns Result.failure(Exception("Permissão negada"))

        val viewModel = BlockedPlayersViewModel(gameRepository, groupRepository, authRepository)
        viewModel.load(gameId)
        advanceUntilIdle()

        viewModel.blockPlayer("user_to_block", "Player Name", "Falta repetida")
        advanceUntilIdle()

        val state = viewModel.uiState.value as BlockedPlayersUiState.Success
        assertFalse(state.isActionLoading)
        assertEquals("Permissão negada", state.userMessage)
    }

    @Test
    fun unblockPlayer_success_callsRepositoryAndReloads() = runTest(testDispatcher) {
        val gameId = "game_1"
        val groupId = "group_1"
        val mockGame = Game(id = gameId, groupId = groupId)

        coEvery { gameRepository.getGameDetails(gameId) } returns Result.success(mockGame)
        coEvery { groupRepository.getBlockedPlayers(groupId) } returns Result.success(emptyList())
        coEvery { gameRepository.getGameConfirmations(gameId) } returns Result.success(emptyList())
        coEvery { groupRepository.unblockPlayer(groupId, "user_to_unblock") } returns Result.success(Unit)

        val viewModel = BlockedPlayersViewModel(gameRepository, groupRepository, authRepository)
        viewModel.load(gameId)
        advanceUntilIdle()

        viewModel.unblockPlayer("user_to_unblock")
        advanceUntilIdle()

        coVerify { groupRepository.unblockPlayer(groupId, "user_to_unblock") }
        coVerify(exactly = 2) { gameRepository.getGameDetails(gameId) }
    }

    @Test
    fun unblockPlayer_failure_setsUserMessage() = runTest(testDispatcher) {
        val gameId = "game_1"
        val groupId = "group_1"
        val mockGame = Game(id = gameId, groupId = groupId)

        coEvery { gameRepository.getGameDetails(gameId) } returns Result.success(mockGame)
        coEvery { groupRepository.getBlockedPlayers(groupId) } returns Result.success(emptyList())
        coEvery { gameRepository.getGameConfirmations(gameId) } returns Result.success(emptyList())
        coEvery { groupRepository.unblockPlayer(any(), any()) } returns Result.failure(Exception("Erro no servidor"))

        val viewModel = BlockedPlayersViewModel(gameRepository, groupRepository, authRepository)
        viewModel.load(gameId)
        advanceUntilIdle()

        viewModel.unblockPlayer("user_to_unblock")
        advanceUntilIdle()

        val state = viewModel.uiState.value as BlockedPlayersUiState.Success
        assertFalse(state.isActionLoading)
        assertEquals("Erro no servidor", state.userMessage)
    }

    @Test
    fun clearUserMessage_clearsMessageInSuccessState() = runTest(testDispatcher) {
        val gameId = "game_1"
        val groupId = "group_1"
        val mockGame = Game(id = gameId, groupId = groupId)

        coEvery { gameRepository.getGameDetails(gameId) } returns Result.success(mockGame)
        coEvery { groupRepository.getBlockedPlayers(groupId) } returns Result.success(emptyList())
        coEvery { gameRepository.getGameConfirmations(gameId) } returns Result.success(emptyList())
        coEvery { groupRepository.unblockPlayer(any(), any()) } returns Result.failure(Exception("Erro temporário"))

        val viewModel = BlockedPlayersViewModel(gameRepository, groupRepository, authRepository)
        viewModel.load(gameId)
        advanceUntilIdle()

        viewModel.unblockPlayer("user_1")
        advanceUntilIdle()

        val stateBefore = viewModel.uiState.value as BlockedPlayersUiState.Success
        assertEquals("Erro temporário", stateBefore.userMessage)

        viewModel.clearUserMessage()
        val stateAfter = viewModel.uiState.value as BlockedPlayersUiState.Success
        assertNull(stateAfter.userMessage)
    }
}
