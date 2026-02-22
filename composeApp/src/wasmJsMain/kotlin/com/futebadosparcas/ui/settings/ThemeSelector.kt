package com.futebadosparcas.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.domain.model.ThemeMode

@Composable
fun ThemeSelector(
    currentTheme: ThemeMode,
    onThemeSelected: (ThemeMode) -> Unit,
    modifier: Modifier = Modifier
) {
    var showPreview by remember { mutableStateOf(false) }
    
    Column(modifier = modifier.fillMaxWidth()) {
        ThemeOption(
            emoji = "☀️",
            title = "Claro",
            description = "Tema claro com fundo branco",
            selected = currentTheme == ThemeMode.LIGHT,
            previewColors = LightThemePreview,
            onClick = { onThemeSelected(ThemeMode.LIGHT) }
        )
        
        SettingsNavigationDivider()
        
        ThemeOption(
            emoji = "🌙",
            title = "Escuro",
            description = "Tema escuro para ambientes com pouca luz",
            selected = currentTheme == ThemeMode.DARK,
            previewColors = DarkThemePreview,
            onClick = { onThemeSelected(ThemeMode.DARK) }
        )
        
        SettingsNavigationDivider()
        
        ThemeOption(
            emoji = "💻",
            title = "Sistema",
            description = "Segue as configurações do dispositivo",
            selected = currentTheme == ThemeMode.SYSTEM,
            previewColors = SystemThemePreview,
            onClick = { onThemeSelected(ThemeMode.SYSTEM) }
        )
        
        if (showPreview) {
            Spacer(modifier = Modifier.height(16.dp))
            ThemePreviewCard(currentTheme)
        }
    }
}

@Composable
private fun ThemeOption(
    emoji: String,
    title: String,
    description: String,
    selected: Boolean,
    previewColors: ThemePreviewColors,
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
        
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            MiniColorCircle(previewColors.primary)
            MiniColorCircle(previewColors.secondary)
            MiniColorCircle(previewColors.tertiary)
        }
    }
}

@Composable
private fun MiniColorCircle(color: Color) {
    Box(
        modifier = Modifier
            .size(20.dp)
            .clip(CircleShape)
            .background(color)
    )
}

@Composable
private fun ThemePreviewCard(themeMode: ThemeMode) {
    val isDark = when (themeMode) {
        ThemeMode.DARK -> true
        ThemeMode.LIGHT -> false
        ThemeMode.SYSTEM -> false
    }
    
    val backgroundColor = if (isDark) Color(0xFF1C1B1F) else Color(0xFFFFFBFE)
    val surfaceColor = if (isDark) Color(0xFF2B2930) else Color(0xFFF3EDF7)
    val primaryColor = Color(0xFF58CC02)
    val textColor = if (isDark) Color(0xFFE6E1E5) else Color(0xFF1C1B1F)
    
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(backgroundColor)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
            .padding(16.dp)
    ) {
        Text(
            text = "Preview do Tema",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = textColor
        )
        
        Spacer(modifier = Modifier.height(12.dp))
        
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(40.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(surfaceColor),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Botão Primário",
                style = MaterialTheme.typography.labelLarge,
                color = Color.White
            )
        }
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(32.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(primaryColor)
            )
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(32.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(surfaceColor)
                    .border(1.dp, primaryColor, RoundedCornerShape(6.dp))
            )
        }
    }
}

private data class ThemePreviewColors(
    val primary: Color,
    val secondary: Color,
    val tertiary: Color
)

private val LightThemePreview = ThemePreviewColors(
    primary = Color(0xFF58CC02),
    secondary = Color(0xFFF3EDF7),
    tertiary = Color(0xFFFFFBFE)
)

private val DarkThemePreview = ThemePreviewColors(
    primary = Color(0xFF58CC02),
    secondary = Color(0xFF2B2930),
    tertiary = Color(0xFF1C1B1F)
)

private val SystemThemePreview = ThemePreviewColors(
    primary = Color(0xFF58CC02),
    secondary = Color(0xFF6B7280),
    tertiary = Color(0xFF9CA3AF)
)
