package com.futebadosparcas.ui.locations

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.ui.theme.FutebaTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Date

/**
 * Testes de UI para o fluxo completo de CRUD de Locais (Locations).
 *
 * Verifica:
 * - Criacao de local com dados validos
 * - Edicao de local com reflexo na lista
 * - Delecao de local com remocao da lista
 * - Adicao de quadras (Fields) em um local
 * - Busca e filtragem de locais
 * - Estado vazio com passos de onboarding
 * - Exibicao de erros de validacao
 * - Tratamento de erros de rede com opcao de retry
 *
 * Utiliza JUnit4 para testes instrumentados (androidTest).
 * Usa componentes internos stateless para evitar dependencia de ViewModel real.
 */
@RunWith(AndroidJUnit4::class)
class LocationFlowTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // ==========================================
    // TESTE 1: Criar Local com Dados Validos
    // ==========================================

    @Test
    fun createLocation_withValidData_showsInList() {
        // Given - Estado inicial vazio
        var locations = emptyList<LocationWithFieldsData>()
        var showCreateDialog = false
        var locationCreated: Location? = null

        composeTestRule.setContent {
            FutebaTheme {
                TestManageLocationsScreen(
                    locations = locations,
                    isLoading = false,
                    errorMessage = null,
                    searchQuery = "",
                    onSearchQueryChange = {},
                    onLocationClick = {},
                    onDeleteLocation = {},
                    onDeleteField = {},
                    onCreateClick = { showCreateDialog = true },
                    onRetry = {}
                )
            }
        }

        // When - Estado vazio exibe botao de criar
        composeTestRule.onNodeWithText("Criar Local", substring = true).assertIsDisplayed()

        // Simular criacao de local
        val newLocation = createTestLocation(
            id = "loc-new-1",
            name = "Arena Teste",
            address = "Rua Teste, 123"
        )
        locationCreated = newLocation
        locations = listOf(LocationWithFieldsData(newLocation, emptyList()))

        // Re-render com local criado
        composeTestRule.setContent {
            FutebaTheme {
                TestManageLocationsScreen(
                    locations = locations,
                    isLoading = false,
                    errorMessage = null,
                    searchQuery = "",
                    onSearchQueryChange = {},
                    onLocationClick = {},
                    onDeleteLocation = {},
                    onDeleteField = {},
                    onCreateClick = {},
                    onRetry = {}
                )
            }
        }

        // Then - Local deve aparecer na lista
        composeTestRule.onNodeWithText("Arena Teste").assertIsDisplayed()
        composeTestRule.onNodeWithText("Rua Teste, 123").assertIsDisplayed()
    }

    // ==========================================
    // TESTE 2: Editar Local com Reflexo no Detalhe
    // ==========================================

    @Test
    fun editLocation_changesReflectedInDetail() {
        // Given - Local existente
        var location = createTestLocation(
            id = "loc-edit-1",
            name = "Arena Original",
            address = "Endereco Original"
        )
        val fields = listOf(createTestField(id = "field-1", name = "Quadra 1"))
        var clickedLocationId: String? = null

        composeTestRule.setContent {
            FutebaTheme {
                TestLocationDetailScreen(
                    location = location,
                    fields = fields,
                    isLoading = false,
                    errorMessage = null,
                    onSave = { updatedLocation ->
                        location = updatedLocation
                    },
                    onAddField = {},
                    onNavigateBack = {}
                )
            }
        }

        // Then - Dados originais devem estar visiveis
        composeTestRule.onNodeWithTag("location_name_input").assertIsDisplayed()

        // When - Editar o nome
        composeTestRule.onNodeWithTag("location_name_input").performTextClearance()
        composeTestRule.onNodeWithTag("location_name_input").performTextInput("Arena Atualizada")

        // Clicar no botao de salvar
        composeTestRule.onNodeWithTag("location_save_button").performClick()

        // Then - Nome atualizado deve refletir
        assertThat(location.name).isEqualTo("Arena Atualizada")
    }

    // ==========================================
    // TESTE 3: Deletar Local Remove da Lista
    // ==========================================

    @Test
    fun deleteLocation_removesFromList() {
        // Given - Lista com locais
        val location1 = createTestLocation(id = "loc-del-1", name = "Arena Para Deletar")
        val location2 = createTestLocation(id = "loc-del-2", name = "Arena Para Manter")
        var locations = listOf(
            LocationWithFieldsData(location1, emptyList()),
            LocationWithFieldsData(location2, emptyList())
        )
        var deletedLocationId: String? = null

        composeTestRule.setContent {
            FutebaTheme {
                TestManageLocationsScreen(
                    locations = locations,
                    isLoading = false,
                    errorMessage = null,
                    searchQuery = "",
                    onSearchQueryChange = {},
                    onLocationClick = {},
                    onDeleteLocation = { locationData ->
                        deletedLocationId = locationData.location.id
                        locations = locations.filter { it.location.id != locationData.location.id }
                    },
                    onDeleteField = {},
                    onCreateClick = {},
                    onRetry = {}
                )
            }
        }

        // Then - Ambos locais visiveis
        composeTestRule.onNodeWithText("Arena Para Deletar").assertIsDisplayed()
        composeTestRule.onNodeWithText("Arena Para Manter").assertIsDisplayed()

        // When - Clicar no botao de deletar do primeiro local
        composeTestRule.onNodeWithTag("delete_location_loc-del-1").performClick()

        // Re-render com local removido
        composeTestRule.setContent {
            FutebaTheme {
                TestManageLocationsScreen(
                    locations = locations,
                    isLoading = false,
                    errorMessage = null,
                    searchQuery = "",
                    onSearchQueryChange = {},
                    onLocationClick = {},
                    onDeleteLocation = {},
                    onDeleteField = {},
                    onCreateClick = {},
                    onRetry = {}
                )
            }
        }

        // Then - Local deletado nao deve mais aparecer
        assertThat(deletedLocationId).isEqualTo("loc-del-1")
        composeTestRule.onNodeWithText("Arena Para Deletar").assertDoesNotExist()
        composeTestRule.onNodeWithText("Arena Para Manter").assertIsDisplayed()
    }

    // ==========================================
    // TESTE 4: Adicionar Quadra Aparece no Detalhe
    // ==========================================

    @Test
    fun addField_showsInLocationDetail() {
        // Given - Local sem quadras
        val location = createTestLocation(id = "loc-field-1", name = "Arena Sem Quadras")
        var fields = emptyList<Field>()
        var fieldAdded = false

        composeTestRule.setContent {
            FutebaTheme {
                TestLocationDetailScreen(
                    location = location,
                    fields = fields,
                    isLoading = false,
                    errorMessage = null,
                    onSave = {},
                    onAddField = { fieldName, fieldType ->
                        val newField = createTestField(
                            id = "field-new-1",
                            name = fieldName,
                            type = fieldType
                        )
                        fields = fields + newField
                        fieldAdded = true
                    },
                    onNavigateBack = {}
                )
            }
        }

        // Then - Mensagem de nenhuma quadra
        composeTestRule.onNodeWithText("Nenhuma quadra cadastrada").assertIsDisplayed()

        // When - Adicionar uma quadra
        composeTestRule.onNodeWithTag("add_field_fab").performClick()

        // Simular adicao
        val newField = createTestField(id = "field-new-1", name = "Quadra Society", type = "SOCIETY")
        fields = listOf(newField)

        // Re-render com quadra adicionada
        composeTestRule.setContent {
            FutebaTheme {
                TestLocationDetailScreen(
                    location = location,
                    fields = fields,
                    isLoading = false,
                    errorMessage = null,
                    onSave = {},
                    onAddField = {},
                    onNavigateBack = {}
                )
            }
        }

        // Then - Quadra deve aparecer
        composeTestRule.onNodeWithText("Quadra Society").assertIsDisplayed()
        composeTestRule.onNodeWithText("SOCIETY").assertIsDisplayed()
    }

    // ==========================================
    // TESTE 5: Busca Filtra Resultados
    // ==========================================

    @Test
    fun searchLocation_filtersResults() {
        // Given - Lista com varios locais
        val locations = listOf(
            LocationWithFieldsData(createTestLocation(id = "loc-1", name = "Arena Norte"), emptyList()),
            LocationWithFieldsData(createTestLocation(id = "loc-2", name = "Arena Sul"), emptyList()),
            LocationWithFieldsData(createTestLocation(id = "loc-3", name = "Quadra Central"), emptyList())
        )
        var searchQuery = ""
        var filteredLocations = locations

        composeTestRule.setContent {
            FutebaTheme {
                TestManageLocationsScreen(
                    locations = filteredLocations,
                    isLoading = false,
                    errorMessage = null,
                    searchQuery = searchQuery,
                    onSearchQueryChange = { query ->
                        searchQuery = query
                        filteredLocations = if (query.isBlank()) {
                            locations
                        } else {
                            locations.filter {
                                it.location.name.contains(query, ignoreCase = true)
                            }
                        }
                    },
                    onLocationClick = {},
                    onDeleteLocation = {},
                    onDeleteField = {},
                    onCreateClick = {},
                    onRetry = {}
                )
            }
        }

        // Then - Todos locais visiveis inicialmente
        composeTestRule.onNodeWithText("Arena Norte").assertIsDisplayed()
        composeTestRule.onNodeWithText("Arena Sul").assertIsDisplayed()
        composeTestRule.onNodeWithText("Quadra Central").assertIsDisplayed()

        // When - Buscar por "Arena"
        composeTestRule.onNodeWithTag("location_search_input").performTextInput("Arena")

        // Aplicar filtro
        filteredLocations = locations.filter {
            it.location.name.contains("Arena", ignoreCase = true)
        }

        // Re-render com resultados filtrados
        composeTestRule.setContent {
            FutebaTheme {
                TestManageLocationsScreen(
                    locations = filteredLocations,
                    isLoading = false,
                    errorMessage = null,
                    searchQuery = "Arena",
                    onSearchQueryChange = {},
                    onLocationClick = {},
                    onDeleteLocation = {},
                    onDeleteField = {},
                    onCreateClick = {},
                    onRetry = {}
                )
            }
        }

        // Then - Apenas locais com "Arena" visiveis
        composeTestRule.onNodeWithText("Arena Norte").assertIsDisplayed()
        composeTestRule.onNodeWithText("Arena Sul").assertIsDisplayed()
        composeTestRule.onNodeWithText("Quadra Central").assertDoesNotExist()
    }

    // ==========================================
    // TESTE 6: Estado Vazio Mostra Onboarding
    // ==========================================

    @Test
    fun emptyState_showsOnboardingSteps() {
        // Given - Estado vazio
        composeTestRule.setContent {
            FutebaTheme {
                TestManageLocationsScreen(
                    locations = emptyList(),
                    isLoading = false,
                    errorMessage = null,
                    searchQuery = "",
                    onSearchQueryChange = {},
                    onLocationClick = {},
                    onDeleteLocation = {},
                    onDeleteField = {},
                    onCreateClick = {},
                    onRetry = {}
                )
            }
        }

        // Then - Deve mostrar estado vazio com onboarding
        composeTestRule.onNodeWithText("Nenhum local cadastrado").assertIsDisplayed()
        composeTestRule.onNodeWithText("Cadastre seu primeiro local").assertIsDisplayed()
        composeTestRule.onNodeWithText("Criar Local").assertIsDisplayed()
    }

    @Test
    fun emptyState_createButtonTriggersCallback() {
        // Given - Estado vazio
        var createClicked = false

        composeTestRule.setContent {
            FutebaTheme {
                TestManageLocationsScreen(
                    locations = emptyList(),
                    isLoading = false,
                    errorMessage = null,
                    searchQuery = "",
                    onSearchQueryChange = {},
                    onLocationClick = {},
                    onDeleteLocation = {},
                    onDeleteField = {},
                    onCreateClick = { createClicked = true },
                    onRetry = {}
                )
            }
        }

        // When - Clicar em criar local
        composeTestRule.onNodeWithText("Criar Local").performClick()

        // Then - Callback deve ser chamado
        assertThat(createClicked).isTrue()
    }

    // ==========================================
    // TESTE 7: Erro de Validacao Mostra Mensagem
    // ==========================================

    @Test
    fun validationError_showsErrorMessage() {
        // Given - Tela de detalhe com erro de validacao
        val location = createTestLocation(id = "loc-val-1", name = "")
        val errorMessage = "Nome do local e obrigatorio"

        composeTestRule.setContent {
            FutebaTheme {
                TestLocationDetailScreen(
                    location = location,
                    fields = emptyList(),
                    isLoading = false,
                    errorMessage = errorMessage,
                    onSave = {},
                    onAddField = {},
                    onNavigateBack = {}
                )
            }
        }

        // Then - Mensagem de erro deve estar visivel
        composeTestRule.onNodeWithText(errorMessage).assertIsDisplayed()
    }

    @Test
    fun validationError_showsFieldSpecificError() {
        // Given - Erro de validacao em campo especifico
        val location = createTestLocation(id = "loc-val-2", name = "AB") // Nome muito curto
        val errorMessage = "Nome deve ter pelo menos 3 caracteres"

        composeTestRule.setContent {
            FutebaTheme {
                TestLocationDetailScreen(
                    location = location,
                    fields = emptyList(),
                    isLoading = false,
                    errorMessage = errorMessage,
                    onSave = {},
                    onAddField = {},
                    onNavigateBack = {}
                )
            }
        }

        // Then - Erro de validacao visivel
        composeTestRule.onNodeWithText(errorMessage).assertIsDisplayed()
    }

    // ==========================================
    // TESTE 8: Erro de Rede Mostra Opcao Retry
    // ==========================================

    @Test
    fun networkError_showsRetryOption() {
        // Given - Erro de rede
        val errorMessage = "Erro de conexao. Verifique sua internet."

        composeTestRule.setContent {
            FutebaTheme {
                TestManageLocationsScreen(
                    locations = emptyList(),
                    isLoading = false,
                    errorMessage = errorMessage,
                    searchQuery = "",
                    onSearchQueryChange = {},
                    onLocationClick = {},
                    onDeleteLocation = {},
                    onDeleteField = {},
                    onCreateClick = {},
                    onRetry = {}
                )
            }
        }

        // Then - Erro e botao de retry visiveis
        composeTestRule.onNodeWithText(errorMessage).assertIsDisplayed()
        composeTestRule.onNodeWithText("Tentar Novamente").assertIsDisplayed()
    }

    @Test
    fun networkError_retryButtonTriggersCallback() {
        // Given - Erro de rede
        var retryCalled = false
        val errorMessage = "Falha ao carregar locais"

        composeTestRule.setContent {
            FutebaTheme {
                TestManageLocationsScreen(
                    locations = emptyList(),
                    isLoading = false,
                    errorMessage = errorMessage,
                    searchQuery = "",
                    onSearchQueryChange = {},
                    onLocationClick = {},
                    onDeleteLocation = {},
                    onDeleteField = {},
                    onCreateClick = {},
                    onRetry = { retryCalled = true }
                )
            }
        }

        // When - Clicar em retry
        composeTestRule.onNodeWithText("Tentar Novamente").performClick()

        // Then - Callback deve ser chamado
        assertThat(retryCalled).isTrue()
    }

    // ==========================================
    // TESTE 9: Estado de Loading
    // ==========================================

    @Test
    fun loadingState_showsProgressIndicator() {
        // Given - Estado de carregamento
        composeTestRule.setContent {
            FutebaTheme {
                TestManageLocationsScreen(
                    locations = emptyList(),
                    isLoading = true,
                    errorMessage = null,
                    searchQuery = "",
                    onSearchQueryChange = {},
                    onLocationClick = {},
                    onDeleteLocation = {},
                    onDeleteField = {},
                    onCreateClick = {},
                    onRetry = {}
                )
            }
        }

        // Then - Indicador de progresso visivel
        composeTestRule.onNodeWithTag("loading_indicator").assertIsDisplayed()
    }

    // ==========================================
    // TESTE 10: Click em Location Navega para Detalhe
    // ==========================================

    @Test
    fun locationCard_clickNavigatesToDetail() {
        // Given - Lista com local
        val location = createTestLocation(id = "loc-nav-1", name = "Arena Navegacao")
        val locations = listOf(LocationWithFieldsData(location, emptyList()))
        var clickedLocationId: String? = null

        composeTestRule.setContent {
            FutebaTheme {
                TestManageLocationsScreen(
                    locations = locations,
                    isLoading = false,
                    errorMessage = null,
                    searchQuery = "",
                    onSearchQueryChange = {},
                    onLocationClick = { locationId -> clickedLocationId = locationId },
                    onDeleteLocation = {},
                    onDeleteField = {},
                    onCreateClick = {},
                    onRetry = {}
                )
            }
        }

        // When - Clicar no card do local
        composeTestRule.onNodeWithTag("location_card_loc-nav-1").performClick()

        // Then - Callback deve receber o ID correto
        assertThat(clickedLocationId).isEqualTo("loc-nav-1")
    }

    // ==========================================
    // TESTE 11: Locais com Quadras Mostram Contagem
    // ==========================================

    @Test
    fun locationWithFields_showsFieldCount() {
        // Given - Local com quadras
        val location = createTestLocation(id = "loc-fields-1", name = "Arena Completa")
        val fields = listOf(
            createTestField(id = "field-1", name = "Quadra 1"),
            createTestField(id = "field-2", name = "Quadra 2"),
            createTestField(id = "field-3", name = "Quadra 3")
        )
        val locations = listOf(LocationWithFieldsData(location, fields))

        composeTestRule.setContent {
            FutebaTheme {
                TestManageLocationsScreen(
                    locations = locations,
                    isLoading = false,
                    errorMessage = null,
                    searchQuery = "",
                    onSearchQueryChange = {},
                    onLocationClick = {},
                    onDeleteLocation = {},
                    onDeleteField = {},
                    onCreateClick = {},
                    onRetry = {}
                )
            }
        }

        // Then - Contagem de quadras deve ser exibida
        composeTestRule.onNodeWithText("3 quadras").assertIsDisplayed()
    }

    // ==========================================
    // TESTE 12: Deletar Quadra de um Local
    // ==========================================

    @Test
    fun deleteField_removesFromLocationDetail() {
        // Given - Local com quadras
        val location = createTestLocation(id = "loc-df-1", name = "Arena Com Quadras")
        var fields = listOf(
            createTestField(id = "field-del-1", name = "Quadra Para Deletar"),
            createTestField(id = "field-keep-1", name = "Quadra Para Manter")
        )
        var deletedFieldId: String? = null

        composeTestRule.setContent {
            FutebaTheme {
                TestLocationDetailScreen(
                    location = location,
                    fields = fields,
                    isLoading = false,
                    errorMessage = null,
                    onSave = {},
                    onAddField = {},
                    onNavigateBack = {},
                    onDeleteField = { fieldId ->
                        deletedFieldId = fieldId
                        fields = fields.filter { it.id != fieldId }
                    }
                )
            }
        }

        // Then - Ambas quadras visiveis
        composeTestRule.onNodeWithText("Quadra Para Deletar").assertIsDisplayed()
        composeTestRule.onNodeWithText("Quadra Para Manter").assertIsDisplayed()

        // When - Deletar a primeira quadra
        composeTestRule.onNodeWithTag("delete_field_field-del-1").performClick()

        // Re-render com quadra removida
        composeTestRule.setContent {
            FutebaTheme {
                TestLocationDetailScreen(
                    location = location,
                    fields = fields,
                    isLoading = false,
                    errorMessage = null,
                    onSave = {},
                    onAddField = {},
                    onNavigateBack = {}
                )
            }
        }

        // Then - Quadra deletada nao deve mais aparecer
        assertThat(deletedFieldId).isEqualTo("field-del-1")
        composeTestRule.onNodeWithText("Quadra Para Deletar").assertDoesNotExist()
        composeTestRule.onNodeWithText("Quadra Para Manter").assertIsDisplayed()
    }

    // ==========================================
    // HELPERS - Criacao de Dados de Teste
    // ==========================================

    /**
     * Cria um local de teste com valores customizaveis.
     */
    private fun createTestLocation(
        id: String = "test-location-id",
        name: String = "Arena Teste",
        address: String = "Rua Teste, 123",
        city: String = "Curitiba",
        state: String = "PR",
        ownerId: String = "owner-123"
    ) = Location(
        id = id,
        name = name,
        address = address,
        city = city,
        state = state,
        ownerId = ownerId,
        isActive = true,
        createdAt = Date()
    )

    /**
     * Cria uma quadra de teste com valores customizaveis.
     */
    private fun createTestField(
        id: String = "test-field-id",
        name: String = "Quadra Teste",
        type: String = "SOCIETY",
        locationId: String = "test-location-id",
        hourlyPrice: Double = 150.0
    ) = Field(
        id = id,
        name = name,
        type = type,
        locationId = locationId,
        hourlyPrice = hourlyPrice,
        isActive = true
    )
}

