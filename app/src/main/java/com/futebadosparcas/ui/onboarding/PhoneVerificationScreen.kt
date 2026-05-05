package com.futebadosparcas.ui.onboarding

import androidx.activity.compose.BackHandler
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
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.activity.ComponentActivity
import org.koin.compose.viewmodel.koinViewModel

/**
 * Tela 1/2 do onboarding obrigatorio: verificacao de telefone via SMS OTP.
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md (R2, Fase 3 #446)
 */
@Composable
fun PhoneVerificationScreen(
    onSuccess: () -> Unit = {},
    viewModel: PhoneVerificationViewModel = koinViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    var phone by rememberSaveable { mutableStateOf("+55") }
    var otp by rememberSaveable { mutableStateOf("") }
    var step by rememberSaveable { mutableStateOf("phone") } // phone | otp

    // Avanca step quando codigo enviado
    LaunchedEffect(state) {
        when (state) {
            PhoneVerificationUiState.CodeSent -> step = "otp"
            PhoneVerificationUiState.Success -> onSuccess()
            else -> {}
        }
    }

    // Volta pra step phone se erro durante OTP
    BackHandler(enabled = step == "otp") {
        step = "phone"
        otp = ""
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
                Column(
                    modifier = Modifier.padding(24.dp),
                ) {
                    Box(
                        modifier = Modifier.size(48.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Phone,
                            contentDescription = null,
                            modifier = Modifier.size(40.dp),
                            tint = MaterialTheme.colorScheme.primary,
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "Verificar telefone",
                        style = MaterialTheme.typography.headlineSmall,
                        modifier = Modifier.semantics {
                            contentDescription = "Etapa 1 de 2: Verificar telefone"
                        },
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "Confirmamos seu numero via SMS para evitar contas falsas. Etapa 1 de 2.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(16.dp))

                    val errorMsg = (state as? PhoneVerificationUiState.Error)?.message
                    if (errorMsg != null) {
                        Text(
                            text = errorMsg,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Spacer(Modifier.height(8.dp))
                    }

                    val loading = state is PhoneVerificationUiState.SendingCode ||
                        state is PhoneVerificationUiState.Verifying

                    if (step == "phone") {
                        OutlinedTextField(
                            value = phone,
                            onValueChange = { phone = it },
                            label = { Text("Telefone (com DDD)") },
                            placeholder = { Text("+5511999998888") },
                            singleLine = true,
                            enabled = !loading,
                            modifier = Modifier.fillMaxWidth(),
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Phone,
                            ),
                            supportingText = {
                                Text("Formato internacional: +55 + DDD + numero")
                            },
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(
                            onClick = {
                                val activity = context as? ComponentActivity
                                    ?: return@Button
                                viewModel.sendVerificationCode(activity, phone)
                            },
                            enabled = !loading,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            if (loading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp,
                                )
                                Spacer(Modifier.size(8.dp))
                                Text("Enviando...")
                            } else {
                                Text("Enviar codigo por SMS")
                            }
                        }
                    } else {
                        Text(
                            text = "Digite o codigo de 6 digitos enviado para $phone",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Spacer(Modifier.height(16.dp))
                        OutlinedTextField(
                            value = otp,
                            onValueChange = {
                                if (it.length <= 6 && it.all { c -> c.isDigit() }) {
                                    otp = it
                                }
                            },
                            label = { Text("Codigo") },
                            placeholder = { Text("123456") },
                            singleLine = true,
                            enabled = !loading,
                            modifier = Modifier.fillMaxWidth(),
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.NumberPassword,
                            ),
                        )
                        Spacer(Modifier.height(16.dp))
                        Box(modifier = Modifier.fillMaxWidth()) {
                            Column {
                                Button(
                                    onClick = { viewModel.verifyCode(otp) },
                                    enabled = !loading && otp.length == 6,
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    if (loading) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(20.dp),
                                            strokeWidth = 2.dp,
                                        )
                                        Spacer(Modifier.size(8.dp))
                                        Text("Verificando...")
                                    } else {
                                        Text("Verificar")
                                    }
                                }
                                Spacer(Modifier.height(8.dp))
                                OutlinedButton(
                                    onClick = {
                                        step = "phone"
                                        otp = ""
                                    },
                                    enabled = !loading,
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    Text("Voltar")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
