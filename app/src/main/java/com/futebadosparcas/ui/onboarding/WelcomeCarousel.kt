package com.futebadosparcas.ui.onboarding

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import kotlinx.coroutines.launch

/**
 * Dados de um slide do carrossel de onboarding.
 */
data class CarouselSlide(
    val id: String,
    val titleRes: Int,
    val subtitleRes: Int,
    /** Emoji ou ícone representativo (fase 1: emoji; fase 2: Lottie animation). */
    val emoji: String
)

/** Slides do carrossel — 4 slides conforme spec §2.2. */
private val CAROUSEL_SLIDES = listOf(
    CarouselSlide(
        id = "organized",
        titleRes = R.string.onboarding_slide1_title,
        subtitleRes = R.string.onboarding_slide1_subtitle,
        emoji = "⚽"
    ),
    CarouselSlide(
        id = "xp",
        titleRes = R.string.onboarding_slide2_title,
        subtitleRes = R.string.onboarding_slide2_subtitle,
        emoji = "🏆"
    ),
    CarouselSlide(
        id = "invite",
        titleRes = R.string.onboarding_slide3_title,
        subtitleRes = R.string.onboarding_slide3_subtitle,
        emoji = "👥"
    ),
    CarouselSlide(
        id = "start",
        titleRes = R.string.onboarding_slide4_title,
        subtitleRes = R.string.onboarding_slide4_subtitle,
        emoji = "🚀"
    )
)

/**
 * Carrossel de boas-vindas do onboarding.
 *
 * Substitui [AppGuideScreen] como passo 3 do [OnboardingFlow].
 * HorizontalPager com 4 slides, dots indicadores, botão "Pular" e CTA final.
 *
 * Acessibilidade:
 * - Touch targets >= 48dp
 * - contentDescription nos indicadores de dots
 * - "Pular" sempre visível (exceto no último slide)
 *
 * @param onComplete Chamado quando o usuário clica em "Bora jogar!" (slide final) ou pula
 * @param onSlideViewed Callback para analytics: (slideIndex, slideId)
 * @param onSkip Callback quando o usuário pula: (atSlideIndex)
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun WelcomeCarousel(
    onComplete: () -> Unit,
    onSlideViewed: (slideIndex: Int, slideId: String) -> Unit = { _, _ -> },
    onSkip: (atSlideIndex: Int) -> Unit = {}
) {
    val slides = remember { CAROUSEL_SLIDES }
    val pagerState = rememberPagerState(pageCount = { slides.size })
    val scope = rememberCoroutineScope()
    val isLastSlide = pagerState.currentPage == slides.lastIndex

    // Notifica analytics quando o slide muda
    LaunchedEffect(pagerState) {
        snapshotFlow { pagerState.currentPage }.collect { page ->
            val slide = slides[page]
            onSlideViewed(page, slide.id)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        // Botão "Pular" no canto superior direito
        AnimatedVisibility(
            visible = !isLastSlide,
            enter = fadeIn(tween(200)),
            exit = fadeOut(tween(200)),
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(16.dp)
        ) {
            TextButton(
                onClick = {
                    val currentSlide = pagerState.currentPage
                    onSkip(currentSlide)
                    onComplete()
                }
            ) {
                Text(
                    text = stringResource(R.string.onboarding_skip),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Conteúdo principal (pager)
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.weight(0.1f))

            HorizontalPager(
                state = pagerState,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) { page ->
                CarouselSlideContent(slide = slides[page])
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Dots indicadores
            val dotsDescription = stringResource(
                R.string.onboarding_slide_indicator_cd,
                pagerState.currentPage + 1,
                slides.size
            )
            Row(
                modifier = Modifier
                    .semantics { contentDescription = dotsDescription }
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                slides.forEachIndexed { index, _ ->
                    val isActive = index == pagerState.currentPage
                    Box(
                        modifier = Modifier
                            .size(if (isActive) 10.dp else 7.dp)
                            .clip(CircleShape)
                            .background(
                                if (isActive) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.outlineVariant
                            )
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            // CTA: "Próximo" ou "Bora jogar!" no último slide
            if (isLastSlide) {
                Button(
                    onClick = onComplete,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 32.dp)
                        .height(56.dp)
                ) {
                    Text(
                        text = stringResource(R.string.onboarding_start),
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            } else {
                OutlinedButton(
                    onClick = {
                        scope.launch {
                            pagerState.animateScrollToPage(pagerState.currentPage + 1)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 32.dp)
                        .height(56.dp)
                ) {
                    Text(
                        text = stringResource(R.string.onboarding_next),
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

/**
 * Conteúdo de um único slide do carrossel.
 */
@Composable
private fun CarouselSlideContent(slide: CarouselSlide) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Fase 1: emoji placeholder (Fase 2: substituir por Lottie animation)
        Text(
            text = slide.emoji,
            style = MaterialTheme.typography.displayLarge,
            modifier = Modifier.padding(bottom = 32.dp)
        )

        Text(
            text = stringResource(slide.titleRes),
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = stringResource(slide.subtitleRes),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )
    }
}
