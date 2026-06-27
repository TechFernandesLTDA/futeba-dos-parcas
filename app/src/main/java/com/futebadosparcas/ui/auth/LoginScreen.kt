package com.futebadosparcas.ui.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.futebadosparcas.BuildConfig
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.ui.theme.AppDimensions
import com.futebadosparcas.ui.theme.surfaceGradient
@Composable
fun LoginScreen(
    uiState: LoginState,
    versionName: String = BuildConfig.VERSION_NAME,
    onGoogleSignInClick: () -> Unit,
    onEmailPasswordSignIn: (email: String, password: String) -> Unit,
    onForgotPassword: (email: String) -> Unit,
    onNavigateToRegister: () -> Unit,
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
        color = MaterialTheme.colorScheme.background
    ) {
        // Background com gradiente sutil
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(surfaceGradient())
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .systemBarsPadding()
                    .padding(AppDimensions.spacing_extraLarge),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                // Top Section: Logo e Título
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Spacer(modifier = Modifier.height(AppDimensions.spacing_massive))

                    // Logo do App (maior e mais proeminente)
                    AppLogo()

                    Spacer(modifier = Modifier.height(AppDimensions.spacing_huge))

                    // Nome do Aplicativo
                    Text(
                        text = stringResource(R.string.auth_title),
                        style = MaterialTheme.typography.displaySmall.copy(
                            fontWeight = FontWeight.Bold
                        ),
                        color = MaterialTheme.colorScheme.primary,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(AppDimensions.spacing_medium))

                    // Slogan
                    Text(
                        text = stringResource(R.string.auth_slogan),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = AppDimensions.spacing_huge)
                    )

                    Spacer(modifier = Modifier.height(AppDimensions.spacing_extraLarge))
                }

                // Middle Section: Login Card
                LoginCard(
                    uiState = uiState,
                    onGoogleSignInClick = onGoogleSignInClick,
                    onEmailPasswordSignIn = onEmailPasswordSignIn,
                    onForgotPassword = onForgotPassword,
                    onNavigateToRegister = onNavigateToRegister
                )

                Spacer(modifier = Modifier.height(AppDimensions.spacing_extraLarge))

                // Bottom Section: Footer
                LoginFooter(versionName = versionName)

                Spacer(modifier = Modifier.height(AppDimensions.spacing_medium))
            }
        }
    }
}

@Composable
private fun AppLogo() {
    Card(
        modifier = Modifier.size(140.dp),
        shape = RoundedCornerShape(AppDimensions.radius_full),
        elevation = CardDefaults.cardElevation(defaultElevation = AppDimensions.elevation_large),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            AsyncImage(
                model = R.mipmap.ic_launcher,
                contentDescription = stringResource(R.string.auth_logo_description),
                modifier = Modifier
                    .size(100.dp)
                    .clip(RoundedCornerShape(AppDimensions.radius_extraLarge)),
                contentScale = ContentScale.Fit
            )
        }
    }
}

@Composable
private fun LoginCard(
    uiState: LoginState,
    onGoogleSignInClick: () -> Unit,
    onEmailPasswordSignIn: (email: String, password: String) -> Unit,
    onForgotPassword: (email: String) -> Unit,
    onNavigateToRegister: () -> Unit
) {
    var showEmailForm by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = AppDimensions.elevation_medium),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(AppDimensions.spacing_huge),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(AppDimensions.spacing_medium)
        ) {
            Text(
                text = stringResource(R.string.auth_sign_in_title),
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontWeight = FontWeight.Bold
                ),
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center
            )

            Text(
                text = stringResource(R.string.auth_sign_in_description),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_extraSmall))

            if (!showEmailForm) {
                AnimatedVisibility(
                    visible = uiState !is LoginState.Loading,
                    enter = fadeIn() + scaleIn(),
                    exit = fadeOut() + scaleOut()
                ) {
                    GoogleSignInButton(onClick = onGoogleSignInClick)
                }

                TextButton(onClick = { showEmailForm = true }) {
                    Text(stringResource(R.string.auth_sign_in_with_email))
                }
            } else {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.auth_email_label)) },
                    leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next
                    ),
                    singleLine = true,
                    shape = MaterialTheme.shapes.medium
                )

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.auth_password_label)) },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = if (passwordVisible) stringResource(R.string.auth_password_hide) else stringResource(R.string.auth_password_show)
                            )
                        }
                    },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
                    singleLine = true,
                    shape = MaterialTheme.shapes.medium
                )

                Button(
                    onClick = { onEmailPasswordSignIn(email, password) },
                    modifier = Modifier.fillMaxWidth().height(AppDimensions.height_button_large),
                    shape = RoundedCornerShape(AppDimensions.radius_medium),
                    enabled = email.isNotBlank() && password.isNotBlank() && uiState !is LoginState.Loading
                ) {
                    Text(stringResource(R.string.auth_sign_in_title))
                }

                TextButton(
                    onClick = {
                        if (email.isNotBlank()) onForgotPassword(email)
                    },
                    enabled = email.isNotBlank()
                ) {
                    Text(stringResource(R.string.auth_forgot_password))
                }

                TextButton(onClick = { showEmailForm = false }) {
                    Text(stringResource(R.string.auth_back_to_google))
                }
            }

            TextButton(onClick = onNavigateToRegister) {
                Text(stringResource(R.string.auth_no_account_register))
            }

            AnimatedVisibility(
                visible = uiState is LoginState.Loading,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(AppDimensions.spacing_medium)
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(AppDimensions.icon_extraLarge),
                        color = MaterialTheme.colorScheme.primary,
                        strokeWidth = 4.dp
                    )
                    Text(
                        text = stringResource(R.string.auth_authenticating),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            AnimatedVisibility(
                visible = uiState is LoginState.Error,
                enter = fadeIn() + scaleIn(),
                exit = fadeOut() + scaleOut()
            ) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(AppDimensions.radius_medium),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Text(
                        text = (uiState as? LoginState.Error)?.message ?: "",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(AppDimensions.spacing_medium)
                    )
                }
            }
        }
    }
}

@Composable
private fun GoogleSignInButton(
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(AppDimensions.height_input),
        shape = RoundedCornerShape(AppDimensions.radius_large),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface
        ),
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = 2.dp,
            pressedElevation = 6.dp
        )
    ) {
        Icon(
            painter = painterResource(R.drawable.ic_google),
            contentDescription = null,
            modifier = Modifier.size(AppDimensions.icon_medium),
            tint = Color.Unspecified // Mantém as cores originais do ícone do Google
        )
        Spacer(modifier = Modifier.size(AppDimensions.spacing_medium))
        Text(
            text = stringResource(R.string.auth_sign_in_google),
            style = MaterialTheme.typography.titleMedium.copy(
                fontWeight = FontWeight.SemiBold
            )
        )
    }
}

@Composable
private fun LoginFooter(versionName: String) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = stringResource(R.string.auth_developed_by),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
            textAlign = TextAlign.Center
        )

        Text(
            text = stringResource(R.string.auth_developer_name),
            style = MaterialTheme.typography.titleSmall.copy(
                fontWeight = FontWeight.Bold
            ),
            color = MaterialTheme.colorScheme.primary,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(AppDimensions.spacing_extraSmall))

        Text(
            text = stringResource(R.string.auth_version, versionName),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
            textAlign = TextAlign.Center
        )
    }
}
