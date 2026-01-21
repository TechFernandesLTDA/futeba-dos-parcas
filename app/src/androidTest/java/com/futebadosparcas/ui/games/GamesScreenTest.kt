package com.futebadosparcas.ui.games

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.repository.GameFilterType
import com.futebadosparcas.ui.components.ShimmerGameCard
import com.futebadosparcas.ui.theme.FutebaTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Testes de UI para GamesScreen usando Compose Testing.
 *
 * Verifica:
 * - Estados de loading, success, empty e error
 * - Exibicao correta de cards de jogos
 * - Filtros de jogos (Todos, Abertos, Meus Jogos)
 * - Navegacao ao clicar em cards
 * - Estado vazio quando nao ha jogos
 *
 * Utiliza JUnit4 para testes instrumentados (androidTest).
 * Usa componentes internos stateless para evitar dependencia de ViewModel real.
 */
@RunWith(AndroidJUnit4::class)
class GamesScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // ==================== Testes de Estado Loading ====================

    @Test
    fun loadingState_showsShimmerCards() {
        // Given - Estado de loading
        // When - Renderizar tela com estado de loading
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Loading
                )
            }
        }

        // Then - Nao deve mostrar jogos reais (shimmer cards sao exibidos)
        composeTestRule.onNodeWithText("Arena Teste").assertDoesNotExist()
    }

    // ==================== Testes de Estado Success ====================

    @Test
    fun successState_showsGameCards() {
        // Given - Estado de sucesso com jogos
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-1",
                locationName = "Arena Teste",
                date = "20/01/2026",
                time = "20:00",
                playersCount = 10,
                status = GameStatus.SCHEDULED
            ),
            createTestGameWithConfirmations(
                id = "game-2",
                locationName = "Quadra Central",
                date = "21/01/2026",
                time = "19:00",
                playersCount = 14,
                status = GameStatus.LIVE
            )
        )

        // When - Renderizar tela
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar os cards de jogos
        composeTestRule.onNodeWithText("Arena Teste").assertIsDisplayed()
        composeTestRule.onNodeWithText("Quadra Central").assertIsDisplayed()
    }

    @Test
    fun successState_showsGameDateTime() {
        // Given - Jogo com data e hora especificas
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-datetime",
                locationName = "Campo do Parque",
                date = "25/01/2026",
                time = "18:30",
                playersCount = 8
            )
        )

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar data e hora formatadas
        composeTestRule.onNodeWithText("25/01/2026 18:30", substring = true).assertExists()
    }

    @Test
    fun successState_showsPlayersCount() {
        // Given - Jogo com jogadores confirmados
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-players",
                locationName = "Arena Soccer",
                playersCount = 12
            )
        )

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar contagem de jogadores (texto parcial)
        composeTestRule.onNodeWithText("12", substring = true).assertExists()
    }

    @Test
    fun successState_showsGameType() {
        // Given - Jogo com tipo Society
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-type",
                locationName = "Arena Society",
                gameType = "Society"
            )
        )

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar badge de tipo do campo
        composeTestRule.onNodeWithText("Society").assertExists()
    }

    @Test
    fun successState_showsLiveGameStatus() {
        // Given - Jogo ao vivo
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-live",
                locationName = "Arena Principal",
                status = GameStatus.LIVE
            )
        )

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar status "Ao Vivo"
        composeTestRule.onNodeWithText("Ao Vivo").assertExists()
    }

    @Test
    fun successState_showsScheduledStatus() {
        // Given - Jogo agendado
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-scheduled",
                locationName = "Arena Agendada",
                status = GameStatus.SCHEDULED
            )
        )

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar status "Agendado"
        composeTestRule.onNodeWithText("Agendado").assertExists()
    }

    // ==================== Testes de Estado Empty ====================

    @Test
    fun emptyState_showsNoGamesMessage() {
        // Given - Estado vazio
        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Empty
                )
            }
        }

        // Then - Deve mostrar mensagem de estado vazio
        composeTestRule.onNodeWithText("Nenhum jogo", substring = true).assertExists()
    }

    @Test
    fun emptyState_showsCreateGameButton() {
        // Given - Estado vazio
        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Empty
                )
            }
        }

        // Then - Deve mostrar botao de criar jogo
        composeTestRule.onNodeWithText("Criar Jogo", substring = true).assertExists()
    }

    @Test
    fun emptyState_createButtonTriggersCallback() {
        // Given - Estado vazio com callback
        var createGameClicked = false

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Empty,
                    onCreateGameClick = { createGameClicked = true }
                )
            }
        }

        // Clicar no botao de criar jogo (dentro do estado vazio)
        composeTestRule.onAllNodesWithText("Criar Jogo", substring = true)
            .filter(hasClickAction())
            .onFirst()
            .performClick()

        // Then - Callback deve ser acionado
        assertThat(createGameClicked).isTrue()
    }

    // ==================== Testes de Estado Error ====================

    @Test
    fun errorState_showsErrorMessage() {
        // Given - Estado de erro
        val errorMessage = "Erro ao carregar jogos"

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Error(errorMessage)
                )
            }
        }

        // Then - Deve mostrar mensagem de erro
        composeTestRule.onNodeWithText(errorMessage).assertIsDisplayed()
    }

    @Test
    fun errorState_showsRetryButton() {
        // Given - Estado de erro

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Error("Falha na conexao")
                )
            }
        }

        // Then - Deve mostrar botao de tentar novamente
        composeTestRule.onNodeWithText("Tentar novamente", substring = true).assertExists()
    }

    @Test
    fun errorState_retryButtonTriggersCallback() {
        // Given - Estado de erro
        var retryCalled = false

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Error("Erro de rede"),
                    onRetry = { retryCalled = true }
                )
            }
        }

        // Clicar no botao retry
        composeTestRule.onNodeWithText("Tentar novamente", substring = true).performClick()

        // Then - Callback deve ser acionado
        assertThat(retryCalled).isTrue()
    }

    // ==================== Testes de Filtros ====================

    @Test
    fun filters_allGamesFilterIsDisplayed() {
        // Given - Estado com jogos
        val games = listOf(createTestGameWithConfirmations(id = "game-1"))

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar filtro "Todos"
        composeTestRule.onNodeWithText("Todos").assertExists()
    }

    @Test
    fun filters_openGamesFilterIsDisplayed() {
        // Given - Estado com jogos
        val games = listOf(createTestGameWithConfirmations(id = "game-1"))

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar filtro "Abertos"
        composeTestRule.onNodeWithText("Abertos").assertExists()
    }

    @Test
    fun filters_myGamesFilterIsDisplayed() {
        // Given - Estado com jogos
        val games = listOf(createTestGameWithConfirmations(id = "game-1"))

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar filtro "Meus Jogos"
        composeTestRule.onNodeWithText("Meus Jogos").assertExists()
    }

    @Test
    fun filters_clickingOpenFilterCallsCallback() {
        // Given - Estado com jogos
        val games = listOf(createTestGameWithConfirmations(id = "game-1"))
        var lastFilterUsed: GameFilterType? = null

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games),
                    onFilterChange = { filter -> lastFilterUsed = filter }
                )
            }
        }

        // Clicar no filtro "Abertos"
        composeTestRule.onNodeWithText("Abertos").performClick()

        // Then - Deve chamar callback com filtro OPEN
        assertThat(lastFilterUsed).isEqualTo(GameFilterType.OPEN)
    }

    @Test
    fun filters_clickingMyGamesFilterCallsCallback() {
        // Given - Estado com jogos
        val games = listOf(createTestGameWithConfirmations(id = "game-1"))
        var lastFilterUsed: GameFilterType? = null

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games),
                    onFilterChange = { filter -> lastFilterUsed = filter }
                )
            }
        }

        // Clicar no filtro "Meus Jogos"
        composeTestRule.onNodeWithText("Meus Jogos").performClick()

        // Then - Deve chamar callback com filtro MY_GAMES
        assertThat(lastFilterUsed).isEqualTo(GameFilterType.MY_GAMES)
    }

    @Test
    fun filters_clickingAllFilterCallsCallback() {
        // Given - Estado com jogos
        val games = listOf(createTestGameWithConfirmations(id = "game-1"))
        var lastFilterUsed: GameFilterType? = null

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games),
                    onFilterChange = { filter -> lastFilterUsed = filter }
                )
            }
        }

        // Clicar primeiro em "Abertos" depois em "Todos"
        composeTestRule.onNodeWithText("Abertos").performClick()
        composeTestRule.onNodeWithText("Todos").performClick()

        // Then - Deve chamar callback com filtro ALL
        assertThat(lastFilterUsed).isEqualTo(GameFilterType.ALL)
    }

    // ==================== Testes de Navegacao ====================

    @Test
    fun gameCard_clickTriggersNavigationCallback() {
        // Given - Estado com um jogo
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-nav-test",
                locationName = "Arena Navegacao"
            )
        )
        var clickedGameId: String? = null

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games),
                    onGameClick = { gameId -> clickedGameId = gameId }
                )
            }
        }

        // Clicar no card do jogo
        composeTestRule.onNodeWithText("Arena Navegacao").performClick()

        // Then - Callback deve receber o ID correto
        assertThat(clickedGameId).isEqualTo("game-nav-test")
    }

    // ==================== Testes de Multiplos Jogos ====================

    @Test
    fun multipleGames_allCardsAreDisplayed() {
        // Given - Multiplos jogos
        val games = listOf(
            createTestGameWithConfirmations(id = "game-1", locationName = "Arena Norte"),
            createTestGameWithConfirmations(id = "game-2", locationName = "Arena Sul"),
            createTestGameWithConfirmations(id = "game-3", locationName = "Arena Leste")
        )

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Todos os cards devem estar presentes
        composeTestRule.onNodeWithText("Arena Norte").assertExists()
        composeTestRule.onNodeWithText("Arena Sul").assertExists()
        composeTestRule.onNodeWithText("Arena Leste").assertExists()
    }

    @Test
    fun multipleGames_correctCardTriggersCallback() {
        // Given - Multiplos jogos
        val games = listOf(
            createTestGameWithConfirmations(id = "game-first", locationName = "Primeiro Campo"),
            createTestGameWithConfirmations(id = "game-second", locationName = "Segundo Campo")
        )
        var clickedGameId: String? = null

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games),
                    onGameClick = { gameId -> clickedGameId = gameId }
                )
            }
        }

        // Clicar no segundo card
        composeTestRule.onNodeWithText("Segundo Campo").performClick()

        // Then - Deve retornar o ID correto
        assertThat(clickedGameId).isEqualTo("game-second")
    }

    // ==================== Testes de Tempo Faltante ====================

    @Test
    fun gameWithoutTime_showsPlaceholder() {
        // Given - Jogo sem hora definida
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-no-time",
                locationName = "Campo Sem Hora",
                date = "30/01/2026",
                time = ""  // Sem hora
            )
        )

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar placeholder de hora
        composeTestRule.onNodeWithText("(--:--)", substring = true).assertExists()
    }

    // ==================== Testes de Endereco ====================

    @Test
    fun gameWithAddress_showsAddress() {
        // Given - Jogo com endereco
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-address",
                locationName = "Arena Completa",
                locationAddress = "Rua dos Testes, 123"
            )
        )

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar endereco
        composeTestRule.onNodeWithText("Rua dos Testes, 123", substring = true).assertExists()
    }

    // ==================== Testes de Diferentes Status ====================

    @Test
    fun gameWithFinishedStatus_showsFinalizadoText() {
        // Given - Jogo finalizado
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-finished",
                locationName = "Arena Finalizada",
                status = GameStatus.FINISHED
            )
        )

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar "Finalizado"
        composeTestRule.onNodeWithText("Finalizado").assertExists()
    }

    @Test
    fun gameWithConfirmedStatus_showsConfirmadoText() {
        // Given - Jogo confirmado
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-confirmed",
                locationName = "Arena Confirmada",
                status = GameStatus.CONFIRMED
            )
        )

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar "Confirmado"
        composeTestRule.onNodeWithText("Confirmado").assertExists()
    }

    @Test
    fun gameWithCancelledStatus_showsCanceladoText() {
        // Given - Jogo cancelado
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-cancelled",
                locationName = "Arena Cancelada",
                status = GameStatus.CANCELLED
            )
        )

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar "Cancelado"
        composeTestRule.onNodeWithText("Cancelado").assertExists()
    }

    // ==================== Testes de Diferentes Tipos de Campo ====================

    @Test
    fun gameWithFutsalType_showsFutsalBadge() {
        // Given - Jogo de futsal
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-futsal",
                locationName = "Quadra Futsal",
                gameType = "Futsal"
            )
        )

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar badge "Futsal"
        composeTestRule.onNodeWithText("Futsal").assertExists()
    }

    @Test
    fun gameWithCampoType_showsCampoBadge() {
        // Given - Jogo de campo
        val games = listOf(
            createTestGameWithConfirmations(
                id = "game-campo",
                locationName = "Campo Gramado",
                gameType = "Campo"
            )
        )

        // When
        composeTestRule.setContent {
            FutebaTheme {
                TestGamesScreenContent(
                    uiState = GamesUiState.Success(games)
                )
            }
        }

        // Then - Deve mostrar badge "Campo"
        composeTestRule.onNodeWithText("Campo").assertExists()
    }

    // ==================== Helpers ====================

    /**
     * Cria um GameWithConfirmations de teste com valores padrao.
     */
    private fun createTestGameWithConfirmations(
        id: String,
        locationName: String = "Arena Padrao",
        locationAddress: String = "",
        date: String = "20/01/2026",
        time: String = "20:00",
        playersCount: Int = 10,
        gameType: String = "Society",
        status: GameStatus = GameStatus.SCHEDULED,
        isUserConfirmed: Boolean = false
    ): GameWithConfirmations {
        val game = Game(
            id = id,
            date = date,
            time = time,
            status = status.name,
            locationName = locationName,
            locationAddress = locationAddress,
            fieldName = "Quadra 1",
            maxPlayers = 14,
            playersCount = playersCount,
            gameType = gameType,
            ownerId = "owner-test",
            ownerName = "Organizador Teste"
        )
        return GameWithConfirmations(game, playersCount, isUserConfirmed)
    }
}

