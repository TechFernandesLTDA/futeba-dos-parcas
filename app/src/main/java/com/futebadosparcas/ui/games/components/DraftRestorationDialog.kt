package com.futebadosparcas.ui.games.components
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.unit.dp
import com.futebadosparcas.data.model.GameDraft
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Dialog para restaurar rascunho de jogo salvo anteriormente.
 * Improvement #9 - Auto-Save Draft.
 */
@Composable
fun DraftRestorationDialog(
    onRestore: () -> Unit,
    onDiscard: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDiscard,
        icon = {
            Icon(
                imageVector = Icons.Default.Restore,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
        },
        title = {
            Text(
                text = stringResource(Res.string.create_game_draft_title),
                style = MaterialTheme.typography.titleLarge
            )
        },
        text = {
            Column {
                Text(
                    text = stringResource(Res.string.create_game_draft_message),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onRestore) {
                Text(stringResource(Res.string.create_game_draft_restore))
            }
        },
        dismissButton = {
            TextButton(onClick = onDiscard) {
                Text(stringResource(Res.string.create_game_draft_discard))
            }
        }
    )
}

/**
 * Indicador de salvamento automatico.
 */
@Composable
fun AutoSaveIndicator(
    isSaving: Boolean,
    lastSavedAt: Long?,
    modifier: Modifier = Modifier
) {
    if (lastSavedAt == null && !isSaving) return

    val dateFormat = remember { SimpleDateFormat("HH:mm", Locale.forLanguageTag("pt-BR")) }

    Row(
        modifier = modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = if (isSaving) {
                stringResource(Res.string.create_game_draft_saving)
            } else {
                stringResource(
                    Res.string.create_game_draft_saved,
                    dateFormat.format(Date(lastSavedAt ?: 0L))
                )
            },
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
        )
    }
}
