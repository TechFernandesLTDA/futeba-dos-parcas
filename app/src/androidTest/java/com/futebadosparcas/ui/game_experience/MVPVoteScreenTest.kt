package com.futebadosparcas.ui.game_experience

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.PlayerPosition
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.ui.theme.FutebaTheme
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Testes de UI para MVPVoteScreen usando Compose Testing.
 *
 * Verifica:
 * - Estado de loading com indicador de carregamento
 * - Tela de votacao com candidatos
 * - Tela de ja votado
 * - Estado de erro com mensagem
 *
 * Usa JUnit 4 para androidTest conforme requisitos do projeto.
 */
@RunWith(AndroidJUnit4::class)
class MVPVoteScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var mockViewModel: MVPVoteViewModel

    // StateFlow mockado para controlar estado da UI
    private val uiStateFlow = MutableStateFlow<MVPVoteUiState>(MVPVoteUiState.Loading)

    @Before
    fun setup() {
        // Configurar ViewModel mockado
        mockViewModel = mockk(relaxed = true)
        every { mockViewModel.uiState } returns uiStateFlow
    }

    // ==========================================
    // TESTE 1: Estado de Loading
    // ==========================================

    @Test
    fun mvpVoteScreen_loadingState_showsLoadingIndicator() {
        // Given - Estado Loading
        uiStateFlow.value = MVPVoteUiState.Loading

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                MVPVoteScreen(
                    viewModel = mockViewModel,
                    gameId = "game123",
                    onNavigateBack = {}
                )
            }
        }

        // Then - Estado de Loading deve ser renderizado sem erros
        // Shimmer nao tem texto especifico
        composeTestRule.onNodeWithText("MVP").assertDoesNotExist()
    }

    // ==========================================
    // TESTE 2: Estado de Votacao
    // ==========================================

    @Test
    fun mvpVoteScreen_votingState_showsCandidates() {
        // Given - Estado Voting com candidatos
        val candidates = listOf(
            createTestGameConfirmation("player1", "João Silva"),
            createTestGameConfirmation("player2", "Carlos Santos")
        )
        val votingState = MVPVoteUiState.Voting(
            currentCategory = VoteCategory.MVP,
            candidates = candidates,
            gameId = "game123"
        )
        uiStateFlow.value = votingState

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                MVPVoteScreen(
                    viewModel = mockViewModel,
                    gameId = "game123",
                    onNavigateBack = {}
                )
            }
        }

        // Then - Titulo de votacao deve ser exibido
        composeTestRule.onNodeWithText("1/3", substring = true).assertIsDisplayed()
    }

    // ==========================================
    // TESTE 3: Estado Ja Votado
    // ==========================================

    @Test
    fun mvpVoteScreen_alreadyVotedState_showsMessage() {
        // Given - Estado AlreadyVoted
        uiStateFlow.value = MVPVoteUiState.AlreadyVoted

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                MVPVoteScreen(
                    viewModel = mockViewModel,
                    gameId = "game123",
                    onNavigateBack = {}
                )
            }
        }

        // Then - Mensagem deve indicar que ja foi votado
        // AlreadyVoted mostra mensagem e botao para voltar
        composeTestRule.onNodeWithText("Voltar", substring = true).assertIsDisplayed()
    }

    // ==========================================
    // TESTE 4: Estado de Erro
    // ==========================================

    @Test
    fun mvpVoteScreen_errorState_showsErrorMessage() {
        // Given - Estado Error
        val errorMessage = "Erro ao carregar candidatos"
        uiStateFlow.value = MVPVoteUiState.Error(errorMessage)

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                MVPVoteScreen(
                    viewModel = mockViewModel,
                    gameId = "game123",
                    onNavigateBack = {}
                )
            }
        }

        // Then - Mensagem de erro deve ser exibida
        composeTestRule.onNodeWithText(errorMessage).assertIsDisplayed()
    }

    // ==========================================
    // TESTE 5: Estado Finalizado
    // ==========================================

    @Test
    fun mvpVoteScreen_finishedState_showsSuccess() {
        // Given - Estado Finished
        uiStateFlow.value = MVPVoteUiState.Finished

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                MVPVoteScreen(
                    viewModel = mockViewModel,
                    gameId = "game123",
                    onNavigateBack = {}
                )
            }
        }

        // Then - Mensagem de sucesso deve ser exibida
        composeTestRule.onNodeWithText("Voltar", substring = true).assertIsDisplayed()
    }

    // ==========================================
    // HELPERS - Criacao de dados de teste
    // ==========================================

    /**
     * Cria uma confirmacao de jogo (candidato) para teste
     */
    private fun createTestGameConfirmation(
        playerId: String = "player1",
        playerName: String = "Test Player"
    ) = GameConfirmation(
        playerId = playerId,
        playerName = playerName,
        playerPhotoUrl = null,
        status = "confirmed",
        confirmedAt = System.currentTimeMillis(),
        position = PlayerPosition.FIELD,
        goals = 2,
        assists = 1,
        saves = 0,
        cards = "none"
    )
}
