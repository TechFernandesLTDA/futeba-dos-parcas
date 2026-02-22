package com.futebadosparcas.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.SeedColors
import com.futebadosparcas.domain.model.ThemeMode
import com.futebadosparcas.ui.settings.SettingsNavigationDivider
import com.futebadosparcas.ui.settings.SettingsSection
import com.futebadosparcas.ui.theme.DynamicThemeEngine
import com.futebadosparcas.ui.theme.FutebaTheme
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class WebThemeConfig(
    val mode: ThemeMode = ThemeMode.SYSTEM,
    val primaryColor: Color = Color(0xFF58CC02),
    val secondaryColor: Color = Color(0xFFFF9600),
    val highContrast: Boolean = false,
    val fontSizeScale: Float = 1.0f
) {
    fun toAppThemeConfig(): AppThemeConfig = AppThemeConfig(
        seedColors = SeedColors(
            primary = primaryColor.toArgb(),
            secondary = secondaryColor.toArgb()
        ),
        mode = mode,
        contrastLevel = if (highContrast) ContrastLevel.HIGH else ContrastLevel.NORMAL
    )
}

class WebThemeViewModel {
    private val _config = MutableStateFlow(WebThemeConfig())
    val config: StateFlow<WebThemeConfig> = _config.asStateFlow()

    fun setThemeMode(mode: ThemeMode) {
        _config.value = _config.value.copy(mode = mode)
    }

    fun setPrimaryColor(color: Color) {
        _config.value = _config.value.copy(primaryColor = color)
    }

    fun setSecondaryColor(color: Color) {
        _config.value = _config.value.copy(secondaryColor = color)
    }

    fun setHighContrast(enabled: Boolean) {
        _config.value = _config.value.copy(highContrast = enabled)
    }

    fun setFontSizeScale(scale: Float) {
        _config.value = _config.value.copy(fontSizeScale = scale)
    }

    fun reset() {
        _config.value = WebThemeConfig()
    }
}

