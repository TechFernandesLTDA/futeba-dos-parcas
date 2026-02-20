package com.futebadosparcas.ui.locations.components
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
/**
 * Estado vazio progressivo para onboarding de Locais
 *
 * Mostra um guia passo a passo para configurar locais:
 * - Passo 1: Criar primeiro local
 * - Passo 2: Adicionar quadras ao local
 * - Passo 3: Definir precos e horarios
 *
 * O passo atual eh destacado visualmente enquanto os passos
 * anteriores mostram checkmark e os proximos ficam esmaecidos.
 *
 * @param currentStep Passo atual (0 = sem locais, 1 = tem local sem quadras, 2 = completo)
 * @param onCreateLocation Callback para criar novo local
 * @param onAddField Callback para adicionar quadra
 * @param onSetPricing Callback para configurar precos
 */
@Composable
fun WelcomeLocationEmptyState(
    currentStep: Int,
    onCreateLocation: () -> Unit,
    onAddField: () -> Unit,
    onSetPricing: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Icone principal
        Icon(
            imageVector = Icons.Default.LocationOn,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Titulo
        Text(
            text = stringResource(Res.string.location_onboarding_title),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Subtitulo
        Text(
            text = stringResource(Res.string.location_onboarding_subtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Card com passos
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceContainerLow
            ),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Passo 1: Criar local
                OnboardingStep(
                    stepNumber = 1,
                    title = stringResource(Res.string.location_onboarding_step1_title),
                    description = stringResource(Res.string.location_onboarding_step1_desc),
                    icon = Icons.Default.AddLocation,
                    isCompleted = currentStep > 0,
                    isCurrent = currentStep == 0,
                    actionLabel = if (currentStep == 0) stringResource(Res.string.location_onboarding_step1_action) else null,
                    onAction = if (currentStep == 0) onCreateLocation else null
                )

                // Linha conectora
                StepConnector(isCompleted = currentStep > 0)

                // Passo 2: Adicionar quadras
                OnboardingStep(
                    stepNumber = 2,
                    title = stringResource(Res.string.location_onboarding_step2_title),
                    description = stringResource(Res.string.location_onboarding_step2_desc),
                    icon = Icons.Default.SportsSoccer,
                    isCompleted = currentStep > 1,
                    isCurrent = currentStep == 1,
                    actionLabel = if (currentStep == 1) stringResource(Res.string.location_onboarding_step2_action) else null,
                    onAction = if (currentStep == 1) onAddField else null
                )

                // Linha conectora
                StepConnector(isCompleted = currentStep > 1)

                // Passo 3: Definir precos
                OnboardingStep(
                    stepNumber = 3,
                    title = stringResource(Res.string.location_onboarding_step3_title),
                    description = stringResource(Res.string.location_onboarding_step3_desc),
                    icon = Icons.Default.Payments,
                    isCompleted = currentStep > 2,
                    isCurrent = currentStep == 2,
                    actionLabel = if (currentStep == 2) stringResource(Res.string.location_onboarding_step3_action) else null,
                    onAction = if (currentStep == 2) onSetPricing else null
                )
            }
        }

        // Mensagem de incentivo
        if (currentStep == 0) {
            Spacer(modifier = Modifier.height(24.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
                        shape = RoundedCornerShape(12.dp)
                    )
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Lightbulb,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )

                Spacer(modifier = Modifier.width(12.dp))

                Text(
                    text = stringResource(Res.string.location_onboarding_tip),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

/**
 * Componente de passo individual do onboarding
 */
@Composable
private fun OnboardingStep(
    stepNumber: Int,
    title: String,
    description: String,
    icon: ImageVector,
    isCompleted: Boolean,
    isCurrent: Boolean,
    actionLabel: String?,
    onAction: (() -> Unit)?,
    modifier: Modifier = Modifier
) {
    val alpha by animateFloatAsState(
        targetValue = when {
            isCompleted || isCurrent -> 1f
            else -> 0.5f
        },
        label = "step_alpha"
    )

    Row(
        modifier = modifier
            .fillMaxWidth()
            .alpha(alpha),
        verticalAlignment = Alignment.Top
    ) {
        // Indicador de passo (circulo com numero ou checkmark)
        StepIndicator(
            stepNumber = stepNumber,
            isCompleted = isCompleted,
            isCurrent = isCurrent
        )

        Spacer(modifier = Modifier.width(16.dp))

        // Conteudo do passo
        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = when {
                        isCompleted -> MaterialTheme.colorScheme.primary
                        isCurrent -> MaterialTheme.colorScheme.primary
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    modifier = Modifier.size(20.dp)
                )

                Spacer(modifier = Modifier.width(8.dp))

                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.SemiBold,
                    color = when {
                        isCompleted -> MaterialTheme.colorScheme.onSurface
                        isCurrent -> MaterialTheme.colorScheme.primary
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Botao de acao (apenas para passo atual)
            AnimatedVisibility(
                visible = actionLabel != null && onAction != null,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                if (actionLabel != null && onAction != null) {
                    Button(
                        onClick = onAction,
                        modifier = Modifier.padding(top = 12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(actionLabel)
                    }
                }
            }
        }
    }
}

/**
 * Indicador visual do passo (circulo numerado ou checkmark)
 */
@Composable
private fun StepIndicator(
    stepNumber: Int,
    isCompleted: Boolean,
    isCurrent: Boolean,
    modifier: Modifier = Modifier
) {
    val backgroundColor = when {
        isCompleted -> MaterialTheme.colorScheme.primary
        isCurrent -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.surfaceVariant
    }

    val contentColor = when {
        isCompleted -> MaterialTheme.colorScheme.onPrimary
        isCurrent -> MaterialTheme.colorScheme.onPrimary
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Box(
        modifier = modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(backgroundColor),
        contentAlignment = Alignment.Center
    ) {
        if (isCompleted) {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = stringResource(Res.string.location_onboarding_step_completed),
                tint = contentColor,
                modifier = Modifier.size(18.dp)
            )
        } else {
            Text(
                text = stepNumber.toString(),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = contentColor
            )
        }
    }
}

/**
 * Linha conectora entre passos
 */
@Composable
private fun StepConnector(
    isCompleted: Boolean,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .padding(start = 15.dp) // Alinhado com o centro do indicador (32dp / 2 - 1dp)
            .width(2.dp)
            .height(24.dp)
            .background(
                color = if (isCompleted) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.outlineVariant
                },
                shape = RoundedCornerShape(1.dp)
            )
    )
}
