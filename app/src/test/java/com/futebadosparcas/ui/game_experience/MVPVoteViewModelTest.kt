package com.futebadosparcas.ui.game_experience

import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.domain.ranking.MatchFinalizationService
import com.futebadosparcas.domain.repository.GameExperienceRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@OptIn(ExperimentalCoroutinesApi::class)
@ExtendWith(MockLogExtension::class)
class MVPVoteViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var gameRepository: GameRepository
    private lateinit var experienceRepository: GameExperienceRepository
    private lateinit var userRepository: UserRepository
    private lateinit var finalizationService: MatchFinalizationService

    private val finishedGame = Game(
        id = "game-1",
        ownerId = "owner-1",
        status = GameStatus.FINISHED.name
    )
    private val confirmations = listOf(
        GameConfirmation(
            gameId = "game-1",
            userId = "owner-1",
            userName = "Owner",
            status = "CONFIRMED"
        ),
        GameConfirmation(
            gameId = "game-1",
            userId = "gk-1",
            userName = "Goleiro",
            status = "CONFIRMED",
            position = "GOALKEEPER"
        ),
        GameConfirmation(
            gameId = "game-1",
            userId = "line-1",
            userName = "Linha",
            status = "CONFIRMED",
            position = "LINE"
        )
    )

    @BeforeEach
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        gameRepository = mockk()
        experienceRepository = mockk()
        userRepository = mockk()
        finalizationService = mockk(relaxed = true)
        coEvery { userRepository.getCurrentUserId() } returns "owner-1"
        every { gameRepository.getGameDetailsFlow("game-1") } returns
            flowOf(Result.success(finishedGame))
        every { gameRepository.getGameConfirmationsFlow("game-1") } returns
            flowOf(Result.success(confirmations))
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel() = MVPVoteViewModel(
        gameRepository,
        experienceRepository,
        userRepository,
        finalizationService
    )

    @Test
    fun `retoma primeira categoria pendente e exclui o proprio usuario`() =
        runTest(dispatcher) {
            coEvery {
                experienceRepository.getUserVoteCategories("game-1", "owner-1")
            } returns Result.success(setOf(VoteCategory.MVP))

            val viewModel = createViewModel()
            viewModel.loadCandidates("game-1")
            advanceUntilIdle()

            val state = assertInstanceOf(
                MVPVoteUiState.Voting::class.java,
                viewModel.uiState.value
            )
            assertEquals(VoteCategory.BEST_GOALKEEPER, state.currentCategory)
            assertEquals(listOf("gk-1"), state.candidates.map { it.userId })
            assertFalse(state.candidates.any { it.userId == "owner-1" })
        }

    @Test
    fun `marca cedula como completa quando MVP e WORST ja existem`() =
        runTest(dispatcher) {
            coEvery {
                experienceRepository.getUserVoteCategories("game-1", "owner-1")
            } returns Result.success(setOf(VoteCategory.MVP, VoteCategory.WORST))

            val viewModel = createViewModel()
            viewModel.loadCandidates("game-1")
            advanceUntilIdle()

            assertInstanceOf(
                MVPVoteUiState.AlreadyVoted::class.java,
                viewModel.uiState.value
            )
        }

    @Test
    fun `ignora toque duplo enquanto voto esta em envio`() = runTest(dispatcher) {
        coEvery {
            experienceRepository.getUserVoteCategories("game-1", "owner-1")
        } returns Result.success(emptySet())
        coEvery { experienceRepository.submitVote(any()) } returns Result.success(Unit)
        coEvery { experienceRepository.checkAllVoted("game-1") } returns Result.success(false)

        val viewModel = createViewModel()
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        viewModel.submitVote("game-1", "gk-1", VoteCategory.MVP)
        viewModel.submitVote("game-1", "gk-1", VoteCategory.MVP)
        advanceUntilIdle()

        coVerify(exactly = 1) { experienceRepository.submitVote(any()) }
    }
}
