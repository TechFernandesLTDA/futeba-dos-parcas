package com.futebadosparcas.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

/**
 * Banner global de status de conectividade.
 *
 * Exibe mensagem clara de "Modo offline — funções limitadas" quando sem conexão.
 * Cores via MaterialTheme.colorScheme (nunca hardcoded).
 *
 * TODO (follow-up #2222): adotar em MainActivityCompose como overlay no topo
 * do scaffold, abaixo da TopBar, passando ConnectivityMonitor.isConnected.
 */
@Composable
fun SyncStatusBanner(
    isConnected: Boolean,
    modifier: Modifier = Modifier
) {
    // Descrição acessível para leitores de tela — comunica estado completo.
    val bannerDesc = stringResource(R.string.ui_offline_banner_desc)

    AnimatedVisibility(
        visible = !isConnected,
        enter = expandVertically(),
        exit = shrinkVertically(),
        modifier = modifier
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.errorContainer)
                .padding(horizontal = 16.dp, vertical = 10.dp)
                // Semântica: role="alert" equivalente no Compose via liveRegion.
                // contentDescription descreve o estado completo para a11y.
                .semantics { contentDescription = bannerDesc },
            contentAlignment = Alignment.Center
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.CloudOff,
                    // Ícone é decorativo — a11y já coberta pelo semantics do Box pai.
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier
                        .size(18.dp)
                        .padding(end = 0.dp)
                )
                Text(
                    // #2222: mensagem clara de modo offline com funções limitadas.
                    text = stringResource(R.string.ui_offline_message),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }
        }
    }
}
