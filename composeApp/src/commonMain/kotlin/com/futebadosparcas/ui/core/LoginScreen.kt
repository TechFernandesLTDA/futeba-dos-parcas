package com.futebadosparcas.ui.core

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.SportsSoccer
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.auth_authenticating
import com.futebadosparcas.compose.resources.auth_back_to_google
import com.futebadosparcas.compose.resources.auth_developed_by
import com.futebadosparcas.compose.resources.auth_developer_team
import com.futebadosparcas.compose.resources.auth_forgot_password
import com.futebadosparcas.compose.resources.auth_hide_password
import com.futebadosparcas.compose.resources.auth_login_tagline
import com.futebadosparcas.compose.resources.auth_logo_description
import com.futebadosparcas.compose.resources.auth_no_account_register
import com.futebadosparcas.compose.resources.auth_show_password
import com.futebadosparcas.compose.resources.auth_sign_in_description
import com.futebadosparcas.compose.resources.auth_sign_in_email
import com.futebadosparcas.compose.resources.auth_sign_in_google
import com.futebadosparcas.compose.resources.auth_sign_in_title
import com.futebadosparcas.compose.resources.auth_title
import com.futebadosparcas.compose.resources.auth_version_lower
import com.futebadosparcas.compose.resources.email
import com.futebadosparcas.compose.resources.password
import org.jetbrains.compose.resources.stringResource

/**
 * Tela de Login portada para KMP.
 * @param uiState estado atual do fluxo de login
 * @param versionName nome da versão exibida no rodapé
 * @param onGoogleSignInClick callback para início do login com Google
 * @param onEmailPasswordSignIn callback para login com email/senha (não funcional nesta versão)
 * @param onForgotPassword callback para esqueci minha senha
 * @param onNavigateToRegister navega para tela de cadastro
 * @param onNavigateToMain navega para tela principal após sucesso
 */
@Composable
fun LoginScreen(
    uiState: LoginState,
    versionName: String,
    onGoogleSignInClick: () -> Unit,
    onEmailPasswordSignIn: (email: String, password: String) -> Unit,
    onForgotPassword: (email: String) -> Unit,
    onNavigateToRegister: () -> Unit,
    onNavigateToMain: () -> Unit
) {
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
        // Background com gradiente suave
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.surface,
                            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
                        ),
                        start = Offset(0f, 0f),
                        end = Offset(1000f, 1000f)
                    )
                )
        ) {
            BoxWithConstraints(
                modifier = Modifier
                    .fillMaxSize()
                    .systemBarsPadding()
            ) {
                val compactWidth = maxWidth < 420.dp
                val horizontalPadding = if (compactWidth) 16.dp else 24.dp
                val titlePadding = if (compactWidth) 16.dp else 32.dp
                val contentSpacing = if (compactWidth) 20.dp else 24.dp

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = horizontalPadding, vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(contentSpacing)
                ) {
                    Spacer(modifier = Modifier.height(if (compactWidth) 8.dp else 24.dp))

                    Column(
                        modifier = Modifier.widthIn(max = 560.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        AppLogo()

                        Spacer(modifier = Modifier.height(if (compactWidth) 24.dp else 32.dp))

                        Text(
                            text = stringResource(Res.string.auth_title),
                            style = MaterialTheme.typography.displaySmall.copy(
                                fontWeight = FontWeight.Bold
                            ),
                            color = MaterialTheme.colorScheme.primary,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.semantics { heading() }
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Text(
                            text = stringResource(Res.string.auth_login_tagline),
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = titlePadding)
                        )
                    }

                    LoginCard(
                        uiState = uiState,
                        contentPadding = if (compactWidth) 20.dp else 32.dp,
                        onGoogleSignInClick = onGoogleSignInClick,
                        onEmailPasswordSignIn = onEmailPasswordSignIn,
                        onForgotPassword = onForgotPassword,
                        onNavigateToRegister = onNavigateToRegister
                    )

                    LoginFooter(versionName = versionName)

                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}

@Composable
private fun AppLogo() {
    Card(
        modifier = Modifier.size(140.dp),
        shape = RoundedCornerShape(28.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Filled.SportsSoccer,
                contentDescription = stringResource(Res.string.auth_logo_description),
                modifier = Modifier.size(80.dp),
                tint = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }
    }
}

@Composable
private fun LoginCard(
    uiState: LoginState,
    contentPadding: androidx.compose.ui.unit.Dp,
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
        modifier = Modifier
            .fillMaxWidth()
            .widthIn(max = 560.dp),
        shape = RoundedCornerShape(24.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(contentPadding),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = stringResource(Res.string.auth_sign_in_title),
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontWeight = FontWeight.Bold
                ),
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center
            )

            Text(
                text = stringResource(Res.string.auth_sign_in_description),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(4.dp))

            if (!showEmailForm) {
                AnimatedVisibility(
                    visible = uiState !is LoginState.Loading,
                    enter = fadeIn() + scaleIn(),
                    exit = fadeOut() + scaleOut()
                ) {
                    GoogleSignInButton(onClick = onGoogleSignInClick)
                }

                TextButton(onClick = { showEmailForm = true }) {
                    Text(stringResource(Res.string.auth_sign_in_email))
                }
            } else {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(Res.string.email)) },
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
                    label = { Text(stringResource(Res.string.password)) },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = if (passwordVisible) {
                                    stringResource(Res.string.auth_hide_password)
                                } else {
                                    stringResource(Res.string.auth_show_password)
                                }
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
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    enabled = email.isNotBlank() && password.isNotBlank() && uiState !is LoginState.Loading
                ) {
                    Text(stringResource(Res.string.auth_sign_in_title))
                }

                TextButton(
                    onClick = {
                        if (email.isNotBlank()) onForgotPassword(email)
                    },
                    enabled = email.isNotBlank()
                ) {
                    Text(stringResource(Res.string.auth_forgot_password))
                }

                TextButton(onClick = { showEmailForm = false }) {
                    Text(stringResource(Res.string.auth_back_to_google))
                }
            }

            TextButton(onClick = onNavigateToRegister) {
                Text(stringResource(Res.string.auth_no_account_register))
            }

            AnimatedVisibility(
                visible = uiState is LoginState.Loading,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(48.dp),
                        color = MaterialTheme.colorScheme.primary,
                        strokeWidth = 4.dp
                    )
                    Text(
                        text = stringResource(Res.string.auth_authenticating),
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
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Text(
                        text = (uiState as? LoginState.Error)?.message ?: "",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun GoogleSignInButton(onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface
        ),
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = 2.dp,
            pressedElevation = 6.dp
        )
    ) {
        // Substituição do ícone do Google por um ícone genérico
        Icon(
            imageVector = Icons.Default.AccountCircle,
            contentDescription = null,
            modifier = Modifier.size(24.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.size(12.dp))
        Text(
            text = stringResource(Res.string.auth_sign_in_google),
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
            text = stringResource(Res.string.auth_developed_by),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
            textAlign = TextAlign.Center
        )

        Text(
            text = stringResource(Res.string.auth_developer_team),
            style = MaterialTheme.typography.titleSmall.copy(
                fontWeight = FontWeight.Bold
            ),
            color = MaterialTheme.colorScheme.primary,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = stringResource(Res.string.auth_version_lower, versionName),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
            textAlign = TextAlign.Center
        )
    }
}
