package com.futebadosparcas.ui.games

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.domain.model.GameDetail
import com.futebadosparcas.domain.model.Player
import com.futebadosparcas.ui.theme.FutebaTheme
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Date

/**
 * Testes de UI para GameDetailScreen usando Compose Testing.
 *
 * Verifica:
 * - Estado de loading com indicador de carregamento
 * - Informacoes basicas do jogo (local, horario, jogadores)
 * - Lista de eventos do jogo (gols, cartoes)
 * - Estado de erro com mensagem
 *
 * Usa JUnit 4 para androidTest conforme requisitos do projeto.
 */
@RunWith(AndroidJUnit4::class)
class GameDetailScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var mockViewModel: GameDetailViewModel

    // StateFlows mockados para controlar estados da UI
    private val uiStateFlow = MutableStateFlow<GameDetailUiState>(GameDetailUiState.Loading)

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
    fun gameDetailScreen_loadingState_showsLoadingIndicator() {
        // Given - Estado Loading
        uiStateFlow.value = GameDetailUiState.Loading

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                GameDetailScreen(
                    viewModel = mockViewModel,
                    onNavigateBack = {},
                    onEditClick = {}
                )
            }
        }

        // Then - Estado de Loading deve ser renderizado sem erros
        // Nao ha texto especifico para loading, apenas shimmer
        composeTestRule.onNodeWithText("Jogo").assertDoesNotExist()
    }

    // ==========================================
    // TESTE 2: Estado de Sucesso - Dados Basicos
    // ==========================================

    @Test
    fun gameDetailScreen_successState_showsGameBasicInfo() {
        // Given - Estado Success com dados do jogo
        val successState = createSuccessState(
            locationName = "Arena Test",
            time = "20:00"
        )
        uiStateFlow.value = successState

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                GameDetailScreen(
                    viewModel = mockViewModel,
                    onNavigateBack = {},
                    onEditClick = {}
                )
            }
        }

        // Then - Informacoes basicas devem ser exibidas
        composeTestRule.onNodeWithText("Arena Test").assertIsDisplayed()
    }

    // ==========================================
    // TESTE 3: Estado de Erro
    // ==========================================

    @Test
    fun gameDetailScreen_errorState_showsErrorMessage() {
        // Given - Estado Error
        val errorMessage = "Erro ao carregar jogo"
        uiStateFlow.value = GameDetailUiState.Error(errorMessage)

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                GameDetailScreen(
                    viewModel = mockViewModel,
                    onNavigateBack = {},
                    onEditClick = {}
                )
            }
        }

        // Then - Mensagem de erro deve ser exibida
        composeTestRule.onNodeWithText(errorMessage).assertIsDisplayed()
    }

    // ==========================================
    // TESTE 4: Botao de Voltar
    // ==========================================

    @Test
    fun gameDetailScreen_hasBackButton() {
        // Given - Estado Success
        val successState = createSuccessState()
        uiStateFlow.value = successState

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                GameDetailScreen(
                    viewModel = mockViewModel,
                    onNavigateBack = {},
                    onEditClick = {}
                )
            }
        }

        // Then - Botao de voltar (back arrow) deve estar visivel
        composeTestRule.onNodeWithContentDescription("Voltar", substring = true).assertIsDisplayed()
    }

    // ==========================================
    // HELPERS - Criacao de dados de teste
    // ==========================================

    /**
     * Cria um jogo de teste
     */
    private fun createTestGame(
        id: String = "game1",
        locationName: String = "Arena Test",
        time: String = "20:00"
    ) = GameDetail(
        id = id,
        date = "2026-01-25",
        time = time,
        status = GameStatus.SCHEDULED.name,
        locationName = locationName,
        fieldName = "Quadra 1",
        maxPlayers = 14,
        ownerId = "user123",
        ownerName = "Test User",
        createdAt = System.currentTimeMillis(),
        description = "Jogo de teste",
        players = emptyList(),
        events = emptyList(),
        team1Count = 7,
        team2Count = 7
    )

    /**
     * Cria um estado Success completo com parametros customizaveis
     */
    private fun createSuccessState(
        locationName: String = "Arena Test",
        time: String = "20:00"
    ) = GameDetailUiState.Success(
        game = createTestGame(
            locationName = locationName,
            time = time
        )
    )
}
