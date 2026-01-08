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
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider

/**
 * TacticalBoardScreen - Tela de quadro tático para desenhar jogadas
 *
 * Features:
 * - Campo de futebol desenhado
 * - Desenho livre com touch
 * - Seleção de cores (Vermelho, Azul, Preto)
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
                title = { Text("Quadro Tático") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Voltar"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
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
                            context.startActivity(Intent.createChooser(intent, "Compartilhar Tática"))
                        } catch (e: Exception) {
                            Toast.makeText(
                                context,
                                "Erro ao compartilhar: ${e.message}",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    } else {
                        Toast.makeText(context, "Erro ao salvar imagem", Toast.LENGTH_SHORT).show()
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
    var selectedColor by remember { mutableStateOf(Color.BLACK) }

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
                text = "Cor do Desenho",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ColorButton(
                    color = androidx.compose.ui.graphics.Color.Red,
                    isSelected = selectedColor == Color.RED,
                    onClick = {
                        selectedColor = Color.RED
                        onColorSelected(Color.RED)
                    }
                )

                ColorButton(
                    color = androidx.compose.ui.graphics.Color.Blue,
                    isSelected = selectedColor == Color.BLUE,
                    onClick = {
                        selectedColor = Color.BLUE
                        onColorSelected(Color.BLUE)
                    }
                )

                ColorButton(
                    color = androidx.compose.ui.graphics.Color.Black,
                    isSelected = selectedColor == Color.BLACK,
                    onClick = {
                        selectedColor = Color.BLACK
                        onColorSelected(Color.BLACK)
                    }
                )
            }

            Divider()

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
                    Text("Limpar")
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
                    Text("Compartilhar")
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
