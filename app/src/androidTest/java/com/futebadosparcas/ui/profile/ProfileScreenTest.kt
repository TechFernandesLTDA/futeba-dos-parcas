package com.futebadosparcas.ui.profile

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasScrollToNodeAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.UserRole
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.util.appString
import com.futebadosparcas.util.assertTextoAusente
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Tela de perfil (`ProfileScreen`) em cada estado, com o ViewModel substituído por um mock.
 *
 * O conteúdo é uma lista preguiçosa: o que fica abaixo da dobra só existe depois de rolar (`rolarAte`).
 */
@RunWith(AndroidJUnit4::class)
class ProfileScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var viewModel: ProfileViewModel
    private val uiState = MutableStateFlow<ProfileUiState>(ProfileUiState.Loading)
    private val meusLocais = MutableStateFlow<List<Location>>(emptyList())
    private val cliques = mutableListOf<String>()

    @Before
    fun setup() {
        viewModel = mockk(relaxed = true)
        every { viewModel.uiState } returns uiState
        every { viewModel.myLocations } returns meusLocais
    }

    private fun abrirTela() {
        composeTestRule.setContent {
            FutebaTheme {
                ProfileScreen(
                    viewModel = viewModel,
                    onEditProfileClick = { cliques += "editar" },
                    onSettingsClick = { cliques += "configuracoes" },
                    onNotificationsClick = { cliques += "notificacoes" },
                    onAboutClick = { cliques += "sobre" },
                    onSchedulesClick = { cliques += "horarios" },
                    onLevelJourneyClick = { cliques += "jornada" },
                    onUserManagementClick = { cliques += "usuarios" },
                    onMyLocationsClick = { cliques += "meus-locais" },
                    onManageLocationsClick = { cliques += "locais" },
                    onFieldOwnerDashboardClick = { cliques += "painel-quadra" },
                    onGamificationSettingsClick = { cliques += "liga" },
                    onConnectedAccountsClick = { cliques += "contas" },
                    onDeveloperMenuClick = { cliques += "dev" },
                    onLogoutClick = { cliques += "sair" }
                )
            }
        }
    }

    /** Rola a lista do perfil até o item com o texto. */
    private fun rolarAte(texto: String) {
        composeTestRule.onAllNodes(hasScrollToNodeAction()).onFirst().performScrollToNode(hasText(texto))
    }

    private fun sucesso(user: User) =
        ProfileUiState.Success(user = user, badges = emptyList(), statistics = null, isDevMode = false)

    @Test
    fun carregando_pedeOPerfilENaoMostraDadosNemErro() {
        abrirTela()

        verify { viewModel.loadProfile() }
        composeTestRule.assertTextoAusente(JOGADOR.name)
        composeTestRule.assertTextoAusente(appString(R.string.retry))
    }

    @Test
    fun perfilCarregado_mostraNomeEEmail() {
        uiState.value = sucesso(JOGADOR)

        abrirTela()

        composeTestRule.onNodeWithText(JOGADOR.name).assertIsDisplayed()
        composeTestRule.onNodeWithText(JOGADOR.email).assertIsDisplayed()
    }

    @Test
    fun perfilCarregado_editarPerfilESairChamamANavegacao() {
        uiState.value = sucesso(JOGADOR)
        abrirTela()

        rolarAte(appString(R.string.edit_profile))
        composeTestRule.onNodeWithText(appString(R.string.edit_profile)).performClick()
        rolarAte(appString(R.string.logout))
        composeTestRule.onNodeWithText(appString(R.string.logout)).performClick()

        assertEquals(listOf("editar", "sair"), cliques)
    }

    @Test
    fun jogadorComum_naoVeOSeloDePapel() {
        uiState.value = sucesso(JOGADOR)

        abrirTela()

        composeTestRule.assertTextoAusente(appString(R.string.profile_role_admin))
        composeTestRule.assertTextoAusente(appString(R.string.profile_role_organizer))
    }

    @Test
    fun administrador_veOSeloEASecaoDeAdministracao() {
        uiState.value = sucesso(JOGADOR.copy(role = UserRole.ADMIN.name))
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.profile_role_admin)).assertIsDisplayed()
        rolarAte(appString(R.string.profile_section_manage_users))
        composeTestRule.onNodeWithText(appString(R.string.profile_section_manage_users)).performClick()

        assertEquals(listOf("usuarios"), cliques)
    }

    @Test
    fun donoDeQuadra_veOPainelMasNaoAGestaoDeUsuarios() {
        uiState.value = sucesso(JOGADOR.copy(role = UserRole.FIELD_OWNER.name))
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.profile_role_organizer)).assertIsDisplayed()
        rolarAte(appString(R.string.field_owner_dashboard))
        composeTestRule.onNodeWithText(appString(R.string.field_owner_dashboard)).performClick()

        assertEquals(listOf("painel-quadra"), cliques)
        composeTestRule.assertTextoAusente(appString(R.string.profile_section_manage_users))
    }

    @Test
    fun erro_mostraAMensagemETentarNovamenteRecarrega() {
        uiState.value = ProfileUiState.Error("Erro ao carregar perfil")
        abrirTela()

        composeTestRule.onNodeWithText("Erro ao carregar perfil").assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.retry)).performClick()

        // Uma chamada ao abrir a tela e outra pelo botão.
        verify(exactly = 2) { viewModel.loadProfile() }
    }

    private companion object {
        val JOGADOR = User(
            id = "user123",
            email = "joao@exemplo.com",
            name = "João Silva",
            level = 5,
            experiencePoints = 1200L
        )
    }
}
