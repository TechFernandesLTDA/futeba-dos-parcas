package com.futebadosparcas.ui.onboarding

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
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
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.ui.theme.AppDimensions
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
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val defaultCountryCode = stringResource(R.string.phone_verification_country_code)
    val connectionErrorMsg = stringResource(R.string.phone_error_connection)

    var phone by rememberSaveable { mutableStateOf(defaultCountryCode) }
    var otp by rememberSaveable { mutableStateOf("") }
    var step by rememberSaveable { mutableStateOf("phone") } // phone | otp

    // Avanca step quando codigo enviado
    LaunchedEffect(state) {
        when (state) {
            PhoneVerificationUiState.CodeSent -> step = "otp"
            is PhoneVerificationUiState.AccountCollision -> step = "otp"
            is PhoneVerificationUiState.ClaimingAccount -> step = "otp"
            is PhoneVerificationUiState.RequestingMerge -> step = "otp"
            PhoneVerificationUiState.Success -> onSuccess()
            else -> {}
        }
    }

    // Volta pra step phone se erro durante OTP
    BackHandler(enabled = step == "otp") {
        viewModel.clearCollision()
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
                .padding(AppDimensions.spacing_extraLarge),
            verticalArrangement = Arrangement.Center,
        ) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                ),
            ) {
                Column(
                    modifier = Modifier.padding(AppDimensions.spacing_extraLarge),
                ) {
                    Box(
                        modifier = Modifier.size(AppDimensions.icon_extraLarge),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Phone,
                            contentDescription = null,
                            modifier = Modifier.size(40.dp),
                            tint = MaterialTheme.colorScheme.primary,
                        )
                    }
                    Spacer(Modifier.height(AppDimensions.spacing_small))
                    val stepLabel = stringResource(R.string.phone_verification_step_cd)
                    Text(
                        text = stringResource(R.string.phone_verification_title),
                        style = MaterialTheme.typography.headlineSmall,
                        modifier = Modifier.semantics {
                            contentDescription = stepLabel
                        },
                    )
                    Spacer(Modifier.height(AppDimensions.spacing_small))
                    Text(
                        text = stringResource(R.string.phone_verification_description),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(AppDimensions.spacing_medium))

                    val errorMsg = (state as? PhoneVerificationUiState.Error)?.message
                    if (errorMsg != null) {
                        Text(
                            text = errorMsg,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Spacer(Modifier.height(AppDimensions.spacing_small))
                    }

                    val loading = state is PhoneVerificationUiState.SendingCode ||
                        state is PhoneVerificationUiState.Verifying ||
                        state is PhoneVerificationUiState.ClaimingAccount ||
                        state is PhoneVerificationUiState.RequestingMerge
                    val accountCollisionActive =
                        state is PhoneVerificationUiState.AccountCollision ||
                            state is PhoneVerificationUiState.ClaimingAccount ||
                            state is PhoneVerificationUiState.RequestingMerge

                    if (step == "phone") {
                        OutlinedTextField(
                            value = phone,
                            onValueChange = { phone = it },
                            label = { Text(stringResource(R.string.phone_verification_label)) },
                            placeholder = { Text(stringResource(R.string.phone_verification_placeholder)) },
                            singleLine = true,
                            enabled = !loading,
                            modifier = Modifier.fillMaxWidth(),
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Phone,
                            ),
                            supportingText = {
                                Text(stringResource(R.string.phone_verification_supporting_text))
                            },
                        )
                        Spacer(Modifier.height(AppDimensions.spacing_medium))
                        Button(
                            onClick = {
                                val activity = context.findActivity()
                                if (activity == null) {
                                    viewModel.reportRecoverableError(
                                        connectionErrorMsg,
                                    )
                                    return@Button
                                }
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
                                Spacer(Modifier.size(AppDimensions.spacing_small))
                                Text(stringResource(R.string.phone_verification_sending))
                            } else {
                                Text(stringResource(R.string.phone_verification_send_code))
                            }
                        }
                    } else if (accountCollisionActive) {
                        Text(
                            text = stringResource(R.string.phone_account_claim_title),
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Spacer(Modifier.height(AppDimensions.spacing_small))
                        Text(
                            text = stringResource(R.string.phone_account_claim_description),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(AppDimensions.spacing_small))
                        Text(
                            text = stringResource(R.string.phone_account_claim_privacy),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(AppDimensions.spacing_large))
                        Button(
                            onClick = { viewModel.claimExistingAccount(false) },
                            enabled = !loading,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            if (state is PhoneVerificationUiState.ClaimingAccount) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp,
                                )
                                Spacer(Modifier.size(AppDimensions.spacing_small))
                                Text(stringResource(R.string.phone_claim_existing_loading))
                            } else {
                                Text(stringResource(R.string.phone_claim_existing_account))
                            }
                        }
                        Spacer(Modifier.height(AppDimensions.spacing_small))
                        OutlinedButton(
                            onClick = { viewModel.claimExistingAccount(true) },
                            enabled = !loading,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            if (state is PhoneVerificationUiState.RequestingMerge) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp,
                                )
                                Spacer(Modifier.size(AppDimensions.spacing_small))
                                Text(stringResource(R.string.phone_request_merge_loading))
                            } else {
                                Text(stringResource(R.string.phone_request_merge))
                            }
                        }
                        Spacer(Modifier.height(AppDimensions.spacing_small))
                        OutlinedButton(
                            onClick = {
                                viewModel.clearCollision()
                                step = "phone"
                                otp = ""
                            },
                            enabled = !loading,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(stringResource(R.string.phone_use_another_number))
                        }
                    } else {
                        Text(
                            text = stringResource(R.string.phone_verification_enter_code, phone),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Spacer(Modifier.height(AppDimensions.spacing_medium))
                        OutlinedTextField(
                            value = otp,
                            onValueChange = {
                                if (it.length <= 6 && it.all { c -> c.isDigit() }) {
                                    otp = it
                                }
                            },
                            label = { Text(stringResource(R.string.phone_verification_code_label)) },
                            placeholder = { Text(stringResource(R.string.phone_verification_code_placeholder)) },
                            singleLine = true,
                            enabled = !loading,
                            modifier = Modifier.fillMaxWidth(),
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.NumberPassword,
                            ),
                        )
                        Spacer(Modifier.height(AppDimensions.spacing_medium))
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
                                        Spacer(Modifier.size(AppDimensions.spacing_small))
                                        Text(stringResource(R.string.phone_verification_verifying))
                                    } else {
                                        Text(stringResource(R.string.verify))
                                    }
                                }
                                Spacer(Modifier.height(AppDimensions.spacing_small))
                                OutlinedButton(
                                    onClick = {
                                        step = "phone"
                                        otp = ""
                                    },
                                    enabled = !loading,
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    Text(stringResource(R.string.back))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
