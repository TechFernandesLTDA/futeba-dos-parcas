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
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.util.appString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Tela de cadastro por e-mail (`RegisterScreen`). A tela não tem ViewModel próprio: recebe o estado e devolve
 * o envio por callback, então o teste controla o estado direto.
 */
@RunWith(AndroidJUnit4::class)
class RegisterScreenComposeTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private var estado by mutableStateOf<RegisterState>(RegisterState.Idle)
    private var enviado: Triple<String, String, String>? = null
    private var foiParaLogin = 0
    private var foiParaInicio = 0

    private fun abrirTela() {
        composeTestRule.setContent {
            FutebaTheme {
                RegisterScreen(
                    uiState = estado,
                    versionName = "1.0.0",
                    onRegisterWithEmail = { email, senha, nome -> enviado = Triple(email, senha, nome) },
                    onNavigateToLogin = { foiParaLogin++ },
                    onNavigateToMain = { foiParaInicio++ }
                )
            }
        }
    }

    /** O título e o botão têm o mesmo texto: o botão é o que aceita clique. */
    private fun botaoCriarConta(): SemanticsNodeInteraction =
        composeTestRule.onNode(hasText(appString(R.string.auth_register_button)) and hasClickAction())

    private fun preencher(nome: String, email: String, senha: String) {
        composeTestRule.onNodeWithText(appString(R.string.auth_name_label)).performTextInput(nome)
        composeTestRule.onNodeWithText(appString(R.string.auth_email_label)).performTextInput(email)
        composeTestRule.onNodeWithText(appString(R.string.auth_password_label)).performTextInput(senha)
    }

    @Test
    fun formularioVazio_mostraOsCamposEOBotaoDesabilitado() {
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.auth_register_subtitle)).assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.auth_name_label)).assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.auth_email_label)).assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.auth_password_label)).assertIsDisplayed()
        botaoCriarConta().assertIsNotEnabled()
    }

    @Test
    fun dadosValidos_enviamEmailSenhaENome() {
        abrirTela()
        preencher(nome = "Maria Souza", email = "maria@exemplo.com", senha = "segredo123")

        botaoCriarConta().assertIsEnabled().performClick()

        assertEquals(Triple("maria@exemplo.com", "segredo123", "Maria Souza"), enviado)
    }

    @Test
    fun emailInvalido_mostraOErroDoCampoENaoEnvia() {
        abrirTela()
        preencher(nome = "Maria Souza", email = "maria-sem-arroba", senha = "segredo123")

        botaoCriarConta().performClick()

        composeTestRule.onNodeWithText("Email inválido").assertIsDisplayed()
        assertNull(enviado)
    }

    @Test
    fun senhaCurta_mostraOErroDoCampoENaoEnvia() {
        abrirTela()
        preencher(nome = "Maria Souza", email = "maria@exemplo.com", senha = "123")

        botaoCriarConta().performClick()

        composeTestRule.onNodeWithText("Senha deve ter no mínimo 6 caracteres").assertIsDisplayed()
        assertNull(enviado)
    }

    @Test
    fun enviando_desabilitaOBotao() {
        abrirTela()
        preencher(nome = "Maria Souza", email = "maria@exemplo.com", senha = "segredo123")

        estado = RegisterState.Loading

        botaoCriarConta().assertIsNotEnabled()
    }

    @Test
    fun erroDoCadastro_mostraAMensagemDoRecurso() {
        estado = RegisterState.Error(R.string.auth_error_network)

        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.auth_error_network)).assertIsDisplayed()
    }

    @Test
    fun cadastroConcluido_vaiParaATelaInicial() {
        abrirTela()

        estado = RegisterState.Success(User(id = "u1", email = "maria@exemplo.com", name = "Maria Souza"))
        composeTestRule.waitForIdle()

        assertEquals(1, foiParaInicio)
    }

    @Test
    fun jaTenhoConta_vaiParaOLogin() {
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.auth_already_have_account)).performClick()

        assertEquals(1, foiParaLogin)
    }
}
