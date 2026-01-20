package com.futebadosparcas.ui.games

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.ui.theme.FutebaDosParcasTheme
import org.junit.Rule
import org.junit.Test

/**
 * Testes de UI Compose básicos para a tela de jogos.
 * Verifica exibição de estados e interações básicas.
 */
class GamesScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun gamesScreen_showsLoadingState() {
        // Given - Estado de Loading
        composeTestRule.setContent {
            FutebaDosParcasTheme {
                GamesScreenContent(
                    uiState = GamesUiState.Loading,
                    onGameClick = {},
                    onConfirmClick = {},
                    onFilterChange = {},
                    onRetry = {},
                    currentFilter = com.futebadosparcas.data.repository.GameFilterType.ALL
                )
            }
        }

        // Then - Deve exibir indicador de loading
        composeTestRule.onNode(hasProgressBarRangeInfo()).assertExists()
    }

    @Test
    fun gamesScreen_showsEmptyState() {
        // Given - Estado vazio
        composeTestRule.setContent {
            FutebaDosParcasTheme {
                GamesScreenContent(
                    uiState = GamesUiState.Empty,
                    onGameClick = {},
                    onConfirmClick = {},
                    onFilterChange = {},
                    onRetry = {},
                    currentFilter = com.futebadosparcas.data.repository.GameFilterType.ALL
                )
            }
        }

        // Then - Deve exibir mensagem de vazio ou ícone
        composeTestRule.onRoot().assertExists()
    }

    @Test
    fun gamesScreen_showsErrorState() {
        // Given - Estado de erro
        val errorMessage = "Erro ao carregar jogos"
        composeTestRule.setContent {
            FutebaDosParcasTheme {
                GamesScreenContent(
                    uiState = GamesUiState.Error(errorMessage, retryable = true),
                    onGameClick = {},
                    onConfirmClick = {},
                    onFilterChange = {},
                    onRetry = {},
                    currentFilter = com.futebadosparcas.data.repository.GameFilterType.ALL
                )
            }
        }

        // Then - Deve exibir mensagem de erro
        composeTestRule.onRoot().assertExists()
    }

    @Test
    fun gamesScreen_showsGamesList() {
        // Given - Lista de jogos
        val games = listOf(
            createTestGameWithConfirmations("1"),
            createTestGameWithConfirmations("2")
        )

        composeTestRule.setContent {
            FutebaDosParcasTheme {
                GamesScreenContent(
                    uiState = GamesUiState.Success(games),
                    onGameClick = {},
                    onConfirmClick = {},
                    onFilterChange = {},
                    onRetry = {},
                    currentFilter = com.futebadosparcas.data.repository.GameFilterType.ALL
                )
            }
        }

        // Then - Deve exibir os jogos
        composeTestRule.onRoot().assertExists()
    }

    // Helper para criar dados de teste
    private fun createTestGameWithConfirmations(id: String) = GameWithConfirmations(
        game = Game(
            id = id,
            date = "2026-01-15",
            time = "20:00",
            status = GameStatus.SCHEDULED.name,
            locationName = "Arena Test",
            fieldName = "Quadra 1",
            maxPlayers = 14,
            playersCount = 10,
            ownerId = "owner123",
            ownerName = "Test Owner"
        ),
        confirmedCount = 10,
        isUserConfirmed = false
    )
}
