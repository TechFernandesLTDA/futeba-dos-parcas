package com.futebadosparcas.ui.theme

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.cd_back
import com.futebadosparcas.compose.resources.theme_mode
import com.futebadosparcas.compose.resources.theme_mode_dark
import com.futebadosparcas.compose.resources.theme_mode_light
import com.futebadosparcas.compose.resources.theme_mode_system
import com.futebadosparcas.compose.resources.theme_settings
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ThemeMode
import com.futebadosparcas.domain.repository.ThemeRepository
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.stringResource

/** iOS/CMP theme selection with the same Light, Dark, and System modes as Android. */
@Composable
fun ThemeSettingsScreen(
    repository: ThemeRepository,
    onNavigateBack: () -> Unit
) {
    val defaultConfig = AppThemeConfig(mode = ThemeMode.SYSTEM)
    val config by repository.themeConfig.collectAsStateWithLifecycle(initialValue = defaultConfig)
    val scope = rememberCoroutineScope()

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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = stringResource(Res.string.theme_mode),
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    ThemeMode.entries.forEach { mode ->
                        FilterChip(
                            selected = config.mode == mode,
                            onClick = { scope.launch { repository.setThemeMode(mode) } },
                            label = { Text(themeModeLabel(mode)) },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun themeModeLabel(mode: ThemeMode): String = when (mode) {
    ThemeMode.LIGHT -> stringResource(Res.string.theme_mode_light)
    ThemeMode.DARK -> stringResource(Res.string.theme_mode_dark)
    ThemeMode.SYSTEM -> stringResource(Res.string.theme_mode_system)
}
