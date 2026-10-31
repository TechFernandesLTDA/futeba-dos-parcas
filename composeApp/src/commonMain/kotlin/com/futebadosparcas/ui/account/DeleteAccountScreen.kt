package com.futebadosparcas.ui.account

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.cancel
import com.futebadosparcas.compose.resources.cd_back
import com.futebadosparcas.compose.resources.delete_account_acknowledge
import com.futebadosparcas.compose.resources.delete_account_button
import com.futebadosparcas.compose.resources.delete_account_button_cd
import com.futebadosparcas.compose.resources.delete_account_confirm_action
import com.futebadosparcas.compose.resources.delete_account_confirm_body
import com.futebadosparcas.compose.resources.delete_account_confirm_title
import com.futebadosparcas.compose.resources.delete_account_error_generic
import com.futebadosparcas.compose.resources.delete_account_error_recent_login
import com.futebadosparcas.compose.resources.delete_account_error_recent_login_action
import com.futebadosparcas.compose.resources.delete_account_error_unavailable
import com.futebadosparcas.compose.resources.delete_account_error_unavailable_action
import com.futebadosparcas.compose.resources.delete_account_headline
import com.futebadosparcas.compose.resources.delete_account_in_progress
import com.futebadosparcas.compose.resources.delete_account_intro
import com.futebadosparcas.compose.resources.delete_account_item_groups
import com.futebadosparcas.compose.resources.delete_account_item_messages
import com.futebadosparcas.compose.resources.delete_account_item_profile
import com.futebadosparcas.compose.resources.delete_account_item_stats
import com.futebadosparcas.compose.resources.delete_account_retention_note
import com.futebadosparcas.compose.resources.delete_account_title
import com.futebadosparcas.compose.resources.delete_account_web_url
import com.futebadosparcas.compose.resources.retry
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import org.jetbrains.compose.resources.stringResource

/**
 * Tela de exclusão de conta (#4391/#4401, App Store 5.1.1(v), LGPD art. 18, VI).
 *
 * Confirmação dupla: (1) o usuário marca "Entendo que a exclusão é permanente", o que
 * habilita o botão destrutivo; (2) um alerta pede a confirmação final. Ao concluir, a
 * sessão já foi encerrada pelo ViewModel e [onAccountDeleted] leva ao início.
 */
