package com.futebadosparcas.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private data class FeatureFlag(
    val id: String,
    val name: String,
    val description: String,
    val enabled: Boolean
)

private sealed class DeveloperToolsUiState {
    object Loading : DeveloperToolsUiState()
    data class Success(
        val devModeEnabled: Boolean,
        val featureFlags: List<FeatureFlag>,
        val lastAction: String?
    ) : DeveloperToolsUiState()
}

@Composable
fun DeveloperToolsScreen(
    onNavigateBack: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var uiState by remember { mutableStateOf<DeveloperToolsUiState>(DeveloperToolsUiState.Loading) }
    var showResetDialog by remember { mutableStateOf(false) }
    var showMockDataDialog by remember { mutableStateOf(false) }
    var actionMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        delay(100)
        val devModeEnabled = jsGetDevModeEnabled()
        val flags = listOf(
            FeatureFlag("new_ranking", "Novo Ranking", "Sistema de ranking por divisões", true),
            FeatureFlag("dark_mode_auto", "Dark Mode Auto", "Detectar preferência do sistema", true),
            FeatureFlag("pwa_install", "PWA Install", "Mostrar banner de instalação", true),
            FeatureFlag("push_notifications", "Push Notifications", "Notificações push (mock)", false),
            FeatureFlag("offline_mode", "Modo Offline", "Cache local para offline", false),
            FeatureFlag("analytics", "Analytics", "Coleta de métricas de uso", false)
        )
        uiState = DeveloperToolsUiState.Success(
            devModeEnabled = devModeEnabled,
            featureFlags = flags,
            lastAction = null
        )
    }

    LaunchedEffect(actionMessage) {
        if (actionMessage != null) {
            delay(3000)
            actionMessage = null
        }
    }

    when (val state = uiState) {
        is DeveloperToolsUiState.Loading -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        }
        is DeveloperToolsUiState.Success -> {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item(key = "header") {
                    DeveloperToolsHeader(
                        devModeEnabled = state.devModeEnabled,
                        onDevModeToggle = { enabled ->
                            jsSetDevModeEnabled(enabled)
                            uiState = state.copy(
                                devModeEnabled = enabled,
                                lastAction = "Modo desenvolvedor ${if (enabled) "ativado" else "desativado"}"
                            )
                        },
                        onNavigateBack = onNavigateBack
                    )
                }

                item(key = "action_message") {
                    if (state.lastAction != null || actionMessage != null) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.primaryContainer
                            )
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(text = "✅", style = MaterialTheme.typography.titleMedium)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = actionMessage ?: state.lastAction ?: "",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            }
                        }
                    }
                }

                item(key = "debug_info") {
                    DebugInfoCard()
                }

                item(key = "performance") {
                    PerformanceCard()
                }

                item(key = "actions_title") {
                    Text(
                        text = "Ações",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                    )
                }

                item(key = "actions") {
                    ActionButtonsGrid(
                        onResetLocalData = { showResetDialog = true },
                        onClearCache = {
                            scope.launch {
                                jsClearBrowserCache()
                                actionMessage = "Cache do navegador limpo!"
                            }
                        },
                        onPopulateMockData = { showMockDataDialog = true },
                        onReloadApp = {
                            jsReloadPage()
                        },
                        onExportLogs = {
                            scope.launch {
                                jsExportLogs()
                                actionMessage = "Logs exportados para console!"
                            }
                        }
                    )
                }

                item(key = "feature_flags_title") {
                    Text(
                        text = "Feature Flags",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 16.dp, bottom = 4.dp)
                    )
                }

                items(state.featureFlags.size, key = { "flag_$it" }) { index ->
                    val flag = state.featureFlags[index]
                    FeatureFlagItem(
                        flag = flag,
                        onToggle = { enabled ->
                            val updatedFlags = state.featureFlags.toMutableList()
                            updatedFlags[index] = flag.copy(enabled = enabled)
                            uiState = state.copy(
                                featureFlags = updatedFlags,
                                lastAction = "Flag '${flag.name}' ${if (enabled) "ativada" else "desativada"}"
                            )
                        }
                    )
                }

                item(key = "warning") {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f)
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.Top
                        ) {
                            Text(
                                text = "⚠️",
                                style = MaterialTheme.typography.titleMedium
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = "Área restrita",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onErrorContainer
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Estas ferramentas são destinadas apenas para desenvolvimento e debug. Use com cuidado em produção.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.8f)
                                )
                            }
                        }
                    }
                }

                item(key = "spacer") {
                    Spacer(modifier = Modifier.height(24.dp))
                }
            }
        }
    }

    if (showResetDialog) {
        ResetDataDialog(
            onDismiss = { showResetDialog = false },
            onConfirm = {
                showResetDialog = false
                scope.launch {
                    jsClearLocalStorage()
                    actionMessage = "Dados locais resetados! Recarregue a página."
                }
            }
        )
    }

    if (showMockDataDialog) {
        MockDataDialog(
            onDismiss = { showMockDataDialog = false },
            onConfirm = {
                showMockDataDialog = false
                scope.launch {
                    delay(500)
                    actionMessage = "Dados de teste populados com sucesso!"
                }
            }
        )
    }
}

