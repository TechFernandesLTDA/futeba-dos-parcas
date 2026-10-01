package com.futebadosparcas.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.BrightnessAuto
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.cd_back
import com.futebadosparcas.compose.resources.retry
import com.futebadosparcas.compose.resources.theme_dark
import com.futebadosparcas.compose.resources.theme_high_contrast
import com.futebadosparcas.compose.resources.theme_high_contrast_desc
import com.futebadosparcas.compose.resources.theme_light
import com.futebadosparcas.compose.resources.theme_mode
import com.futebadosparcas.compose.resources.theme_mode_dark_hint
import com.futebadosparcas.compose.resources.theme_mode_desc
import com.futebadosparcas.compose.resources.theme_mode_light_hint
import com.futebadosparcas.compose.resources.theme_mode_system_hint
import com.futebadosparcas.compose.resources.theme_settings
import com.futebadosparcas.compose.resources.theme_settings_action_reset
import com.futebadosparcas.compose.resources.theme_settings_error_body
import com.futebadosparcas.compose.resources.theme_settings_mode_note
import com.futebadosparcas.compose.resources.theme_settings_preview_label
import com.futebadosparcas.compose.resources.theme_system
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.ThemeMode
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource

/**
 * Tela de tema do composeApp (iOS) — paridade com `ThemeSettingsScreen` do Android (#4097).
 *
 * Escopo: modo (Claro / Escuro / Sistema) e alto contraste. A seleção é aplicada
 * imediatamente (o `App.kt` coleta `ThemeRepository.themeConfig`) e persiste em
 * `NSUserDefaults` no iOS.
 */
@Composable
fun ThemeSettingsScreen(
    viewModel: ThemeSettingsViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    ThemeSettingsContent(
        uiState = uiState,
        onSelectMode = viewModel::setThemeMode,
        onToggleHighContrast = viewModel::setHighContrast,
        onReset = viewModel::resetTheme,
        onRetry = viewModel::observeTheme,
        onNavigateBack = onNavigateBack
    )
}

/** Conteúdo stateless (preview/teste). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ThemeSettingsContent(
    uiState: ThemeSettingsUiState,
    onSelectMode: (ThemeMode) -> Unit,
    onToggleHighContrast: (Boolean) -> Unit,
    onReset: () -> Unit,
    onRetry: () -> Unit,
    onNavigateBack: () -> Unit
) {
    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = stringResource(Res.string.theme_settings),
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(Res.string.cd_back)
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        when (uiState) {
            ThemeSettingsUiState.Loading -> Box(
                modifier = Modifier.fillMaxSize().padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                // Ação pontual (não é lista): indicador simples em vez de shimmer.
                CircularProgressIndicator()
            }

            is ThemeSettingsUiState.Error -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(24.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = uiState.message ?: stringResource(Res.string.theme_settings_error_body),
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedButton(onClick = onRetry) {
                    Text(stringResource(Res.string.retry))
                }
            }

            is ThemeSettingsUiState.Success -> ThemeSettingsForm(
                config = uiState.config,
                onSelectMode = onSelectMode,
                onToggleHighContrast = onToggleHighContrast,
                onReset = onReset,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            )
        }
    }
}

@Composable
private fun ThemeSettingsForm(
    config: AppThemeConfig,
    onSelectMode: (ThemeMode) -> Unit,
    onToggleHighContrast: (Boolean) -> Unit,
    onReset: () -> Unit,
    modifier: Modifier = Modifier
) {
    BoxWithConstraints(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // Tablet/landscape: limita a largura do formulário para manter a leitura confortável.
        Column(
            modifier = Modifier
                .widthIn(max = 640.dp)
                .fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            ThemeModeCard(selected = config.mode, onSelectMode = onSelectMode)

            HighContrastCard(
                enabled = config.contrastLevel == ContrastLevel.HIGH,
                onToggle = onToggleHighContrast
            )

            // Prévia: reage na hora, pois o tema raiz coleta o mesmo repositório.
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                ),
                modifier = Modifier.fillMaxWidth().height(96.dp)
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                    Text(
                        text = stringResource(Res.string.theme_settings_preview_label),
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }

            Text(
                text = stringResource(Res.string.theme_settings_mode_note),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Button(
                onClick = onReset,
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                    contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                )
            ) {
                Text(stringResource(Res.string.theme_settings_action_reset))
            }
        }
    }
}

/** Opção de modo de tema exibida como linha de rádio. */
private data class ThemeModeOption(
    val mode: ThemeMode,
    val label: StringResource,
    val hint: StringResource,
    val icon: ImageVector
)

private val themeModeOptions = listOf(
    ThemeModeOption(ThemeMode.LIGHT, Res.string.theme_light, Res.string.theme_mode_light_hint, Icons.Filled.LightMode),
    ThemeModeOption(ThemeMode.DARK, Res.string.theme_dark, Res.string.theme_mode_dark_hint, Icons.Filled.DarkMode),
    ThemeModeOption(ThemeMode.SYSTEM, Res.string.theme_system, Res.string.theme_mode_system_hint, Icons.Filled.BrightnessAuto)
)

@Composable
private fun ThemeModeCard(
    selected: ThemeMode,
    onSelectMode: (ThemeMode) -> Unit
) {
    Card {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(Res.string.theme_mode),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() }
            )
            Text(
                text = stringResource(Res.string.theme_mode_desc),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Column(modifier = Modifier.selectableGroup()) {
                themeModeOptions.forEach { option ->
                    val isSelected = option.mode == selected
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            // Touch target >= 48dp e a linha inteira é o alvo (a11y).
                            .heightIn(min = 56.dp)
                            .selectable(
                                selected = isSelected,
                                role = Role.RadioButton,
                                onClick = { onSelectMode(option.mode) }
                            )
                            .padding(horizontal = 4.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // onClick = null: o clique é tratado pela Row (evita alvo duplicado).
                        RadioButton(selected = isSelected, onClick = null)
                        Spacer(modifier = Modifier.width(12.dp))
                        Icon(
                            imageVector = option.icon,
                            contentDescription = null,
                            tint = if (isSelected) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            }
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = stringResource(option.label),
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = stringResource(option.hint),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HighContrastCard(
    enabled: Boolean,
    onToggle: (Boolean) -> Unit
) {
    Card {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                // A linha inteira alterna o switch (alvo grande + semântica única).
                .toggleable(
                    value = enabled,
                    role = Role.Switch,
                    onValueChange = onToggle
                )
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(Res.string.theme_high_contrast),
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = stringResource(Res.string.theme_high_contrast_desc),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(modifier = Modifier.width(16.dp))
            // onCheckedChange = null: o toggle é tratado pela Row.
            Switch(checked = enabled, onCheckedChange = null)
        }
    }
}
