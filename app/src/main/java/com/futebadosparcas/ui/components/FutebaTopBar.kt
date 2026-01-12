package com.futebadosparcas.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.R

/**
 * TopBar padronizada do app Futeba dos Parcas.
 *
 * Componente compartilhado para garantir consistencia visual
 * em todas as telas do aplicativo.
 *
 * @param unreadCount Numero de notificacoes nao lidas (0 esconde o badge)
 * @param onNavigateNotifications Callback ao clicar no icone de notificacoes
 * @param onNavigateGroups Callback ao clicar no icone de grupos
 * @param onNavigateMap Callback ao clicar no icone de mapa
 * @param modifier Modifier opcional para customizacao
 */
@Composable
fun FutebaTopBar(
    unreadCount: Int,
    onNavigateNotifications: () -> Unit,
    onNavigateGroups: () -> Unit,
    onNavigateMap: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Titulo do app
            Text(
                text = stringResource(R.string.app_name),
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.weight(1f)
            )

            // Icone de Notificacoes com Badge
            Box {
                IconButton(
                    onClick = onNavigateNotifications,
                    modifier = Modifier.size(48.dp)
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_notifications),
                        contentDescription = stringResource(R.string.cd_notifications),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }

                // Badge de contagem
                if (unreadCount > 0) {
                    Surface(
                        color = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError,
                        shape = CircleShape,
                        modifier = Modifier
                            .size(16.dp)
                            .align(Alignment.TopEnd)
                            .offset(x = (-2).dp, y = 2.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = if (unreadCount > 9) "9+" else unreadCount.toString(),
                                color = MaterialTheme.colorScheme.onError,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }

            // Icone de Grupos
            IconButton(
                onClick = onNavigateGroups,
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_group),
                    contentDescription = stringResource(R.string.cd_groups),
                    tint = MaterialTheme.colorScheme.primary
                )
            }

            // Icone de Mapa/Localizacao
            IconButton(
                onClick = onNavigateMap,
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_map),
                    contentDescription = stringResource(R.string.cd_map),
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}
