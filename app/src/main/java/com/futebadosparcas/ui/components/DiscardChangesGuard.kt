package com.futebadosparcas.ui.components

import androidx.activity.compose.BackHandler
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.R

/**
 * Guard reutilizável para forms com dirty state.
 *
 * Protege contra perda silenciosa de dados em duas vias:
 * 1. **System back gesture** — `BackHandler` ativo quando `isDirty=true` mostra
 *    AlertDialog antes de descartar.
 * 2. **TopBar back button** — caller usa o callback `attemptExit` retornado em
 *    vez do `onNavigateBack` direto. Se dirty, mostra dialog; senão sai imediato.
 *
 * Uso típico em CreateGameScreen / CreateGroupScreen / EditProfileScreen:
 * ```kotlin
 * val attemptExit = rememberDiscardChangesGuard(
 *     isDirty = isDirty,
 *     onConfirmedExit = onNavigateBack,
 * )
 *
 * Scaffold(
 *     topBar = {
 *         TopAppBar(
 *             navigationIcon = {
 *                 IconButton(onClick = attemptExit) {
 *                     Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = ...)
 *                 }
 *             },
 *             // ...
 *         )
 *     }
 * ) { ... }
 * ```
 *
 * FIX android-audit A1-H4 (2026-05-08): forms perdiam dados silenciosamente em
 * system back gesture. Pattern equivalente ao `useDirtyGuard` do web app.
 *
 * @param isDirty Se há mudanças não salvas (caller calcula via comparação ou ViewModel)
 * @param onConfirmedExit Ação executada ao confirmar descarte (geralmente `onNavigateBack`)
 * @return Callback `attemptExit` pra plugar no TopBar back button
 */
@Composable
fun rememberDiscardChangesGuard(
    isDirty: Boolean,
    onConfirmedExit: () -> Unit,
): () -> Unit {
    var showDialog by remember { mutableStateOf(false) }

    val attemptExit: () -> Unit = {
        if (isDirty) {
            showDialog = true
        } else {
            onConfirmedExit()
        }
    }

    BackHandler(enabled = isDirty) {
        showDialog = true
    }

    if (showDialog) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            title = { Text(stringResource(R.string.form_discard_changes_title)) },
            text = { Text(stringResource(R.string.form_discard_changes_message)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDialog = false
                        onConfirmedExit()
                    }
                ) {
                    Text(stringResource(R.string.form_discard_changes_confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = { showDialog = false }) {
                    Text(stringResource(R.string.form_discard_changes_dismiss))
                }
            }
        )
    }

    return attemptExit
}
