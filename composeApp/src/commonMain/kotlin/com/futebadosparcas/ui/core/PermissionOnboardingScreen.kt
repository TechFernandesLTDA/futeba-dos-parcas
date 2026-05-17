package com.futebadosparcas.ui.core

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Camera
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import org.koin.compose.viewmodel.koinViewModel

/**
 * Tela de onboarding para solicitar permissões do sistema.
 * Exibida na primeira abertura do app para solicitar:
 * - Notificações (se necessário)
 * - Localização (para encontrar jogos próximos)
 * - Câmera (para foto de perfil)
 * - Microfone (para mensagens de voz)
 */
@Composable
fun PermissionOnboardingScreen(
    onComplete: () -> Unit,
    viewModel: PermissionOnboardingViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsState()
    val scrollState = rememberScrollState()

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(48.dp))

            // Título
            Text(
                text = "Permissões necessárias",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onBackground
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Para a melhor experiência, permita o acesso aos recursos abaixo",
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Card de Notificações (condicional)
            if (state.showNotificationPermission) {
                PermissionCard(
                    icon = Icons.Filled.Notifications,
                    title = "Notificações",
                    description = "Receba convites para jogos e atualizações",
                    isGranted = state.notificationGranted,
                    onRequest = { viewModel.requestNotification() }
                )
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Card de Localização
            PermissionCard(
                icon = Icons.Filled.LocationOn,
                title = "Localização",
                description = "Encontre jogos perto de você",
                isGranted = state.locationGranted,
                onRequest = { viewModel.requestLocation() }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Card de Câmera
            PermissionCard(
                icon = Icons.Filled.Camera,
                title = "Câmera",
                description = "Tire fotos para seu perfil",
                isGranted = state.cameraGranted,
                onRequest = { viewModel.requestCamera() }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Card de Microfone (Mensagens de Voz)
            PermissionCard(
                icon = Icons.Filled.Mic,
                title = "Microfone",
                description = "Envie mensagens de voz",
                isGranted = state.microphoneGranted,
                onRequest = { viewModel.requestMicrophone() }
            )

            Spacer(modifier = Modifier.weight(1f))

            // Botão Continuar
            Button(
                onClick = onComplete,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                Text(
                    text = "Continuar",
                    style = MaterialTheme.typography.titleMedium
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Texto informativo
            Text(
                text = "Você pode permitir depois nas configurações.",
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun PermissionCard(
    icon: ImageVector,
    title: String,
    description: String,
    isGranted: Boolean,
    onRequest: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isGranted) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
            } else {
                MaterialTheme.colorScheme.surfaceContainerHigh
            }
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Ícone
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(
                        color = if (isGranted) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.surfaceVariant
                        },
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isGranted) Icons.Filled.Check else icon,
                    contentDescription = null,
                    tint = if (isGranted) {
                        MaterialTheme.colorScheme.onPrimary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Textos
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Botão
            AnimatedVisibility(
                visible = !isGranted,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                OutlinedButton(
                    onClick = onRequest,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Permitir")
                }
            }
        }
    }
}