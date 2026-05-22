package com.futebadosparcas.ui.components.gate

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.window.DialogProperties
import com.futebadosparcas.R
import com.futebadosparcas.ui.onboarding.CpfVerificationScreen

@Composable
fun ProfileGate(
    isProfileComplete: Boolean?,
    onRefreshProfileComplete: () -> Unit,
    content: @Composable () -> Unit
) {
    var showCpfScreen by remember { mutableStateOf(false) }

    when {
        isProfileComplete == null -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }

        isProfileComplete == false -> {
            if (showCpfScreen) {
                CpfVerificationScreen(
                    onSuccess = {
                        onRefreshProfileComplete()
                        showCpfScreen = false
                    },
                )
            } else {
                AlertDialog(
                    onDismissRequest = { /* blocked — no-op */ },
                    title = {
                        Text(
                            text = stringResource(R.string.profile_gate_title),
                            style = MaterialTheme.typography.headlineSmall,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    },
                    text = {
                        Text(
                            text = stringResource(R.string.profile_gate_message),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    },
                    confirmButton = {
                        TextButton(onClick = { showCpfScreen = true }) {
                            Text(stringResource(R.string.profile_gate_action))
                        }
                    },
                    properties = DialogProperties(
                        dismissOnBackPress = false,
                        dismissOnClickOutside = false
                    )
                )
            }
        }

        else -> content()
    }
}
