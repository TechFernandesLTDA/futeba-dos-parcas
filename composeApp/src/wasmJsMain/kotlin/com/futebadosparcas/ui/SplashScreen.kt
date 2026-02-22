package com.futebadosparcas.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(
    isAuthenticated: Boolean?,
    onNavigate: (isAuthenticated: Boolean) -> Unit
) {
    var logoScale by remember { mutableFloatStateOf(0.3f) }
    var logoAlpha by remember { mutableFloatStateOf(0f) }
    var textAlpha by remember { mutableFloatStateOf(0f) }
    var taglineAlpha by remember { mutableFloatStateOf(0f) }
    var loadingAlpha by remember { mutableFloatStateOf(0f) }
    var hasNavigated by remember { mutableStateOf(false) }

    val isDark = isSystemInDarkTheme()

    LaunchedEffect(Unit) {
        logoScale = 1f
        logoAlpha = 1f
        delay(300)
        textAlpha = 1f
        delay(200)
        taglineAlpha = 1f
        delay(200)
        loadingAlpha = 1f

        delay(2000)

        if (isAuthenticated != null && !hasNavigated) {
            hasNavigated = true
            onNavigate(isAuthenticated)
        }
    }

    LaunchedEffect(isAuthenticated) {
        if (isAuthenticated != null && !hasNavigated) {
            delay(500)
            hasNavigated = true
            onNavigate(isAuthenticated)
        }
    }

    val gradientColors = if (isDark) {
        listOf(
            Color(0xFF1A237E),
            Color(0xFF0D47A1),
            Color(0xFF01579B)
        )
    } else {
        listOf(
            Color(0xFF1976D2),
            Color(0xFF2196F3),
            Color(0xFF03A9F4)
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = gradientColors,
                    startY = 0f,
                    endY = Float.POSITIVE_INFINITY
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .scale(logoScale)
                    .alpha(logoAlpha)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "⚽",
                    fontSize = 64.sp
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Futeba dos Parças",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                modifier = Modifier.alpha(textAlpha)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Organize suas peladas!",
                style = MaterialTheme.typography.bodyLarge,
                color = Color.White.copy(alpha = 0.9f),
                modifier = Modifier.alpha(taglineAlpha)
            )

            Spacer(modifier = Modifier.height(48.dp))

            androidx.compose.animation.AnimatedVisibility(
                visible = loadingAlpha > 0.5f,
                enter = androidx.compose.animation.fadeIn(
                    animationSpec = tween(durationMillis = 300)
                )
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                    Text(
                        text = "Carregando...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                }
            }
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 32.dp)
                .alpha(loadingAlpha),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Versão Web 1.0",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.6f)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Tech Fernandes LTDA",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.5f)
            )
        }
    }
}
