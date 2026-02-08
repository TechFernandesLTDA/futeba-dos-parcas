package com.futebadosparcas.ui.statistics

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.R
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Tela de resumo semanal no estilo "Spotify Wrapped".
 * Apresenta estatísticas da semana em slides animados e interativos.
 */

// ==================== Models ====================

/**
 * Dados do resumo semanal.
 */
data class WeeklyRecapData(
    val weekNumber: Int,
    val startDate: String,
    val endDate: String,
    val gamesPlayed: Int,
    val totalMinutesPlayed: Int,
    val goals: Int,
    val assists: Int,
    val xpEarned: Int,
    val winRate: Float,
    val streakDays: Int,
    val mvpCount: Int,
    val topPartner: String?,
    val topPartnerGames: Int,
    val favoriteLocation: String?,
    val favoriteLocationGames: Int,
    val rankingChange: Int, // Positivo = subiu, negativo = desceu
    val highlightMoment: String?, // Momento destaque da semana
    val personalBests: List<PersonalBest>,
    val funFacts: List<String>
)

/**
 * Record pessoal batido na semana.
 */
data class PersonalBest(
    val category: String,
    val value: String,
    val previousBest: String
)

// ==================== Cores do Recap ====================

object RecapColors {
    val GradientStart = Color(0xFF667eea)
    val GradientEnd = Color(0xFF764ba2)
    val AccentGold = Color(0xFFFFD700)
    val AccentGreen = Color(0xFF00C853)
    val AccentBlue = Color(0xFF2196F3)
    val AccentPurple = Color(0xFFAB47BC)
}

// ==================== Tela Principal ====================

@Composable
fun WeeklyRecapScreen(
    recapData: WeeklyRecapData,
    onClose: () -> Unit,
    onShare: () -> Unit,
    modifier: Modifier = Modifier
) {
    val totalSlides = 7 // Número de slides
    val pagerState = rememberPagerState(pageCount = { totalSlides })
    val scope = rememberCoroutineScope()

    // Auto-advance timer
    var autoAdvance by remember { mutableStateOf(true) }

    LaunchedEffect(pagerState.currentPage, autoAdvance) {
        if (autoAdvance && pagerState.currentPage < totalSlides - 1) {
            delay(5000) // 5 segundos por slide
            scope.launch {
                pagerState.animateScrollToPage(pagerState.currentPage + 1)
            }
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        RecapColors.GradientStart,
                        RecapColors.GradientEnd
                    )
                )
            )
    ) {
        // Conteúdo principal
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize()
        ) { page ->
            when (page) {
                0 -> IntroSlide(recapData)
                1 -> GamesPlayedSlide(recapData)
                2 -> PerformanceSlide(recapData)
                3 -> SocialSlide(recapData)
                4 -> AchievementsSlide(recapData)
                5 -> FunFactsSlide(recapData)
                6 -> SummarySlide(recapData, onShare)
            }
        }

        // Header com botão fechar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onClose,
                modifier = Modifier
                    .background(Color.White.copy(alpha = 0.2f), CircleShape)
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = stringResource(R.string.cd_close),
                    tint = Color.White
                )
            }

            // Indicador de progresso
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.weight(1f).padding(horizontal = 16.dp)
            ) {
                repeat(totalSlides) { index ->
                    val progress = when {
                        index < pagerState.currentPage -> 1f
                        index == pagerState.currentPage -> {
                            if (autoAdvance) {
                                val animatedProgress by animateFloatAsState(
                                    targetValue = 1f,
                                    animationSpec = tween(5000),
                                    label = "slideProgress"
                                )
                                animatedProgress
                            } else 0.5f
                        }
                        else -> 0f
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(3.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(Color.White.copy(alpha = 0.3f))
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(progress)
                                .height(3.dp)
                                .background(Color.White)
                        )
                    }
                }
            }

            IconButton(
                onClick = onShare,
                modifier = Modifier
                    .background(Color.White.copy(alpha = 0.2f), CircleShape)
            ) {
                Icon(
                    imageVector = Icons.Default.Share,
                    contentDescription = stringResource(R.string.cd_share),
                    tint = Color.White
                )
            }
        }

        // Navegação por toque
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 80.dp, bottom = 100.dp)
        ) {
            // Área esquerda - voltar
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxSize()
                    .clip(RoundedCornerShape(8.dp))
            ) {
                // Tap area
            }
            // Área direita - avançar
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxSize()
            ) {
                // Tap area
            }
        }

        // Botões de navegação (bottom)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .padding(24.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            if (pagerState.currentPage > 0) {
                IconButton(
                    onClick = {
                        autoAdvance = false
                        scope.launch {
                            pagerState.animateScrollToPage(pagerState.currentPage - 1)
                        }
                    },
                    modifier = Modifier
                        .background(Color.White.copy(alpha = 0.2f), CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = stringResource(R.string.cd_previous),
                        tint = Color.White
                    )
                }
            } else {
                Spacer(modifier = Modifier.size(48.dp))
            }

            if (pagerState.currentPage < totalSlides - 1) {
                IconButton(
                    onClick = {
                        autoAdvance = false
                        scope.launch {
                            pagerState.animateScrollToPage(pagerState.currentPage + 1)
                        }
                    },
                    modifier = Modifier
                        .background(Color.White.copy(alpha = 0.2f), CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = stringResource(R.string.cd_next),
                        tint = Color.White
                    )
                }
            } else {
                Spacer(modifier = Modifier.size(48.dp))
            }
        }
    }
}

