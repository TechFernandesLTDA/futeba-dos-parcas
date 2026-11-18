package com.futebadosparcas.ui.groups

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.UserGroup
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
 * Tela "Grupos" (`GroupsScreen`) em cada estado, com o ViewModel substituído por um mock.
 */
@RunWith(AndroidJUnit4::class)
class GroupsScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var viewModel: GroupsViewModel
    private val uiState = MutableStateFlow<GroupsUiState>(GroupsUiState.Loading)
    private val busca = MutableStateFlow("")
    private val atualizando = MutableStateFlow(false)

    private val gruposAbertos = mutableListOf<String>()
    private var criarGrupo = 0
    private var descobrir = 0
    private var voltou = 0

    @Before
    fun setup() {
        viewModel = mockk(relaxed = true)
        every { viewModel.uiState } returns uiState
        every { viewModel.searchQuery } returns busca
        every { viewModel.isRefreshing } returns atualizando
    }

    private fun abrirTela() {
        composeTestRule.setContent {
            FutebaTheme {
                GroupsScreen(
                    viewModel = viewModel,
                    onGroupClick = { gruposAbertos += it },
                    onCreateGroupClick = { criarGrupo++ },
                    onDiscoverGroupsClick = { descobrir++ },
                    onBackClick = { voltou++ }
                )
            }
        }
    }

    @Test
    fun carregando_mostraOTituloSemListaNemEstadoVazio() {
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.cd_groups)).assertIsDisplayed()
        composeTestRule.assertTextoAusente(appString(R.string.fragment_groups_text_2))
        composeTestRule.assertTextoAusente(appString(R.string.error))
    }

    @Test
    fun semGrupos_mostraOConviteEOBotaoCriaGrupo() {
        uiState.value = GroupsUiState.Empty
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.fragment_groups_text_2)).assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.fragment_groups_text_3)).assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.fragment_groups_text_4)).performClick()

        assertEquals(1, criarGrupo)
    }

    @Test
    fun buscaSemResultado_mostraOAvisoELimparBuscaZeraOFiltro() {
        uiState.value = GroupsUiState.Empty
        busca.value = "xyz"
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.fragment_groups_text_5)).assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.groups_clear_search)).performClick()

        verify { viewModel.searchGroups("") }
    }

    @Test
    fun comGrupos_mostraCadaGrupoETocarAbreODetalhe() {
        uiState.value = GroupsUiState.Success(grupos())
        abrirTela()

        composeTestRule.onNodeWithText("Pelada de Quinta").assertIsDisplayed()
        composeTestRule.onNodeWithText("Futebol de Domingo").performClick()

        assertEquals(listOf("g2"), gruposAbertos)
    }

    @Test
    fun comGrupos_botaoFlutuanteCriaGrupo() {
        uiState.value = GroupsUiState.Success(grupos())
        abrirTela()

        composeTestRule
            .onNodeWithContentDescription(appString(R.string.fragment_groups_contentdescription_7))
            .performClick()

        assertEquals(1, criarGrupo)
    }

    @Test
    fun comMenosDeTresGrupos_naoMostraABusca() {
        uiState.value = GroupsUiState.Success(grupos().take(2))

        abrirTela()

        composeTestRule.assertTextoAusente(appString(R.string.fragment_groups_hint_1))
    }

    @Test
    fun comTresGrupos_mostraABusca() {
        uiState.value = GroupsUiState.Success(grupos())

        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.fragment_groups_hint_1)).assertIsDisplayed()
    }

    @Test
    fun erro_mostraAMensagemETentarNovamenteRecarrega() {
        uiState.value = GroupsUiState.Error("Erro ao carregar grupos")
        abrirTela()

        composeTestRule.onNodeWithText("Erro ao carregar grupos").assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.action_try_again)).performClick()

        verify { viewModel.refreshGroups() }
    }

    @Test
    fun barraSuperior_fecharEDescobrirGruposChamamANavegacao() {
        uiState.value = GroupsUiState.Empty
        abrirTela()

        composeTestRule.onNodeWithContentDescription(appString(R.string.close)).performClick()
        composeTestRule.onNodeWithContentDescription(appString(R.string.discover_groups_title)).performClick()

        assertEquals(1, voltou)
        assertEquals(1, descobrir)
    }

    private fun grupos() = listOf(
        grupo("g1", "Pelada de Quinta", GroupMemberRole.OWNER, 15),
        grupo("g2", "Futebol de Domingo", GroupMemberRole.MEMBER, 22),
        grupo("g3", "Racha da Firma", GroupMemberRole.ADMIN, 9)
    )

    private fun grupo(id: String, nome: String, papel: GroupMemberRole, membros: Int) = UserGroup(
        id = id,
        groupId = id,
        groupName = nome,
        role = papel.name,
        memberCount = membros
    )
}
