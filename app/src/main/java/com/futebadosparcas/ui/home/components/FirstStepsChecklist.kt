package com.futebadosparcas.ui.home.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.onboarding.OnboardingStep

/**
 * Card de Primeiros Passos exibido na HomeScreen.
 *
 * Os passos são derivados de dados de domínio existentes — NÃO são checkboxes manuais.
 * Exibe uma barra de progresso e lista de ações com deep-links para cada passo.
 *
 * Acessibilidade: touch targets >= 48dp, contentDescriptions nos ícones.
 *
 * @param steps Mapa de passos com status de conclusão (derivado do domínio)
 * @param visible Controla visibilidade (oculto se todos concluídos ou dispensado)
 * @param onDismiss Callback quando o usuário dispensa o checklist
 * @param onStepClick Callback quando o usuário clica em um passo para navegar
 */
@Composable
fun FirstStepsChecklist(
    steps: Map<OnboardingStep, Boolean>,
    visible: Boolean,
    onDismiss: () -> Unit,
    onStepClick: (OnboardingStep) -> Unit,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(300)) + expandVertically(tween(300)),
        exit = fadeOut(tween(300)) + shrinkVertically(tween(300)),
        modifier = modifier
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                // Cabeçalho com título e botão dispensar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = stringResource(R.string.onboarding_checklist_title),
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        val completedCount = steps.values.count { it }
                        Text(
                            text = "$completedCount/${steps.size}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                        )
                    }
                    TextButton(onClick = onDismiss) {
                        Text(
                            text = stringResource(R.string.onboarding_checklist_dismiss),
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Barra de progresso
                val completedCount = steps.values.count { it }
                val progress = if (steps.isEmpty()) 0f else completedCount.toFloat() / steps.size

                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .semantics {
                            contentDescription = "$completedCount de ${steps.size} passos concluídos"
                        },
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Lista de passos
                steps.entries.forEachIndexed { _, (step, isCompleted) ->
                    ChecklistStepItem(
                        step = step,
                        isCompleted = isCompleted,
                        onClick = { if (!isCompleted) onStepClick(step) }
                    )
                }
            }
        }
    }
}

/**
 * Item individual de um passo do checklist.
 */
@Composable
private fun ChecklistStepItem(
    step: OnboardingStep,
    isCompleted: Boolean,
    onClick: () -> Unit
) {
    val (titleRes, subtitleRes, actionRes) = stepResources(step)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Ícone de status
        val iconDescription = if (isCompleted) "Concluído" else "Pendente"
        Icon(
            imageVector = if (isCompleted) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
            contentDescription = iconDescription,
            tint = if (isCompleted)
                MaterialTheme.colorScheme.primary
            else
                MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.5f),
            modifier = Modifier.size(24.dp)
        )

        Spacer(modifier = Modifier.width(12.dp))

        // Título e subtítulo
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = stringResource(titleRes),
                style = MaterialTheme.typography.bodyMedium,
                color = if (isCompleted)
                    MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.6f)
                else
                    MaterialTheme.colorScheme.onPrimaryContainer
            )
            Text(
                text = stringResource(subtitleRes),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.5f)
            )
        }

        // Ação de navegação (apenas se não concluído)
        if (!isCompleted) {
            Spacer(modifier = Modifier.width(8.dp))
            TextButton(
                onClick = onClick,
                modifier = Modifier.height(48.dp) // touch target mínimo
            ) {
                Text(
                    text = stringResource(actionRes),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

/**
 * Mapeia cada [OnboardingStep] para seus recursos de string.
 */
private fun stepResources(step: OnboardingStep): Triple<Int, Int, Int> = when (step) {
    OnboardingStep.COMPLETE_PROFILE -> Triple(
        R.string.onboarding_step_complete_profile,
        R.string.onboarding_step_complete_profile_subtitle,
        R.string.onboarding_action_go_to_profile
    )
    OnboardingStep.JOIN_OR_CREATE_GROUP -> Triple(
        R.string.onboarding_step_join_group,
        R.string.onboarding_step_join_group_subtitle,
        R.string.onboarding_action_find_group
    )
    OnboardingStep.CONFIRM_PRESENCE -> Triple(
        R.string.onboarding_step_confirm_presence,
        R.string.onboarding_step_confirm_presence_subtitle,
        R.string.onboarding_action_see_games
    )
    OnboardingStep.PLAY_FIRST_GAME -> Triple(
        R.string.onboarding_step_play_game,
        R.string.onboarding_step_play_game_subtitle,
        R.string.onboarding_action_see_games
    )
}
