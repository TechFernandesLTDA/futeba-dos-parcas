package com.futebadosparcas.ui.components.modern

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
/**
 * Empty state moderno com ilustração, mensagem e CTA
 *
 * Segue Material 3 Design System para estados vazios
 *
 * @param icon Ícone ilustrativo (pode ser substituído por Lottie animation)
 * @param title Título principal
 * @param message Mensagem descritiva
 * @param actionText Texto do botão de ação (opcional)
 * @param onAction Ação ao clicar no botão (opcional)
 */
@Composable
fun EmptyState(
    icon: ImageVector,
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    actionText: String? = null,
    onAction: (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Ícone ilustrativo
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(120.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Título
        Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Mensagem
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(0.8f)
        )

        // Botão de ação (se fornecido)
        if (actionText != null && onAction != null) {
            Spacer(modifier = Modifier.height(24.dp))

            FilledTonalButton(
                onClick = onAction,
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(48.dp)
            ) {
                Text(
                    text = actionText,
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }
    }
}

/**
 * Empty state pré-configurado para lista de jogos
 */
@Composable
fun EmptyGamesState(
    modifier: Modifier = Modifier,
    onCreateGame: (() -> Unit)? = null
) {
    EmptyState(
        icon = Icons.Default.SportsFootball,
        title = stringResource(R.string.empty_state_no_games_title_generic),
        message = stringResource(R.string.empty_state_no_games_desc_generic),
        actionText = if (onCreateGame != null) stringResource(R.string.empty_state_no_games_action) else null,
        onAction = onCreateGame,
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para confirmações
 */
@Composable
fun EmptyConfirmationsState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.PeopleAlt,
        title = stringResource(R.string.empty_state_no_games_title_generic),
        message = stringResource(R.string.empty_state_no_games_desc_generic),
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para estatísticas
 */
@Composable
fun EmptyStatisticsState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.BarChart,
        title = stringResource(R.string.empty_state_no_statistics_title),
        message = stringResource(R.string.empty_state_no_statistics_desc),
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para badges
 */
@Composable
fun EmptyBadgesState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.EmojiEvents,
        title = stringResource(R.string.empty_state_no_games_title_generic),
        message = stringResource(R.string.empty_state_no_games_desc_generic),
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para notificações
 */
@Composable
fun EmptyNotificationsState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.NotificationsNone,
        title = stringResource(R.string.empty_state_no_notifications_title),
        message = stringResource(R.string.empty_state_no_notifications_desc),
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para ranking
 */
@Composable
fun EmptyRankingState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.Leaderboard,
        title = stringResource(R.string.empty_state_no_ranking_title),
        message = stringResource(R.string.empty_state_no_ranking_desc),
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para grupos
 */
@Composable
fun EmptyGroupsState(
    modifier: Modifier = Modifier,
    onCreateGroup: (() -> Unit)? = null,
    onJoinGroup: (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Groups,
            contentDescription = null,
            modifier = Modifier.size(120.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = stringResource(R.string.empty_state_no_groups_title),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = stringResource(R.string.empty_state_no_groups_desc),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(0.8f)
        )

        Spacer(modifier = Modifier.height(24.dp))

        if (onCreateGroup != null) {
            FilledTonalButton(
                onClick = onCreateGroup,
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.empty_state_no_groups_action),
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }

        if (onJoinGroup != null) {
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedButton(
                onClick = onJoinGroup,
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.GroupAdd,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.empty_state_no_groups_join_action),
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }
    }
}

/**
 * Empty state pré-configurado para busca sem resultados
 */
@Composable
fun EmptySearchState(
    searchQuery: String,
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.SearchOff,
        title = stringResource(R.string.empty_state_no_games_title_generic),
        message = stringResource(R.string.empty_state_no_games_desc_generic),
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para caixa do grupo (cashbox)
 */
@Composable
fun EmptyCashboxState(
    modifier: Modifier = Modifier,
    onAddTransaction: (() -> Unit)? = null
) {
    EmptyState(
        icon = Icons.Default.AccountBalanceWallet,
        title = stringResource(R.string.empty_state_no_cashbox_title),
        message = stringResource(R.string.empty_state_no_cashbox_desc),
        actionText = if (onAddTransaction != null) stringResource(R.string.empty_state_no_cashbox_action) else null,
        onAction = onAddTransaction,
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para badges/conquistas
 */
@Composable
fun EmptyBadgesFullState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.EmojiEvents,
        title = stringResource(R.string.empty_state_no_badges_title),
        message = stringResource(R.string.empty_state_no_badges_desc),
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para agendamentos
 */
@Composable
fun EmptySchedulesState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.CalendarMonth,
        title = stringResource(R.string.empty_state_no_schedules_title),
        message = stringResource(R.string.empty_state_no_schedules_desc),
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para membros do grupo
 */
@Composable
fun EmptyMembersState(
    modifier: Modifier = Modifier,
    onInvite: (() -> Unit)? = null
) {
    EmptyState(
        icon = Icons.Default.PersonAdd,
        title = stringResource(R.string.empty_state_no_members_title),
        message = stringResource(R.string.empty_state_no_members_desc),
        actionText = if (onInvite != null) stringResource(R.string.empty_state_no_members_action) else null,
        onAction = onInvite,
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para feed de atividades
 */
@Composable
fun EmptyActivitiesState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.Timeline,
        title = stringResource(R.string.empty_state_no_activities_title),
        message = stringResource(R.string.empty_state_no_activities_desc),
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para histórico de XP
 */
@Composable
fun EmptyXpLogsState(
    modifier: Modifier = Modifier
) {
    EmptyState(
        icon = Icons.Default.TrendingUp,
        title = stringResource(R.string.empty_state_no_xp_logs_title),
        message = stringResource(R.string.empty_state_no_xp_logs_desc),
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para locais/campos
 */
@Composable
fun EmptyLocationsState(
    modifier: Modifier = Modifier,
    onAddLocation: (() -> Unit)? = null
) {
    EmptyState(
        icon = Icons.Default.LocationOn,
        title = stringResource(R.string.empty_state_no_locations_title),
        message = stringResource(R.string.empty_state_no_locations_desc),
        actionText = if (onAddLocation != null) stringResource(R.string.empty_state_no_locations_action) else null,
        onAction = onAddLocation,
        modifier = modifier
    )
}

/**
 * Empty state pré-configurado para jogadores
 */
@Composable
fun EmptyPlayersState(
    modifier: Modifier = Modifier,
    onInvite: (() -> Unit)? = null
) {
    EmptyState(
        icon = Icons.Default.People,
        title = stringResource(R.string.empty_state_no_players_title),
        message = stringResource(R.string.empty_state_no_players_desc),
        actionText = if (onInvite != null) stringResource(R.string.empty_state_invite_players) else null,
        onAction = onInvite,
        modifier = modifier
    )
}

/**
 * Variante compacta para empty state em cards/seções
 */
@Composable
fun CompactEmptyState(
    icon: ImageVector,
    message: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(48.dp)
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}
