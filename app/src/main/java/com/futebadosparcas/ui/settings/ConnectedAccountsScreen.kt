package com.futebadosparcas.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.LinkOff
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialException
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.util.AppLogger
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import kotlinx.coroutines.launch

private const val TAG = "ConnectedAccountsScreen"

/**
 * #3190: Tela "Contas conectadas" — lista provedores de login vinculados e
 * permite vincular/desvincular Google. Renderizada dentro de SecondaryScreenWrapper
 * (que fornece a top bar com botão de voltar).
 */
@Composable
fun ConnectedAccountsScreen(
    viewModel: ConnectedAccountsViewModel
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val credentialManager = remember { CredentialManager.create(context) }

    // Eventos transitórios → snackbar
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            val msg = when (event) {
                is ConnectedAccountsEvent.ShowSuccess -> context.getString(event.messageRes)
                is ConnectedAccountsEvent.ShowError -> context.getString(event.messageRes)
            }
            snackbarHostState.showSnackbar(msg)
        }
    }

    val success = uiState as? ConnectedAccountsUiState.Success
    val providers = success?.providers ?: emptyList()
    val hasGoogle = providers.contains("google.com")
    val hasPassword = providers.contains("password")
    val canUnlinkGoogle = hasGoogle && hasPassword

    var confirmUnlinkOpen by remember { mutableStateOf(false) }

    // Lança o fluxo do Credential Manager para obter o idToken do Google.
    fun startGoogleLink() {
        scope.launch {
            try {
                val googleIdOption = GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(context.getString(R.string.default_web_client_id))
                    .build()
                val request = GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build()
                val result = credentialManager.getCredential(request = request, context = context)
                val credential = result.credential
                if (credential is CustomCredential &&
                    credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                ) {
                    try {
                        val googleId = GoogleIdTokenCredential.createFrom(credential.data)
                        viewModel.linkGoogleAccount(googleId.idToken)
                    } catch (e: GoogleIdTokenParsingException) {
                        AppLogger.e(TAG, "Invalid Google ID token", e)
                        snackbarHostState.showSnackbar(context.getString(R.string.connected_accounts_link_error))
                    }
                } else {
                    AppLogger.e(TAG, "Unexpected credential type: ${credential.type}")
                    snackbarHostState.showSnackbar(context.getString(R.string.connected_accounts_link_error))
                }
            } catch (e: GetCredentialException) {
                // Usuário cancelou o seletor — não é erro (padrão do projeto)
                AppLogger.d(TAG) { "Google link credential cancelled: ${e.message}" }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Google link credential failed", e)
                snackbarHostState.showSnackbar(context.getString(R.string.connected_accounts_link_error))
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.connected_accounts_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            // Lista de provedores vinculados
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(8.dp)) {
                    if (providers.isEmpty()) {
                        Text(
                            text = stringResource(R.string.connected_accounts_subtitle),
                            modifier = Modifier.padding(16.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        providers.forEachIndexed { index, providerId ->
                            ProviderRow(providerId)
                            if (index < providers.lastIndex) HorizontalDivider()
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // Ações
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (!hasGoogle) {
                    Button(
                        onClick = { startGoogleLink() },
                        enabled = !(success?.isLinking ?: false) && !(success?.isUnlinking ?: false),
                        modifier = Modifier.weight(1f)
                    ) {
                        if (success?.isLinking == true) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        } else {
                            Icon(
                                painter = painterResource(R.drawable.ic_google),
                                contentDescription = null,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(stringResource(R.string.connected_accounts_link_google))
                        }
                    }
                }
                if (hasGoogle) {
                    OutlinedButton(
                        onClick = { confirmUnlinkOpen = true },
                        enabled = canUnlinkGoogle &&
                            !(success?.isLinking ?: false) &&
                            !(success?.isUnlinking ?: false),
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error
                        )
                    ) {
                        if (success?.isUnlinking == true) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(Icons.Default.LinkOff, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text(stringResource(R.string.connected_accounts_unlink_google))
                        }
                    }
                }
            }

            if (hasGoogle && !canUnlinkGoogle) {
                Text(
                    text = stringResource(R.string.connected_accounts_cannot_unlink),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 12.dp)
                )
            }
        }
    }

    if (confirmUnlinkOpen) {
        AlertDialog(
            onDismissRequest = { confirmUnlinkOpen = false },
            title = { Text(stringResource(R.string.connected_accounts_unlink_confirm_title)) },
            text = { Text(stringResource(R.string.connected_accounts_unlink_confirm_desc)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmUnlinkOpen = false
                        viewModel.unlinkGoogleAccount()
                    }
                ) {
                    Text(
                        stringResource(R.string.connected_accounts_unlink_google),
                        color = MaterialTheme.colorScheme.error
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmUnlinkOpen = false }) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }
}

@Composable
private fun ProviderRow(providerId: String) {
    val labelRes: Int? = when (providerId) {
        "password" -> R.string.connected_accounts_provider_password
        "google.com" -> R.string.connected_accounts_provider_google
        "phone" -> R.string.connected_accounts_provider_phone
        else -> null
    }
    val icon: ImageVector? = when (providerId) {
        "password" -> Icons.Default.Lock
        "phone" -> Icons.Default.Phone
        else -> Icons.Default.AccountCircle
    }
    Row(
        modifier = Modifier.fillMaxWidth().padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (providerId == "google.com") {
            Icon(
                painter = painterResource(R.drawable.ic_google),
                contentDescription = null,
                modifier = Modifier.size(24.dp)
            )
        } else {
            icon?.let {
                Icon(it, contentDescription = null, modifier = Modifier.size(24.dp))
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = labelRes?.let { stringResource(it) } ?: providerId,
                fontWeight = FontWeight.Medium
            )
        }
        SuggestionChip(
            onClick = {},
            label = { Text(stringResource(R.string.connected_accounts_connected)) }
        )
    }
}
