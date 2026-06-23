package com.futebadosparcas.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.splash_app_name
import com.futebadosparcas.compose.resources.splash_logo_content_description
import com.futebadosparcas.compose.resources.splash_platform_ready
import com.futebadosparcas.compose.resources.splash_tagline
import org.jetbrains.compose.resources.stringResource

expect fun getPlatformName(): String

@Composable
fun SplashScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .background(MaterialTheme.colorScheme.primary),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Surface(
                shape = MaterialTheme.shapes.extraLarge,
                color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.12f)
            ) {
                Icon(
                    imageVector = Icons.Default.SportsSoccer,
                    contentDescription = stringResource(Res.string.splash_logo_content_description),
                    modifier = Modifier
                        .padding(20.dp)
                        .size(56.dp),
                    tint = MaterialTheme.colorScheme.onPrimary
                )
            }
            Text(
                text = stringResource(Res.string.splash_app_name),
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimary
            )
            Text(
                text = stringResource(Res.string.splash_tagline),
                fontSize = 16.sp,
                color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f)
            )
            Text(
                text = stringResource(Res.string.splash_platform_ready, getPlatformName()),
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.68f)
            )
        }
    }
}
