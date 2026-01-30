package com.futebadosparcas.ui.games.presence

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

/**
 * Badge que indica que o jogador e um convidado (nao membro do grupo).
 * Issue #38: Badge de convidado
 */
@Composable
fun GuestBadge(modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(4.dp),
        color = MaterialTheme.colorScheme.tertiaryContainer
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.PersonAdd,
                contentDescription = null,
                modifier = Modifier.size(12.dp),
                tint = MaterialTheme.colorScheme.onTertiaryContainer
            )
            Text(
                text = stringResource(R.string.guest_label),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onTertiaryContainer,
                modifier = Modifier.padding(start = 2.dp)
            )
        }
    }
}

/**
 * Badge que indica a taxa de presenca/confiabilidade do jogador.
 * Issue #37: Badge de confiabilidade
 *
 * Verde: >= 80% presenca
 * Amarelo: 60-79% presenca
 * Vermelho: < 60% presenca
 * Nao exibe se attendanceRate for null (jogador novo)
 */
@Composable
fun ReliabilityBadge(
    attendanceRate: Double?,
    modifier: Modifier = Modifier
) {
    // Nao exibe para jogadores novos (sem historico)
    if (attendanceRate == null) return

    val (color, contentColor) = when {
        attendanceRate >= 0.8 -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
        attendanceRate >= 0.6 -> MaterialTheme.colorScheme.secondaryContainer to MaterialTheme.colorScheme.onSecondaryContainer
        else -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
    }

    Surface(
        modifier = modifier,
        shape = CircleShape,
        color = color
    ) {
        Text(
            text = "${(attendanceRate * 100).toInt()}%",
            style = MaterialTheme.typography.labelSmall,
            color = contentColor,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}