@Composable
private fun DeveloperToolsHeader(
    devModeEnabled: Boolean,
    onDevModeToggle: (Boolean) -> Unit,
    onNavigateBack: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (devModeEnabled) 
                MaterialTheme.colorScheme.primaryContainer 
            else 
                MaterialTheme.colorScheme.surfaceVariant
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
                    Text(
                        text = "←",
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier
                            .clickable { onNavigateBack() }
                            .padding(end = 12.dp)
                    )
                    Text(
                        text = "🔧 Developer Tools",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(
                        if (devModeEnabled) 
                            MaterialTheme.colorScheme.primary.copy(alpha = 0.2f) 
                        else 
                            MaterialTheme.colorScheme.surface.copy(alpha = 0.5f)
                    )
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Modo Desenvolvedor",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = if (devModeEnabled) "Ativado - Ferramentas liberadas" else "Desativado",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )
                }
                
                Switch(
                    checked = devModeEnabled,
                    onCheckedChange = onDevModeToggle
                )
            }
        }
    }
}

@Composable
private fun ActionButtonsGrid(
    onResetLocalData: () -> Unit,
    onClearCache: () -> Unit,
    onPopulateMockData: () -> Unit,
    onReloadApp: () -> Unit,
    onExportLogs: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ActionButton(
                modifier = Modifier.weight(1f),
                emoji = "🗑️",
                title = "Reset Local",
                subtitle = "Limpar dados locais",
                onClick = onResetLocalData,
                isDestructive = true
            )
            ActionButton(
                modifier = Modifier.weight(1f),
                emoji = "🧹",
                title = "Clear Cache",
                subtitle = "Limpar cache navegador",
                onClick = onClearCache
            )
        }
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ActionButton(
                modifier = Modifier.weight(1f),
                emoji = "🧪",
                title = "Mock Data",
                subtitle = "Popular dados de teste",
                onClick = onPopulateMockData
            )
            ActionButton(
                modifier = Modifier.weight(1f),
                emoji = "🔄",
                title = "Reload",
                subtitle = "Recarregar aplicação",
                onClick = onReloadApp
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ActionButton(
                modifier = Modifier.weight(1f),
                emoji = "📋",
                title = "Export Logs",
                subtitle = "Baixar logs do console",
                onClick = onExportLogs
            )
            ActionButton(
                modifier = Modifier.weight(1f),
                emoji = "🔐",
                title = "Test Auth",
                subtitle = "Simular autenticação",
                onClick = {
                    jsTestAuth()
                }
            )
        }
    }
}

@Composable
private fun ActionButton(
    modifier: Modifier = Modifier,
    emoji: String,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    isDestructive: Boolean = false
) {
    Card(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isDestructive) 
                MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f) 
            else 
                MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = emoji,
                style = MaterialTheme.typography.headlineMedium
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = if (isDestructive) 
                    MaterialTheme.colorScheme.error 
                else 
                    MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun FeatureFlagItem(
    flag: FeatureFlag,
    onToggle: (Boolean) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = if (flag.enabled) "🟢" else "⚪",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = flag.name,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                }
                Text(
                    text = flag.description,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 24.dp)
                )
            }
            
            Switch(
                checked = flag.enabled,
                onCheckedChange = onToggle
            )
        }
    }
}

@Composable
private fun ResetDataDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("🗑️ Resetar Dados Locais") },
        text = { 
            Text("Isso irá limpar todos os dados salvos localmente no navegador, incluindo preferências e cache. Deseja continuar?") 
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Resetar")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

@Composable
private fun MockDataDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("🧪 Popular Dados de Teste") },
        text = { 
            Text("Isso irá criar dados fictícios para testes:\n\n• 5 jogos de exemplo\n• 3 grupos\n• 6 campos\n• Ranking com 15 jogadores\n\nDeseja continuar?") 
        },
        confirmButton = {
            Button(onClick = onConfirm) {
                Text("Popular")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}
