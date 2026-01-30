package com.futebadosparcas.ui.games.owner

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import android.graphics.Typeface
import android.net.Uri
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.futebadosparcas.R
import com.futebadosparcas.data.model.*
import com.futebadosparcas.ui.components.CachedProfileImage
import java.io.File
import java.io.FileOutputStream
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale

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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostGameReportScreen(
    report: PostGameReport,
    onNavigateBack: () -> Unit,
    onShare: () -> Unit,
    onShareWhatsApp: () -> Unit
) {
    val context = LocalContext.current
    val currencyFormat = remember { NumberFormat.getCurrencyInstance(Locale("pt", "BR")) }
    val dateFormat = remember { SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR")) }

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
            TopAppBar(
                title = { Text(stringResource(R.string.owner_post_game_report)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back))
                    }
                },
                actions = {
                    IconButton(onClick = onShareWhatsApp) {
                        Icon(
                            painter = androidx.compose.ui.res.painterResource(R.drawable.ic_whatsapp),
                            contentDescription = stringResource(R.string.share),
                            tint = com.futebadosparcas.ui.theme.BrandColors.WhatsApp
                        )
                    }
                    IconButton(onClick = onShare) {
                        Icon(Icons.Outlined.Share, stringResource(R.string.share))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
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
                        title = stringResource(R.string.owner_top_scorers),
                        players = report.topScorers,
                        icon = Icons.Filled.SportsSoccer,
                        valueLabel = stringResource(R.string.goals)
                    )
                }
            }

            // Top assistencias
            if (report.topAssists.isNotEmpty()) {
                item {
                    ReportTopPlayersCard(
                        title = stringResource(R.string.owner_top_assists),
                        players = report.topAssists,
                        icon = Icons.Filled.Star,
                        valueLabel = stringResource(R.string.assists)
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
                    unpaidCount = unpaidPlayers.size,
                    currencyFormat = currencyFormat
                )
            }

            // Lista de presentes
            item {
                Text(
                    text = stringResource(R.string.owner_present_players, presentPlayers.size),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
            items(presentPlayers, key = { it.userId }) { player ->
                ReportPlayerRow(
                    player = player,
                    icon = Icons.Filled.CheckCircle,
                    iconColor = com.futebadosparcas.ui.theme.BrandColors.WhatsApp
                )
            }

            // Lista de ausentes
            if (absentPlayers.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(R.string.owner_absent_players, absentPlayers.size),
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
                        text = stringResource(R.string.owner_unpaid_players, unpaidPlayers.size),
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
                        extraInfo = currencyFormat.format(report.game.dailyPrice)
                    )
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
                text = "${game.date} - ${game.time}",
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
                        text = team1?.name ?: stringResource(R.string.team_label_one),
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
                    text = " x ",
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
                        text = team2?.name ?: stringResource(R.string.team_label_two),
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
            containerColor = Color(0xFFFFD700).copy(alpha = 0.2f)
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
                contentDescription = null,
                tint = Color(0xFFFFD700),
                modifier = Modifier.size(32.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.owner_mvp_title),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
                Text(
                    text = player.getDisplayName(),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }

            CachedProfileImage(
                photoUrl = player.userPhoto,
                userName = player.userName,
                size = 48.dp
            )
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
                text = stringResource(R.string.owner_match_stats),
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
                    label = stringResource(R.string.owner_present),
                    color = com.futebadosparcas.ui.theme.BrandColors.WhatsApp
                )
                StatBox(
                    value = absentCount.toString(),
                    label = stringResource(R.string.owner_absent),
                    color = MaterialTheme.colorScheme.error
                )
                StatBox(
                    value = totalGoals.toString(),
                    label = stringResource(R.string.goals),
                    color = MaterialTheme.colorScheme.primary
                )
                StatBox(
                    value = yellowCards.toString(),
                    label = stringResource(R.string.owner_yellow),
                    color = Color(0xFFFDD835)
                )
                StatBox(
                    value = redCards.toString(),
                    label = stringResource(R.string.owner_red),
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

                    CachedProfileImage(
                        photoUrl = player.userPhoto,
                        userName = player.userName,
                        size = 32.dp
                    )
                    Spacer(modifier = Modifier.width(8.dp))

                    Text(
                        text = player.getDisplayName(),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

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
    unpaidCount: Int,
    currencyFormat: NumberFormat
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
                    text = stringResource(R.string.owner_financial_summary),
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
                        text = currencyFormat.format(totalCost),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    Text(
                        text = stringResource(R.string.owner_total_cost),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = currencyFormat.format(collected),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = com.futebadosparcas.ui.theme.BrandColors.WhatsApp
                    )
                    Text(
                        text = stringResource(R.string.owner_collected_count, paidCount),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = currencyFormat.format(pending),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error
                    )
                    Text(
                        text = stringResource(R.string.owner_pending_count, unpaidCount),
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

        CachedProfileImage(
            photoUrl = player.userPhoto,
            userName = player.userName,
            size = 32.dp
        )
        Spacer(modifier = Modifier.width(8.dp))

        Text(
            text = player.getDisplayName(),
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        if (player.goals > 0) {
            Text(
                text = "${player.goals} gols",
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

/**
 * Funcao utilitaria para gerar e compartilhar o relatorio como imagem
 */
fun generateAndShareReport(
    context: Context,
    report: PostGameReport,
    asWhatsApp: Boolean = false
) {
    // Gerar texto do relatorio
    val currencyFormat = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))

    val presentPlayers = report.confirmations.filter {
        it.status == ConfirmationStatus.CONFIRMED.name && it.wasPresent
    }
    val paidCount = report.confirmations.count { it.paymentStatus == PaymentStatus.PAID.name }
    val unpaidCount = report.confirmations.count {
        it.status == ConfirmationStatus.CONFIRMED.name &&
        it.paymentStatus != PaymentStatus.PAID.name
    }

    val reportText = buildString {
        appendLine("FUTEBA DOS PARCAS")
        appendLine("Relatorio Pos-Jogo")
        appendLine()
        appendLine("${report.game.date} - ${report.game.time}")
        appendLine(report.game.locationName)
        appendLine()
        appendLine("PLACAR: ${report.game.team1Score} x ${report.game.team2Score}")
        appendLine()
        report.mvpPlayer?.let {
            appendLine("MVP: ${it.getDisplayName()}")
            appendLine()
        }
        appendLine("Presentes: ${presentPlayers.size}")
        appendLine("Gols: ${report.totalGoals}")
        appendLine()
        appendLine("FINANCEIRO:")
        appendLine("Custo: ${currencyFormat.format(report.game.totalCost)}")
        appendLine("Pagos: $paidCount | Devendo: $unpaidCount")
        appendLine()
        if (report.topScorers.isNotEmpty()) {
            appendLine("ARTILHEIROS:")
            report.topScorers.take(3).forEach { (player, goals) ->
                appendLine("${player.getDisplayName()}: $goals gols")
            }
        }
    }

    val intent = if (asWhatsApp) {
        Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("https://wa.me/?text=${Uri.encode(reportText)}")
        }
    } else {
        Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, reportText)
        }
    }

    context.startActivity(Intent.createChooser(intent, "Compartilhar Relatorio"))
}