@Composable
fun rememberWebThemeViewModel(): WebThemeViewModel {
    return remember { WebThemeViewModel() }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ThemeSettingsScreen(
    onBackClick: () -> Unit = {},
    viewModel: WebThemeViewModel = rememberWebThemeViewModel()
) {
    val config by viewModel.config.collectAsState()
    var hasChanges by remember { mutableStateOf(false) }
    val initialConfig = remember { config }

    LaunchedEffect(config) {
        hasChanges = config != initialConfig
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            ThemeModeSection(
                currentMode = config.mode,
                onModeSelected = { viewModel.setThemeMode(it) }
            )
        }

        item {
            AccentColorSection(
                title = "🎨 Cor Principal",
                emoji = "🌿",
                selectedColor = config.primaryColor,
                presets = PrimaryColorPresets,
                onColorSelected = { viewModel.setPrimaryColor(it) }
            )
        }

        item {
            AccentColorSection(
                title = "✨ Cor de Destaque",
                emoji = "🏆",
                selectedColor = config.secondaryColor,
                presets = AccentColorPresets,
                onColorSelected = { viewModel.setSecondaryColor(it) }
            )
        }

        item {
            HighContrastSection(
                enabled = config.highContrast,
                onToggle = { viewModel.setHighContrast(it) }
            )
        }

        item {
            FontSizeSection(
                currentScale = config.fontSizeScale,
                onScaleChange = { viewModel.setFontSizeScale(it) }
            )
        }

        item {
            PreviewSection(config = config)
        }

        item {
            ActionButtonsSection(
                hasChanges = hasChanges,
                onApply = { onBackClick() },
                onReset = { viewModel.reset() },
                onBackClick = onBackClick
            )
        }

        item {
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun ThemeModeSection(
    currentMode: ThemeMode,
    onModeSelected: (ThemeMode) -> Unit
) {
    SettingsSection(title = "🌓 Modo do Tema", emoji = "") {
        Column(modifier = Modifier.padding(8.dp)) {
            ThemeModeOption(
                emoji = "☀️",
                title = "Claro",
                description = "Interface clara e brilhante",
                selected = currentMode == ThemeMode.LIGHT,
                onClick = { onModeSelected(ThemeMode.LIGHT) }
            )
            SettingsNavigationDivider()
            ThemeModeOption(
                emoji = "🌙",
                title = "Escuro",
                description = "Interface escura para poupar bateria",
                selected = currentMode == ThemeMode.DARK,
                onClick = { onModeSelected(ThemeMode.DARK) }
            )
            SettingsNavigationDivider()
            ThemeModeOption(
                emoji = "💻",
                title = "Sistema",
                description = "Segue as preferências do navegador",
                selected = currentMode == ThemeMode.SYSTEM,
                onClick = { onModeSelected(ThemeMode.SYSTEM) }
            )
        }
    }
}

@Composable
private fun ThemeModeOption(
    emoji: String,
    title: String,
    description: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        RadioButton(
            selected = selected,
            onClick = onClick
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "$emoji $title",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun AccentColorSection(
    title: String,
    emoji: String,
    selectedColor: Color,
    presets: List<Color>,
    onColorSelected: (Color) -> Unit
) {
    SettingsSection(title = title, emoji = "") {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(presets, key = { it.toArgb() }) { color ->
                    ColorOption(
                        color = color,
                        selected = selectedColor == color,
                        onClick = { onColorSelected(color) }
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Selecionada:",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(selectedColor)
                        .border(2.dp, MaterialTheme.colorScheme.outline, CircleShape)
                )
                Text(
                    text = "#${selectedColor.value.toString(16).takeLast(6).uppercase()}",
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                )
            }
        }
    }
}

@Composable
private fun ColorOption(
    color: Color,
    selected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(CircleShape)
            .background(color)
            .border(
                width = if (selected) 3.dp else 1.dp,
                color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                shape = CircleShape
            )
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        if (selected) {
            Text(
                text = "✓",
                color = if (color.luminance() > 0.5f) Color.Black else Color.White,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun HighContrastSection(
    enabled: Boolean,
    onToggle: (Boolean) -> Unit
) {
    SettingsSection(title = "👁️ Acessibilidade", emoji = "") {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onToggle(!enabled) }
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "🔲 Alto Contraste",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "Aumenta o contraste das cores para melhor legibilidade",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Switch(
                checked = enabled,
                onCheckedChange = onToggle
            )
        }
    }
}

@Composable
private fun FontSizeSection(
    currentScale: Float,
    onScaleChange: (Float) -> Unit
) {
    SettingsSection(title = "🔤 Tamanho da Fonte", emoji = "") {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                FontSizeOption("A", 12.sp, currentScale == 0.85f) { onScaleChange(0.85f) }
                FontSizeOption("A", 16.sp, currentScale == 1.0f) { onScaleChange(1.0f) }
                FontSizeOption("A", 20.sp, currentScale == 1.15f) { onScaleChange(1.15f) }
                FontSizeOption("A", 24.sp, currentScale == 1.3f) { onScaleChange(1.3f) }
            }

            Slider(
                value = currentScale,
                onValueChange = onScaleChange,
                valueRange = 0.7f..1.5f,
                steps = 7,
                modifier = Modifier.fillMaxWidth()
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Menor",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "${(currentScale * 100).toInt()}%",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "Maior",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun FontSizeOption(
    text: String,
    fontSize: androidx.compose.ui.unit.TextUnit,
    selected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(CircleShape)
            .background(
                if (selected) MaterialTheme.colorScheme.primaryContainer
                else MaterialTheme.colorScheme.surfaceVariant
            )
            .border(
                width = if (selected) 2.dp else 0.dp,
                color = if (selected) MaterialTheme.colorScheme.primary else Color.Transparent,
                shape = CircleShape
            )
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            fontSize = fontSize,
            color = if (selected) MaterialTheme.colorScheme.onPrimaryContainer
                   else MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun PreviewSection(config: WebThemeConfig) {
    SettingsSection(title = "👁️ Preview em Tempo Real", emoji = "") {
        FutebaThemePreview(config = config) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "🎮 Futeba dos Parças",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        Text(
                            text = "Exemplo de texto no novo tema",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {},
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        )
                    ) {
                        Text("Botão Primário")
                    }
                    OutlinedButton(
                        onClick = {},
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Secundário")
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AssistChip(
                        onClick = {},
                        label = { Text("Chip 1") },
                        leadingIcon = { Text("⚽") }
                    )
                    AssistChip(
                        onClick = {},
                        label = { Text("Chip 2") },
                        leadingIcon = { Text("🏆") }
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    PreviewColorBox(
                        color = MaterialTheme.colorScheme.primary,
                        label = "Primary",
                        modifier = Modifier.weight(1f)
                    )
                    PreviewColorBox(
                        color = MaterialTheme.colorScheme.secondary,
                        label = "Secondary",
                        modifier = Modifier.weight(1f)
                    )
                    PreviewColorBox(
                        color = MaterialTheme.colorScheme.tertiary,
                        label = "Tertiary",
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
private fun FutebaThemePreview(
    config: WebThemeConfig,
    content: @Composable () -> Unit
) {
    val isDark = when (config.mode) {
        ThemeMode.DARK -> true
        ThemeMode.LIGHT -> false
        ThemeMode.SYSTEM -> false
    }

    val colorScheme = remember(config.primaryColor, config.secondaryColor, isDark) {
        DynamicThemeEngine.generateColorScheme(config.toAppThemeConfig(), isDark)
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}

@Composable
private fun PreviewColorBox(
    color: Color,
    label: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(color)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun ActionButtonsSection(
    hasChanges: Boolean,
    onApply: () -> Unit,
    onReset: () -> Unit,
    onBackClick: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (hasChanges) {
            Button(
                onClick = onApply,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                )
            ) {
                Text("✅ Aplicar Tema")
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = onBackClick,
                modifier = Modifier.weight(1f)
            ) {
                Text("← Voltar")
            }
            OutlinedButton(
                onClick = onReset,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("🔄 Restaurar")
            }
        }
    }
}

private val Color.luminance: () -> Float
    get() = {
        val r = (red * 0.299f)
        val g = (green * 0.587f)
        val b = (blue * 0.114f)
        r + g + b
    }

val PrimaryColorPresets = listOf(
    Color(0xFF58CC02), // Verde Futeba
    Color(0xFF00BCD4), // Ciano
    Color(0xFF2196F3), // Azul
    Color(0xFF3F51B5), // Indigo
    Color(0xFF9C27B0), // Roxo
    Color(0xFFE91E63), // Rosa
    Color(0xFFF44336), // Vermelho
    Color(0xFFFF5722), // Laranja Profundo
)

val AccentColorPresets = listOf(
    Color(0xFFFF9600), // Laranja Badge
    Color(0xFFFFEB3B), // Amarelo
    Color(0xFF4CAF50), // Verde
    Color(0xFF009688), // Teal
    Color(0xFF673AB7), // Roxo Profundo
    Color(0xFFFF4081), // Rosa Vibrante
    Color(0xFFFFC107), // Âmbar
    Color(0xFF03A9F4), // Azul Claro
)
