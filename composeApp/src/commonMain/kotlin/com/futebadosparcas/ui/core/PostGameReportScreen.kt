package com.futebadosparcas.ui.core

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.cd_back
import com.futebadosparcas.compose.resources.owner_absent
import com.futebadosparcas.compose.resources.owner_absent_players
import com.futebadosparcas.compose.resources.owner_financial_summary
import com.futebadosparcas.compose.resources.owner_financial_total_cost
import com.futebadosparcas.compose.resources.owner_game_date_time
import com.futebadosparcas.compose.resources.owner_goals
import com.futebadosparcas.compose.resources.owner_match_stats
import com.futebadosparcas.compose.resources.owner_mvp_short
import com.futebadosparcas.compose.resources.owner_paid_count_parenthesized
import com.futebadosparcas.compose.resources.owner_post_game_report
import com.futebadosparcas.compose.resources.owner_present
import com.futebadosparcas.compose.resources.owner_present_players
import com.futebadosparcas.compose.resources.owner_red
import com.futebadosparcas.compose.resources.owner_score_separator
import com.futebadosparcas.compose.resources.owner_share_whatsapp_cd
import com.futebadosparcas.compose.resources.owner_team_default_1
import com.futebadosparcas.compose.resources.owner_team_default_2
import com.futebadosparcas.compose.resources.owner_top_assists_compact
import com.futebadosparcas.compose.resources.owner_top_scorers
import com.futebadosparcas.compose.resources.owner_unpaid_count_parenthesized
import com.futebadosparcas.compose.resources.owner_unpaid_players
import com.futebadosparcas.compose.resources.owner_yellow
import com.futebadosparcas.compose.resources.report_player_goals
import com.futebadosparcas.compose.resources.share
import com.futebadosparcas.domain.model.*
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import org.jetbrains.compose.resources.stringResource

// Log: removeu imports java.*, resources android, etc.
// Substituiu formatacao monetaria por funcao local

/**
 * Issue #66: Relatorio Pos-Jogo
 * Resumo completo: presentes, ausentes, pagamentos, placar, MVP.
 */
data class PostGameReport(
    val game: Game,
    val confirmations: List<GameConfirmation>,
    val teams: List<Team>,
    val mvpPlayer: GameConfirmation? = null,
    val totalGoals: Int = 0,
    val topScorers: List<Pair<GameConfirmation, Int>> = emptyList(),
    val topAssists: List<Pair<GameConfirmation, Int>> = emptyList(),
    val yellowCards: Int = 0,
    val redCards: Int = 0
)

// Funcao local para formatar moeda (BRL)
private fun formatCurrency(amount: Double): String {
    val whole = amount.toLong()
    val cents = ((amount - whole) * 100).toInt()
    return "R$ $whole,${cents.toString().padStart(2, '0')}"
}

// Funcao local para formatar data (dd/MM/yyyy)
private fun formatDate(date: String): String {
    // Assume formato ISO (yyyy-MM-dd) ou similar
    val parts = date.split("-")
    return if (parts.size == 3) {
        "${parts[2]}/${parts[1]}/${parts[0]}"
    } else date
}

// Componente substituto para CachedProfileImage (iniciais)
@Composable
private fun ProfileInitials(name: String, size: Int = 32) {
    val firstChar = name.firstOrNull()?.uppercase() ?: "?"
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primaryContainer),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = firstChar,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
            fontWeight = FontWeight.Bold,
            fontSize = (size / 2).sp
        )
    }
}