// ==================== Slides ====================

@Composable
private fun IntroSlide(data: WeeklyRecapData) {
    var visible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(200)
        visible = true
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        AnimatedVisibility(
            visible = visible,
            enter = fadeIn() + slideInVertically { -50 }
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = stringResource(R.string.recap_your_summary),
                    style = MaterialTheme.typography.headlineMedium,
                    color = Color.White.copy(alpha = 0.8f)
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = stringResource(R.string.recap_week_number, data.weekNumber),
                    style = MaterialTheme.typography.displayLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "${data.startDate} - ${data.endDate}",
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color.White.copy(alpha = 0.7f)
                )

                Spacer(modifier = Modifier.height(48.dp))

                Icon(
                    painter = painterResource(id = R.drawable.ic_football),
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(80.dp)
                )

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = stringResource(R.string.recap_lets_see),
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White.copy(alpha = 0.9f)
                )
            }
        }
    }
}

@Composable
private fun GamesPlayedSlide(data: WeeklyRecapData) {
    var animatedGames by remember { mutableIntStateOf(0) }
    var animatedMinutes by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        // Animação de contagem
        repeat(data.gamesPlayed) {
            delay(100)
            animatedGames++
        }
        repeat(data.totalMinutesPlayed / 10) {
            delay(20)
            animatedMinutes += 10
        }
        animatedMinutes = data.totalMinutesPlayed
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = stringResource(R.string.recap_you_played),
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White.copy(alpha = 0.8f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "$animatedGames",
            style = MaterialTheme.typography.displayLarge.copy(
                fontSize = 120.sp
            ),
            fontWeight = FontWeight.Bold,
            color = RecapColors.AccentGold
        )

        Text(
            text = stringResource(if (data.gamesPlayed == 1) R.string.recap_pelada_singular else R.string.recap_pelada_plural),
            style = MaterialTheme.typography.headlineMedium,
            color = Color.White
        )

        Spacer(modifier = Modifier.height(48.dp))

        Card(
            colors = CardDefaults.cardColors(
                containerColor = Color.White.copy(alpha = 0.15f)
            ),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "$animatedMinutes",
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = stringResource(R.string.recap_minutes_on_field),
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color.White.copy(alpha = 0.8f)
                )
            }
        }
    }
}

