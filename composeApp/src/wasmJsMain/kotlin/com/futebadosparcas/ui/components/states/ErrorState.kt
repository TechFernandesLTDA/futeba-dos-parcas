package com.futebadosparcas.ui.components.states

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ErrorState(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    retryButtonText: String = "Tentar Novamente",
    emoji: String = "\u26A0\uFE0F"
) {
    var visible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        visible = true
    }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ) + scaleIn(
            initialScale = 0.9f,
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ) + slideInVertically(
            initialOffsetY = { it / 4 },
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 32.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = emoji,
                fontSize = 64.sp,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            Text(
                text = "Ops! Algo deu errado",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(0.8f)
            )

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                ),
                modifier = Modifier
                    .fillMaxWidth(0.5f)
                    .height(48.dp)
            ) {
                Text("\uD83D\uDD04", fontSize = 16.sp)
                Spacer(modifier = Modifier.width(8.dp))
                Text(retryButtonText)
            }
        }
    }
}

@Composable
fun ErrorStateCompact(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    retryButtonText: String = "Tentar Novamente"
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "\u26A0\uFE0F",
            fontSize = 48.sp,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        TextButton(onClick = onRetry) {
            Text("\uD83D\uDD04", fontSize = 14.sp)
            Spacer(modifier = Modifier.width(4.dp))
            Text(retryButtonText)
        }
    }
}

@Composable
fun ErrorStateWithHelp(
    message: String,
    onRetry: () -> Unit,
    onHelp: () -> Unit,
    modifier: Modifier = Modifier,
    retryButtonText: String = "Tentar Novamente",
    helpButtonText: String = "Preciso de Ajuda",
    emoji: String = "\u2753"
) {
    var visible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        visible = true
    }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ) + scaleIn(
            initialScale = 0.9f,
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ) + slideInVertically(
            initialOffsetY = { it / 4 },
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 32.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = emoji,
                fontSize = 64.sp,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            Text(
                text = "Ops! Algo deu errado",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(0.8f)
            )

            Spacer(modifier = Modifier.height(24.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = onRetry,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    ),
                    modifier = Modifier.height(48.dp)
                ) {
                    Text("\uD83D\uDD04", fontSize = 16.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(retryButtonText)
                }

                OutlinedButton(
                    onClick = onHelp,
                    modifier = Modifier.height(48.dp)
                ) {
                    Text("\u2753", fontSize = 16.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(helpButtonText)
                }
            }
        }
    }
}

@Composable
fun NoConnectionErrorState(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    ErrorState(
        message = "Verifique sua conexão com a internet e tente novamente.",
        onRetry = onRetry,
        modifier = modifier,
        retryButtonText = "Tentar Novamente",
        emoji = "\uD83D\uDCF6"
    )
}

@Composable
fun TimeoutErrorState(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    ErrorState(
        message = "A operação demorou muito. Por favor, tente novamente.",
        onRetry = onRetry,
        modifier = modifier,
        retryButtonText = "Tentar Novamente",
        emoji = "\u231B\uFE0F"
    )
}

@Composable
fun PermissionDeniedErrorState(
    modifier: Modifier = Modifier,
    message: String = "Você não tem permissão para acessar este conteúdo.",
    onRetry: (() -> Unit)? = null
) {
    var visible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        visible = true
    }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ) + scaleIn(
            initialScale = 0.9f,
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ) + slideInVertically(
            initialOffsetY = { it / 4 },
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 32.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "\uD83D\uDD12",
                fontSize = 64.sp,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            Text(
                text = "Acesso Negado",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(0.8f)
            )

            if (onRetry != null) {
                Spacer(modifier = Modifier.height(24.dp))

                OutlinedButton(
                    onClick = onRetry,
                    modifier = Modifier.height(48.dp)
                ) {
                    Text("\u2B05\uFE0F", fontSize = 16.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Voltar")
                }
            }
        }
    }
}

@Composable
fun ServerErrorState(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    onHelp: (() -> Unit)? = null
) {
    if (onHelp != null) {
        ErrorStateWithHelp(
            message = "Nosso servidor está enfrentando problemas. Nossa equipe já foi notificada.",
            onRetry = onRetry,
            onHelp = onHelp,
            modifier = modifier,
            emoji = "\uD83D\uDEA7"
        )
    } else {
        ErrorState(
            message = "Nosso servidor está enfrentando problemas. Tente novamente em alguns minutos.",
            onRetry = onRetry,
            modifier = modifier,
            emoji = "\uD83D\uDEA7"
        )
    }
}

@Composable
fun NotFoundErrorState(
    modifier: Modifier = Modifier,
    onGoBack: (() -> Unit)? = null
) {
    var visible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        visible = true
    }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ) + scaleIn(
            initialScale = 0.9f,
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ) + slideInVertically(
            initialOffsetY = { it / 4 },
            animationSpec = spring(stiffness = Spring.StiffnessLow)
        ),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 32.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "\uD83D\uDD0D",
                fontSize = 64.sp,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            Text(
                text = "Não Encontrado",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "O conteúdo que você está procurando não existe ou foi removido.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(0.8f)
            )

            if (onGoBack != null) {
                Spacer(modifier = Modifier.height(24.dp))

                FilledTonalButton(
                    onClick = onGoBack,
                    modifier = Modifier.height(48.dp)
                ) {
                    Text("\u2B05\uFE0F", fontSize = 16.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Voltar")
                }
            }
        }
    }
}
