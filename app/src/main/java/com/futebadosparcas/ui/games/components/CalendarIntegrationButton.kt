package com.futebadosparcas.ui.games.components

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Event
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Game

/**
 * Botao para adicionar jogo ao calendario do dispositivo.
 * Improvement #10 - Google Calendar Integration.
 */
@Composable
fun CalendarIntegrationButton(
    game: Game?,
    calendarIntent: Intent?,
    onCreateIntent: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    OutlinedButton(
        onClick = {
            if (calendarIntent != null) {
                launchCalendarIntent(context, calendarIntent)
            } else {
                onCreateIntent()
            }
        },
        enabled = game != null,
        modifier = modifier
    ) {
        Icon(
            imageVector = Icons.Default.Event,
            contentDescription = null,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(text = stringResource(R.string.create_game_add_to_calendar))
    }
}

/**
 * Versao destacada do botao para tela de sucesso.
 */
@Composable
fun CalendarIntegrationCard(
    game: Game,
    calendarIntent: Intent?,
    onCreateIntent: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    Button(
        onClick = {
            if (calendarIntent != null) {
                launchCalendarIntent(context, calendarIntent)
            } else {
                onCreateIntent()
            }
        },
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
            contentColor = MaterialTheme.colorScheme.onSecondaryContainer
        ),
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Default.CalendarMonth,
                contentDescription = null,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = stringResource(R.string.create_game_add_to_calendar),
                style = MaterialTheme.typography.labelLarge
            )
        }
    }
}

private fun launchCalendarIntent(context: Context, intent: Intent) {
    try {
        context.startActivity(intent)
    } catch (e: Exception) {
        // Se nenhum app de calendario disponivel, ignorar silenciosamente
        // ou mostrar Toast/Snackbar
    }
}
