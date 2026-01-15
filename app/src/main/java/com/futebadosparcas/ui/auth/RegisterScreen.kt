package com.futebadosparcas.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme.colorScheme
import androidx.compose.material3.MaterialTheme.typography
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.res.stringResource
import coil.compose.AsyncImage
import com.futebadosparcas.BuildConfig
import com.futebadosparcas.R

/**
 * Tela de Registro (descontinuada).
 *
 * Nota: O registro agora é feito via Google Sign-In.
 * Esta tela mostra uma mensagem informativa e redireciona para o Login.
 *
 * A Activity é finalizada imediatamente após mostrar a mensagem.
 */
@Composable
fun RegisterScreen(
    versionName: String = BuildConfig.VERSION_NAME,
    onNavigateToLogin: () -> Unit
) {
    // Navegar para o Login imediatamente
    LaunchedEffect(Unit) {
        onNavigateToLogin()
    }

    // Mostrar diálogo informativo durante navegação
    Dialog(
        onDismissRequest = { },
        properties = DialogProperties(
            dismissOnBackPress = false,
            dismissOnClickOutside = false
        )
    ) {
        Surface(
            modifier = Modifier
                .padding(32.dp),
            shape = RoundedCornerShape(16.dp),
            color = colorScheme.surface
        ) {
            Column(
                modifier = Modifier
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                // Logo
                AsyncImage(
                    model = R.mipmap.ic_launcher,
                    contentDescription = null,
                    modifier = Modifier.size(80.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = stringResource(R.string.auth_register_title),
                    style = typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = colorScheme.primary
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = stringResource(R.string.auth_register_message),
                    style = typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = colorScheme.onSurface
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = stringResource(R.string.auth_register_redirect),
                    style = typography.bodySmall,
                    textAlign = TextAlign.Center,
                    color = colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
