package com.futebadosparcas.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.unit.dp
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.firebase.FirebaseManager.AdminMetrics
import kotlinx.coroutines.launch

private data class ChartData(
    val label: String,
    val value: Int,
    val maxValue: Int
)

private sealed class AdminUiState {
    object Loading : AdminUiState()
    data class Success(val metrics: AdminMetrics) : AdminUiState()
    data class Error(val message: String) : AdminUiState()
}

private sealed class AdminScreen {
    object Dashboard : AdminScreen()
    object Users : AdminScreen()
    object Reports : AdminScreen()
}

@Composable
fun AdminTab(
    onNavigateToUsers: () -> Unit = {},
    onNavigateToReports: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var uiState by remember { mutableStateOf<AdminUiState>(AdminUiState.Loading) }

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                val firebaseMetrics = FirebaseManager.getAdminMetrics()
                val metrics = AdminMetrics(
                    totalUsers = firebaseMetrics.totalUsers,
                    totalGames = firebaseMetrics.totalGames,
                    totalGroups = firebaseMetrics.totalGroups,
                    totalLocations = firebaseMetrics.totalLocations,
                    activeUsersToday = firebaseMetrics.activeUsersToday,
                    gamesThisWeek = firebaseMetrics.gamesThisWeek,
                    pendingReports = firebaseMetrics.pendingReports,
                    newUsersThisMonth = firebaseMetrics.newUsersThisMonth
                )
                uiState = AdminUiState.Success(metrics)
            } catch (e: Exception) {
                uiState = AdminUiState.Error(e.message ?: "Erro ao carregar métricas")
            }
        }
    }

    when (val state = uiState) {
        is AdminUiState.Loading -> AdminLoadingShimmer()
        is AdminUiState.Success -> AdminDashboard(
            metrics = state.metrics,
            onNavigateToUsers = onNavigateToUsers,
            onNavigateToReports = onNavigateToReports
        )
        is AdminUiState.Error -> AdminErrorState(
            message = state.message,
            onRetry = { uiState = AdminUiState.Loading }
        )
    }
}

@Composable
private fun AdminDashboard(
    metrics: AdminMetrics,
    onNavigateToUsers: () -> Unit,
    onNavigateToReports: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item(key = "header") {
            AdminHeader()
        }

        item(key = "metrics_row1") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                MetricCard(
                    modifier = Modifier.weight(1f),
                    emoji = "👥",
                    title = "Usuários",
                    value = metrics.totalUsers.toString(),
                    subtitle = "+${metrics.newUsersThisMonth} este mês",
                    color = Color(0xFF4CAF50)
                )
                MetricCard(
                    modifier = Modifier.weight(1f),
                    emoji = "⚽",
                    title = "Jogos",
                    value = metrics.totalGames.toString(),
                    subtitle = "${metrics.gamesThisWeek} esta semana",
                    color = Color(0xFF2196F3)
                )
            }
        }

        item(key = "metrics_row2") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                MetricCard(
                    modifier = Modifier.weight(1f),
                    emoji = "🏟️",
                    title = "Grupos",
                    value = metrics.totalGroups.toString(),
                    subtitle = "Ativos",
                    color = Color(0xFF9C27B0)
                )
                MetricCard(
                    modifier = Modifier.weight(1f),
                    emoji = "📍",
                    title = "Locais",
                    value = metrics.totalLocations.toString(),
                    subtitle = "Cadastrados",
                    color = Color(0xFFFF9800)
                )
            }
        }

        item(key = "activity_chart") {
            ActivityChartCard()
        }

        item(key = "quick_actions") {
            QuickActionsCard(
                onNavigateToUsers = onNavigateToUsers,
                onNavigateToReports = onNavigateToReports,
                pendingReports = metrics.pendingReports
            )
        }

        item(key = "system_status") {
            SystemStatusCard(
                activeUsersToday = metrics.activeUsersToday
            )
        }

        item(key = "spacer") {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun AdminHeader() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.error),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "👑",
                    style = MaterialTheme.typography.headlineMedium
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Painel Admin",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
                Text(
                    text = "Gerenciamento e métricas do sistema",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.7f)
                )
            }
        }
    }
}

