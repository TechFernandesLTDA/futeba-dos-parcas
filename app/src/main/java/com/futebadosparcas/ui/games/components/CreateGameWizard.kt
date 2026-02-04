package com.futebadosparcas.ui.games.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.ui.games.CreateGameStep

/**
 * Indicador de progresso do wizard de criacao de jogo.
 * Mostra os passos com numeros e estado (completo/atual/pendente).
 */
@Composable
fun WizardStepIndicator(
    currentStep: CreateGameStep,
    steps: List<CreateGameStep>,
    modifier: Modifier = Modifier,
    onStepClick: (CreateGameStep) -> Unit = {}
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        steps.forEachIndexed { index, step ->
            val isCompleted = step.index < currentStep.index
            val isCurrent = step.index == currentStep.index
            val isPending = step.index > currentStep.index

            StepCircle(
                stepNumber = index + 1,
                isCompleted = isCompleted,
                isCurrent = isCurrent,
                onClick = { onStepClick(step) }
            )

            if (index < steps.lastIndex) {
                StepConnector(
                    isCompleted = step.index < currentStep.index,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun StepCircle(
    stepNumber: Int,
    isCompleted: Boolean,
    isCurrent: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor = when {
        isCompleted -> MaterialTheme.colorScheme.primary
        isCurrent -> MaterialTheme.colorScheme.primaryContainer
        else -> MaterialTheme.colorScheme.surfaceVariant
    }

    val contentColor = when {
        isCompleted -> MaterialTheme.colorScheme.onPrimary
        isCurrent -> MaterialTheme.colorScheme.onPrimaryContainer
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Box(
        modifier = modifier
            .size(36.dp)
            .clip(CircleShape)
            .background(backgroundColor),
        contentAlignment = Alignment.Center
    ) {
        if (isCompleted) {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = null,
                tint = contentColor,
                modifier = Modifier.size(20.dp)
            )
        } else {
            Text(
                text = stepNumber.toString(),
                style = MaterialTheme.typography.labelLarge,
                color = contentColor,
                fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal
            )
        }
    }
}

@Composable
private fun StepConnector(
    isCompleted: Boolean,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .height(2.dp)
            .padding(horizontal = 4.dp)
            .background(
                if (isCompleted) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.surfaceVariant
            )
    )
}

/**
 * Barra de navegacao do wizard com botoes Anterior/Proximo.
 */
@Composable
fun WizardNavigationBar(
    currentStep: CreateGameStep,
    onPreviousClick: () -> Unit,
    onNextClick: () -> Unit,
    onFinishClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLastStep: Boolean = false,
    isFirstStep: Boolean = false,
    canProceed: Boolean = true
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (!isFirstStep) {
            OutlinedButton(
                onClick = onPreviousClick,
                modifier = Modifier.weight(1f)
            ) {
                Text(text = stringResource(R.string.create_game_wizard_previous))
            }
        } else {
            Spacer(modifier = Modifier.weight(1f))
        }

        if (isLastStep) {
            Button(
                onClick = onFinishClick,
                enabled = canProceed,
                modifier = Modifier.weight(1f)
            ) {
                Text(text = stringResource(R.string.create_game_wizard_finish))
            }
        } else {
            Button(
                onClick = onNextClick,
                enabled = canProceed,
                modifier = Modifier.weight(1f)
            ) {
                Text(text = stringResource(R.string.create_game_wizard_next))
            }
        }
    }
}

/**
 * Container animado para conteudo do wizard.
 * Aplica animacao de slide ao mudar de passo.
 */
@Composable
fun WizardContent(
    currentStep: CreateGameStep,
    modifier: Modifier = Modifier,
    content: @Composable (CreateGameStep) -> Unit
) {
    AnimatedContent(
        targetState = currentStep,
        transitionSpec = {
            val direction = if (targetState.index > initialState.index) 1 else -1
            slideInHorizontally { fullWidth -> direction * fullWidth } togetherWith
                    slideOutHorizontally { fullWidth -> -direction * fullWidth }
        },
        label = "WizardStepTransition",
        modifier = modifier
    ) { step ->
        content(step)
    }
}

/**
 * Cabecalho do passo do wizard com titulo e descricao.
 */
@Composable
fun WizardStepHeader(
    title: String,
    modifier: Modifier = Modifier,
    description: String? = null
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface
        )
        if (description != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
