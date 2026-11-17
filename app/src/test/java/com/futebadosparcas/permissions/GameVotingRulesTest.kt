package com.futebadosparcas.permissions

import com.futebadosparcas.data.model.Game as AndroidGame
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.domain.model.MVPVote
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.domain.ranking.MatchFinalizationService
import com.futebadosparcas.domain.repository.GameExperienceRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.ui.game_experience.MVPVoteUiState
import com.futebadosparcas.ui.game_experience.MVPVoteViewModel
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
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import java.util.Date

/**
 * Votação pós-jogo: janela de votação (prazo e conclusão), quem pode ser votado
 * (só quem confirmou presença, nunca o próprio votante), e voto duplicado na mesma cédula.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@ExtendWith(MockLogExtension::class)
class GameVotingRulesTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var gameRepository: GameRepository
    private lateinit var experienceRepository: GameExperienceRepository
    private lateinit var userRepository: UserRepository

    private val jogoFinalizado = Game(id = "game-1", ownerId = "owner-1", status = GameStatus.FINISHED.name)

    private val confirmados = listOf(
        GameConfirmation(gameId = "game-1", userId = "owner-1", userName = "Dono", status = "CONFIRMED"),
        GameConfirmation(
            gameId = "game-1", userId = "gk-1", userName = "Goleiro",
            status = "CONFIRMED", position = "GOALKEEPER"
        ),
        GameConfirmation(gameId = "game-1", userId = "line-1", userName = "Linha", status = "CONFIRMED", position = "LINE"),
        // Inscrito que não confirmou presença: não pode receber voto.
        GameConfirmation(gameId = "game-1", userId = "ausente-1", userName = "Ausente", status = "ABSENT", position = "LINE")
    )

    @BeforeEach
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        gameRepository = mockk()
        experienceRepository = mockk()
        userRepository = mockk()
        coEvery { userRepository.getCurrentUserId() } returns "owner-1"
        every { gameRepository.getGameDetailsFlow("game-1") } returns flowOf(Result.success(jogoFinalizado))
        every { gameRepository.getGameConfirmationsFlow("game-1") } returns flowOf(Result.success(confirmados))
        coEvery { experienceRepository.getUserVoteCategories("game-1", "owner-1") } returns
            Result.success(emptySet())
        coEvery { experienceRepository.submitVote(any()) } returns Result.success(Unit)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel() = MVPVoteViewModel(
        gameRepository,
        experienceRepository,
        userRepository,
        mockk<MatchFinalizationService>(relaxed = true)
    )

    // ---------- Janela de votação (modelo do app) ----------

    private fun jogoComPrazo(prazo: Date?, status: String = GameStatus.FINISHED.name, concluida: Boolean = false) =
        AndroidGame(id = "game-1", status = status, votingDeadline = prazo, votingConcluded = concluida)

    @Test
    fun isVotingOpen_finalizadoDentroDoPrazo_permiteVotar() {
        val jogo = jogoComPrazo(Date(System.currentTimeMillis() + 3_600_000))

        assertTrue(jogo.isVotingOpen())
    }

    @Test
    fun isVotingOpen_prazoVencido_fechaAVotacao() {
        val jogo = jogoComPrazo(Date(System.currentTimeMillis() - 3_600_000))

        assertFalse(jogo.isVotingOpen())
    }

    @Test
    fun isVotingOpen_jogoAindaNaoFinalizadoOuVotacaoConcluida_fechaAVotacao() {
        assertFalse(jogoComPrazo(Date(System.currentTimeMillis() + 3_600_000), status = "LIVE").isVotingOpen())
        assertFalse(jogoComPrazo(Date(System.currentTimeMillis() + 3_600_000), concluida = true).isVotingOpen())
    }

    // ---------- Votos na cédula ----------

    @Test
    fun submitVote_votoValidoEmJogadorConfirmado_enviaUmaVezComVotanteCorreto() = runTest(dispatcher) {
        val viewModel = viewModel()
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        viewModel.submitVote("game-1", "line-1", VoteCategory.MVP)
        advanceUntilIdle()

        coVerify(exactly = 1) {
            experienceRepository.submitVote(match<MVPVote> { voto ->
                voto.voterId == "owner-1" &&
                    voto.votedPlayerId == "line-1" &&
                    voto.category == VoteCategory.MVP
            })
        }
    }

    @Test
    fun submitVote_jogadorQueNaoConfirmou_eIgnoradoSemEnviar() = runTest(dispatcher) {
        val viewModel = viewModel()
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        viewModel.submitVote("game-1", "ausente-1", VoteCategory.MVP)
        advanceUntilIdle()

        coVerify(exactly = 0) { experienceRepository.submitVote(any()) }
        assertInstanceOf(MVPVoteUiState.Voting::class.java, viewModel.uiState.value)
    }

    @Test
    fun submitVote_votarEmSiMesmo_eIgnoradoSemEnviar() = runTest(dispatcher) {
        val viewModel = viewModel()
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        viewModel.submitVote("game-1", "owner-1", VoteCategory.MVP)
        advanceUntilIdle()

        coVerify(exactly = 0) { experienceRepository.submitVote(any()) }
    }

    @Test
    fun submitVote_mesmaCategoriaJaEnviada_naoAceitaVotoDuplicado() = runTest(dispatcher) {
        val viewModel = viewModel()
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        viewModel.submitVote("game-1", "line-1", VoteCategory.MVP)
        advanceUntilIdle()
        // Agora a cédula está em BEST_GOALKEEPER: outro voto MVP não deve ser enviado.
        viewModel.submitVote("game-1", "gk-1", VoteCategory.MVP)
        advanceUntilIdle()

        coVerify(exactly = 1) { experienceRepository.submitVote(any()) }
    }
}
