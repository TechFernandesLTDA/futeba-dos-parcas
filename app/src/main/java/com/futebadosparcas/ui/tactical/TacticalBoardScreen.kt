package com.futebadosparcas.ui.tactical

import android.content.Intent
import android.graphics.Color
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import com.futebadosparcas.R

/**
 * Cores para o quadro tático (Material Design 3 compliant)
 */
object TacticalBoardColors {
    val TeamRed = Color.RED      // Gamification: Team color (intentional)
    val TeamBlue = Color.BLUE    // Gamification: Team color (intentional)
    // Árbitro usa cor do tema para adaptar a dark/light mode
}

/**
 * TacticalBoardScreen - Tela de quadro tático para desenhar jogadas
 *
 * Features:
 * - Campo de futebol desenhado
 * - Desenho livre com touch
 * - Seleção de cores (Vermelho, Azul, Preto adaptável ao tema)
 * - Limpar quadro
 * - Compartilhar imagem
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TacticalBoardScreen(
    onBackClick: () -> Unit = {}
) {
    val context = LocalContext.current
    var tacticalBoardView by remember { mutableStateOf<TacticalBoardView?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.tactical_title)) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.tactical_back)
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Tactical Board View (Custom Canvas)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                AndroidView(
                    factory = { ctx ->
                        TacticalBoardView(ctx).also {
                            tacticalBoardView = it
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )
            }

            // Control Panel
            TacticalBoardControls(
                onColorSelected = { color ->
                    tacticalBoardView?.setColor(color)
                },
                onClear = {
                    tacticalBoardView?.clear()
                },
                onShare = {
                    val file = tacticalBoardView?.saveBoard()
                    if (file != null) {
                        try {
                            val uri = FileProvider.getUriForFile(
                                context,
                                "${context.packageName}.fileprovider",
                                file
                            )

                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "image/jpeg"
                                putExtra(Intent.EXTRA_STREAM, uri)
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            context.startActivity(Intent.createChooser(intent, context.getString(R.string.tactical_share_tactic)))
                        } catch (e: Exception) {
                            Toast.makeText(
                                context,
                                context.getString(R.string.tactical_error_share, e.message ?: ""),
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    } else {
                        Toast.makeText(context, context.getString(R.string.tactical_error_save), Toast.LENGTH_SHORT).show()
                    }
                }
            )
        }
    }
}

@Composable
private fun TacticalBoardControls(
    onColorSelected: (Int) -> Unit,
    onClear: () -> Unit,
    onShare: () -> Unit
) {
    // Cor padrão adaptada ao tema (usar onSurface para dark/light mode)
    val defaultColor = MaterialTheme.colorScheme.onSurface.toArgb()
    var selectedColor by remember { mutableStateOf(defaultColor) }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surfaceVariant,
        tonalElevation = 4.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Color Selection
            Text(
                text = stringResource(R.string.tactical_draw_color),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Gamification: Team color (intentional)
                ColorButton(
                    color = androidx.compose.ui.graphics.Color.Red,
                    isSelected = selectedColor == TacticalBoardColors.TeamRed,
                    onClick = {
                        selectedColor = TacticalBoardColors.TeamRed
                        onColorSelected(TacticalBoardColors.TeamRed)
                    }
                )

                // Gamification: Team color (intentional)
                ColorButton(
                    color = androidx.compose.ui.graphics.Color.Blue,
                    isSelected = selectedColor == TacticalBoardColors.TeamBlue,
                    onClick = {
                        selectedColor = TacticalBoardColors.TeamBlue
                        onColorSelected(TacticalBoardColors.TeamBlue)
                    }
                )

                ColorButton(
                    color = MaterialTheme.colorScheme.onSurface,
                    isSelected = selectedColor == defaultColor,
                    onClick = {
                        selectedColor = defaultColor
                        onColorSelected(defaultColor)
                    }
                )
            }

            HorizontalDivider()

            // Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onClear,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.tactical_clear))
                }

                Button(
                    onClick = onShare,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Default.Share,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.tactical_share))
                }
            }
        }
    }
}

@Composable
private fun ColorButton(
    color: androidx.compose.ui.graphics.Color,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier.size(56.dp),
        contentAlignment = Alignment.Center
    ) {
        // Selection indicator
        if (isSelected) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .background(
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f),
                        shape = CircleShape
                    )
            )
        }

        // Color circle
        Surface(
            onClick = onClick,
            modifier = Modifier.size(40.dp),
            shape = CircleShape,
            color = color,
            border = if (isSelected) {
                androidx.compose.foundation.BorderStroke(
                    3.dp,
                    MaterialTheme.colorScheme.primary
                )
            } else {
                androidx.compose.foundation.BorderStroke(
                    1.dp,
                    MaterialTheme.colorScheme.outline
                )
            }
        ) {}
    }
}