@Composable
private fun MetricCard(
    modifier: Modifier = Modifier,
    emoji: String,
    title: String,
    value: String,
    subtitle: String,
    color: Color
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = emoji,
                style = MaterialTheme.typography.headlineMedium
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = color
            )
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ActivityChartCard() {
    val weeklyData = listOf(
        ChartData("Seg", 12, 20),
        ChartData("Ter", 8, 20),
        ChartData("Qua", 15, 20),
        ChartData("Qui", 10, 20),
        ChartData("Sex", 18, 20),
        ChartData("Sáb", 22, 22),
        ChartData("Dom", 20, 22)
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
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
                Text(
                    text = "📊 Jogos por Dia",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Última semana",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.Bottom
            ) {
                weeklyData.forEach { data ->
                    BarChart(
                        label = data.label,
                        value = data.value,
                        maxValue = data.maxValue
                    )
                }
            }
        }
    }
}

@Composable
private fun BarChart(
    label: String,
    value: Int,
    maxValue: Int
) {
    val height = 120.dp
    val barHeight = if (maxValue > 0) (value.toFloat() / maxValue) else 0f
    val color = MaterialTheme.colorScheme.primary

    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .width(28.dp)
                .height(height)
                .clip(RoundedCornerShape(4.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.BottomCenter
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(height * barHeight)
                    .clip(RoundedCornerShape(4.dp))
                    .background(color)
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value.toString(),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}

@Composable
private fun QuickActionsCard(
    onNavigateToUsers: () -> Unit,
    onNavigateToReports: () -> Unit,
    pendingReports: Int
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "⚡ Ações Rápidas",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                QuickActionButton(
                    modifier = Modifier.weight(1f),
                    emoji = "👤",
                    title = "Promover Admin",
                    onClick = onNavigateToUsers
                )
                QuickActionButton(
                    modifier = Modifier.weight(1f),
                    emoji = "📍",
                    title = "Gerenciar Locais",
                    onClick = { }
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                QuickActionButton(
                    modifier = Modifier.weight(1f),
                    emoji = "⚠️",
                    title = "Denúncias",
                    badge = if (pendingReports > 0) pendingReports.toString() else null,
                    onClick = onNavigateToReports
                )
                QuickActionButton(
                    modifier = Modifier.weight(1f),
                    emoji = "📊",
                    title = "Relatórios",
                    onClick = { }
                )
            }
        }
    }
}

@Composable
private fun QuickActionButton(
    modifier: Modifier = Modifier,
    emoji: String,
    title: String,
    badge: String? = null,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                Box {
                    Text(
                        text = emoji,
                        style = MaterialTheme.typography.headlineSmall
                    )
                    if (badge != null) {
                        Surface(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .offset(x = 8.dp, y = (-4).dp),
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.error
                        ) {
                            Text(
                                text = badge,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onError,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
private fun SystemStatusCard(activeUsersToday: Int) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF4CAF50).copy(alpha = 0.1f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "🟢 Status do Sistema",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                StatusItem(
                    label = "Usuários Ativos Hoje",
                    value = activeUsersToday.toString()
                )
                StatusItem(
                    label = "Uptime",
                    value = "99.9%"
                )
                StatusItem(
                    label = "API",
                    value = "Online"
                )
            }
        }
    }
}

@Composable
private fun StatusItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF4CAF50)
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun AdminLoadingShimmer() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Box(
                            modifier = Modifier
                                .width(150.dp)
                                .height(24.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Box(
                            modifier = Modifier
                                .width(200.dp)
                                .height(16.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                        )
                    }
                }
            }
        }

        items(3) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
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
                            .height(80.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                }
            }
        }
    }
}

@Composable
private fun AdminErrorState(message: String, onRetry: () -> Unit) {
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
