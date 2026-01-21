package com.futebadosparcas.ui.onboarding

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.futebadosparcas.util.PreferencesManager

/**
 * Fluxo completo de onboarding para novos usuários.
 *
 * Etapas:
 * 1. Boas-vindas - Apresentação do app
 * 2. Permissões - Solicita permissões do sistema
 * 3. Configuração de Perfil - Coleta informações básicas
 * 4. Guia do App - Orientação sobre funcionalidades
 */
@Composable
fun OnboardingFlow(
    preferencesManager: PreferencesManager,
    onComplete: () -> Unit,
    onProfileSetup: (ProfileSetupData) -> Unit
) {
    var currentStep by remember { mutableIntStateOf(0) }

    AnimatedContent(
        targetState = currentStep,
        transitionSpec = {
            if (targetState > initialState) {
                // Avançando
                (slideInHorizontally { width -> width } + fadeIn())
                    .togetherWith(slideOutHorizontally { width -> -width } + fadeOut())
            } else {
                // Voltando
                (slideInHorizontally { width -> -width } + fadeIn())
                    .togetherWith(slideOutHorizontally { width -> width } + fadeOut())
            }
        },
        label = "onboarding_animation"
    ) { step ->
        when (step) {
            0 -> WelcomeScreen(
                onContinue = { currentStep = 1 }
            )
            1 -> PermissionOnboardingScreen(
                onComplete = { currentStep = 2 }
            )
            2 -> ProfileSetupScreen(
                onContinue = { profileData ->
                    onProfileSetup(profileData)
                    currentStep = 3
                },
                onSkip = { currentStep = 3 }
            )
            3 -> AppGuideScreen(
                onComplete = {
                    preferencesManager.setPermissionOnboardingCompleted(true)
                    onComplete()
                }
            )
        }
    }
}

/**
 * Dados coletados na configuração de perfil
 */
data class ProfileSetupData(
    val name: String,
    val nickname: String?,
    val preferredPosition: String?,
    val preferredFieldTypes: List<String>
)