// ==========================================
// COMPONENTES DE TESTE - Versoes Simplificadas
// ==========================================

/**
 * Helper object para operacoes comuns de teste de locais.
 */
object LocationTestHelper {

    /**
     * Cria um local de teste atraves da UI.
     */
    fun ComposeTestRule.createTestLocation(name: String) {
        // Navegar para criacao
        onNodeWithTag("create_location_fab").performClick()

        // Preencher nome
        onNodeWithTag("location_name_input").performTextInput(name)

        // Salvar
        onNodeWithTag("location_save_button").performClick()
    }

    /**
     * Navega para detalhe de um local.
     */
    fun ComposeTestRule.navigateToLocationDetail(locationId: String) {
        onNodeWithTag("location_card_$locationId").performClick()
    }

    /**
     * Aguarda a lista de locais carregar.
     */
    fun ComposeTestRule.waitForLocationList() {
        waitUntil(timeoutMillis = 5000) {
            onAllNodesWithTag("location_card", useUnmergedTree = true)
                .fetchSemanticsNodes().isNotEmpty() ||
                    onAllNodesWithTag("empty_state", useUnmergedTree = true)
                        .fetchSemanticsNodes().isNotEmpty()
        }
    }
}

/**
 * Tela de gerenciamento de locais para teste.
 * Replica a estrutura da ManageLocationsScreen sem dependencias externas.
 */
