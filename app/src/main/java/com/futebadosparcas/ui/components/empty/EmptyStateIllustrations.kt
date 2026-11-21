package com.futebadosparcas.ui.components.empty

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import com.futebadosparcas.R
import com.futebadosparcas.domain.artes.ArteId
import com.futebadosparcas.ui.components.artes.ArteDaPelada
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Empty states ilustrados para diferentes contextos do app.
 * Usa as artes da pelada (vetores leves gerados de shared/artes).
 */

/**
 * Tipo de empty state.
 */
enum class EmptyStateType {
    NO_GAMES,
    NO_GROUPS,
    NO_PLAYERS,
    NO_NOTIFICATIONS,
    NO_CONNECTION,
    NO_RESULTS,
    ERROR,
    COMING_SOON
}

/**
 * Configuração de empty state.
 */
data class EmptyStateConfig(
    val type: EmptyStateType,
    val title: String,
    val message: String,
    val primaryAction: EmptyStateAction? = null,
    val secondaryAction: EmptyStateAction? = null
)

/**
 * Ação de empty state.
 */
data class EmptyStateAction(
    val label: String,
    val onClick: () -> Unit
)

/**
 * Componente de empty state ilustrado.
 */
@Composable
fun IllustratedEmptyState(
    config: EmptyStateConfig,
    modifier: Modifier = Modifier,
    illustrationSize: Dp = 160.dp
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Ilustração animada
        EmptyStateIllustration(
            type = config.type,
            modifier = Modifier.size(illustrationSize)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Título
        Text(
            text = config.title,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Mensagem
        Text(
            text = config.message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        // Ações
        if (config.primaryAction != null || config.secondaryAction != null) {
            Spacer(modifier = Modifier.height(24.dp))

            config.primaryAction?.let { action ->
                Button(
                    onClick = action.onClick,
                    modifier = Modifier.fillMaxWidth(0.7f)
                ) {
                    Text(action.label)
                }
            }

            config.secondaryAction?.let { action ->
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(
                    onClick = action.onClick,
                    modifier = Modifier.fillMaxWidth(0.7f)
                ) {
                    Text(action.label)
                }
            }
        }
    }
}

/**
 * Arte da pelada para cada tipo de estado vazio (spec FEAT_2026-11-21_ARTES_DA_PELADA).
 */
@Composable
fun EmptyStateIllustration(
    type: EmptyStateType,
    modifier: Modifier = Modifier
) {
    val arte = when (type) {
        EmptyStateType.NO_GAMES -> ArteId.PRANCHETA_VAZIA
        EmptyStateType.NO_GROUPS -> ArteId.COLETES_VARAL
        EmptyStateType.NO_PLAYERS -> ArteId.BANCO_VAZIO
        EmptyStateType.NO_NOTIFICATIONS -> ArteId.APITO
        EmptyStateType.NO_CONNECTION -> ArteId.BOLA_NA_TRAVE
        EmptyStateType.NO_RESULTS -> ArteId.LUPA
        EmptyStateType.ERROR -> ArteId.BOLA_NA_TRAVE
        EmptyStateType.COMING_SOON -> ArteId.CONES
    }
    ArteDaPelada(id = arte, modifier = modifier)
}

// ==================== Presets Comuns ====================

/**
 * Empty state para lista de jogos vazia.
 */
@Composable
fun NoGamesEmptyState(
    onCreateGame: () -> Unit,
    modifier: Modifier = Modifier
) {
    IllustratedEmptyState(
        config = EmptyStateConfig(
            type = EmptyStateType.NO_GAMES,
            title = stringResource(R.string.empty_illustration_no_games_title),
            message = stringResource(R.string.empty_illustration_no_games_desc),
            primaryAction = EmptyStateAction(stringResource(R.string.empty_state_no_games_action), onCreateGame)
        ),
        modifier = modifier
    )
}

/**
 * Empty state para lista de grupos vazia.
 */
@Composable
fun NoGroupsEmptyState(
    onCreateGroup: () -> Unit,
    onJoinGroup: () -> Unit,
    modifier: Modifier = Modifier
) {
    IllustratedEmptyState(
        config = EmptyStateConfig(
            type = EmptyStateType.NO_GROUPS,
            title = stringResource(R.string.empty_illustration_no_groups_title),
            message = stringResource(R.string.empty_illustration_no_groups_desc),
            primaryAction = EmptyStateAction(stringResource(R.string.empty_illustration_no_groups_action_create), onCreateGroup),
            secondaryAction = EmptyStateAction(stringResource(R.string.empty_illustration_no_groups_action_join), onJoinGroup)
        ),
        modifier = modifier
    )
}

/**
 * Empty state para sem conexão.
 */
@Composable
fun NoConnectionEmptyState(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    IllustratedEmptyState(
        config = EmptyStateConfig(
            type = EmptyStateType.NO_CONNECTION,
            title = stringResource(R.string.empty_illustration_no_connection_title),
            message = stringResource(R.string.empty_illustration_no_connection_desc),
            primaryAction = EmptyStateAction(stringResource(R.string.action_try_again), onRetry)
        ),
        modifier = modifier
    )
}

/**
 * Empty state para busca sem resultados.
 */
@Composable
fun NoResultsEmptyState(
    searchQuery: String,
    onClearSearch: () -> Unit,
    modifier: Modifier = Modifier
) {
    IllustratedEmptyState(
        config = EmptyStateConfig(
            type = EmptyStateType.NO_RESULTS,
            title = stringResource(R.string.empty_illustration_no_results_title),
            message = stringResource(R.string.empty_illustration_no_results_desc, searchQuery),
            primaryAction = EmptyStateAction(stringResource(R.string.empty_illustration_clear_search), onClearSearch)
        ),
        modifier = modifier
    )
}

/**
 * Empty state para erro genérico.
 */
@Composable
fun ErrorEmptyState(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    message: String = stringResource(R.string.empty_illustration_error_default_desc)
) {
    IllustratedEmptyState(
        config = EmptyStateConfig(
            type = EmptyStateType.ERROR,
            title = stringResource(R.string.empty_illustration_error_title),
            message = message,
            primaryAction = EmptyStateAction(stringResource(R.string.action_try_again), onRetry)
        ),
        modifier = modifier
    )
}
