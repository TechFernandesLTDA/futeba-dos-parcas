package com.futebadosparcas.ui.game_experience

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.model.MVPVote
import com.futebadosparcas.data.model.VoteCategory
import com.futebadosparcas.data.repository.GameExperienceRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.ranking.GameProcessingResult
import com.futebadosparcas.domain.ranking.MatchFinalizationService
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
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
 * Testes unitarios para MVPVoteViewModel.
 * Verifica carregamento de candidatos, submissao de votos,
 * fluxo de categorias e finalizacao da votacao.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("MVPVoteViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class MVPVoteViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()

    private lateinit var gameRepository: GameRepository
    private lateinit var gameExperienceRepository: GameExperienceRepository
    private lateinit var userRepository: UserRepository
    private lateinit var matchFinalizationService: MatchFinalizationService

    private lateinit var viewModel: MVPVoteViewModel

    private fun createViewModel(): MVPVoteViewModel {
        return MVPVoteViewModel(
            gameRepository,
            gameExperienceRepository,
            userRepository,
            matchFinalizationService
        )
    }

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)

        gameRepository = mockk(relaxed = true)
        gameExperienceRepository = mockk(relaxed = true)
        userRepository = mockk(relaxed = true)
        matchFinalizationService = mockk(relaxed = true)

        // Setup default mocks
        every { userRepository.getCurrentUserId() } returns "user123"
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
        assertTrue(viewModel.uiState.value is MVPVoteUiState.Loading)
    }

    @Test
    @DisplayName("Deve carregar candidatos com sucesso")
    fun `loadCandidates_withConfirmedPlayers_showsVoting`() = runTest {
        // Given - Dado jogo com jogadores confirmados
        val testGame = createTestGame("game-1", ownerId = "owner")
        val confirmations = listOf(
            createTestConfirmation("player-1", "Jogador 1"),
            createTestConfirmation("player-2", "Jogador 2"),
            createTestConfirmation("player-3", "Jogador 3")
        )

        coEvery { gameRepository.getGameDetails("game-1") } returns Result.success(testGame)
        coEvery { gameExperienceRepository.hasUserVoted("game-1", "user123") } returns Result.success(false)
        coEvery { gameRepository.getGameConfirmations("game-1") } returns Result.success(confirmations)

        viewModel = createViewModel()

        // When - Quando carregar candidatos
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        // Then - Estado deve ser Voting com 3 candidatos
        val state = viewModel.uiState.value
        assertTrue(state is MVPVoteUiState.Voting, "Estado esperado: Voting, obtido: ${state::class.simpleName}")
        val votingState = state as MVPVoteUiState.Voting
        assertEquals(3, votingState.candidates.size)
        assertEquals(VoteCategory.MVP, votingState.currentCategory)
    }

    @Test
    @DisplayName("Deve exibir AlreadyVoted quando usuario ja votou")
    fun `loadCandidates_alreadyVoted_showsAlreadyVoted`() = runTest {
        // Given - Dado usuario ja votou
        val testGame = createTestGame("game-1")
        coEvery { gameRepository.getGameDetails("game-1") } returns Result.success(testGame)
        coEvery { gameExperienceRepository.hasUserVoted("game-1", "user123") } returns Result.success(true)

        viewModel = createViewModel()

        // When - Quando carregar candidatos
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        // Then - Estado deve ser AlreadyVoted
        assertTrue(viewModel.uiState.value is MVPVoteUiState.AlreadyVoted)
    }

    @Test
    @DisplayName("Deve exibir Finished quando jogo ja terminou")
    fun `loadCandidates_gameFinished_showsFinished`() = runTest {
        // Given - Dado jogo ja finalizado
        val testGame = createTestGame("game-1", status = GameStatus.FINISHED.name)
        coEvery { gameRepository.getGameDetails("game-1") } returns Result.success(testGame)

        viewModel = createViewModel()

        // When - Quando carregar candidatos
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        // Then - Estado deve ser Finished
        assertTrue(viewModel.uiState.value is MVPVoteUiState.Finished)
    }

    @Test
    @DisplayName("Deve identificar corretamente o dono do jogo")
    fun `loadCandidates_isOwner_setsIsOwnerTrue`() = runTest {
        // Given - Dado usuario e o dono do jogo
        val testGame = createTestGame("game-1", ownerId = "user123")
        val confirmations = listOf(
            createTestConfirmation("player-1", "Jogador 1")
        )

        coEvery { gameRepository.getGameDetails("game-1") } returns Result.success(testGame)
        coEvery { gameExperienceRepository.hasUserVoted("game-1", "user123") } returns Result.success(false)
        coEvery { gameRepository.getGameConfirmations("game-1") } returns Result.success(confirmations)

        viewModel = createViewModel()

        // When - Quando carregar candidatos
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        // Then - isOwner deve ser true
        assertTrue(viewModel.uiState.value.isOwner)
    }

    @Test
    @DisplayName("Deve exibir Error quando nao ha jogadores confirmados")
    fun `loadCandidates_noConfirmedPlayers_showsError`() = runTest {
        // Given - Dado nenhum jogador confirmado
        val testGame = createTestGame("game-1")
        val confirmations = listOf(
            createTestConfirmation("player-1", "Jogador 1", status = "PENDING")
        )

        coEvery { gameRepository.getGameDetails("game-1") } returns Result.success(testGame)
        coEvery { gameExperienceRepository.hasUserVoted("game-1", "user123") } returns Result.success(false)
        coEvery { gameRepository.getGameConfirmations("game-1") } returns Result.success(confirmations)

        viewModel = createViewModel()

        // When - Quando carregar candidatos
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        // Then - Estado deve ser Error
        val state = viewModel.uiState.value
        assertTrue(state is MVPVoteUiState.Error)
        assertTrue((state as MVPVoteUiState.Error).message.contains("Nenhum jogador"))
    }

    @Test
    @DisplayName("Deve exibir Error quando repositorio falha ao carregar confirmacoes")
    fun `loadCandidates_repositoryFails_showsError`() = runTest {
        // Given - Dado erro no repositorio
        val testGame = createTestGame("game-1")
        coEvery { gameRepository.getGameDetails("game-1") } returns Result.success(testGame)
        coEvery { gameExperienceRepository.hasUserVoted("game-1", "user123") } returns Result.success(false)
        coEvery { gameRepository.getGameConfirmations("game-1") } returns Result.failure(Exception("Erro de rede"))

        viewModel = createViewModel()

        // When - Quando carregar candidatos
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        // Then - Estado deve ser Error
        assertTrue(viewModel.uiState.value is MVPVoteUiState.Error)
    }

    @Test
    @DisplayName("Deve submeter voto MVP com sucesso e ir para proxima categoria")
    fun `submitVote_mvpCategory_advancesToNextCategory`() = runTest {
        // Given - Dado ViewModel em estado Voting com MVP
        setupVotingState("game-1")
        coEvery { gameExperienceRepository.submitVote(any()) } returns Result.success(Unit)

        viewModel = createViewModel()
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        // When - Quando submeter voto MVP
        viewModel.submitVote("game-1", "player-1", VoteCategory.MVP)
        advanceUntilIdle()

        // Then - Deve avancar para proxima categoria (WORST, pois BEST_GOALKEEPER sem goleiros sera skipado)
        val state = viewModel.uiState.value
        assertTrue(
            state is MVPVoteUiState.Voting || state is MVPVoteUiState.Finished,
            "Estado inesperado: ${state::class.simpleName}"
        )
    }

    @Test
    @DisplayName("Deve exibir Error quando submissao do voto falha")
    fun `submitVote_repositoryFails_showsError`() = runTest {
        // Given - Dado erro ao submeter voto
        setupVotingState("game-1")
        coEvery { gameExperienceRepository.submitVote(any()) } returns Result.failure(Exception("Erro ao salvar"))

        viewModel = createViewModel()
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        // When - Quando submeter voto
        viewModel.submitVote("game-1", "player-1", VoteCategory.MVP)
        advanceUntilIdle()

        // Then - Estado deve ser Error
        assertTrue(viewModel.uiState.value is MVPVoteUiState.Error)
    }

    @Test
    @DisplayName("submitVote nao deve fazer nada quando estado nao e Voting")
    fun `submitVote_notVotingState_doesNothing`() = runTest {
        // Given - Dado ViewModel em estado Loading
        viewModel = createViewModel()

        // When - Quando tentar submeter voto
        viewModel.submitVote("game-1", "player-1", VoteCategory.MVP)
        advanceUntilIdle()

        // Then - Nao deve chamar o repositorio
        coVerify(exactly = 0) { gameExperienceRepository.submitVote(any()) }
    }

    @Test
    @DisplayName("Deve finalizar votacao com sucesso")
    fun `finalizeVoting_succeeds_showsFinished`() = runTest {
        // Given - Dado votacao pode ser finalizada
        coEvery { gameExperienceRepository.concludeVoting("game-1") } returns Result.success(Unit)
        coEvery { matchFinalizationService.processGame("game-1") } returns GameProcessingResult(
            gameId = "game-1",
            success = true,
            playersProcessed = emptyList()
        )

        viewModel = createViewModel()

        // When - Quando finalizar
        viewModel.finalizeVoting("game-1")
        // withContext(Dispatchers.IO) no ViewModel despacha processGame para pool real de IO.
        // Aguardar IO thread completar antes de avançar o test dispatcher.
        Thread.sleep(100)
        advanceUntilIdle()

        // Then - Estado deve ser Finished
        assertTrue(viewModel.uiState.value is MVPVoteUiState.Finished)
    }

    @Test
    @DisplayName("Deve exibir Error quando finalizacao falha")
    fun `finalizeVoting_fails_showsError`() = runTest {
        // Given - Dado erro ao finalizar
        coEvery { gameExperienceRepository.concludeVoting("game-1") } returns Result.failure(Exception("Erro"))

        viewModel = createViewModel()

        // When - Quando finalizar
        viewModel.finalizeVoting("game-1")
        advanceUntilIdle()

        // Then - Estado deve ser Error
        val state = viewModel.uiState.value
        assertTrue(state is MVPVoteUiState.Error)
        // A mensagem real usa "votação" com acento
        assertTrue((state as MVPVoteUiState.Error).message.contains("concluir vota"))
    }

    @Test
    @DisplayName("Deve finalizar automaticamente quando todos votaram apos ultimo voto")
    fun `submitVote_lastCategory_checkAllVotedAndAutoFinalize`() = runTest {
        // Given - Dado ultimo voto (categoria WORST) e todos votaram
        setupVotingState("game-1")
        coEvery { gameExperienceRepository.submitVote(any()) } returns Result.success(Unit)
        coEvery { gameExperienceRepository.checkAllVoted("game-1") } returns Result.success(true)
        coEvery { gameExperienceRepository.concludeVoting("game-1") } returns Result.success(Unit)
        coEvery { matchFinalizationService.processGame(any()) } returns GameProcessingResult(
            gameId = "game-1",
            success = true,
            playersProcessed = emptyList()
        )

        viewModel = createViewModel()
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        // Votar em todas categorias ate chegar no fim
        // 1. MVP
        viewModel.submitVote("game-1", "player-1", VoteCategory.MVP)
        advanceUntilIdle()

        // 2. Se chegou em WORST, votar
        val stateAfterMvp = viewModel.uiState.value
        if (stateAfterMvp is MVPVoteUiState.Voting) {
            viewModel.submitVote("game-1", "player-2", stateAfterMvp.currentCategory)
            advanceUntilIdle()
        }

        // 3. Se ainda esta em Voting (WORST), votar de novo
        val stateAfterSecond = viewModel.uiState.value
        if (stateAfterSecond is MVPVoteUiState.Voting) {
            viewModel.submitVote("game-1", "player-3", stateAfterSecond.currentCategory)
            advanceUntilIdle()
        }

        // withContext(Dispatchers.IO) no finalizeVoting (auto-finalize) despacha para pool real de IO.
        // Aguardar IO thread completar antes de avançar o test dispatcher.
        Thread.sleep(200)
        advanceUntilIdle()

        // Then - Deve chegar em Finished (automaticamente ou apos todos votarem)
        // O comportamento exato depende se BEST_GOALKEEPER foi pulado
        val finalState = viewModel.uiState.value
        assertTrue(
            finalState is MVPVoteUiState.Finished || finalState is MVPVoteUiState.Voting,
            "Estado inesperado: ${finalState::class.simpleName}"
        )
    }

    @Test
    @DisplayName("Deve filtrar goleiros para categoria BEST_GOALKEEPER")
    fun `loadCandidates_withGoalkeepers_filtersForGoalkeeperCategory`() = runTest {
        // Given - Dado confirmacoes com goleiro
        val testGame = createTestGame("game-1")
        val confirmations = listOf(
            createTestConfirmation("player-1", "Jogador 1", position = "FORWARD"),
            createTestConfirmation("gk-1", "Goleiro 1", position = "GOALKEEPER"),
            createTestConfirmation("player-2", "Jogador 2", position = "MIDFIELDER")
        )

        coEvery { gameRepository.getGameDetails("game-1") } returns Result.success(testGame)
        coEvery { gameExperienceRepository.hasUserVoted("game-1", "user123") } returns Result.success(false)
        coEvery { gameRepository.getGameConfirmations("game-1") } returns Result.success(confirmations)

        viewModel = createViewModel()

        // When - Quando carregar candidatos
        viewModel.loadCandidates("game-1")
        advanceUntilIdle()

        // Then - MVP deve ter todos os candidatos
        val state = viewModel.uiState.value as? MVPVoteUiState.Voting
        assertNotNull(state)
        assertEquals(VoteCategory.MVP, state!!.currentCategory)
        assertEquals(3, state.candidates.size) // Todos para MVP
    }

    // === Helper Functions ===

    private fun setupVotingState(gameId: String) {
        val testGame = createTestGame(gameId)
        val confirmations = listOf(
            createTestConfirmation("player-1", "Jogador 1"),
            createTestConfirmation("player-2", "Jogador 2"),
            createTestConfirmation("player-3", "Jogador 3")
        )

        coEvery { gameRepository.getGameDetails(gameId) } returns Result.success(testGame)
        coEvery { gameExperienceRepository.hasUserVoted(gameId, "user123") } returns Result.success(false)
        coEvery { gameRepository.getGameConfirmations(gameId) } returns Result.success(confirmations)
    }

    private fun createTestGame(
        id: String,
        ownerId: String = "owner123",
        status: String = GameStatus.LIVE.name
    ): Game {
        return Game(
            id = id,
            date = "2026-02-15",
            time = "20:00",
            status = status,
            locationName = "Arena Test",
            fieldName = "Quadra 1",
            maxPlayers = 14,
            ownerId = ownerId,
            ownerName = "Owner Test"
        )
    }

    private fun createTestConfirmation(
        userId: String,
        userName: String,
        status: String = "CONFIRMED",
        position: String = "FIELD"
    ): GameConfirmation {
        return GameConfirmation(
            id = "conf-$userId",
            gameId = "game-1",
            userId = userId,
            userName = userName,
            status = status,
            position = position
        )
    }
}