// Componente substituto para TeamBadgeById (escudo placeholder)
@Composable
private fun TeamBadgePlaceholder(size: Int = 18) {
    Icon(
        imageVector = Icons.Filled.Shield,
        contentDescription = null,
        modifier = Modifier.size(size.dp),
        tint = MaterialTheme.colorScheme.primary
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostGameReportScreen(
    report: PostGameReport,
    onNavigateBack: () -> Unit,
    onShare: () -> Unit,
    onShareWhatsApp: () -> Unit
) {
    val presentPlayers = report.confirmations.filter {
        it.status == ConfirmationStatus.CONFIRMED.name && it.wasPresent
    }
    val absentPlayers = report.confirmations.filter {
        it.status == ConfirmationStatus.CONFIRMED.name && !it.wasPresent
    }
    val paidPlayers = report.confirmations.filter {
        it.paymentStatus == PaymentStatus.PAID.name
    }
    val unpaidPlayers = report.confirmations.filter {
        it.status == ConfirmationStatus.CONFIRMED.name &&
        it.paymentStatus != PaymentStatus.PAID.name
    }

    val totalCollected = paidPlayers.size * report.game.dailyPrice
    val totalPending = unpaidPlayers.size * report.game.dailyPrice

    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = stringResource(Res.string.owner_post_game_report),
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(Res.string.cd_back)
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onShareWhatsApp) {
                        Icon(
                            imageVector = Icons.Filled.Chat,
                            contentDescription = stringResource(Res.string.owner_share_whatsapp_cd),
                            tint = Color(0xFF25D366) // verde whatsapp
                        )
                    }
                    IconButton(onClick = onShare) {
                        Icon(
                            Icons.Outlined.Share,
                            contentDescription = stringResource(Res.string.share)
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        Crossfade(
            targetState = report.game.id,
            label = "postGameReportCrossfade"
        ) { _ ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .widthIn(max = 920.dp),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header com placar
            item {
                ReportScoreCard(
                    game = report.game,
                    teams = report.teams
                )
            }

            // MVP
            report.mvpPlayer?.let { mvp ->
                item {
                    MvpCard(player = mvp)
                }
            }

            // Estatisticas gerais
            item {
                ReportStatsCard(
                    presentCount = presentPlayers.size,
                    absentCount = absentPlayers.size,
                    totalGoals = report.totalGoals,
                    yellowCards = report.yellowCards,
                    redCards = report.redCards
                )
            }

            // Top artilheiros
            if (report.topScorers.isNotEmpty()) {
                item {
                    ReportTopPlayersCard(
                        title = stringResource(Res.string.owner_top_scorers),
                        players = report.topScorers,
                        icon = Icons.Filled.SportsSoccer,
                        valueLabel = stringResource(Res.string.owner_goals)
                    )
                }
            }

            // Top assistencias
            if (report.topAssists.isNotEmpty()) {
                item {
                    ReportTopPlayersCard(
                        title = stringResource(Res.string.owner_top_assists_compact),
                        players = report.topAssists,
                        icon = Icons.Filled.Star,
                        valueLabel = stringResource(Res.string.owner_top_assists_compact)
                    )
                }
            }

            // Resumo financeiro
            item {
                ReportFinancialCard(
                    totalCost = report.game.totalCost,
                    collected = totalCollected,
                    pending = totalPending,
                    paidCount = paidPlayers.size,
                    unpaidCount = unpaidPlayers.size
                )
            }

            // Lista de presentes
            item {
                Text(
                    text = stringResource(Res.string.owner_present_players, presentPlayers.size),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
            items(presentPlayers, key = { it.userId }) { player ->
                ReportPlayerRow(
                    player = player,
                    icon = Icons.Filled.CheckCircle,
                    iconColor = Color(0xFF25D366)
                )
            }

            // Lista de ausentes
            if (absentPlayers.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(Res.string.owner_absent_players, absentPlayers.size),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                items(absentPlayers, key = { it.userId }) { player ->
                    ReportPlayerRow(
                        player = player,
                        icon = Icons.Filled.Cancel,
                        iconColor = MaterialTheme.colorScheme.error
                    )
                }
            }

            // Lista de devedores
            if (unpaidPlayers.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(Res.string.owner_unpaid_players, unpaidPlayers.size),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.tertiary
                    )
                }
                items(unpaidPlayers, key = { it.userId }) { player ->
                    ReportPlayerRow(
                        player = player,
                        icon = Icons.Outlined.AttachMoney,
                        iconColor = MaterialTheme.colorScheme.tertiary,
                        extraInfo = formatCurrency(report.game.dailyPrice)
                    )
                }
            }
        }
        }
    }
}

@Composable
private fun ReportScoreCard(
    game: Game,
    teams: List<Team>
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = stringResource(Res.string.owner_game_date_time, formatDate(game.date), game.time),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
            )
            Text(
                text = game.locationName,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Placar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val team1 = teams.getOrNull(0)
                val team2 = teams.getOrNull(1)

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = team1?.name ?: stringResource(Res.string.owner_team_default_1),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }

                Spacer(modifier = Modifier.width(24.dp))

                Text(
                    text = "${game.team1Score}",
                    style = MaterialTheme.typography.displayMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )

                Text(
                    text = stringResource(Res.string.owner_score_separator),
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.5f)
                )

                Text(
                    text = "${game.team2Score}",
                    style = MaterialTheme.typography.displayMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )

                Spacer(modifier = Modifier.width(24.dp))

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = team2?.name ?: stringResource(Res.string.owner_team_default_2),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
        }
    }
}

