package com.futebadosparcas.ui.debug

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.BuildConfig
import com.futebadosparcas.util.LocationQueryMetrics
import com.futebadosparcas.util.QueryStats

/**
 * Tela de debug para visualizar metricas de queries de Location.
 *
 * Disponivel apenas em builds de debug.
 * Mostra:
 * - Resumo de todas as queries
 * - Latencia media, p95, max
 * - Contagem de erros
 * - Indicadores visuais de performance
 *
 * Uso:
 * Acessivel atraves do menu de desenvolvedor ou configuracoes avancadas.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationMetricsScreen(
    onBack: () -> Unit
) {
    // Verifica se esta em modo debug
    if (!BuildConfig.DEBUG) {
        DebugOnlyMessage(onBack)
        return
    }

    var metrics by remember { mutableStateOf(LocationQueryMetrics.getMetricsSummary()) }
    var refreshTrigger by remember { mutableIntStateOf(0) }

    // Atualiza metricas quando refreshTrigger muda
    LaunchedEffect(refreshTrigger) {
        metrics = LocationQueryMetrics.getMetricsSummary()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Location Query Metrics") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Voltar"
                        )
                    }
                },
                actions = {
                    // Botao de refresh
                    IconButton(onClick = { refreshTrigger++ }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Atualizar"
                        )
                    }
                    // Botao de limpar metricas
                    IconButton(onClick = {
                        LocationQueryMetrics.clearMetrics()
                        refreshTrigger++
                    }) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Limpar metricas"
                        )
                    }
                    // Botao de enviar ao Analytics
                    IconButton(onClick = {
                        LocationQueryMetrics.reportMetricsToAnalytics()
                    }) {
                        Icon(
                            imageVector = Icons.Default.CloudUpload,
                            contentDescription = "Enviar ao Analytics"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                    navigationIconContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { paddingValues ->
        if (metrics.isEmpty()) {
            EmptyMetricsMessage(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            )
        } else {
            MetricsList(
                metrics = metrics,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            )
        }
    }
}

@Composable
private fun DebugOnlyMessage(onBack: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "Disponivel apenas em builds de debug",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Button(onClick = onBack) {
                Text("Voltar")
            }
        }
    }
}

@Composable
private fun EmptyMetricsMessage(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Analytics,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "Nenhuma metrica registrada",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "Execute operacoes de Location para coletar metricas",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun MetricsList(
    metrics: Map<String, QueryStats>,
    modifier: Modifier = Modifier
) {
    val sortedMetrics = remember(metrics) {
        metrics.entries.sortedByDescending { it.value.count }
    }

    // Calcular totais
    val totalQueries = sortedMetrics.sumOf { it.value.count }
    val totalErrors = sortedMetrics.sumOf { it.value.errorCount }
    val overallAvg = if (totalQueries > 0) {
        sortedMetrics.sumOf { it.value.totalMs } / totalQueries
    } else 0L

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Resumo geral
        item {
            SummaryCard(
                totalQueries = totalQueries,
                totalErrors = totalErrors,
                overallAvgMs = overallAvg
            )
        }

        // Legenda
        item {
            LegendCard()
        }

        // Header da tabela
        item {
            MetricsTableHeader()
        }

        // Linhas de metricas
        items(sortedMetrics, key = { it.key }) { (queryName, stats) ->
            MetricsRow(queryName = queryName, stats = stats)
        }

        // Espacamento no final
        item {
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun SummaryCard(
    totalQueries: Int,
    totalErrors: Int,
    overallAvgMs: Long
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Resumo Geral",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                SummaryItem(
                    label = "Total Queries",
                    value = totalQueries.toString(),
                    icon = Icons.Default.Storage
                )
                SummaryItem(
                    label = "Erros",
                    value = totalErrors.toString(),
                    icon = Icons.Default.Error,
                    isError = totalErrors > 0
                )
                SummaryItem(
                    label = "Media Geral",
                    value = "${overallAvgMs}ms",
                    icon = Icons.Default.Speed
                )
            }
        }
    }
}

@Composable
private fun SummaryItem(
    label: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isError: Boolean = false
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(24.dp),
            tint = if (isError) {
                MaterialTheme.colorScheme.error
            } else {
                MaterialTheme.colorScheme.onPrimaryContainer
            }
        )
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = if (isError) {
                MaterialTheme.colorScheme.error
            } else {
                MaterialTheme.colorScheme.onPrimaryContainer
            }
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun LegendCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            LegendItem(
                color = Color(0xFF4CAF50),
                label = "Bom (<500ms)"
            )
            LegendItem(
                color = Color(0xFFFF9800),
                label = "Lento (500-2s)"
            )
            LegendItem(
                color = Color(0xFFF44336),
                label = "Critico (>2s)"
            )
        }
    }
}

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(CircleShape)
                .background(color)
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun MetricsTableHeader() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Query",
                modifier = Modifier.width(180.dp),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "Count",
                modifier = Modifier.width(60.dp),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.End,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "Avg",
                modifier = Modifier.width(70.dp),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.End,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "P95",
                modifier = Modifier.width(70.dp),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.End,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "Max",
                modifier = Modifier.width(70.dp),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.End,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "Err",
                modifier = Modifier.width(50.dp),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.End,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

@Composable
private fun MetricsRow(
    queryName: String,
    stats: QueryStats
) {
    val statusColor = when {
        stats.p95Ms > LocationQueryMetrics.SLOW_QUERY_THRESHOLD_MS -> Color(0xFFF44336) // Vermelho
        stats.p95Ms > 500 -> Color(0xFFFF9800) // Laranja
        else -> Color(0xFF4CAF50) // Verde
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Indicador de status
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(statusColor)
            )

            // Nome da query
            Text(
                text = formatQueryName(queryName),
                modifier = Modifier.width(168.dp),
                style = MaterialTheme.typography.bodySmall,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1
            )

            // Count
            Text(
                text = stats.count.toString(),
                modifier = Modifier.width(60.dp),
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.End,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Avg
            Text(
                text = "${stats.avgMs}ms",
                modifier = Modifier.width(70.dp),
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.End,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // P95
            Text(
                text = "${stats.p95Ms}ms",
                modifier = Modifier.width(70.dp),
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.End,
                fontWeight = FontWeight.Bold,
                color = statusColor
            )

            // Max
            Text(
                text = "${stats.maxMs}ms",
                modifier = Modifier.width(70.dp),
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.End,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Errors
            Text(
                text = stats.errorCount.toString(),
                modifier = Modifier.width(50.dp),
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.End,
                color = if (stats.errorCount > 0) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
        }
    }
}

/**
 * Formata o nome da query para exibicao.
 * Remove prefixo comum e converte underscores em espacos.
 */
private fun formatQueryName(queryName: String): String {
    return queryName
        .removePrefix("location_")
        .removePrefix("field_")
        .replace("_", " ")
        .replaceFirstChar { it.uppercase() }
}
