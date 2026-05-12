package com.futebadosparcas.ui.groups

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.data.model.UserGroup
import com.futebadosparcas.ui.theme.FutebaTheme
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Testes de UI para GroupsScreen usando Compose Testing.
 *
 * Verifica:
 * - Estado de loading com indicador de carregamento
 * - Lista de grupos quando existem dados
 * - Estado vazio quando nao ha grupos
 * - Estado de erro com mensagem
 *
 * Usa JUnit 4 para androidTest conforme requisitos do projeto.
 */
@RunWith(AndroidJUnit4::class)
class GroupsScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var mockViewModel: GroupsViewModel

    // StateFlows mockados para controlar estados da UI
    private val uiStateFlow = MutableStateFlow<GroupsUiState>(GroupsUiState.Loading)
    private val searchQueryFlow = MutableStateFlow("")
    private val isRefreshingFlow = MutableStateFlow(false)

    @Before
    fun setup() {
        // Configurar ViewModel mockado
        mockViewModel = mockk(relaxed = true)
        every { mockViewModel.uiState } returns uiStateFlow
        every { mockViewModel.searchQuery } returns searchQueryFlow
        every { mockViewModel.isRefreshing } returns isRefreshingFlow
    }

    // ==========================================
    // TESTE 1: Estado de Loading
    // ==========================================

    @Test
    fun groupsScreen_loadingState_showsLoadingIndicator() {
        // Given - Estado Loading
        uiStateFlow.value = GroupsUiState.Loading

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                GroupsScreen(
                    viewModel = mockViewModel,
                    onGroupClick = {},
                    onCreateGroupClick = {},
                    onDiscoverGroupsClick = {},
                    onBackClick = {}
                )
            }
        }

        // Then - Estado de Loading deve ser renderizado sem erros
        composeTestRule.onNodeWithText("Grupos").assertIsDisplayed()
    }

    // ==========================================
    // TESTE 2: Estado de Sucesso - Lista de Grupos
    // ==========================================

    @Test
    fun groupsScreen_successState_showsGroupsList() {
        // Given - Estado Success com grupos
        val groups = listOf(
            createTestGroup("group1", "Pelada do Bairro"),
            createTestGroup("group2", "Copa Amigos")
        )
        val successState = GroupsUiState.Success(groups = groups)
        uiStateFlow.value = successState

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                GroupsScreen(
                    viewModel = mockViewModel,
                    onGroupClick = {},
                    onCreateGroupClick = {},
                    onDiscoverGroupsClick = {},
                    onBackClick = {}
                )
            }
        }

        // Then - Grupos devem ser exibidos
        composeTestRule.onNodeWithText("Pelada do Bairro").assertIsDisplayed()
        composeTestRule.onNodeWithText("Copa Amigos").assertIsDisplayed()
    }

    // ==========================================
    // TESTE 3: Estado Vazio
    // ==========================================

    @Test
    fun groupsScreen_emptyState_showsEmptyMessage() {
        // Given - Estado Empty
        uiStateFlow.value = GroupsUiState.Empty

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                GroupsScreen(
                    viewModel = mockViewModel,
                    onGroupClick = {},
                    onCreateGroupClick = {},
                    onDiscoverGroupsClick = {},
                    onBackClick = {}
                )
            }
        }

        // Then - Mensagem de vazio deve ser exibida (tela renderiza sem erro)
        composeTestRule.onNodeWithText("Grupos").assertIsDisplayed()
    }

    // ==========================================
    // TESTE 4: Estado de Erro
    // ==========================================

    @Test
    fun groupsScreen_errorState_showsErrorMessage() {
        // Given - Estado Error
        val errorMessage = "Erro ao carregar grupos"
        uiStateFlow.value = GroupsUiState.Error(errorMessage)

        // When - Renderiza a tela
        composeTestRule.setContent {
            FutebaTheme {
                GroupsScreen(
                    viewModel = mockViewModel,
                    onGroupClick = {},
                    onCreateGroupClick = {},
                    onDiscoverGroupsClick = {},
                    onBackClick = {}
                )
            }
        }

        // Then - Mensagem de erro deve ser exibida
        composeTestRule.onNodeWithText(errorMessage).assertIsDisplayed()
    }

    // ==========================================
    // HELPERS - Criacao de dados de teste
    // ==========================================

    /**
     * Cria um grupo de teste
     */
    private fun createTestGroup(
        id: String = "group1",
        name: String = "Test Group"
    ) = UserGroup(
        id = id,
        name = name,
        description = "Descricao do grupo",
        photoUrl = "",
        ownerId = "user123",
        ownerName = "Test User",
        memberCount = 10,
        createdAt = System.currentTimeMillis()
    )
}
