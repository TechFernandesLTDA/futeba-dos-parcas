package com.futebadosparcas.ui.developer

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.R

/**
 * DeveloperScreen - Ferramentas de Geração e Análise de Dados
 *
 * Permite:
 * - Gerar dados históricos mockados
 * - Popular quadras para todos os locais
 * - Analisar Firestore (relatório no Logcat)
 * - Limpar dados inválidos
 * - Resetar todos os dados mock
 *
 * Features:
 * - Botões de ação com feedback visual
 * - Estados de loading e erro
 * - Mensagens de sucesso/erro
 */
@Composable
fun DeveloperScreen(
    viewModel: DeveloperViewModel
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // Show toast on state changes
    LaunchedEffect(uiState) {
        when (uiState) {
            is DeveloperUiState.Success -> {
                Toast.makeText(context, (uiState as DeveloperUiState.Success).message, Toast.LENGTH_LONG).show()
            }
            is DeveloperUiState.Error -> {
                Toast.makeText(context, (uiState as DeveloperUiState.Error).message, Toast.LENGTH_LONG).show()
            }
            else -> {}
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
                // ========== GERAÇÃO DE DADOS ==========
                Text(
                    text = stringResource(R.string.developer_data_generation),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                DeveloperActionCard(
                    title = stringResource(R.string.developer_generate_mock),
                    description = stringResource(R.string.developer_generate_mock_desc),
                    icon = Icons.Default.AddCircle,
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                    onClick = { viewModel.generateMockData() },
                    enabled = uiState !is DeveloperUiState.Loading
                )

                DeveloperActionCard(
                    title = stringResource(R.string.developer_populate_fields),
                    description = stringResource(R.string.developer_populate_fields_desc),
                    icon = Icons.Default.Stadium,
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                    contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                    onClick = { viewModel.populateFieldsForAllLocations() },
                    enabled = uiState !is DeveloperUiState.Loading
                )

                // ========== ANÁLISE ==========
                Text(
                    text = stringResource(R.string.developer_analysis),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 8.dp, bottom = 8.dp)
                )

                DeveloperActionCard(
                    title = stringResource(R.string.developer_analyze_firestore),
                    description = stringResource(R.string.developer_analyze_firestore_desc),
                    icon = Icons.Default.Analytics,
                    containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                    contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
                    onClick = { viewModel.analyzeFirestore() },
                    enabled = uiState !is DeveloperUiState.Loading
                )

                // ========== LIMPEZA ==========
                Text(
                    text = stringResource(R.string.developer_data_cleanup),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = 8.dp, bottom = 8.dp)
                )

                DeveloperActionCard(
                    title = stringResource(R.string.developer_clean_invalid),
                    description = stringResource(R.string.developer_clean_invalid_desc),
                    icon = Icons.Default.CleaningServices,
                    containerColor = MaterialTheme.colorScheme.errorContainer,
                    contentColor = MaterialTheme.colorScheme.onErrorContainer,
                    onClick = { viewModel.cleanUpData() },
                    enabled = uiState !is DeveloperUiState.Loading
                )

            // Bottom spacing
            Spacer(modifier = Modifier.height(32.dp))
        }

        // Loading overlay
        if (uiState is DeveloperUiState.Loading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    modifier = Modifier.padding(32.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(48.dp),
                            color = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = stringResource(R.string.developer_processing),
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}

/**
 * Card de ação customizado para ferramentas de desenvolvedor
 */
@Composable
private fun DeveloperActionCard(
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    containerColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.surfaceVariant,
    contentColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurfaceVariant
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = containerColor
        ),
        onClick = onClick,
        enabled = enabled
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = contentColor.copy(alpha = 0.2f),
                modifier = Modifier.size(56.dp)
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize()
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = contentColor,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }

            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = contentColor
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = contentColor.copy(alpha = 0.8f),
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            Icon(
                imageVector = Icons.Default.PlayArrow,
                contentDescription = stringResource(R.string.developer_cd_execute),
                tint = contentColor,
                modifier = Modifier.size(28.dp)
            )
        }
    }
}
