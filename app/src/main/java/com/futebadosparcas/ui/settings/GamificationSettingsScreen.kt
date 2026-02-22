package com.futebadosparcas.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.domain.model.GamificationSettings
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

@Composable
fun GamificationSettingsScreen(
    viewModel: SettingsViewModel,
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        when (val state = uiState) {
            is SettingsUiState.Loading -> {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = MaterialTheme.colorScheme.primary
                )
            }
            is SettingsUiState.Success -> {
                SettingsForm(state.settings) { updated ->
                    viewModel.saveSettings(updated)
                }
            }
            is SettingsUiState.Error -> {
                ErrorMessage(state.message) { viewModel.loadSettings() }
            }
            is SettingsUiState.Saved -> {
                SuccessMessage {
                    viewModel.resetState()
                    onBack()
                }
            }
        }
    }
}

@Composable
fun SettingsForm(
    initialSettings: GamificationSettings,
    onSave: (GamificationSettings) -> Unit
) {
    var settings by remember { mutableStateOf(initialSettings) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Categoria: Partida e Resultado
        SectionCard(title = stringResource(R.string.gamification_section_match_result), icon = Icons.Filled.EmojiEvents) {
            SettingsInput(stringResource(R.string.gamification_xp_win), settings.xpWin, Icons.Filled.CheckCircle) { settings = settings.copy(xpWin = it) }
            SettingsInput(stringResource(R.string.gamification_xp_draw), settings.xpDraw, Icons.Filled.RemoveCircle) { settings = settings.copy(xpDraw = it) }
            SettingsInput(stringResource(R.string.gamification_xp_presence), settings.xpPresence, Icons.Filled.Person) { settings = settings.copy(xpPresence = it) }
            SettingsInput(stringResource(R.string.gamification_xp_mvp), settings.xpMvp, Icons.Filled.Star) { settings = settings.copy(xpMvp = it) }
        }

        // Categoria: Ações Técnicas
        SectionCard(title = stringResource(R.string.gamification_section_technical_skills), icon = Icons.Filled.SportsFootball) {
            SettingsInput(stringResource(R.string.gamification_xp_per_goal), settings.xpPerGoal, Icons.Filled.AddCircle) { settings = settings.copy(xpPerGoal = it) }
            SettingsInput(stringResource(R.string.gamification_xp_per_assist), settings.xpPerAssist, Icons.Filled.Handshake) { settings = settings.copy(xpPerAssist = it) }
            SettingsInput(stringResource(R.string.gamification_xp_per_save), settings.xpPerSave, Icons.Filled.Shield) { settings = settings.copy(xpPerSave = it) }
        }

        // Categoria: Sequências (Streaks)
        SectionCard(title = stringResource(R.string.gamification_section_streaks), icon = Icons.Filled.Whatshot) {
            SettingsInput(stringResource(R.string.gamification_xp_streak_3), settings.xpStreak3, Icons.Filled.Filter3) { settings = settings.copy(xpStreak3 = it) }
            SettingsInput(stringResource(R.string.gamification_xp_streak_7), settings.xpStreak7, Icons.Filled.Filter7) { settings = settings.copy(xpStreak7 = it) }
            SettingsInput(stringResource(R.string.gamification_xp_streak_10), settings.xpStreak10, Icons.Filled.Filter9Plus) { settings = settings.copy(xpStreak10 = it) }
        }

        Button(
            onClick = { onSave(settings) },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(stringResource(R.string.edit_profile_save_changes).uppercase(), fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
        
        Spacer(modifier = Modifier.height(32.dp))
    }
}

@Composable
fun SectionCard(
    title: String,
    icon: ImageVector,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    title,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
            HorizontalDivider(
                modifier = Modifier.padding(vertical = 12.dp),
                color = MaterialTheme.colorScheme.outlineVariant
            )
            content()
        }
    }
}

@Composable
fun SettingsInput(
    label: String,
    value: Int,
    icon: ImageVector,
    onValueChange: (Int) -> Unit
) {
    var textValue by remember(value) { mutableStateOf(value.toString()) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
            Icon(
                icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                label,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        OutlinedTextField(
            value = textValue,
            onValueChange = {
                if (it.isEmpty() || it.all { char -> char.isDigit() }) {
                    textValue = it
                    it.toIntOrNull()?.let { num -> onValueChange(num) }
                }
            },
            modifier = Modifier.width(80.dp),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            textStyle = LocalTextStyle.current.copy(fontSize = 14.sp, fontWeight = FontWeight.Bold),
            shape = RoundedCornerShape(8.dp)
        )
    }
}

@Composable
fun ErrorMessage(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Filled.Warning,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.error,
            modifier = Modifier.size(48.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onRetry) {
            Text(stringResource(R.string.retry))
        }
    }
}

@Composable
fun SuccessMessage(onConfirm: () -> Unit) {
    LaunchedEffect(Unit) {
        onConfirm()
    }
}