@Composable
fun DeleteAccountScreen(
    viewModel: DeleteAccountViewModel,
    onNavigateBack: () -> Unit,
    onAccountDeleted: () -> Unit,
    onSignedOutForReauthentication: () -> Unit
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(state) {
        if (state == DeleteAccountUiState.Deleted) onAccountDeleted()
    }

    DeleteAccountContent(
        state = state,
        onNavigateBack = onNavigateBack,
        onConfirmDeletion = viewModel::confirmDeletion,
        onDismissError = viewModel::dismissError,
        onSignOutForReauthentication = {
            viewModel.signOutForReauthentication(onSignedOutForReauthentication)
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DeleteAccountContent(
    state: DeleteAccountUiState,
    onNavigateBack: () -> Unit,
    onConfirmDeletion: () -> Unit,
    onDismissError: () -> Unit,
    onSignOutForReauthentication: () -> Unit
) {
    var acknowledged by remember { mutableStateOf(false) }
    var showFinalConfirmation by remember { mutableStateOf(false) }
    val isDeleting = state == DeleteAccountUiState.Deleting
    val haptics = LocalHapticFeedback.current

    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = stringResource(Res.string.delete_account_title),
                navigationIcon = {
                    // Sem voltar durante a exclusão: a operação não pode ser interrompida.
                    if (!isDeleting) {
                        IconButton(onClick = onNavigateBack) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = stringResource(Res.string.cd_back)
                            )
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Column(
                modifier = Modifier.widthIn(max = 640.dp).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Filled.WarningAmber,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(Modifier.width(12.dp))
                    Text(
                        text = stringResource(Res.string.delete_account_headline),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.semantics { heading() }
                    )
                }

                Text(
                    text = stringResource(Res.string.delete_account_intro),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface
                )

                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(
                            Res.string.delete_account_item_profile,
                            Res.string.delete_account_item_stats,
                            Res.string.delete_account_item_groups,
                            Res.string.delete_account_item_messages
                        ).forEach { item ->
                            BulletLine(text = stringResource(item))
                        }
                    }
                }

                Text(
                    text = stringResource(Res.string.delete_account_retention_note),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Confirmação 1: a linha inteira é o alvo de toque (≥ 48dp), com papel de checkbox.
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .toggleable(
                            value = acknowledged,
                            enabled = !isDeleting,
                            role = Role.Checkbox,
                            onValueChange = { acknowledged = it }
                        ),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = acknowledged,
                        onCheckedChange = null,
                        enabled = !isDeleting
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = stringResource(Res.string.delete_account_acknowledge),
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                if (state is DeleteAccountUiState.Error) {
                    DeleteAccountErrorCard(
                        error = state.reason,
                        onRetry = {
                            onDismissError()
                            showFinalConfirmation = true
                        },
                        onSignOutForReauthentication = onSignOutForReauthentication
                    )
                }

                val buttonDescription = stringResource(Res.string.delete_account_button_cd)
                Button(
                    onClick = { showFinalConfirmation = true },
                    enabled = acknowledged && !isDeleting,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .semantics { contentDescription = buttonDescription }
                ) {
                    if (isDeleting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onError
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(stringResource(Res.string.delete_account_in_progress))
                    } else {
                        Text(stringResource(Res.string.delete_account_button))
                    }
                }
            }
        }
    }

    // Confirmação 2: alerta final com a ação destrutiva destacada em vermelho.
    if (showFinalConfirmation) {
        AlertDialog(
            onDismissRequest = { showFinalConfirmation = false },
            title = { Text(stringResource(Res.string.delete_account_confirm_title)) },
            text = { Text(stringResource(Res.string.delete_account_confirm_body)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        showFinalConfirmation = false
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        onConfirmDeletion()
                    },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text(
                        text = stringResource(Res.string.delete_account_confirm_action),
                        fontWeight = FontWeight.SemiBold
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showFinalConfirmation = false }) {
                    Text(stringResource(Res.string.cancel))
                }
            }
        )
    }
}

@Composable
private fun BulletLine(text: String) {
    Row(verticalAlignment = Alignment.Top) {
        Text(
            text = "•",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = text,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun DeleteAccountErrorCard(
    error: DeleteAccountError,
    onRetry: () -> Unit,
    onSignOutForReauthentication: () -> Unit
) {
    val uriHandler = LocalUriHandler.current
    val webUrl = stringResource(Res.string.delete_account_web_url)
    val message = when (error) {
        DeleteAccountError.RECENT_LOGIN_REQUIRED -> Res.string.delete_account_error_recent_login
        DeleteAccountError.BACKEND_UNAVAILABLE -> Res.string.delete_account_error_unavailable
        DeleteAccountError.GENERIC -> Res.string.delete_account_error_generic
    }
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer,
            contentColor = MaterialTheme.colorScheme.onErrorContainer
        ),
        // Anuncia o erro ao VoiceOver assim que aparece.
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = stringResource(message),
                style = MaterialTheme.typography.bodyMedium
            )
            OutlinedButton(
                onClick = when (error) {
                    DeleteAccountError.RECENT_LOGIN_REQUIRED -> onSignOutForReauthentication
                    DeleteAccountError.BACKEND_UNAVAILABLE -> {
                        { runCatching { uriHandler.openUri(webUrl) }; Unit }
                    }
                    DeleteAccountError.GENERIC -> onRetry
                },
                modifier = Modifier.heightIn(min = 48.dp)
            ) {
                Text(
                    stringResource(
                        when (error) {
                            DeleteAccountError.RECENT_LOGIN_REQUIRED ->
                                Res.string.delete_account_error_recent_login_action
                            DeleteAccountError.BACKEND_UNAVAILABLE ->
                                Res.string.delete_account_error_unavailable_action
                            DeleteAccountError.GENERIC -> Res.string.retry
                        }
                    )
                )
            }
        }
    }
}
