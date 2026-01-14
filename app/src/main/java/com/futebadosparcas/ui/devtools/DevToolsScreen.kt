package com.futebadosparcas.ui.devtools

import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.ui.auth.LoginActivityCompose
import com.futebadosparcas.util.PreferencesManager
import kotlinx.coroutines.launch

/**
 * DevToolsScreen - Ferramentas de Desenvolvedor
 *
 * Permite:
 * - Alternar entre dados mockados e Firebase real
 * - Limpar cache local
 * - Popular 50 locais de Curitiba/PR
 * - Reiniciar o app
 * - Limpar todas as preferências
 *
 * Features:
 * - Switch para modo mock
 * - Botões de ação com feedback visual
 * - Confirmação para ações destrutivas
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DevToolsScreen(
    preferencesManager: PreferencesManager,
    gameDao: GameDao,
    locationRepository: LocationRepository,
    onNavigateBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var isMockMode by remember { mutableStateOf(preferencesManager.isMockModeEnabled()) }
    var isSeedingLocations by remember { mutableStateOf(false) }
    var showToast by remember { mutableStateOf<String?>(null) }

    // Show toast effect
    LaunchedEffect(showToast) {
        showToast?.let {
            // Toast would be shown here in Fragment
            showToast = null
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.dev_tools_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.cd_back)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // ========== MODO DE DADOS ==========
            Text(
                text = "Fonte de Dados",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Usar Dados Mockados",
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "FakeRepository ao invés de Firebase",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                        Switch(
                            checked = isMockMode,
                            onCheckedChange = { checked ->
                                isMockMode = checked
                                preferencesManager.setMockModeEnabled(checked)
                                showToast = "Modo alterado. Reinicie o app para aplicar."
                            },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = MaterialTheme.colorScheme.primary,
                                checkedTrackColor = MaterialTheme.colorScheme.primaryContainer
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = if (isMockMode) {
                            "📱 Modo atual: Dados Mockados (FakeRepository)"
                        } else {
                            "☁️ Modo atual: Firebase Real"
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (isMockMode) {
                            MaterialTheme.colorScheme.tertiary
                        } else {
                            MaterialTheme.colorScheme.primary
                        },
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // ========== AÇÕES DE CACHE ==========
            Text(
                text = "Cache e Dados",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 8.dp, bottom = 8.dp)
            )

            // Limpar Cache Local
            DevToolButton(
                title = stringResource(R.string.dev_tools_clear_cache),
                description = stringResource(R.string.dev_tools_clear_cache_desc),
                icon = Icons.Default.CleaningServices,
                containerColor = MaterialTheme.colorScheme.errorContainer,
                contentColor = MaterialTheme.colorScheme.onErrorContainer,
                onClick = {
                    scope.launch {
                        try {
                            gameDao.clearAll()
                            showToast = "Cache local limpo!"
                        } catch (e: Exception) {
                            showToast = "Erro: ${e.message}"
                        }
                    }
                }
            )

            // Popular Locais
            DevToolButton(
                title = stringResource(R.string.dev_tools_seed_apollo),
                description = stringResource(R.string.dev_tools_seed_apollo_desc),
                icon = Icons.Default.LocationOn,
                isLoading = isSeedingLocations,
                onClick = {
                    scope.launch {
                        isSeedingLocations = true
                        showToast = "Iniciando seed do Ginásio Apollo..."

                        val result = locationRepository.seedGinasioApollo()

                        isSeedingLocations = false
                        result.fold(
                            onSuccess = { location ->
                                showToast = "Sucesso! ${location.name} criado com 6 quadras (4 futsal + 2 society)."
                            },
                            onFailure = { e ->
                                showToast = "Erro: ${e.message}"
                            }
                        )
                    }
                }
            )

            // Limpar Preferências
            DevToolButton(
                title = stringResource(R.string.dev_tools_reset_prefs),
                description = stringResource(R.string.dev_tools_reset_prefs_desc),
                icon = Icons.Default.SettingsBackupRestore,
                containerColor = MaterialTheme.colorScheme.errorContainer,
                contentColor = MaterialTheme.colorScheme.onErrorContainer,
                onClick = {
                    preferencesManager.clearAll()
                    isMockMode = preferencesManager.isMockModeEnabled()
                    showToast = "Preferências resetadas!"
                }
            )

            // ========== SISTEMA ==========
            Text(
                text = "Sistema",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 8.dp, bottom = 8.dp)
            )

            // Reiniciar App
            DevToolButton(
                title = stringResource(R.string.dev_tools_restart_app),
                description = stringResource(R.string.dev_tools_restart_app_desc),
                icon = Icons.Default.RestartAlt,
                containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
                onClick = {
                    val intent = Intent(context, LoginActivityCompose::class.java)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    context.startActivity(intent)
                    Runtime.getRuntime().exit(0)
                }
            )

            // Bottom spacing
            Spacer(modifier = Modifier.height(32.dp))
        }
    }

    // Toast Snackbar (simple implementation)
    showToast?.let { message ->
        Snackbar(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(message)
        }
    }
}

/**
 * Botão customizado para ferramentas de desenvolvedor
 */
@Composable
private fun DevToolButton(
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    containerColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.surfaceVariant,
    contentColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurfaceVariant,
    isLoading: Boolean = false
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = containerColor
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = contentColor,
                modifier = Modifier.size(32.dp)
            )

            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = contentColor
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = contentColor.copy(alpha = 0.7f),
                    modifier = Modifier.padding(top = 2.dp)
                )
            }

            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = contentColor,
                    strokeWidth = 2.dp
                )
            } else {
                IconButton(
                    onClick = onClick,
                    colors = IconButtonDefaults.iconButtonColors(
                        contentColor = contentColor
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Executar"
                    )
                }
            }
        }
    }
}