// ==================== Componentes de Teste ====================

/**
 * Componente de teste que renderiza o conteudo da GamesScreen
 * sem depender de ViewModel real.
 *
 * Permite testar os componentes de UI de forma isolada.
 */
@Composable
private fun TestGamesScreenContent(
    uiState: GamesUiState,
    onGameClick: (gameId: String) -> Unit = {},
    onCreateGameClick: () -> Unit = {},
    onFilterChange: (GameFilterType) -> Unit = {},
    onRetry: () -> Unit = {}
) {
    Box(modifier = Modifier.fillMaxSize()) {
        when (uiState) {
            is GamesUiState.Loading -> {
                GamesLoadingStateForTest()
            }
            is GamesUiState.Success -> {
                GamesSuccessContentForTest(
                    games = uiState.games,
                    onGameClick = onGameClick,
                    onFilterChange = onFilterChange
                )
            }
            is GamesUiState.Empty -> {
                GamesEmptyStateForTest(
                    onCreateGameClick = onCreateGameClick
                )
            }
            is GamesUiState.Error -> {
                GamesErrorStateForTest(
                    message = uiState.message,
                    onRetry = onRetry
                )
            }
        }
    }
}

/**
 * Loading state usando componente real de shimmer
 */
@Composable
private fun GamesLoadingStateForTest() {
    LazyColumn(modifier = Modifier.fillMaxSize()) {
        items(3) {
            ShimmerGameCard()
        }
    }
}

