package com.futebadosparcas.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

/**
 * Exemplos de uso dos componentes modernos de UX
 *
 * SHIMMER COMPONENTS - Loading States
 * ===================================
 */

// Exemplo 1: Shimmer para lista de jogos
@Composable
fun ExampleShimmerGames() {
    Column(modifier = Modifier.fillMaxSize()) {
        // Exibir múltiplos cards de shimmer
        ShimmerGameCardList(count = 5)
    }
}

// Exemplo 2: Shimmer para lista de jogadores
@Composable
fun ExampleShimmerPlayers() {
    Column(modifier = Modifier.fillMaxSize()) {
        // Exibir múltiplos cards de shimmer
        ShimmerPlayerCardList(count = 8)
    }
}

// Exemplo 3: Shimmer genérico customizado
@Composable
fun ExampleCustomShimmer() {
    ShimmerListContent(
        count = 10,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) { brush ->
        // Conteúdo customizado com o brush animado
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            ShimmerBox(
                modifier = Modifier
                    .size(48.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                ShimmerBox(
                    modifier = Modifier
                        .fillMaxWidth(0.7f)
                        .height(20.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
                ShimmerBox(
                    modifier = Modifier
                        .fillMaxWidth(0.5f)
                        .height(16.dp)
                )
            }
        }
    }
}

/**
 * EMPTY STATES - Estados Vazios Diferenciados
 * ===========================================
 */

// Exemplo 4: Empty State - Sem dados
@Composable
fun ExampleEmptyStateNoData() {
    EmptyState(
        type = EmptyStateType.NoData(
            title = "Nenhum jogo agendado",
            description = "Que tal criar o primeiro jogo e reunir a galera?",
            icon = Icons.Default.SportsScore,
            actionLabel = "Criar Jogo",
            onAction = {
                // Navegar para tela de criar jogo
            }
        )
    )
}

// Exemplo 5: Empty State - Erro com retry
@Composable
fun ExampleEmptyStateError() {
    EmptyState(
        type = EmptyStateType.Error(
            title = "Erro ao carregar jogos",
            description = "Não foi possível carregar os dados. Tente novamente.",
            onRetry = {
                // Tentar carregar novamente
            }
        )
    )
}

// Exemplo 6: Empty State - Sem conexão
@Composable
fun ExampleEmptyStateNoConnection() {
    EmptyState(
        type = EmptyStateType.NoConnection(
            onRetry = {
                // Tentar conectar novamente
            }
        )
    )
}

// Exemplo 7: Empty State - Busca sem resultados
@Composable
fun ExampleEmptyStateNoResults() {
    val searchQuery = remember { mutableStateOf("Ronaldinho") }

    EmptyState(
        type = EmptyStateType.NoResults(
            description = "Nenhum resultado para \"${searchQuery.value}\"",
            actionLabel = "Limpar Busca",
            onAction = {
                searchQuery.value = ""
            }
        )
    )
}

// Exemplo 8: Empty States pré-configurados
@Composable
fun ExamplePreconfiguredEmptyStates() {
    Column {
        // Empty state para jogos
        EmptyGamesState(
            onCreateGame = {
                // Navegar para criar jogo
            }
        )

        // Empty state para jogadores
        EmptyPlayersState(
            onInvitePlayers = {
                // Abrir tela de convites
            }
        )

        // Empty state para busca
        EmptySearchState(
            query = "Cristiano Ronaldo",
            onClearSearch = {
                // Limpar busca
            }
        )
    }
}

/**
 * UNDO SNACKBAR - Snackbar com ação de desfazer
 * ==============================================
 */

// Exemplo 9: Scaffold com Undo Snackbar
@Composable
fun ExampleScaffoldWithUndoSnackbar() {
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    Scaffold(
        snackbarHost = {
            UndoSnackbarHost(hostState = snackbarHostState)
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Button(
                onClick = {
                    scope.launch {
                        snackbarHostState.showUndoSnackbar(
                            message = "Jogador removido do grupo",
                            actionLabel = "Desfazer",
                            onUndo = {
                                // Restaurar jogador
                            },
                            onDismiss = {
                                // Confirmar remoção
                            }
                        )
                    }
                }
            ) {
                Text("Remover Jogador")
            }
        }
    }
}

// Exemplo 10: Ação reversível com timer automático
@Composable
fun ExampleUndoableAction() {
    val snackbarHostState = remember { SnackbarHostState() }
    var deletedItem by remember { mutableStateOf<String?>(null) }

    val deleteAction = rememberUndoableAction(
        snackbarHostState = snackbarHostState,
        message = "Item excluído",
        actionLabel = "Desfazer",
        delayMs = 3000L,
        onCommit = {
            // Executar exclusão permanente
            deletedItem?.let {
                // Excluir do banco de dados
            }
        },
        onUndo = {
            // Cancelar exclusão
            deletedItem = null
        }
    )

    Scaffold(
        snackbarHost = {
            UndoSnackbarHost(hostState = snackbarHostState)
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Button(
                onClick = {
                    deletedItem = "Item123"
                    deleteAction()
                }
            ) {
                Text("Excluir Item")
            }
        }
    }
}

/**
 * EXEMPLO COMPLETO - Tela de Jogos com todos os componentes
 * =========================================================
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun ExampleGamesScreenComplete() {
    // Estados
    var isLoading by remember { mutableStateOf(true) }
    var hasError by remember { mutableStateOf(false) }
    var games by remember { mutableStateOf(emptyList<String>()) }
    val snackbarHostState = remember { SnackbarHostState() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Jogos") }
            )
        },
        snackbarHost = {
            UndoSnackbarHost(hostState = snackbarHostState)
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when {
                // Loading state - Mostrar shimmer
                isLoading -> {
                    ShimmerGameCardList(count = 5)
                }

                // Error state - Mostrar erro
                hasError -> {
                    EmptyState(
                        type = EmptyStateType.Error(
                            title = "Erro ao carregar jogos",
                            description = "Não foi possível carregar os dados. Tente novamente.",
                            onRetry = {
                                isLoading = true
                                hasError = false
                                // Tentar carregar novamente
                            }
                        )
                    )
                }

                // Empty state - Lista vazia
                games.isEmpty() -> {
                    EmptyGamesState(
                        onCreateGame = {
                            // Navegar para criar jogo
                        }
                    )
                }

                // Success state - Mostrar dados
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(games.size) { index ->
                            // Card de jogo aqui
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                onClick = { /* Abrir detalhes */ }
                            ) {
                                Text(
                                    text = games[index],
                                    modifier = Modifier.padding(16.dp)
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
 * DICAS DE USO
 * ============
 *
 * 1. SHIMMER LOADING:
 *    - Use ShimmerGameCard para loading de jogos
 *    - Use ShimmerPlayerCard para loading de jogadores
 *    - Use ShimmerListContent para criar shimmer customizado
 *
 * 2. EMPTY STATES:
 *    - Use EmptyStateType.NoData para listas vazias
 *    - Use EmptyStateType.Error para erros com retry
 *    - Use EmptyStateType.NoConnection para problemas de conexão
 *    - Use EmptyStateType.NoResults para buscas sem resultado
 *
 * 3. UNDO SNACKBAR:
 *    - Use showUndoSnackbar() para ações reversíveis simples
 *    - Use rememberUndoableAction() para ações com timer
 *    - Sempre forneça feedback visual ao usuário
 *
 * 4. BOAS PRÁTICAS:
 *    - Sempre use strings.xml para textos
 *    - Mantenha consistência com Material Design 3
 *    - Teste em diferentes tamanhos de tela
 *    - Use cores do tema (MaterialTheme.colorScheme)
 */
