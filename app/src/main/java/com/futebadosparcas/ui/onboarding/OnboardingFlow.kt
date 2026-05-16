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
 * 4. Carrossel de boas-vindas - [WelcomeCarousel] (4 slides, spec feat-2026-05-16)
 *
 * Nota: [AppGuideScreen] foi substituído por [WelcomeCarousel] no passo 3.
 * O userId é opcional — quando nulo, o estado não é persistido no Firestore
 * (usuário ainda não autenticado neste ponto do fluxo).
 *
 * @param viewModel ViewModel de onboarding para analytics/persistência (opcional)
 * @param userId UID do usuário autenticado (pode ser null se auth ainda não concluída)
 */
@Composable
fun OnboardingFlow(
    preferencesManager: PreferencesManager,
    onComplete: () -> Unit,
    onProfileSetup: (ProfileSetupData) -> Unit,
    viewModel: OnboardingViewModel? = null,
    userId: String? = null
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
            3 -> {
                // Carrossel de boas-vindas (substitui AppGuideScreen — Fase 1)
                WelcomeCarousel(
                    onComplete = {
                        // Mantém flag local para compatibilidade retroativa
                        preferencesManager.setPermissionOnboardingCompleted(true)
                        // Persiste no Firestore se userId disponível
                        userId?.let { uid ->
                            viewModel?.onCarouselCompleted(uid)
                        }
                        onComplete()
                    },
                    onSlideViewed = { slideIndex, slideId ->
                        viewModel?.onSlideViewed(slideIndex, slideId)
                    },
                    onSkip = { atSlideIndex ->
                        userId?.let { uid ->
                            viewModel?.onCarouselSkipped(uid, atSlideIndex)
                        }
                    }
                )
            }
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