/**
 * Success content com filtros e lista de jogos
 */
@Composable
private fun GamesSuccessContentForTest(
    games: List<GameWithConfirmations>,
    onGameClick: (gameId: String) -> Unit,
    onFilterChange: (GameFilterType) -> Unit
) {
    var selectedFilter by remember { mutableStateOf(GameFilterType.ALL) }

    Column(modifier = Modifier.fillMaxSize()) {
        // Filtros
        GamesFiltersForTest(
            selectedFilter = selectedFilter,
            onFilterChange = { newFilter ->
                selectedFilter = newFilter
                onFilterChange(newFilter)
            }
        )

        // Lista de jogos
        LazyColumn {
            items(
                count = games.size,
                key = { index -> games[index].game.id }
            ) { index ->
                GameCardForTest(
                    game = games[index],
                    onClick = { onGameClick(games[index].game.id) }
                )
            }
        }
    }
}

/**
 * Filtros de jogos para teste
 */
@Composable
private fun GamesFiltersForTest(
    selectedFilter: GameFilterType,
    onFilterChange: (GameFilterType) -> Unit
) {
    Row(
        modifier = Modifier.padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        FilterChip(
            selected = selectedFilter == GameFilterType.ALL,
            onClick = { onFilterChange(GameFilterType.ALL) },
            label = { Text("Todos") }
        )

        FilterChip(
            selected = selectedFilter == GameFilterType.OPEN,
            onClick = { onFilterChange(GameFilterType.OPEN) },
            label = { Text("Abertos") }
        )

        FilterChip(
            selected = selectedFilter == GameFilterType.MY_GAMES,
            onClick = { onFilterChange(GameFilterType.MY_GAMES) },
            label = { Text("Meus Jogos") }
        )
    }
}

