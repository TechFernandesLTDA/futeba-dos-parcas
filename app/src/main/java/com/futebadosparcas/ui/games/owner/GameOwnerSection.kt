package com.futebadosparcas.ui.games.owner

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.outlined.Rule
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.data.model.*

/**
 * Secao completa de ferramentas do organizador para GameDetailScreen.
 * Inclui todas as funcionalidades dos issues #61-70.
 */
@Composable
fun GameOwnerSection(
    game: Game,
    confirmations: List<GameConfirmation>,
    isOwner: Boolean,
    isCoOrganizer: Boolean,
    onShowFinancialDashboard: () -> Unit,
    onShowMassMessage: () -> Unit,
    onShowDelegateAdmin: () -> Unit,
    onShowBlockedPlayers: () -> Unit,
    onShowAutoClose: () -> Unit,
    onShowRules: () -> Unit,
    onShowPostGameReport: () -> Unit,
    onShowOwnerStats: () -> Unit,
    onShowTransferOwnership: () -> Unit,
    modifier: Modifier = Modifier,
    onShowCheckinSettings: () -> Unit = {}
) {
    // Apenas dono ou co-organizador pode ver
    if (!isOwner && !isCoOrganizer) return

    var expanded by remember { mutableStateOf(false) }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .animateContentSize(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHighest
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded },
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Outlined.AdminPanelSettings,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = stringResource(R.string.owner_tools_title),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = if (isOwner) stringResource(R.string.owner_role_owner)
                                   else stringResource(R.string.owner_role_co_organizer),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                Icon(
                    imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = null
                )
            }

            // Acoes rapidas sempre visiveis
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                QuickActionButton(
                    icon = Icons.Outlined.AttachMoney,
                    label = stringResource(R.string.owner_financial_short),
                    onClick = onShowFinancialDashboard
                )
                QuickActionButton(
                    icon = Icons.AutoMirrored.Filled.Send,
                    label = stringResource(R.string.owner_notify_short),
                    onClick = onShowMassMessage
                )
                if (game.status == GameStatus.FINISHED.name) {
                    QuickActionButton(
                        icon = Icons.Outlined.Summarize,
                        label = stringResource(R.string.owner_report_short),
                        onClick = onShowPostGameReport
                    )
                }
            }

            // Conteudo expandido
            AnimatedVisibility(
                visible = expanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                Column(modifier = Modifier.padding(top = 16.dp)) {
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(12.dp))

                    // Grid de opcoes
                    OwnerOptionItem(
                        icon = Icons.Outlined.PeopleAlt,
                        title = stringResource(R.string.owner_delegate_admin),
                        subtitle = stringResource(R.string.owner_delegate_admin_subtitle),
                        onClick = onShowDelegateAdmin
                    )

                    OwnerOptionItem(
                        icon = Icons.Outlined.Block,
                        title = stringResource(R.string.owner_blocked_players),
                        subtitle = stringResource(R.string.owner_blocked_players_subtitle),
                        onClick = onShowBlockedPlayers
                    )

                    OwnerOptionItem(
                        icon = Icons.Outlined.Timer,
                        title = stringResource(R.string.owner_auto_close_title),
                        subtitle = if (game.autoCloseHours != null)
                            stringResource(R.string.owner_auto_close_enabled, game.autoCloseHours ?: 0)
                        else stringResource(R.string.owner_auto_close_disabled),
                        onClick = onShowAutoClose
                    )

                    OwnerOptionItem(
                        icon = Icons.Outlined.LocationOn,
                        title = stringResource(R.string.checkin_settings_title),
                        subtitle = if (game.requireCheckin)
                            stringResource(R.string.checkin_enabled_with_radius, game.checkinRadiusMeters)
                        else stringResource(R.string.checkin_disabled),
                        onClick = onShowCheckinSettings
                    )

                    OwnerOptionItem(
                        icon = Icons.AutoMirrored.Outlined.Rule,
                        title = stringResource(R.string.owner_rules),
                        subtitle = if (game.rules.isNotBlank())
                            game.rules.take(50) + "..."
                        else stringResource(R.string.owner_rules_empty),
                        onClick = onShowRules
                    )

                    OwnerOptionItem(
                        icon = Icons.Outlined.BarChart,
                        title = stringResource(R.string.owner_my_stats),
                        subtitle = stringResource(R.string.owner_my_stats_subtitle),
                        onClick = onShowOwnerStats
                    )

                    // Apenas o dono pode transferir propriedade
                    if (isOwner) {
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        OwnerOptionItem(
                            icon = Icons.Outlined.SwapHoriz,
                            title = stringResource(R.string.owner_transfer_ownership),
                            subtitle = stringResource(R.string.owner_transfer_ownership_subtitle),
                            onClick = onShowTransferOwnership,
                            isDanger = true
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit
) {
    FilledTonalButton(
        onClick = onClick,
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun OwnerOptionItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    isDanger: Boolean = false
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (isDanger) MaterialTheme.colorScheme.error
                   else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = if (isDanger) MaterialTheme.colorScheme.error
                       else MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Exibe as regras do jogo para todos os jogadores (Issue #68).
 */
@Composable
fun GameRulesSection(
    rules: String,
    modifier: Modifier = Modifier
) {
    if (rules.isBlank()) return

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.5f)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.AutoMirrored.Outlined.Rule,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.tertiary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.owner_game_rules),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.tertiary
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = rules,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

/**
 * Indicador de co-organizadores do jogo.
 */
@Composable
fun CoOrganizersChip(
    coOrganizers: List<String>,
    confirmations: List<GameConfirmation>,
    modifier: Modifier = Modifier
) {
    if (coOrganizers.isEmpty()) return

    val coOrgNames = confirmations
        .filter { it.userId in coOrganizers }
        .map { it.getDisplayName() }
        .take(2)

    val displayText = when {
        coOrgNames.isEmpty() -> return
        coOrgNames.size == 1 -> coOrgNames.first()
        coOrganizers.size == 2 -> coOrgNames.joinToString(" e ")
        else -> "${coOrgNames.first()} +${coOrganizers.size - 1}"
    }

    SuggestionChip(
        onClick = { },
        label = {
            Text(
                text = stringResource(R.string.owner_co_organizers, displayText),
                style = MaterialTheme.typography.labelSmall
            )
        },
        icon = {
            Icon(
                imageVector = Icons.Outlined.SupervisorAccount,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
        },
        modifier = modifier
    )
}
