package com.futebadosparcas.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import org.koin.compose.viewmodel.koinViewModel
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.ThemeMode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ThemeSettingsScreen(
    viewModel: ThemeViewModel = koinViewModel(),
    onBackClick: () -> Unit = {}
) {
    val config by viewModel.themeConfig.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // Theme Mode
        Card {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(stringResource(R.string.theme_mode), style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ThemeMode.values().forEach { mode ->
                        FilterChip(
                            selected = config.mode == mode,
                            onClick = { viewModel.setThemeMode(mode) },
                            label = { Text(mode.name) }
                        )
                    }
                }
            }
        }

        // Primary Color
        ColorPickerSection(
            title = "Cor Principal",
            selectedColor = config.seedColors.primary,
            onColorSelected = { viewModel.setPrimaryColor(it) }
        )

        // Secondary Color
        ColorPickerSection(
            title = "Cor de Destaque",
            selectedColor = config.seedColors.secondary,
            onColorSelected = { viewModel.setSecondaryColor(it) }
        )
        
        // Preview Box (Demonstrates dynamic theming immediately)
        Card(
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer
            ),
            modifier = Modifier.fillMaxWidth().height(100.dp)
        ) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                Text("Preview: Primary Container", color = MaterialTheme.colorScheme.onPrimaryContainer)
            }
        }
        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = stringResource(R.string.theme_settings_preview_note),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Button(
            onClick = { viewModel.resetTheme() },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                contentColor = MaterialTheme.colorScheme.onSecondaryContainer
            )
        ) {
            Text(stringResource(R.string.theme_settings_action_reset))
        }
    }
}

@Composable
fun ColorPickerSection(
    title: String,
    selectedColor: Int,
    onColorSelected: (Int) -> Unit
) {
    val presets = com.futebadosparcas.ui.theme.ThemePresets.All

    Card {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(16.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(presets, key = { it.toArgb() }) { color ->
                    val isSelected = selectedColor == color.toArgb()
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(color)
                            .border(
                                width = if (isSelected) 3.dp else 0.dp,
                                color = MaterialTheme.colorScheme.onSurface,
                                shape = CircleShape
                            )
                            .clickable { onColorSelected(color.toArgb()) }
                    )
                }
            }
        }
    }
}
