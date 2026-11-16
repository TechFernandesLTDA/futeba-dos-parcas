package com.futebadosparcas.ui.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.util.appString
import com.futebadosparcas.util.assertTextoAusente
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Tela de login (`LoginScreen`): entrada com Google, formulário de e-mail e senha, e os estados de
 * carregamento, erro e sucesso. A tela não tem ViewModel próprio: recebe o estado e devolve as ações por
 * callback, então o teste controla o estado direto.
 *
 * A tela rola na vertical. `texto()` rola até o elemento antes de conferir ou tocar.
 */
@RunWith(AndroidJUnit4::class)
class LoginScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private var estado by mutableStateOf<LoginState>(LoginState.Idle)

    private var cliquesGoogle = 0
    private var loginPorEmail: Pair<String, String>? = null
    private var emailDaSenhaEsquecida: String? = null
    private var foiParaCadastro = 0
    private var foiParaInicio = 0

    private fun abrirTela() {
        composeTestRule.setContent {
            FutebaTheme {
                LoginScreen(
                    uiState = estado,
                    versionName = VERSAO,
                    onGoogleSignInClick = { cliquesGoogle++ },
                    onEmailPasswordSignIn = { email, senha -> loginPorEmail = email to senha },
                    onForgotPassword = { emailDaSenhaEsquecida = it },
                    onNavigateToRegister = { foiParaCadastro++ },
                    onNavigateToMain = { foiParaInicio++ }
                )
            }
        }
    }

    private fun texto(valor: String): SemanticsNodeInteraction =
        composeTestRule.onNodeWithText(valor).performScrollTo()

    /** O nome do app aparece no título e de novo no rodapé: o título é o primeiro. */
    private fun titulo(): SemanticsNodeInteraction =
        composeTestRule.onAllNodesWithText(appString(R.string.auth_title)).onFirst().performScrollTo()

    private fun botaoGoogle() = texto(appString(R.string.auth_sign_in_google))

    /** No formulário de e-mail, o título do cartão e o botão têm o mesmo texto: o botão é o que aceita clique. */
    private fun botaoEntrar(): SemanticsNodeInteraction =
        composeTestRule.onNode(hasText(appString(R.string.auth_sign_in_title)) and hasClickAction())
            .performScrollTo()

    private fun abrirFormularioDeEmail(email: String = "", senha: String = "") {
        texto(appString(R.string.auth_sign_in_with_email)).performClick()
        if (email.isNotEmpty()) texto(appString(R.string.auth_email_label)).performTextInput(email)
        if (senha.isNotEmpty()) texto(appString(R.string.auth_password_label)).performTextInput(senha)
    }

    // --- Estado inicial ---

    @Test
    fun inicial_mostraMarcaCartaoDeEntradaEVersao() {
        abrirTela()

        composeTestRule.onNodeWithContentDescription(appString(R.string.auth_logo_description))
            .performScrollTo().assertIsDisplayed()
        titulo().assertIsDisplayed()
        texto(appString(R.string.auth_slogan)).assertIsDisplayed()
        texto(appString(R.string.auth_sign_in_title)).assertIsDisplayed()
        texto(appString(R.string.auth_sign_in_description)).assertIsDisplayed()
        texto(appString(R.string.auth_developed_by)).assertIsDisplayed()
        texto(appString(R.string.auth_version, VERSAO)).assertIsDisplayed()
    }

    @Test
    fun inicial_botaoDoGoogleChamaOLogin() {
        abrirTela()

        botaoGoogle().assertIsEnabled().performClick()

        assertEquals(1, cliquesGoogle)
    }

    @Test
    fun inicial_naoTemContaVaiParaOCadastro() {
        abrirTela()

        texto(appString(R.string.auth_no_account_register)).performClick()

        assertEquals(1, foiParaCadastro)
    }

    // --- Carregando, erro e sucesso ---

    @Test
    fun carregando_mostraOAvisoEEscondeOBotaoDoGoogle() {
        estado = LoginState.Loading

        abrirTela()

        texto(appString(R.string.auth_authenticating)).assertIsDisplayed()
        composeTestRule.assertTextoAusente(appString(R.string.auth_sign_in_google))
        titulo().assertIsDisplayed()
    }

    @Test
    fun erro_mostraAMensagemDoRecursoEPermiteTentarDeNovo() {
        estado = LoginState.Error(R.string.auth_error_network)
        abrirTela()

        texto(appString(R.string.auth_error_network)).assertIsDisplayed()
        botaoGoogle().performClick()

        assertEquals(1, cliquesGoogle)
    }

    @Test
    fun sucesso_vaiParaATelaInicialUmaVezSo() {
        estado = LoginState.Success(User(id = "u1", email = "maria@exemplo.com", name = "Maria Souza"))

        abrirTela()
        composeTestRule.waitForIdle()

        assertEquals(1, foiParaInicio)
    }

    @Test
    fun deInicialParaCarregandoParaErro_aTelaAcompanhaOEstado() {
        abrirTela()
        botaoGoogle().assertIsDisplayed()

        estado = LoginState.Loading
        texto(appString(R.string.auth_authenticating)).assertIsDisplayed()
        composeTestRule.assertTextoAusente(appString(R.string.auth_sign_in_google))

        estado = LoginState.Error(R.string.auth_error_invalid_credentials)
        texto(appString(R.string.auth_error_invalid_credentials)).assertIsDisplayed()
        botaoGoogle().assertIsDisplayed()
        composeTestRule.assertTextoAusente(appString(R.string.auth_authenticating))
    }

    // --- Formulário de e-mail e senha ---

    @Test
    fun formularioDeEmail_vazioDeixaEntrarEEsqueciDesabilitados() {
        abrirTela()

        abrirFormularioDeEmail()

        botaoEntrar().assertIsNotEnabled()
        texto(appString(R.string.auth_forgot_password)).assertIsNotEnabled()
        composeTestRule.assertTextoAusente(appString(R.string.auth_sign_in_google))
    }

    @Test
    fun formularioDeEmail_dadosValidosEnviamEmailESenha() {
        abrirTela()
        abrirFormularioDeEmail(email = "maria@exemplo.com", senha = "segredo123")

        botaoEntrar().assertIsEnabled().performClick()

        assertEquals("maria@exemplo.com" to "segredo123", loginPorEmail)
    }

    @Test
    fun formularioDeEmail_emailInvalidoMostraOErroENaoEnvia() {
        abrirTela()
        abrirFormularioDeEmail(email = "maria-sem-arroba", senha = "segredo123")

        botaoEntrar().performClick()

        texto("Email inválido").assertIsDisplayed()
        assertNull(loginPorEmail)
    }

    @Test
    fun formularioDeEmail_esqueciMinhaSenhaEnviaOEmailDigitado() {
        abrirTela()
        abrirFormularioDeEmail(email = "maria@exemplo.com")

        texto(appString(R.string.auth_forgot_password)).performClick()

        assertEquals("maria@exemplo.com", emailDaSenhaEsquecida)
    }

    @Test
    fun formularioDeEmail_carregandoDesabilitaOEntrar() {
        abrirTela()
        abrirFormularioDeEmail(email = "maria@exemplo.com", senha = "segredo123")

        estado = LoginState.Loading

        botaoEntrar().assertIsNotEnabled()
    }

    @Test
    fun formularioDeEmail_voltarParaGoogleMostraOBotaoDoGoogleDeNovo() {
        abrirTela()
        abrirFormularioDeEmail()

        texto(appString(R.string.auth_back_to_google)).performClick()

        botaoGoogle().assertIsDisplayed()
    }

    private companion object {
        const val VERSAO = "1.2.3"
    }
}
