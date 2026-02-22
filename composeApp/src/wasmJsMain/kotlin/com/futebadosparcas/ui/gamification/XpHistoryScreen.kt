package com.futebadosparcas.ui.gamification

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.theme.GamificationColors

private data class XpTransaction(
    val id: String,
    val amount: Int,
    val source: String,
    val description: String,
    val timestamp: Double,
    val gameId: String? = null
)

private sealed class XpPeriodFilter {
    object All : XpPeriodFilter()
    object Today : XpPeriodFilter()
    object Week : XpPeriodFilter()
    object Month : XpPeriodFilter()
}

private fun generateMockXpHistory(): List<XpTransaction> {
    val now = jsGetCurrentTimestamp()
    val hour = 60.0 * 60.0 * 1000.0
    val day = 24.0 * 60.0 * 60.0 * 1000.0

    return listOf(
        XpTransaction("1", 10, "PARTICIPATION", "Participação na pelada", now - 2 * hour, "game1"),
        XpTransaction("2", 15, "GOAL", "Gol marcado (x3)", now - 3 * hour, "game1"),
        XpTransaction("3", 6, "ASSIST", "Assistências (x2)", now - 3 * hour, "game1"),
        XpTransaction("4", 20, "WIN", "Vitória do time", now - 3 * hour, "game1"),
        XpTransaction("5", 50, "MVP", "Eleito MVP da partida", now - 4 * hour, "game1"),
        XpTransaction("6", 10, "PARTICIPATION", "Participação na pelada", now - day, "game2"),
        XpTransaction("7", 10, "GOAL", "Gol marcado (x2)", now - day, "game2"),
        XpTransaction("8", 3, "ASSIST", "Assistência", now - day, "game2"),
        XpTransaction("9", 10, "PARTICIPATION", "Participação na pelada", now - 2 * day, "game3"),
        XpTransaction("10", 25, "GOAL", "Gols marcados (x5)", now - 2 * day, "game3"),
        XpTransaction("11", 50, "MVP", "Eleito MVP da partida", now - 2 * day, "game3"),
        XpTransaction("12", 15, "HAT_TRICK", "Hat-trick conquistado", now - 2 * day, "game3"),
        XpTransaction("13", 20, "STREAK", "Bônus sequência de 7 dias", now - 3 * day),
        XpTransaction("14", 10, "PARTICIPATION", "Participação na pelada", now - 3 * day, "game4"),
        XpTransaction("15", 5, "GOAL", "Gol marcado", now - 3 * day, "game4"),
        XpTransaction("16", 2, "SAVE", "Defesa de goleiro", now - 3 * day, "game4"),
        XpTransaction("17", 10, "PARTICIPATION", "Participação na pelada", now - 5 * day, "game5"),
        XpTransaction("18", 20, "WIN", "Vitória do time", now - 5 * day, "game5"),
        XpTransaction("19", 10, "PARTICIPATION", "Participação na pelada", now - 7 * day, "game6"),
        XpTransaction("20", 35, "GOAL", "Gols marcados (x7)", now - 7 * day, "game6"),
        XpTransaction("21", 50, "MVP", "Eleito MVP da partida", now - 7 * day, "game6"),
        XpTransaction("22", 10, "STREAK", "Bônus sequência de 3 dias", now - 10 * day),
        XpTransaction("23", 10, "PARTICIPATION", "Participação na pelada", now - 15 * day, "game7"),
        XpTransaction("24", 15, "GOAL", "Gols marcados (x3)", now - 15 * day, "game7"),
        XpTransaction("25", 10, "STREAK", "Bônus sequência de 7 dias", now - 20 * day),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun XpHistoryScreen(
    totalXP: Long,
    onNavigateBack: () -> Unit
) {
    var selectedPeriod by remember { mutableStateOf<XpPeriodFilter>(XpPeriodFilter.All) }
    var showFilterDialog by remember { mutableStateOf(false) }

    val allTransactions = remember { generateMockXpHistory() }

    val filteredTransactions = remember(selectedPeriod, allTransactions) {
        val now = jsGetCurrentTimestamp()
        val day = 24.0 * 60.0 * 60.0 * 1000.0

        when (selectedPeriod) {
            XpPeriodFilter.All -> allTransactions
            XpPeriodFilter.Today -> allTransactions.filter {
                now - it.timestamp < day
            }
            XpPeriodFilter.Week -> allTransactions.filter {
                now - it.timestamp < 7 * day
            }
            XpPeriodFilter.Month -> allTransactions.filter {
                now - it.timestamp < 30 * day
            }
        }
    }

    val totalFilteredXP = filteredTransactions.sumOf { it.amount }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        text = "Histórico de XP",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Text("←", style = MaterialTheme.typography.titleLarge)
                    }
                },
                actions = {
                    TextButton(onClick = { showFilterDialog = true }) {
                        Text("Filtrar")
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            XpSummaryCard(
                totalXP = totalXP,
                periodXP = totalFilteredXP,
                periodLabel = when (selectedPeriod) {
                    XpPeriodFilter.All -> "Total"
                    XpPeriodFilter.Today -> "Hoje"
                    XpPeriodFilter.Week -> "Esta semana"
                    XpPeriodFilter.Month -> "Este mês"
                }
            )

            if (filteredTransactions.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "📊",
                            style = MaterialTheme.typography.displayLarge
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Nenhuma transação de XP encontrada",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "Jogue peladas para ganhar XP!",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredTransactions, key = { it.id }) { transaction ->
                        XpTransactionItem(transaction = transaction)
                    }
                }
            }
        }
    }

    if (showFilterDialog) {
        XpFilterDialog(
            selectedPeriod = selectedPeriod,
            onPeriodSelected = { selectedPeriod = it },
            onDismiss = { showFilterDialog = false }
        )
    }
}

