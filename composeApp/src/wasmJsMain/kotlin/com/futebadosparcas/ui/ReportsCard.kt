package com.futebadosparcas.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.firebase.FirebaseManager.Report
import com.futebadosparcas.platform.Date
import kotlinx.coroutines.launch

private data class ReportStats(
    val pending: Int,
    val reviewed: Int,
    val resolved: Int
)

private sealed class ReportsState {
    object Loading : ReportsState()
    data class Success(val reports: List<Report>, val stats: ReportStats) : ReportsState()
    data class Error(val message: String) : ReportsState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportsScreen(
    onBackClick: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var uiState by remember { mutableStateOf<ReportsState>(ReportsState.Loading) }
    var selectedReport by remember { mutableStateOf<Report?>(null) }
    var showActionDialog by remember { mutableStateOf(false) }
    var actionType by remember { mutableStateOf<ReportAction?>(null) }

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                val reports = FirebaseManager.getPendingReports()
                val stats = ReportStats(
                    pending = reports.count { it.status == "PENDING" },
                    reviewed = reports.count { it.status == "REVIEWED" },
                    resolved = reports.count { it.status == "RESOLVED" }
                )
                uiState = ReportsState.Success(reports, stats)
            } catch (e: Exception) {
                uiState = ReportsState.Error(e.message ?: "Erro ao carregar denúncias")
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Text(
                    text = "⚠️ Denúncias",
                    fontWeight = FontWeight.Bold
                )
            },
            navigationIcon = {
                IconButton(onClick = onBackClick) {
                    Text("←", style = MaterialTheme.typography.titleLarge)
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.errorContainer,
                titleContentColor = MaterialTheme.colorScheme.onErrorContainer
            )
        )

        when (val state = uiState) {
            is ReportsState.Loading -> ReportsLoading()
            is ReportsState.Success -> {
                if (state.reports.isEmpty()) {
                    EmptyReportsState()
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp)
                    ) {
                        Spacer(modifier = Modifier.height(8.dp))

                        ReportStatsRow(stats = state.stats)

                        Spacer(modifier = Modifier.height(16.dp))

                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            contentPadding = PaddingValues(vertical = 8.dp)
                        ) {
                            items(state.reports, key = { it.id }) { report ->
                                ReportCard(
                                    report = report,
                                    onAction = { action ->
                                        selectedReport = report
                                        actionType = action
                                        showActionDialog = true
                                    }
                                )
                            }
                        }
                    }
                }
            }
            is ReportsState.Error -> ReportsError(
                message = state.message,
                onRetry = { uiState = ReportsState.Loading }
            )
        }
    }

    if (showActionDialog && selectedReport != null && actionType != null) {
        ReportActionDialog(
            report = selectedReport!!,
            action = actionType!!,
            onDismiss = { showActionDialog = false },
            onConfirm = {
                scope.launch {
                    val success = when (actionType) {
                        ReportAction.IGNORE -> FirebaseManager.ignoreReport(selectedReport!!.id)
                        ReportAction.WARN -> FirebaseManager.warnUser(selectedReport!!.reportedUserId, selectedReport!!.id)
                        ReportAction.BAN -> FirebaseManager.banUser(selectedReport!!.reportedUserId, selectedReport!!.id)
                        null -> false
                    }
                    if (success) {
                        val currentState = uiState as ReportsState.Success
                        val updatedReports = currentState.reports.filter { it.id != selectedReport!!.id }
                        val stats = ReportStats(
                            pending = updatedReports.count { it.status == "PENDING" },
                            reviewed = updatedReports.count { it.status == "REVIEWED" },
                            resolved = updatedReports.count { it.status == "RESOLVED" }
                        )
                        uiState = ReportsState.Success(updatedReports, stats)
                    }
                }
                showActionDialog = false
            }
        )
    }
}

