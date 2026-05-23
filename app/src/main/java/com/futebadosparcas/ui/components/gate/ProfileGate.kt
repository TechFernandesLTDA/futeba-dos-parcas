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
import com.futebadosparcas.ui.onboarding.PhoneVerificationScreen
import com.google.firebase.auth.FirebaseAuth

private sealed interface OnboardingStep {
    object None : OnboardingStep
    object Phone : OnboardingStep
    object Cpf : OnboardingStep
}

@Composable
fun ProfileGate(
    isProfileComplete: Boolean?,
    onRefreshProfileComplete: () -> Unit,
    content: @Composable () -> Unit
) {
    var step by remember { mutableStateOf<OnboardingStep>(OnboardingStep.None) }

    when {
        isProfileComplete == null -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }

        isProfileComplete == false -> {
            when (step) {
                OnboardingStep.Phone -> {
                    PhoneVerificationScreen(
                        onSuccess = { step = OnboardingStep.Cpf },
                    )
                }
                OnboardingStep.Cpf -> {
                    CpfVerificationScreen(
                        onSuccess = {
                            onRefreshProfileComplete()
                            step = OnboardingStep.None
                        },
                    )
                }
                OnboardingStep.None -> {
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
                            TextButton(onClick = {
                                val phone = FirebaseAuth.getInstance().currentUser?.phoneNumber
                                step = if (phone.isNullOrEmpty()) {
                                    OnboardingStep.Phone
                                } else {
                                    OnboardingStep.Cpf
                                }
                            }) {
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
        }

        else -> content()
    }
}