@Composable
private fun XpSummaryCard(
    totalXP: Long,
    periodXP: Int,
    periodLabel: String
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Total Acumulado",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "$totalXP XP",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }

            Box(
                modifier = Modifier
                    .width(1.dp)
                    .height(50.dp)
                    .background(MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f))
            )

            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = periodLabel,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "+$periodXP",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = GamificationColors.XpGreen
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "XP",
                        style = MaterialTheme.typography.titleMedium,
                        color = GamificationColors.XpGreen
                    )
                }
            }
        }
    }
}

@Composable
private fun XpTransactionItem(
    transaction: XpTransaction
) {
    val (emoji, bgColor) = getXpSourceStyle(transaction.source)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(bgColor, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = emoji,
                    style = MaterialTheme.typography.headlineSmall
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = transaction.description,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = formatTransactionDate(transaction.timestamp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Surface(
                shape = RoundedCornerShape(8.dp),
                color = GamificationColors.XpGreen.copy(alpha = 0.15f)
            ) {
                Text(
                    text = "+${transaction.amount} XP",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = GamificationColors.XpGreen,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                )
            }
        }
    }
}

@Composable
private fun getXpSourceStyle(source: String): Pair<String, Color> {
    return when (source) {
        "PARTICIPATION" -> "👟" to GamificationColors.XpGreen.copy(alpha = 0.2f)
        "GOAL" -> "⚽" to GamificationColors.Gold.copy(alpha = 0.2f)
        "ASSIST" -> "👟" to MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
        "SAVE" -> "🧤" to MaterialTheme.colorScheme.secondary.copy(alpha = 0.2f)
        "WIN" -> "🏆" to GamificationColors.Gold.copy(alpha = 0.2f)
        "MVP" -> "⭐" to GamificationColors.Gold.copy(alpha = 0.3f)
        "HAT_TRICK" -> "🎩" to GamificationColors.Gold.copy(alpha = 0.25f)
        "STREAK" -> "🔥" to Color(0xFFFF9800).copy(alpha = 0.2f)
        "LEVEL_UP" -> "🎉" to GamificationColors.LevelUpGold.copy(alpha = 0.2f)
        else -> "✨" to MaterialTheme.colorScheme.surfaceVariant
    }
}

private fun formatTransactionDate(timestamp: Double): String {
    val now = jsGetCurrentTimestamp()
    val diff = now - timestamp
    val day = 24.0 * 60.0 * 60.0 * 1000.0
    val hour = 60.0 * 60.0 * 1000.0
    val minute = 60.0 * 1000.0

    return when {
        diff < minute -> "Agora mesmo"
        diff < hour -> "${(diff / minute).toInt()} min atrás"
        diff < day -> "${(diff / hour).toInt()}h atrás"
        diff < 2 * day -> "Ontem"
        diff < 7 * day -> "${(diff / day).toInt()} dias atrás"
        else -> {
            val date = jsFormatDate(timestamp.toLong())
            date
        }
    }
}

@Composable
private fun XpFilterDialog(
    selectedPeriod: XpPeriodFilter,
    onPeriodSelected: (XpPeriodFilter) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Filtrar por período") },
        text = {
            Column {
                XpFilterOption(
                    label = "Todo o período",
                    isSelected = selectedPeriod is XpPeriodFilter.All,
                    onClick = { onPeriodSelected(XpPeriodFilter.All) }
                )
                XpFilterOption(
                    label = "Hoje",
                    isSelected = selectedPeriod is XpPeriodFilter.Today,
                    onClick = { onPeriodSelected(XpPeriodFilter.Today) }
                )
                XpFilterOption(
                    label = "Última semana",
                    isSelected = selectedPeriod is XpPeriodFilter.Week,
                    onClick = { onPeriodSelected(XpPeriodFilter.Week) }
                )
                XpFilterOption(
                    label = "Último mês",
                    isSelected = selectedPeriod is XpPeriodFilter.Month,
                    onClick = { onPeriodSelected(XpPeriodFilter.Month) }
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fechar")
            }
        }
    )
}

@Composable
private fun XpFilterOption(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        RadioButton(
            selected = isSelected,
            onClick = onClick
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge
        )
    }
}

private external fun jsGetCurrentTimestamp(): Double
private external fun jsFormatDate(timestamp: Long): String
