package com.futebadosparcas.ui.auth

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme.colorScheme
import androidx.compose.material3.MaterialTheme.typography
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.futebadosparcas.BuildConfig
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.User

/**
 * Tela de login em Jetpack Compose.
 *
 * Segue Material Design 3 e o design system do app.
 */
@Composable
fun LoginScreen(
    uiState: LoginState,
    versionName: String = BuildConfig.VERSION_NAME,
    onGoogleSignInClick: () -> Unit,
    onNavigateToMain: () -> Unit
) {
    val context = LocalContext.current

    // Navegar automaticamente quando login for bem-sucedido
    LaunchedEffect(uiState) {
        if (uiState is LoginState.Success) {
            onNavigateToMain()
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Logo/Ícone do App
            AppLogo()

            Spacer(modifier = Modifier.height(24.dp))

            // Nome do Aplicativo
            Text(
                text = stringResource(R.string.activity_login_text_2),
                style = typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = colorScheme.primary
                )
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Slogan
            Text(
                text = stringResource(R.string.activity_login_text_3),
                style = typography.bodyMedium,
                color = colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(48.dp))

            // Subtítulo de Login
            Text(
                text = stringResource(R.string.activity_login_text_4),
                style = typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Botão Google Sign-In
            if (uiState !is LoginState.Loading) {
                GoogleSignInButton(
                    onClick = onGoogleSignInClick
                )
            } else {
                CircularProgressIndicator()
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Mensagem de erro (se houver)
            if (uiState is LoginState.Error) {
                Text(
                    text = uiState.message,
                    style = typography.bodySmall,
                    color = colorScheme.error,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 32.dp)
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            // Footer com informações de desenvolvedor e versão
            LoginFooter(versionName)
        }
    }
}

@Composable
private fun AppLogo() {
    AsyncImage(
        model = R.mipmap.ic_launcher,
        contentDescription = stringResource(R.string.activity_login_contentdescription_1),
        modifier = Modifier.size(120.dp),
        contentScale = ContentScale.Fit
    )
}

@Composable
private fun GoogleSignInButton(
    onClick: () -> Unit
) {
    OutlinedButton(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(60.dp),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = colorScheme.onSurface
        ),
        border = BorderStroke(2.dp, colorScheme.outline)
    ) {
        Icon(
            painter = painterResource(R.drawable.ic_google),
            contentDescription = null,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.weight(1f))
        Text(
            text = stringResource(R.string.login_with_google),
            style = typography.bodyLarge
        )
        Spacer(modifier = Modifier.weight(1f))
    }
}

@Composable
private fun LoginFooter(versionName: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = stringResource(R.string.activity_login_text_7),
            style = typography.bodySmall,
            color = colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
        )

        Text(
            text = stringResource(R.string.activity_login_text_8),
            style = typography.bodyMedium,
            fontWeight = FontWeight.Bold,
            color = colorScheme.primary
        )

        Text(
            text = stringResource(R.string.version, versionName),
            style = typography.bodySmall,
            color = colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
        )
    }
}
