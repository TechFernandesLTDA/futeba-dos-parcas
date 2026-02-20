package com.futebadosparcas.ui.games.teamformation.components
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.domain.model.TeamColor
import com.futebadosparcas.util.ContrastHelper

/**
 * Seletor de cores de colete para times.
 * Mostra todas as cores disponiveis com preview visual.
 */
@Composable
fun VestColorPicker(
    team1Color: TeamColor,
    team2Color: TeamColor,
    onTeam1ColorChange: (TeamColor) -> Unit,
    onTeam2ColorChange: (TeamColor) -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedTeam by remember { mutableIntStateOf(0) } // 0 = Team1, 1 = Team2

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Palette,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = stringResource(Res.string.select_vest_color),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(Modifier.height(16.dp))

            // Tabs para selecionar time
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                TeamColorTab(
                    label = stringResource(Res.string.team_a),
                    color = team1Color,
                    isSelected = selectedTeam == 0,
                    onClick = { selectedTeam = 0 },
                    modifier = Modifier.weight(1f)
                )

                TeamColorTab(
                    label = stringResource(Res.string.team_b),
                    color = team2Color,
                    isSelected = selectedTeam == 1,
                    onClick = { selectedTeam = 1 },
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(Modifier.height(16.dp))

            // Grid de cores
            ColorGrid(
                selectedColor = if (selectedTeam == 0) team1Color else team2Color,
                disabledColor = if (selectedTeam == 0) team2Color else team1Color,
                onColorSelected = { color ->
                    if (selectedTeam == 0) {
                        onTeam1ColorChange(color)
                    } else {
                        onTeam2ColorChange(color)
                    }
                }
            )
        }
    }
}

/**
 * Tab para selecao de time.
 */
@Composable
private fun TeamColorTab(
    label: String,
    color: TeamColor,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colorValue = Color(color.hexValue)

    val borderColor by animateColorAsState(
        targetValue = if (isSelected) {
            MaterialTheme.colorScheme.primary
        } else {
            MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
        },
        animationSpec = spring(),
        label = "tabBorder"
    )

    Surface(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = if (isSelected) {
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        } else {
            MaterialTheme.colorScheme.surface
        },
        border = androidx.compose.foundation.BorderStroke(
            width = if (isSelected) 2.dp else 1.dp,
            color = borderColor
        )
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            // Circulo de cor
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .background(colorValue, CircleShape)
                    .border(
                        1.dp,
                        MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                        CircleShape
                    )
            )

            Spacer(Modifier.width(8.dp))

            Column {
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = color.displayName,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Grid de cores disponiveis.
 */
@Composable
private fun ColorGrid(
    selectedColor: TeamColor,
    disabledColor: TeamColor,
    onColorSelected: (TeamColor) -> Unit
) {
    val haptic = LocalHapticFeedback.current

    LazyVerticalGrid(
        columns = GridCells.Fixed(5),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.height(140.dp)
    ) {
        items(TeamColor.entries.toList()) { color ->
            val isSelected = color == selectedColor
            val isDisabled = color == disabledColor

            ColorCircle(
                color = color,
                isSelected = isSelected,
                isDisabled = isDisabled,
                onClick = {
                    if (!isDisabled) {
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        onColorSelected(color)
                    }
                }
            )
        }
    }
}

/**
 * Circulo de cor individual.
 */
@Composable
private fun ColorCircle(
    color: TeamColor,
    isSelected: Boolean,
    isDisabled: Boolean,
    onClick: () -> Unit
) {
    val colorValue = Color(color.hexValue)

    val borderColor by animateColorAsState(
        targetValue = when {
            isSelected -> MaterialTheme.colorScheme.primary
            isDisabled -> MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
            else -> MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
        },
        animationSpec = spring(),
        label = "colorBorder"
    )

    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(CircleShape)
            .background(
                if (isDisabled) {
                    colorValue.copy(alpha = 0.3f)
                } else {
                    colorValue
                }
            )
            .border(
                width = if (isSelected) 3.dp else 1.dp,
                color = borderColor,
                shape = CircleShape
            )
            .clickable(enabled = !isDisabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        when {
            isSelected -> {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = ContrastHelper.getContrastingTextColor(colorValue)
                )
            }
            isDisabled -> {
                // X para cor desabilitada
                Text(
                    text = "X",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                )
            }
        }
    }
}

/**
 * Dialog para selecao de cor do colete.
 */
@Composable
fun VestColorPickerDialog(
    currentColor: TeamColor,
    disabledColor: TeamColor?,
    onDismiss: () -> Unit,
    onColorSelected: (TeamColor) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = stringResource(Res.string.select_vest_color),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            LazyVerticalGrid(
                columns = GridCells.Fixed(4),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(TeamColor.entries.toList()) { color ->
                    val isSelected = color == currentColor
                    val isDisabled = color == disabledColor

                    ColorCircle(
                        color = color,
                        isSelected = isSelected,
                        isDisabled = isDisabled,
                        onClick = {
                            if (!isDisabled) {
                                onColorSelected(color)
                            }
                        }
                    )
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(Res.string.close))
            }
        }
    )
}

/**
 * Chip compacto de cor do time.
 * Mostra cor atual e permite alterar.
 */
@Composable
fun TeamColorChip(
    color: TeamColor,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colorValue = Color(color.hexValue)

    Surface(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        color = colorValue.copy(alpha = 0.2f),
        border = androidx.compose.foundation.BorderStroke(1.dp, colorValue)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(16.dp)
                    .background(colorValue, CircleShape)
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Medium
            )
            Spacer(Modifier.width(4.dp))
            Icon(
                imageVector = Icons.Default.Palette,
                contentDescription = stringResource(Res.string.select_vest_color),
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Preview de comparacao de cores dos times.
 */
@Composable
fun TeamColorsPreview(
    team1Color: TeamColor,
    team2Color: TeamColor,
    modifier: Modifier = Modifier,
    team1Name: String = "Time A",
    team2Name: String = "Time B"
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Time 1
        TeamColorPreviewItem(
            color = team1Color,
            teamName = team1Name
        )

        Text(
            text = "VS",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        // Time 2
        TeamColorPreviewItem(
            color = team2Color,
            teamName = team2Name
        )
    }
}

@Composable
private fun TeamColorPreviewItem(
    color: TeamColor,
    teamName: String
) {
    val colorValue = Color(color.hexValue)
    val textColor = ContrastHelper.getContrastingTextColor(colorValue)

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = colorValue
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = teamName,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = textColor
            )
            Text(
                text = color.displayName,
                style = MaterialTheme.typography.labelSmall,
                color = textColor.copy(alpha = 0.8f)
            )
        }
    }
}