@Composable
private fun ReportStatsRow(stats: ReportStats) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatChip(
            modifier = Modifier.weight(1f),
            emoji = "⏳",
            label = "Pendentes",
            value = stats.pending,
            color = Color(0xFFFF9800)
        )
        StatChip(
            modifier = Modifier.weight(1f),
            emoji = "👁️",
            label = "Analisadas",
            value = stats.reviewed,
            color = Color(0xFF2196F3)
        )
        StatChip(
            modifier = Modifier.weight(1f),
            emoji = "✅",
            label = "Resolvidas",
            value = stats.resolved,
            color = Color(0xFF4CAF50)
        )
    }
}

@Composable
private fun StatChip(
    modifier: Modifier = Modifier,
    emoji: String,
    label: String,
    value: Int,
    color: Color
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = color.copy(alpha = 0.1f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = emoji, style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = value.toString(),
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
}

@Composable
private fun ReportCard(
    report: Report,
    onAction: (ReportAction) -> Unit
) {
    val typeEmoji = when (report.type) {
        "SPAM" -> "📧"
        "ABUSE" -> "👊"
        "FAKE_PROFILE" -> "🎭"
        "CHEATING" -> "🃏"
        "INAPPROPRIATE" -> "🚫"
        else -> "⚠️"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = typeEmoji, style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = report.type.replace("_", " ").lowercase().replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
                Text(
                    text = getTimeAgo(report.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = report.reason,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = report.description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(12.dp))

            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Denunciante:",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = report.reporterName,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "Denunciado:",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.error
                    )
                    Text(
                        text = report.reportedUserName,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = { onAction(ReportAction.IGNORE) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                ) {
                    Text("Ignorar", style = MaterialTheme.typography.labelMedium)
                }
                FilledTonalButton(
                    onClick = { onAction(ReportAction.WARN) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.filledTonalButtonColors(
                        containerColor = Color(0xFFFF9800).copy(alpha = 0.2f),
                        contentColor = Color(0xFFFF9800)
                    )
                ) {
                    Text("Avisar", style = MaterialTheme.typography.labelMedium)
                }
                Button(
                    onClick = { onAction(ReportAction.BAN) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Banir", style = MaterialTheme.typography.labelMedium)
                }
            }
        }
    }
}

private enum class ReportAction {
    IGNORE, WARN, BAN
}

@Composable
private fun ReportActionDialog(
    report: Report,
    action: ReportAction,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    val (title, message, confirmText, emoji) = when (action) {
        ReportAction.IGNORE -> listOf(
            "Ignorar Denúncia",
            "A denúncia será marcada como revisada sem nenhuma ação.",
            "Ignorar",
            "✅"
        )
        ReportAction.WARN -> listOf(
            "Enviar Aviso",
            "${report.reportedUserName} receberá um aviso formal.",
            "Enviar Aviso",
            "⚠️"
        )
        ReportAction.BAN -> listOf(
            "Banir Usuário",
            "ATENÇÃO: Esta ação é irreversível! ${report.reportedUserName} será permanentemente banido.",
            "Banir",
            "🚫"
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(text = emoji, style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.width(8.dp))
                Text(title)
            }
        },
        text = {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium
            )
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (action == ReportAction.BAN) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.primary
                    }
                )
            ) {
                Text(confirmText)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

@Composable
private fun EmptyReportsState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "🎉",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Nenhuma denúncia pendente!",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Todas as denúncias foram revisadas.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun ReportsLoading() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(4) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .width(150.dp)
                            .height(20.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(60.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                }
            }
        }
    }
}

@Composable
private fun ReportsError(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "❌",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onRetry) {
            Text("🔄")
            Spacer(modifier = Modifier.width(8.dp))
            Text("Tentar novamente")
        }
    }
}

private fun getTimeAgo(timestamp: Long): String {
    val now = Date.now().toLong()
    val diff = now - timestamp
    
    val minutes = diff / (1000 * 60)
    val hours = diff / (1000 * 60 * 60)
    val days = diff / (1000 * 60 * 60 * 24)
    
    return when {
        minutes < 1 -> "Agora"
        minutes < 60 -> "${minutes}m"
        hours < 24 -> "${hours}h"
        days < 7 -> "${days}d"
        else -> "${days / 7}sem"
    }
}
