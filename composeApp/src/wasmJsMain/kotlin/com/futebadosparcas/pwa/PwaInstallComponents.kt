package com.futebadosparcas.pwa

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kotlinx.coroutines.await
import kotlin.js.Promise

@Composable
fun rememberPwaInstallState(): PwaInstallState {
    val scope = rememberCoroutineScope()
    var canInstall by remember { mutableStateOf(pwaCanInstall()) }
    var isInstalled by remember { mutableStateOf(pwaIsInstalled()) }
    var isInstalling by remember { mutableStateOf(false) }

    DisposableEffect(Unit) {
        fun updateState() {
            canInstall = pwaCanInstall()
            isInstalled = pwaIsInstalled()
        }
        updateState()
        onDispose {}
    }

    return remember(canInstall, isInstalled, isInstalling) {
        PwaInstallState(
            canInstall = canInstall && !isInstalled,
            isInstalled = isInstalled,
            isInstalling = isInstalling,
            install = {
                if (canInstall && !isInstalling) {
                    isInstalling = true
                    scope.launch {
                        try {
                            val result = pwaPromptInstall().await<JsAny>()
                            val outcome = result.toString()
                            if (outcome == InstallOutcome.ACCEPTED) {
                                isInstalled = true
                                canInstall = false
                            }
                        } catch (e: Exception) {
                            // Handle error
                        } finally {
                            isInstalling = false
                        }
                    }
                }
            }
        )
    }
}

data class PwaInstallState(
    val canInstall: Boolean,
    val isInstalled: Boolean,
    val isInstalling: Boolean,
    val install: () -> Unit
)

@Composable
fun PwaInstallBanner(
    state: PwaInstallState,
    modifier: Modifier = Modifier,
    onDismiss: () -> Unit = {}
) {
    if (!state.canInstall) return

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "Instale o app para uma melhor experiência!",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.width(8.dp))
        Row {
            OutlinedButton(
                onClick = onDismiss,
                modifier = Modifier.padding(end = 8.dp)
            ) {
                Text("Depois")
            }
            Button(
                onClick = { state.install() },
                enabled = !state.isInstalling,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                )
            ) {
                Text(if (state.isInstalling) "Instalando..." else "Instalar")
            }
        }
    }
}

@Composable
fun PwaInstallButton(
    state: PwaInstallState,
    modifier: Modifier = Modifier
) {
    if (!state.canInstall) return

    Button(
        onClick = { state.install() },
        enabled = !state.isInstalling,
        modifier = modifier
    ) {
        Text(
            text = if (state.isInstalling) "Instalando..." else "⬇ Instalar App",
            fontWeight = FontWeight.Medium
        )
    }
}