@Composable
private fun PerformanceSlide(data: WeeklyRecapData) {
    val animatedProgress = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        animatedProgress.animateTo(
            targetValue = data.winRate,
            animationSpec = tween(1500, easing = FastOutSlowInEasing)
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = stringResource(R.string.recap_your_performance),
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White.copy(alpha = 0.8f)
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Estatísticas principais
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            StatBox(
                value = "${data.goals}",
                label = "Gols",
                icon = R.drawable.ic_football
            )
            StatBox(
                value = "${data.assists}",
                label = "Assistências",
                icon = R.drawable.ic_assist
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Win Rate circular
        Box(
            modifier = Modifier.size(180.dp),
            contentAlignment = Alignment.Center
        ) {
            // Background circle
            Box(
                modifier = Modifier
                    .size(180.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.1f))
            )

            // Progress indicator
            androidx.compose.foundation.Canvas(
                modifier = Modifier.size(180.dp)
            ) {
                drawArc(
                    color = RecapColors.AccentGreen,
                    startAngle = -90f,
                    sweepAngle = 360f * animatedProgress.value,
                    useCenter = false,
                    style = androidx.compose.ui.graphics.drawscope.Stroke(
                        width = 12.dp.toPx(),
                        cap = androidx.compose.ui.graphics.StrokeCap.Round
                    )
                )
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "${(animatedProgress.value * 100).toInt()}%",
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = stringResource(R.string.recap_win_rate),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.8f)
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        // XP ganho
        Card(
            colors = CardDefaults.cardColors(
                containerColor = RecapColors.AccentGold.copy(alpha = 0.2f)
            ),
            shape = RoundedCornerShape(16.dp)
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_star),
                    contentDescription = null,
                    tint = RecapColors.AccentGold,
                    modifier = Modifier.size(32.dp)
                )
                Column {
                    Text(
                        text = stringResource(R.string.recap_xp_earned_format, data.xpEarned),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = stringResource(R.string.recap_xp_earned_this_week),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                }
            }
        }
    }
}

@Composable
private fun StatBox(
    value: String,
    label: String,
    icon: Int,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = Color.White.copy(alpha = 0.15f)
        ),
        shape = RoundedCornerShape(16.dp),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                painter = painterResource(id = icon),
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(32.dp)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.8f)
            )
        }
    }
}

@Composable
private fun SocialSlide(data: WeeklyRecapData) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = stringResource(R.string.recap_social_life),
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White.copy(alpha = 0.8f)
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Parceiro mais frequente
        if (data.topPartner != null) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = Color.White.copy(alpha = 0.15f)
                ),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = stringResource(R.string.recap_your_pelada_partner),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.7f)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Avatar placeholder
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(CircleShape)
                            .background(RecapColors.AccentPurple),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = data.topPartner.take(2).uppercase(),
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = data.topPartner,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )

                    Text(
                        text = stringResource(R.string.recap_games_together, data.topPartnerGames),
                        style = MaterialTheme.typography.bodyMedium,
                        color = RecapColors.AccentGold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Local favorito
        if (data.favoriteLocation != null) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = Color.White.copy(alpha = 0.15f)
                ),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_location),
                        contentDescription = null,
                        tint = RecapColors.AccentBlue,
                        modifier = Modifier.size(40.dp)
                    )

                    Spacer(modifier = Modifier.width(16.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stringResource(R.string.recap_favorite_location),
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.7f)
                        )
                        Text(
                            text = data.favoriteLocation,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White
                        )
                    }

                    Text(
                        text = "${data.favoriteLocationGames}x",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = RecapColors.AccentBlue
                    )
                }
            }
        }
    }
}

@Composable
private fun AchievementsSlide(data: WeeklyRecapData) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = stringResource(R.string.recap_achievements),
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White.copy(alpha = 0.8f)
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Streak
        if (data.streakDays > 0) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = Color(0xFFFF6B35).copy(alpha = 0.3f)
                ),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "🔥",
                        style = MaterialTheme.typography.displaySmall
                    )

                    Spacer(modifier = Modifier.width(16.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stringResource(R.string.recap_streak_days, data.streakDays),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = stringResource(R.string.recap_keep_going),
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // MVP count
        if (data.mvpCount > 0) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = RecapColors.AccentGold.copy(alpha = 0.3f)
                ),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "⭐",
                        style = MaterialTheme.typography.displaySmall
                    )

                    Spacer(modifier = Modifier.width(16.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stringResource(R.string.recap_mvp_count, data.mvpCount),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = stringResource(R.string.recap_mvp_star),
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Ranking change
        if (data.rankingChange != 0) {
            val isUp = data.rankingChange > 0
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (isUp) {
                        RecapColors.AccentGreen.copy(alpha = 0.3f)
                    } else {
                        MaterialTheme.colorScheme.error.copy(alpha = 0.3f)
                    }
                ),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isUp) "📈" else "📉",
                        style = MaterialTheme.typography.displaySmall
                    )

                    Spacer(modifier = Modifier.width(16.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = if (isUp) {
                                stringResource(R.string.recap_ranked_up, data.rankingChange)
                            } else {
                                stringResource(R.string.recap_ranked_down, -data.rankingChange)
                            },
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = stringResource(R.string.recap_in_group_ranking),
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                }
            }
        }

        // Personal bests
        if (data.personalBests.isNotEmpty()) {
            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Recordes Pessoais Batidos 🏆",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )

            Spacer(modifier = Modifier.height(12.dp))

            data.personalBests.forEach { best ->
                Text(
                    text = "${best.category}: ${best.value} (antes: ${best.previousBest})",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.9f)
                )
            }
        }
    }
}

