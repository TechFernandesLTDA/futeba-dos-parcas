package com.futebadosparcas.ui.livegame

import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.LiveScore
import com.futebadosparcas.domain.model.Team
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.LiveGameRepository
import com.futebadosparcas.domain.usecase.livegame.AddGameEventUseCase
import com.futebadosparcas.domain.usecase.livegame.FinishLiveGameUseCase
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
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
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@OptIn(ExperimentalCoroutinesApi::class)
@ExtendWith(MockLogExtension::class)
class LiveGameViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private lateinit var liveGameRepository: LiveGameRepository
    private lateinit var gameRepository: GameRepository
    private lateinit var authRepository: AuthRepository
    private lateinit var viewModel: LiveGameViewModel

    private val gameFlow = MutableStateFlow(
        Result.success(Game(id = "game-1", ownerId = "owner-1", status = "LIVE"))
    )
    private val scoreFlow = MutableStateFlow<LiveScore?>(
        LiveScore(
            id = "game-1",
            gameId = "game-1",
            team1Id = "team-a",
            team2Id = "team-b"
        )
    )
    private val teamsFlow = MutableStateFlow(
        Result.success(
            listOf(
                Team(id = "team-a", gameId = "game-1", name = "A", playerIds = listOf("p1")),
                Team(id = "team-b", gameId = "game-1", name = "B", playerIds = listOf("p2"))
            )
        )
    )
    private val confirmationsFlow = MutableStateFlow(
        Result.success(
            listOf(
                GameConfirmation(gameId = "game-1", userId = "p1", userName = "Um"),
                GameConfirmation(gameId = "game-1", userId = "p2", userName = "Dois")
            )
        )
    )

    @BeforeEach
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        gameFlow.value = Result.success(
            Game(id = "game-1", ownerId = "owner-1", status = "LIVE")
        )
        scoreFlow.value = LiveScore(
            id = "game-1",
            gameId = "game-1",
            team1Id = "team-a",
            team2Id = "team-b"
        )
        teamsFlow.value = Result.success(
            listOf(
                Team(id = "team-a", gameId = "game-1", name = "A", playerIds = listOf("p1")),
                Team(id = "team-b", gameId = "game-1", name = "B", playerIds = listOf("p2"))
            )
        )
        confirmationsFlow.value = Result.success(
            listOf(
                GameConfirmation(gameId = "game-1", userId = "p1", userName = "Um"),
                GameConfirmation(gameId = "game-1", userId = "p2", userName = "Dois")
            )
        )
        liveGameRepository = mockk(relaxed = true)
        gameRepository = mockk(relaxed = true)
        authRepository = mockk(relaxed = true)

        every { gameRepository.getGameDetailsFlow("game-1") } returns gameFlow
        every { liveGameRepository.observeLiveScore("game-1") } returns scoreFlow
        every { gameRepository.getGameTeamsFlow("game-1") } returns teamsFlow
        every { gameRepository.getGameConfirmationsFlow("game-1") } returns confirmationsFlow
        every { authRepository.getCurrentUserId() } returns "owner-1"

        viewModel = LiveGameViewModel(
            liveGameRepository = liveGameRepository,
            gameRepository = gameRepository,
            authRepository = authRepository,
            addGameEventUseCase = mockk<AddGameEventUseCase>(relaxed = true),
            finishLiveGameUseCase = mockk<FinishLiveGameUseCase>(relaxed = true)
        )
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `combina jogo placar times e confirmacoes sem refetch`() = runTest(dispatcher) {
        viewModel.loadGame("game-1")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertInstanceOf(LiveGameUiState.Success::class.java, state)
        state as LiveGameUiState.Success
        assertEquals(listOf("p1"), state.team1Players.map { it.userId })
        assertEquals(listOf("p2"), state.team2Players.map { it.userId })
        assertEquals(true, state.isOwner)
        coVerify(exactly = 0) { gameRepository.getGameTeams(any()) }
        coVerify(exactly = 0) { gameRepository.getGameConfirmations(any()) }
    }

    @Test
    fun `documento de placar ausente mantem loading ate emissao real`() = runTest(dispatcher) {
        scoreFlow.value = null
        viewModel.loadGame("game-1")
        advanceUntilIdle()

        assertInstanceOf(LiveGameUiState.Loading::class.java, viewModel.uiState.value)

        scoreFlow.value = LiveScore(
            id = "game-1",
            gameId = "game-1",
            team1Id = "team-a",
            team2Id = "team-b"
        )
        advanceUntilIdle()

        assertInstanceOf(LiveGameUiState.Success::class.java, viewModel.uiState.value)
    }

    @Test
    fun `id de time ausente no placar produz erro em vez de fallback alfabetico`() = runTest(dispatcher) {
        scoreFlow.value = LiveScore(
            id = "game-1",
            gameId = "game-1",
            team1Id = "team-inexistente",
            team2Id = "team-b",
            team1Score = 4,
            team2Score = 1
        )

        viewModel.loadGame("game-1")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertInstanceOf(LiveGameUiState.Error::class.java, state)
        assertEquals(
            "Placar indisponível: times vinculados não foram encontrados.",
            (state as LiveGameUiState.Error).message
        )
    }

    @Test
    fun `mesmo time nos dois lados do placar produz erro`() = runTest(dispatcher) {
        scoreFlow.value = LiveScore(
            id = "game-1",
            gameId = "game-1",
            team1Id = "team-a",
            team2Id = "team-a",
            team1Score = 2,
            team2Score = 2
        )

        viewModel.loadGame("game-1")
        advanceUntilIdle()

        assertInstanceOf(LiveGameUiState.Error::class.java, viewModel.uiState.value)
    }

    @Test
    fun `rajada fora de ordem converge para o snapshot mais recente sem refetch`() = runTest(dispatcher) {
        viewModel.loadGame("game-1")
        advanceUntilIdle()

        repeat(100) { score ->
            scoreFlow.value = LiveScore(
                id = "game-1",
                gameId = "game-1",
                team1Id = "team-b",
                team2Id = "team-a",
                team1Score = score,
                team2Score = score / 2
            )
        }
        confirmationsFlow.value = Result.success(
            confirmationsFlow.value.getOrThrow() +
                GameConfirmation(gameId = "game-1", userId = "p3", userName = "Tres")
        )
        teamsFlow.value = Result.success(
            listOf(
                Team(
                    id = "team-a",
                    gameId = "game-1",
                    name = "A",
                    playerIds = listOf("p1")
                ),
                Team(
                    id = "team-b",
                    gameId = "game-1",
                    name = "B",
                    playerIds = listOf("p2", "p3")
                )
            )
        )
        advanceUntilIdle()

        val state = viewModel.uiState.value as LiveGameUiState.Success
        assertEquals("team-b", state.team1.id)
        assertEquals(99, state.score.team1Score)
        assertEquals(listOf("p2", "p3"), state.team1Players.map { it.userId })
        coVerify(exactly = 0) { gameRepository.getGameTeams(any()) }
        coVerify(exactly = 0) { gameRepository.getGameConfirmations(any()) }
    }
}