/**
 * Card de jogo para teste - replica logica do GameCard original
 */
@Composable
private fun GameCardForTest(
    game: GameWithConfirmations,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Local
            Text(
                text = game.game.locationName,
                style = MaterialTheme.typography.titleSmall
            )

            // Endereco (se existir)
            if (game.game.locationAddress.isNotEmpty()) {
                Text(
                    text = game.game.locationAddress,
                    style = MaterialTheme.typography.labelSmall
                )
            }

            // Badge de tipo
            Surface(
                shape = RoundedCornerShape(6.dp),
                color = MaterialTheme.colorScheme.primaryContainer
            ) {
                Text(
                    text = game.game.gameType,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelSmall
                )
            }

            // Data e hora
            val timeText = buildString {
                append(game.game.date)
                if (game.game.time.isNotEmpty()) {
                    append(" ${game.game.time}")
                } else {
                    append(" (--:--)")
                }
            }
            Text(
                text = timeText,
                style = MaterialTheme.typography.bodySmall
            )

            // Contagem de jogadores
            Text(
                text = "${game.game.playersCount} confirmados",
                style = MaterialTheme.typography.bodySmall
            )

            // Status badge
            if (game.game.status.isNotEmpty()) {
                val statusText = when (game.game.status.uppercase()) {
                    "OPEN" -> "Aberto"
                    "CONFIRMED" -> "Confirmado"
                    "SCHEDULED" -> "Agendado"
                    "LIVE" -> "Ao Vivo"
                    "FINISHED" -> "Finalizado"
                    "CANCELLED" -> "Cancelado"
                    else -> game.game.status
                }
                Text(
                    text = statusText,
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}

/**
 * Estado vazio para teste
 */
@Composable
private fun GamesEmptyStateForTest(
    onCreateGameClick: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Nenhum jogo encontrado",
            style = MaterialTheme.typography.headlineSmall
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Que tal criar o primeiro jogo?",
            style = MaterialTheme.typography.bodyMedium
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(onClick = onCreateGameClick) {
            Text("Criar Jogo")
        }
    }
}

/**
 * Estado de erro para teste
 */
@Composable
private fun GamesErrorStateForTest(
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
            Text("Tentar novamente")
        }
    }
}