@Composable
private fun FunFactsSlide(data: WeeklyRecapData) {
    var currentFact by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(3000)
            if (data.funFacts.isNotEmpty()) {
                currentFact = (currentFact + 1) % data.funFacts.size
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = stringResource(R.string.recap_curiosities),
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White.copy(alpha = 0.8f)
        )

        Spacer(modifier = Modifier.height(48.dp))

        if (data.funFacts.isNotEmpty()) {
            AnimatedContent(
                targetState = currentFact,
                transitionSpec = {
                    (fadeIn() + slideInVertically { it }) togetherWith
                            (fadeOut() + slideOutVertically { -it })
                },
                label = "funFact"
            ) { index ->
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = Color.White.copy(alpha = 0.15f)
                    ),
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "💡",
                            style = MaterialTheme.typography.displayMedium
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = data.funFacts[index],
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Medium,
                            color = Color.White,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Indicadores
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                data.funFacts.indices.forEach { index ->
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(
                                if (index == currentFact) Color.White
                                else Color.White.copy(alpha = 0.3f)
                            )
                    )
                }
            }
        }
    }
}

@Composable
private fun SummarySlide(
    data: WeeklyRecapData,
    onShare: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "É isso! 🎉",
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = stringResource(R.string.recap_week_was_great, data.weekNumber),
            style = MaterialTheme.typography.titleLarge,
            color = Color.White.copy(alpha = 0.9f)
        )

        Spacer(modifier = Modifier.height(48.dp))

        // Resumo rápido
        Card(
            colors = CardDefaults.cardColors(
                containerColor = Color.White.copy(alpha = 0.15f)
            ),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                SummaryRow("Jogos", "${data.gamesPlayed}")
                SummaryRow("Gols", "${data.goals}")
                SummaryRow("Assistências", "${data.assists}")
                SummaryRow("XP Ganho", "+${data.xpEarned}")
                SummaryRow(stringResource(R.string.recap_win_rate), "${(data.winRate * 100).toInt()}%")
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Botão compartilhar
        Button(
            onClick = onShare,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.White,
                contentColor = RecapColors.GradientStart
            ),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Share,
                contentDescription = null,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = stringResource(R.string.recap_share_summary),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Nos vemos na próxima pelada! ⚽",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            color = Color.White.copy(alpha = 0.8f)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
    }
}

// ==================== Preview Data ====================

/**
 * Cria dados de exemplo para preview.
 */
fun createSampleWeeklyRecapData() = WeeklyRecapData(
    weekNumber = 45,
    startDate = "04/11",
    endDate = "10/11",
    gamesPlayed = 4,
    totalMinutesPlayed = 240,
    goals = 7,
    assists = 3,
    xpEarned = 450,
    winRate = 0.75f,
    streakDays = 5,
    mvpCount = 2,
    topPartner = "João Silva",
    topPartnerGames = 3,
    favoriteLocation = "Arena Society",
    favoriteLocationGames = 2,
    rankingChange = 3,
    highlightMoment = "Hat-trick contra o Time B!",
    personalBests = listOf(
        PersonalBest("Gols em uma partida", "4", "3"),
        PersonalBest("Win rate semanal", "75%", "60%")
    ),
    funFacts = listOf(
        "Você correu aproximadamente 12km esta semana",
        "Seu melhor horário é às 20h - 80% de vitórias",
        "Você marcou mais gols de pé esquerdo (4) do que de direito (3)"
    )
)
