package com.futebadosparcas.ui.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.futebadosparcas.domain.util.CpfValidator
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
import org.koin.compose.viewmodel.koinViewModel

/**
 * Tela 2/2 do onboarding obrigatorio: verificacao de CPF.
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md (R3, R6, Fase 3 #446)
 */
@Composable
fun CpfVerificationScreen(
    onSuccess: () -> Unit = {},
    viewModel: CpfVerificationViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    var cpf by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(state) {
        if (state is CpfVerificationUiState.Success) onSuccess()
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                ),
            ) {
                Column(modifier = Modifier.padding(24.dp)) {
                    Box(
                        modifier = Modifier.size(48.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Badge,
                            contentDescription = null,
                            modifier = Modifier.size(40.dp),
                            tint = MaterialTheme.colorScheme.primary,
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = stringResource(R.string.cpf_verification_title),
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = stringResource(R.string.cpf_verification_subtitle),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(16.dp))

                    val errorMsg = (state as? CpfVerificationUiState.Error)?.message
                    if (errorMsg != null) {
                        Text(
                            text = errorMsg,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Spacer(Modifier.height(8.dp))
                    }

                    val loading = state is CpfVerificationUiState.Verifying

                    OutlinedTextField(
                        value = cpf,
                        onValueChange = { input ->
                            // Aplica mascara progressiva enquanto digita
                            val digits = input.filter { it.isDigit() }.take(11)
                            cpf = formatProgressive(digits)
                        },
                        label = { Text(stringResource(R.string.cpf_label)) },
                        placeholder = { Text(stringResource(R.string.cpf_placeholder)) },
                        singleLine = true,
                        enabled = !loading,
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.NumberPassword,
                        ),
                        supportingText = { Text(stringResource(R.string.cpf_supporting_text)) },
                    )
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = { viewModel.verifyCpf(cpf) },
                        enabled = !loading && CpfValidator.isValid(cpf),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (loading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                            )
                            Spacer(Modifier.size(8.dp))
                            Text(stringResource(R.string.cpf_verifying))
                        } else {
                            Text(stringResource(R.string.cpf_finish))
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    Text(
                        text = stringResource(R.string.cpf_privacy_terms),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

/**
 * Aplica mascara progressiva ao CPF (999.999.999-99) enquanto digita.
 */
private fun formatProgressive(digits: String): String {
    return when {
        digits.length <= 3 -> digits
        digits.length <= 6 -> "${digits.substring(0, 3)}.${digits.substring(3)}"
        digits.length <= 9 ->
            "${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6)}"
        else ->
            "${digits.substring(0, 3)}.${digits.substring(3, 6)}." +
                "${digits.substring(6, 9)}-${digits.substring(9)}"
    }
}
