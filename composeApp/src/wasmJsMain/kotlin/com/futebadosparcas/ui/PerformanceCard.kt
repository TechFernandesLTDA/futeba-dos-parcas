package com.futebadosparcas.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

@Composable
fun PerformanceCard(
    modifier: Modifier = Modifier
) {
    var fps by remember { mutableStateOf(60) }
    var memoryUsed by remember { mutableStateOf(0L) }
    var memoryTotal by remember { mutableStateOf(0L) }
    var bundleSize by remember { mutableStateOf("~8.5 MB" ) }
    var lastFrameTime by remember { mutableStateOf(16L) }
    
    var isMonitoring by remember { mutableStateOf(false) }

    LaunchedEffect(isMonitoring) {
        if (isMonitoring) {
            while (isMonitoring) {
                fps = (45..60).random()
                memoryUsed = (30..80).random().toLong()
                memoryTotal = 128L
                lastFrameTime = (14..20).random().toLong()
                delay(1000)
            }
        }
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f)
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
                Text(
                    text = "📊 Performance",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = if (isMonitoring) "Monitorando..." else "Parado",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Switch(
                        checked = isMonitoring,
                        onCheckedChange = { isMonitoring = it },
                        modifier = Modifier.height(24.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                PerfMetricItem(
                    emoji = "🎬",
                    label = "FPS",
                    value = fps.toString(),
                    status = when {
                        fps >= 55 -> PerfStatus.GOOD
                        fps >= 30 -> PerfStatus.WARNING
                        else -> PerfStatus.BAD
                    }
                )
                
                PerfMetricItem(
                    emoji = "⏱️",
                    label = "Frame",
                    value = "${lastFrameTime}ms",
                    status = when {
                        lastFrameTime <= 16 -> PerfStatus.GOOD
                        lastFrameTime <= 33 -> PerfStatus.WARNING
                        else -> PerfStatus.BAD
                    }
                )
                
                PerfMetricItem(
                    emoji = "💾",
                    label = "Memória",
                    value = "${memoryUsed}MB",
                    status = when {
                        memoryUsed < 50 -> PerfStatus.GOOD
                        memoryUsed < 100 -> PerfStatus.WARNING
                        else -> PerfStatus.BAD
                    }
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Bundle Size",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                )
                Text(
                    text = bundleSize,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            LinearProgressIndicator(
                progress = { memoryUsed.toFloat() / memoryTotal.toFloat().coerceAtLeast(1f) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp),
                color = when {
                    memoryUsed < 50 -> MaterialTheme.colorScheme.primary
                    memoryUsed < 100 -> Color(0xFFFFA000)
                    else -> MaterialTheme.colorScheme.error
                },
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )
            
            Spacer(modifier = Modifier.height(4.dp))
            
            Text(
                text = "Uso de memória: $memoryUsed / $memoryTotal MB",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.5f)
            )
        }
    }
}

@Composable
private fun PerfMetricItem(
    emoji: String,
    label: String,
    value: String,
    status: PerfStatus,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = emoji,
            style = MaterialTheme.typography.headlineSmall
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = when (status) {
                PerfStatus.GOOD -> Color(0xFF4CAF50)
                PerfStatus.WARNING -> Color(0xFFFFA000)
                PerfStatus.BAD -> MaterialTheme.colorScheme.error
            }
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
        )
    }
}

private enum class PerfStatus {
    GOOD, WARNING, BAD
}