@Composable
private fun MvpCard(player: GameConfirmation) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Filled.Star,
                contentDescription = stringResource(Res.string.owner_mvp_short),
                tint = Color(0xFFFFD700),
                modifier = Modifier.size(32.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(Res.string.owner_mvp_short),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = player.getDisplayName(),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    TeamBadgePlaceholder(size = 20)
                }
            }

            ProfileInitials(name = player.userName, size = 48)
        }
    }
}

@Composable
private fun ReportStatsCard(
    presentCount: Int,
    absentCount: Int,
    totalGoals: Int,
    yellowCards: Int,
    redCards: Int
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(Res.string.owner_match_stats),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatBox(
                    value = presentCount.toString(),
                    label = stringResource(Res.string.owner_present),
                    color = Color(0xFF25D366)
                )
                StatBox(
                    value = absentCount.toString(),
                    label = stringResource(Res.string.owner_absent),
                    color = MaterialTheme.colorScheme.error
                )
                StatBox(
                    value = totalGoals.toString(),
                    label = stringResource(Res.string.owner_goals),
                    color = MaterialTheme.colorScheme.primary
                )
                StatBox(
                    value = yellowCards.toString(),
                    label = stringResource(Res.string.owner_yellow),
                    color = Color(0xFFFDD835)
                )
                StatBox(
                    value = redCards.toString(),
                    label = stringResource(Res.string.owner_red),
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
private fun StatBox(
    value: String,
    label: String,
    color: Color
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = color
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun ReportTopPlayersCard(
    title: String,
    players: List<Pair<GameConfirmation, Int>>,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    valueLabel: String
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(modifier = Modifier.height(12.dp))

            players.take(3).forEachIndexed { index, (player, count) ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Medal/position
                    val medalColor = when (index) {
                        0 -> Color(0xFFFFD700)
                        1 -> Color(0xFFE0E0E0)
                        2 -> Color(0xFFCD7F32)
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(medalColor),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "${index + 1}",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = if (index == 1) Color.Black else Color.White
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    ProfileInitials(name = player.userName, size = 32)
                    Spacer(modifier = Modifier.width(8.dp))

                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                        Text(
                            text = player.getDisplayName(),
                            style = MaterialTheme.typography.bodyMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        TeamBadgePlaceholder(size = 18)
                    }

                    Text(
                        text = count.toString(),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

@Composable
private fun ReportFinancialCard(
    totalCost: Double,
    collected: Double,
    pending: Double,
    paidCount: Int,
    unpaidCount: Int
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Outlined.AttachMoney,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSecondaryContainer
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(Res.string.owner_financial_summary),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )
            }
            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = formatCurrency(totalCost),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    Text(
                        text = stringResource(Res.string.owner_financial_total_cost),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = formatCurrency(collected),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF25D366)
                    )
                    Text(
                        text = stringResource(Res.string.owner_paid_count_parenthesized, paidCount),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = formatCurrency(pending),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error
                    )
                    Text(
                        text = stringResource(Res.string.owner_unpaid_count_parenthesized, unpaidCount),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                    )
                }
            }
        }
    }
}

@Composable
private fun ReportPlayerRow(
    player: GameConfirmation,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconColor: Color,
    extraInfo: String? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = iconColor,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))

        ProfileInitials(name = player.userName, size = 32)
        Spacer(modifier = Modifier.width(8.dp))

        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
            Text(
                text = player.getDisplayName(),
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.width(4.dp))
            TeamBadgePlaceholder(size = 18)
        }

        if (player.goals > 0) {
            Text(
                text = stringResource(Res.string.report_player_goals, player.goals),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(8.dp))
        }

        extraInfo?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = iconColor
            )
        }
    }
}
