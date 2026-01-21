package com.futebadosparcas.ui.auth

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.ui.theme.FutebaTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Testes de UI para a tela de Login usando Jetpack Compose Testing.
 *
 * Valida:
 * - Estado inicial (Idle) mostra botao de login
 * - Estado de carregamento (Loading) mostra progress indicator
 * - Estado de erro (Error) mostra mensagem de erro
 * - Estado de sucesso (Success) dispara callback de navegacao
 * - Interacao com botao do Google
 */
@RunWith(AndroidJUnit4::class)
class LoginScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var context: android.content.Context

    // Strings de recursos usadas na tela
    private lateinit var appTitle: String
    private lateinit var slogan: String
    private lateinit var signInTitle: String
    private lateinit var signInDescription: String
    private lateinit var googleSignInText: String
    private lateinit var authenticatingText: String
    private lateinit var logoDescription: String

    @Before
    fun setup() {
        context = InstrumentationRegistry.getInstrumentation().targetContext

        // Carrega strings de recursos para usar nos testes
        appTitle = context.getString(R.string.auth_title)
        slogan = context.getString(R.string.auth_slogan)
        signInTitle = context.getString(R.string.auth_sign_in_title)
        signInDescription = context.getString(R.string.auth_sign_in_description)
        googleSignInText = context.getString(R.string.auth_sign_in_google)
        authenticatingText = context.getString(R.string.auth_authenticating)
        logoDescription = context.getString(R.string.auth_logo_description)
    }

    // ==================== Testes de Estado Idle ====================

    @Test
    fun loginScreen_idleState_showsAppTitleAndSlogan() {
        // Given - Estado inicial (Idle)
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Idle,
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Verifica titulo e slogan do app
        composeTestRule
            .onNodeWithText(appTitle)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText(slogan)
            .assertIsDisplayed()
    }

    @Test
    fun loginScreen_idleState_showsSignInCard() {
        // Given - Estado inicial (Idle)
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Idle,
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Verifica conteudo do card de login
        composeTestRule
            .onNodeWithText(signInTitle)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText(signInDescription)
            .assertIsDisplayed()
    }

    @Test
    fun loginScreen_idleState_showsGoogleSignInButton() {
        // Given - Estado inicial (Idle)
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Idle,
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Verifica botao de login com Google
        composeTestRule
            .onNodeWithText(googleSignInText)
            .assertIsDisplayed()
            .assertIsEnabled()
    }

    @Test
    fun loginScreen_idleState_showsVersionNumber() {
        // Given - Estado inicial com versao especifica
        val versionName = "1.4.0"
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Idle,
                    versionName = versionName,
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Verifica que a versao esta exibida
        val versionText = context.getString(R.string.auth_version, versionName)
        composeTestRule
            .onNodeWithText(versionText)
            .assertIsDisplayed()
    }

    @Test
    fun loginScreen_idleState_showsLogo() {
        // Given - Estado inicial (Idle)
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Idle,
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Verifica logo do app via content description
        composeTestRule
            .onNodeWithContentDescription(logoDescription)
            .assertIsDisplayed()
    }

    // ==================== Testes de Interacao ====================

    @Test
    fun loginScreen_googleSignInButtonClick_triggersCallback() {
        // Given - Flag para verificar se callback foi chamado
        val callbackCalled = AtomicBoolean(false)

        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Idle,
                    versionName = "1.0.0",
                    onGoogleSignInClick = { callbackCalled.set(true) },
                    onNavigateToMain = {}
                )
            }
        }

        // When - Clica no botao de login
        composeTestRule
            .onNodeWithText(googleSignInText)
            .performClick()

        // Then - Callback deve ter sido chamado
        assertThat(callbackCalled.get()).isTrue()
    }

    // ==================== Testes de Estado Loading ====================

    @Test
    fun loginScreen_loadingState_showsProgressIndicator() {
        // Given - Estado de carregamento
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Loading,
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Verifica que texto de autenticando esta visivel
        composeTestRule
            .onNodeWithText(authenticatingText)
            .assertIsDisplayed()
    }

    @Test
    fun loginScreen_loadingState_hidesGoogleSignInButton() {
        // Given - Estado de carregamento
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Loading,
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Botao do Google nao deve estar visivel durante loading
        // Nota: Usando assertDoesNotExist porque o AnimatedVisibility remove o node
        composeTestRule
            .onNodeWithText(googleSignInText)
            .assertIsNotDisplayed()
    }

    @Test
    fun loginScreen_loadingState_stillShowsAppTitle() {
        // Given - Estado de carregamento
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Loading,
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Titulo do app ainda deve estar visivel
        composeTestRule
            .onNodeWithText(appTitle)
            .assertIsDisplayed()
    }

    // ==================== Testes de Estado Error ====================

    @Test
    fun loginScreen_errorState_showsErrorMessage() {
        // Given - Estado de erro com mensagem
        val errorMessage = "Falha na autenticacao com Google"
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Error(errorMessage),
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Verifica que a mensagem de erro esta visivel
        composeTestRule
            .onNodeWithText(errorMessage)
            .assertIsDisplayed()
    }

    @Test
    fun loginScreen_errorState_stillShowsGoogleSignInButton() {
        // Given - Estado de erro
        val errorMessage = "Erro de conexao"
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Error(errorMessage),
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Botao de login ainda deve estar visivel para retry
        composeTestRule
            .onNodeWithText(googleSignInText)
            .assertIsDisplayed()
    }

    @Test
    fun loginScreen_errorState_allowsRetry() {
        // Given - Estado de erro e flag para verificar retry
        val retryClicked = AtomicBoolean(false)
        val errorMessage = "Erro temporario"

        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Error(errorMessage),
                    versionName = "1.0.0",
                    onGoogleSignInClick = { retryClicked.set(true) },
                    onNavigateToMain = {}
                )
            }
        }

        // When - Usuario clica para tentar novamente
        composeTestRule
            .onNodeWithText(googleSignInText)
            .performClick()

        // Then - Callback de retry deve ser chamado
        assertThat(retryClicked.get()).isTrue()
    }

    @Test
    fun loginScreen_errorState_displaysMultipleErrorTypes() {
        // Testa diferentes tipos de mensagens de erro

        val errorMessages = listOf(
            "Erro de rede",
            "Token invalido",
            "Usuario cancelou autenticacao",
            "Conta Google desconhecida"
        )

        errorMessages.forEach { errorMessage ->
            composeTestRule.setContent {
                FutebaTheme {
                    LoginScreen(
                        uiState = LoginState.Error(errorMessage),
                        versionName = "1.0.0",
                        onGoogleSignInClick = {},
                        onNavigateToMain = {}
                    )
                }
            }

            // Verifica que a mensagem especifica esta visivel
            composeTestRule
                .onNodeWithText(errorMessage)
                .assertIsDisplayed()
        }
    }

    // ==================== Testes de Estado Success ====================

    @Test
    fun loginScreen_successState_triggersNavigationCallback() {
        // Given - Flag para verificar navegacao
        val navigationCalled = AtomicBoolean(false)
        val testUser = createTestUser()

        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Success(testUser),
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = { navigationCalled.set(true) }
                )
            }
        }

        // Then - Aguarda e verifica que navegacao foi chamada
        composeTestRule.waitForIdle()
        assertThat(navigationCalled.get()).isTrue()
    }

    @Test
    fun loginScreen_successState_navigatesOnlyOnce() {
        // Given - Contador de chamadas de navegacao
        var navigationCount = 0
        val testUser = createTestUser()

        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Success(testUser),
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = { navigationCount++ }
                )
            }
        }

        // Then - Navegacao deve ser chamada exatamente uma vez
        composeTestRule.waitForIdle()
        assertThat(navigationCount).isEqualTo(1)
    }

    // ==================== Testes de Transicao de Estado ====================

    @Test
    fun loginScreen_transitionFromIdleToLoading_updatesUI() {
        // Given - Estado inicial Idle
        var currentState: LoginState = LoginState.Idle

        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = currentState,
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Botao Google visivel
        composeTestRule
            .onNodeWithText(googleSignInText)
            .assertIsDisplayed()

        // When - Transicao para Loading
        currentState = LoginState.Loading
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = currentState,
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Texto de autenticando visivel, botao oculto
        composeTestRule
            .onNodeWithText(authenticatingText)
            .assertIsDisplayed()
    }

    @Test
    fun loginScreen_transitionFromLoadingToError_showsErrorAndButton() {
        // Given - Estado de Loading
        var currentState: LoginState = LoginState.Loading
        val errorMessage = "Autenticacao falhou"

        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = currentState,
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // When - Transicao para Error
        currentState = LoginState.Error(errorMessage)
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = currentState,
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Erro e botao visiveis
        composeTestRule
            .onNodeWithText(errorMessage)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText(googleSignInText)
            .assertIsDisplayed()
    }

    // ==================== Testes de Footer ====================

    @Test
    fun loginScreen_showsDeveloperInfo() {
        // Given
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = LoginState.Idle,
                    versionName = "1.0.0",
                    onGoogleSignInClick = {},
                    onNavigateToMain = {}
                )
            }
        }

        // Then - Verifica informacoes do desenvolvedor
        val developedByText = context.getString(R.string.auth_developed_by)
        val developerName = context.getString(R.string.auth_developer_name)

        composeTestRule
            .onNodeWithText(developedByText)
            .assertIsDisplayed()

        composeTestRule
            .onNodeWithText(developerName)
            .assertIsDisplayed()
    }

    // ==================== Helpers ====================

    /**
     * Cria um usuario de teste para os testes de sucesso.
     */
    private fun createTestUser(
        id: String = "test-user-id",
        name: String = "Usuario Teste",
        email: String = "teste@futebadosparcas.com"
    ) = User(
        id = id,
        name = name,
        email = email
    )
}