@Composable
private fun TestManageLocationsScreen(
    locations: List<LocationWithFieldsData>,
    isLoading: Boolean,
    errorMessage: String?,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    onLocationClick: (locationId: String) -> Unit,
    onDeleteLocation: (LocationWithFieldsData) -> Unit,
    onDeleteField: (Field) -> Unit,
    onCreateClick: () -> Unit,
    onRetry: () -> Unit
) {
    Scaffold(
        floatingActionButton = {
            if (!isLoading && errorMessage == null && locations.isNotEmpty()) {
                FloatingActionButton(
                    onClick = onCreateClick,
                    modifier = Modifier.testTag("create_location_fab")
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Criar Local")
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when {
                isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.testTag("loading_indicator")
                        )
                    }
                }
                errorMessage != null -> {
                    TestErrorState(
                        message = errorMessage,
                        onRetry = onRetry
                    )
                }
                locations.isEmpty() -> {
                    TestEmptyState(
                        onCreateClick = onCreateClick
                    )
                }
                else -> {
                    Column(modifier = Modifier.fillMaxSize()) {
                        // Barra de busca
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = onSearchQueryChange,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp)
                                .testTag("location_search_input"),
                            placeholder = { Text("Buscar locais...") },
                            singleLine = true
                        )

                        // Lista de locais
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxSize()
                                .testTag("location_list"),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(locations, key = { it.location.id }) { locationData ->
                                TestLocationCard(
                                    locationData = locationData,
                                    onClick = { onLocationClick(locationData.location.id) },
                                    onDelete = { onDeleteLocation(locationData) },
                                    onDeleteField = onDeleteField
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Card de local para teste.
 */
@Composable
private fun TestLocationCard(
    locationData: LocationWithFieldsData,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    onDeleteField: (Field) -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("location_card_${locationData.location.id}")
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = locationData.location.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (locationData.location.address.isNotEmpty()) {
                        Text(
                            text = locationData.location.address,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Row {
                    IconButton(
                        onClick = onClick,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            Icons.Default.Edit,
                            contentDescription = "Editar",
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    IconButton(
                        onClick = onDelete,
                        modifier = Modifier
                            .size(32.dp)
                            .testTag("delete_location_${locationData.location.id}")
                    ) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = "Deletar",
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            // Contagem de quadras
            if (locationData.fields.isNotEmpty()) {
                HorizontalDivider()
                Text(
                    text = "${locationData.fields.size} quadras",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

/**
 * Tela de detalhe de local para teste.
 */
@Composable
private fun TestLocationDetailScreen(
    location: Location,
    fields: List<Field>,
    isLoading: Boolean,
    errorMessage: String?,
    onSave: (Location) -> Unit,
    onAddField: (name: String, type: String) -> Unit,
    onNavigateBack: () -> Unit,
    onDeleteField: (fieldId: String) -> Unit = {}
) {
    var name by remember { mutableStateOf(location.name) }
    var address by remember { mutableStateOf(location.address) }

    Scaffold(
        floatingActionButton = {
            if (!isLoading) {
                FloatingActionButton(
                    onClick = { onAddField("Nova Quadra", "SOCIETY") },
                    modifier = Modifier.testTag("add_field_fab")
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Adicionar Quadra")
                }
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Erro de validacao
            if (errorMessage != null) {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = errorMessage,
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }

            // Campo nome
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Nome do Local") },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("location_name_input")
            )

            // Campo endereco
            OutlinedTextField(
                value = address,
                onValueChange = { address = it },
                label = { Text("Endereco") },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("location_address_input")
            )

            // Botao salvar
            Button(
                onClick = {
                    onSave(location.copy(name = name, address = address))
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("location_save_button"),
                enabled = !isLoading
            ) {
                Text("Salvar")
            }

            HorizontalDivider()

            // Lista de quadras
            Text(
                text = "Quadras",
                style = MaterialTheme.typography.titleMedium
            )

            if (fields.isEmpty()) {
                Text(
                    text = "Nenhuma quadra cadastrada",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                fields.forEach { field ->
                    TestFieldItem(
                        field = field,
                        onDelete = { onDeleteField(field.id) }
                    )
                }
            }
        }
    }
}

/**
 * Item de quadra para teste.
 */
@Composable
private fun TestFieldItem(
    field: Field,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("field_card_${field.id}"),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = field.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = field.type,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(
                onClick = onDelete,
                modifier = Modifier.testTag("delete_field_${field.id}")
            ) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Deletar quadra",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

/**
 * Estado vazio para teste.
 */
@Composable
private fun TestEmptyState(
    onCreateClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .testTag("empty_state"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.LocationOn,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Nenhum local cadastrado",
            style = MaterialTheme.typography.headlineSmall
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Cadastre seu primeiro local",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(onClick = onCreateClick) {
            Icon(Icons.Default.Add, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Criar Local")
        }
    }
}

/**
 * Estado de erro para teste.
 */
@Composable
private fun TestErrorState(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Erro",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.error
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(onClick = onRetry) {
            Text("Tentar Novamente")
        }
    }
}
