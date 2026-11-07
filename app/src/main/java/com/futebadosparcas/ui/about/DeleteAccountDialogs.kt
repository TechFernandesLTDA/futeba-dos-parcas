package com.futebadosparcas.ui.about

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialException
import com.futebadosparcas.R
import com.futebadosparcas.data.repository.BlockingGroup
import com.futebadosparcas.util.AppLogger
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import kotlinx.coroutines.launch

private const val TAG = "DeleteAccountDialogs"
private const val PROVIDER_GOOGLE = "google.com"
private const val PROVIDER_PASSWORD = "password"

/**
 * Diálogo de reautenticação (#4391): o login tem mais de 10 min.
 * Oferece Google e/ou senha, conforme os provedores vinculados à conta.
 */
@Composable
fun DeleteAccountReauthDialog(
    state: DeleteAccountUiState,
    onReauthWithPassword: (String) -> Unit,
    onReauthWithGoogleToken: (String) -> Unit,
    onReauthGoogleFailed: () -> Unit,
    onDismiss: () -> Unit,
) {
    val providers = state.reauthProviders ?: return
    val context = LocalContext.current
    val defaultWebClientId = stringResource(R.string.default_web_client_id)
    val scope = rememberCoroutineScope()
    var password by remember { mutableStateOf("") }
    val busy = state.isReauthenticating || state.isDeleting
    val hasGoogle = providers.contains(PROVIDER_GOOGLE)
    val hasPassword = providers.contains(PROVIDER_PASSWORD)

    fun startGoogleReauth() {
        scope.launch {
            try {
                val option = GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(defaultWebClientId)
                    .build()
                val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
                val credential = CredentialManager.create(context)
                    .getCredential(request = request, context = context).credential
                if (credential is CustomCredential &&
                    credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                ) {
                    try {
                        onReauthWithGoogleToken(GoogleIdTokenCredential.createFrom(credential.data).idToken)
                    } catch (e: GoogleIdTokenParsingException) {
                        AppLogger.e(TAG, "Invalid Google ID token", e)
                        onReauthGoogleFailed()
                    }
                } else {
                    onReauthGoogleFailed()
                }
            } catch (e: GetCredentialException) {
                // Usuário cancelou o seletor: não é erro
                AppLogger.d(TAG) { "Google reauth cancelled: ${e.message}" }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Google reauth failed", e)
                onReauthGoogleFailed()
            }
        }
    }

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        icon = { Icon(Icons.Default.Lock, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
        title = { Text(stringResource(R.string.delete_account_reauth_title)) },
        text = {
            Column {
                Text(stringResource(R.string.delete_account_reauth_message))
                if (hasPassword) {
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.delete_account_reauth_password)) },
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        singleLine = true,
                        enabled = !busy
                    )
                }
                if (hasGoogle) {
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = { startGoogleReauth() },
                        enabled = !busy,
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                    ) {
                        Text(stringResource(R.string.delete_account_reauth_google))
                    }
                }
                state.reauthErrorRes?.let { errorRes ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(errorRes),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                if (busy) {
                    Spacer(modifier = Modifier.height(8.dp))
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                }
            }
        },
        confirmButton = {
            if (hasPassword) {
                Button(
                    onClick = { onReauthWithPassword(password) },
                    enabled = password.isNotBlank() && !busy,
                    modifier = Modifier.heightIn(min = 48.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError
                    )
                ) {
                    Text(stringResource(R.string.delete_account_reauth_confirm))
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !busy,
                modifier = Modifier.heightIn(min = 48.dp)
            ) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}

/**
 * Diálogo de bloqueio (#4391): o usuário é dono de grupos com outros
 * membros ativos e precisa transferir a posse ou remover os membros.
 */
@Composable
fun DeleteAccountBlockingGroupsDialog(
    groups: List<BlockingGroup>?,
    onDismiss: () -> Unit,
) {
    if (groups == null) return
    val unnamed = stringResource(R.string.delete_account_blocked_group_unnamed)
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
        title = { Text(stringResource(R.string.delete_account_blocked_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(R.string.delete_account_blocked_message))
                Spacer(modifier = Modifier.height(4.dp))
                groups.forEach { group ->
                    Text(
                        text = stringResource(
                            R.string.delete_account_blocked_group_item,
                            group.name.ifBlank { unnamed }
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss, modifier = Modifier.heightIn(min = 48.dp)) {
                Text(stringResource(R.string.delete_account_blocked_ok))
            }
        }
    )
}
