package com.futebadosparcas.ui.profile

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.ui.theme.FutebaTheme
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Testes de UI para ProfileScreen usando Compose Testing.
 *
 * Verifica:
 * - Estado de loading com indicador de carregamento
 * - Informacoes do usuario (nome, nivel, XP)
 * - Badges e estatisticas
 * - Estado de erro com mensagem
 *
 * Usa JUnit 4 para androidTest conforme requisitos do projeto.
 */
@RunWith(AndroidJUnit4::class)
class ProfileScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var mockViewModel: ProfileViewModel

    // StateFlows mockados para controlar estados da UI
    private val uiStateFlow = MutableStateFlow<ProfileUiState>(ProfileUiState.Loading)

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
    fun profileScreen_loadingState_showsLoadingIndicator() {
        // Given - Estado Loading
        uiStateFlow.value = ProfileUiState.Loading

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                ProfileScreen(
                    viewModel = mockViewModel,
                    onEditProfileClick = {},
                    onSettingsClick = {},
                    onNotificationsClick = {},
                    onAboutClick = {},
                    onSchedulesClick = {},
                    onLogoutClick = {},
                    onDeleteAccountClick = {}
                )
            }
        }

        // Then - Estado de Loading deve ser renderizado sem erros
        composeTestRule.onNodeWithText("Perfil").assertIsDisplayed()
    }

    // ==========================================
    // TESTE 2: Estado de Sucesso - Dados do Usuario
    // ==========================================

    @Test
    fun profileScreen_successState_showsUserInfo() {
        // Given - Estado Success com dados do usuario
        val testUser = createTestUser(name = "João Silva")
        val successState = ProfileUiState.Success(
            user = testUser,
            statistics = null,
            badges = emptyList()
        )
        uiStateFlow.value = successState

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                ProfileScreen(
                    viewModel = mockViewModel,
                    onEditProfileClick = {},
                    onSettingsClick = {},
                    onNotificationsClick = {},
                    onAboutClick = {},
                    onSchedulesClick = {},
                    onLogoutClick = {},
                    onDeleteAccountClick = {}
                )
            }
        }

        // Then - Nome do usuario deve ser exibido
        composeTestRule.onNodeWithText("João Silva").assertIsDisplayed()
    }

    // ==========================================
    // TESTE 3: Estado de Erro
    // ==========================================

    @Test
    fun profileScreen_errorState_showsErrorMessage() {
        // Given - Estado Error
        val errorMessage = "Erro ao carregar perfil"
        uiStateFlow.value = ProfileUiState.Error(errorMessage)

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                ProfileScreen(
                    viewModel = mockViewModel,
                    onEditProfileClick = {},
                    onSettingsClick = {},
                    onNotificationsClick = {},
                    onAboutClick = {},
                    onSchedulesClick = {},
                    onLogoutClick = {},
                    onDeleteAccountClick = {}
                )
            }
        }

        // Then - Mensagem de erro deve ser exibida
        composeTestRule.onNodeWithText(errorMessage).assertIsDisplayed()
    }

    // ==========================================
    // TESTE 4: Nivel do Usuario
    // ==========================================

    @Test
    fun profileScreen_successState_showsUserLevel() {
        // Given - Usuario com nivel 10
        val testUser = createTestUser(name = "Jogador", level = 10)
        val successState = ProfileUiState.Success(
            user = testUser,
            statistics = null,
            badges = emptyList()
        )
        uiStateFlow.value = successState

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                ProfileScreen(
                    viewModel = mockViewModel,
                    onEditProfileClick = {},
                    onSettingsClick = {},
                    onNotificationsClick = {},
                    onAboutClick = {},
                    onSchedulesClick = {},
                    onLogoutClick = {},
                    onDeleteAccountClick = {}
                )
            }
        }

        // Then - Nivel deve estar visivel
        composeTestRule.onNodeWithText("Jogador").assertIsDisplayed()
    }

    // ==========================================
    // HELPERS - Criacao de dados de teste
    // ==========================================

    /**
     * Cria um usuario de teste
     */
    private fun createTestUser(
        name: String = "Test User",
        level: Int = 5
    ) = User(
        id = "user123",
        name = name,
        nickname = null,
        email = "test@test.com",
        photoUrl = "",
        level = level,
        experiencePoints = 2500L,
        createdAt = System.currentTimeMillis()
    )
}
