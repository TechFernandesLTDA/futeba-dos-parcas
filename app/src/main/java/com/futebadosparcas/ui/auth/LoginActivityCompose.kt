package com.futebadosparcas.ui.auth

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.GetCredentialException
import androidx.lifecycle.lifecycleScope
import com.futebadosparcas.BuildConfig
import com.futebadosparcas.R
import com.futebadosparcas.ui.main.MainActivityCompose
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.BiometricHelper
import com.futebadosparcas.util.PreferencesManager
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.ktx.auth
import com.google.firebase.ktx.Firebase
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Activity de Login com suporte a Google Sign-In e autenticação biométrica.
 * Modernizada para Jetpack Compose.
 *
 * Fluxo de autenticação:
 * 1. Verifica usuário já logado (onStart)
 * 2. Tenta autenticação biométrica se disponível
 * 3. Permite login com Google Credential Manager
 */
@AndroidEntryPoint
class LoginActivityCompose : AppCompatActivity() {

    private val viewModel: LoginViewModel by viewModels()

    private lateinit var auth: FirebaseAuth
    private lateinit var credentialManager: CredentialManager

    @Inject
    lateinit var preferencesManager: PreferencesManager

    companion object {
        private const val TAG = "LoginActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        auth = Firebase.auth
        credentialManager = CredentialManager.create(this)

        setContent {
            FutebaTheme {
                val uiState by viewModel.loginState.collectAsStateWithLifecycle()

                LoginScreen(
                    uiState = uiState,
                    versionName = BuildConfig.VERSION_NAME,
                    onGoogleSignInClick = { signInWithGoogle() },
                    onNavigateToMain = { navigateToMain() }
                )
            }
        }

        // Tentar autenticação biométrica se disponível
        tryBiometricAuth()
    }

    /**
     * Tenta autenticação biométrica para usuários que já fizeram login antes.
     */
    private fun tryBiometricAuth() {
        val biometricHelper = BiometricHelper(this)

        // Verificar se biometria está disponível E se usuário já fez login antes
        if (biometricHelper.isBiometricAvailable() &&
            preferencesManager.getLastLoginTime() > 0 &&
            auth.currentUser != null) {

            biometricHelper.showBiometricPrompt(
                activity = this,
                title = getString(R.string.toast_welcome_user, ""),
                subtitle = getString(R.string.biometric_subtitle),
                negativeButtonText = getString(R.string.biometric_negative_button),
                onSuccess = {
                    // Autenticação biométrica bem-sucedida
                    preferencesManager.setLastLoginTime()
                    navigateToMain()
                },
                onError = { error ->
                    // Erro na biometria - mostrar botão Google
                    AppLogger.d(TAG) { getString(R.string.login_biometric_failed) + ": $error" }
                },
                onFailed = {
                    // Falha na autenticação - mostrar botão Google
                    AppLogger.d(TAG) { getString(R.string.login_biometric_failed) }
                }
            )
        }
    }

    override fun onStart() {
        super.onStart()
        // Check if user is already signed in
        val currentUser = auth.currentUser
        if (currentUser != null) {
            viewModel.onGoogleSignInSuccess()
        }
    }

    /**
     * Inicia o fluxo de Google Sign-In usando Credential Manager.
     */
    private fun signInWithGoogle() {
        AppLogger.d(TAG) { "=== ${getString(R.string.login_google_signin_started)} ===" }
        AppLogger.d(TAG) { "Web Client ID: ${getString(R.string.default_web_client_id)}" }

        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(getString(R.string.default_web_client_id))
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        lifecycleScope.launch {
            try {
                AppLogger.d(TAG) { getString(R.string.login_showing_progress) }

                AppLogger.d(TAG) { "Requesting credentials from CredentialManager" }
                val result = credentialManager.getCredential(
                    request = request,
                    context = this@LoginActivityCompose
                )
                AppLogger.d(TAG) {
                    getString(R.string.login_credentials_received, result.credential.type)
                }
                handleSignInResult(result)
            } catch (e: GetCredentialException) {
                AppLogger.e(TAG, "Google Sign-In failed: ${e.javaClass.simpleName} - ${e.message}", e)
                showToast(getString(R.string.login_error_google_signin, e.message ?: ""))
                viewModel.onGoogleSignInError(getString(R.string.login_error_google_signin, e.message ?: ""))
            } catch (e: Exception) {
                AppLogger.e(TAG, "Unexpected error during sign-in: ${e.message}", e)
                showToast(getString(R.string.login_error_unexpected, e.message ?: ""))
                viewModel.onGoogleSignInError(getString(R.string.login_error_unexpected, e.message ?: ""))
            }
        }
    }

    /**
     * Processa o resultado do Credential Manager.
     */
    private fun handleSignInResult(result: GetCredentialResponse) {
        AppLogger.d(TAG) { "=== HANDLING SIGN-IN RESULT ===" }
        val credential = result.credential
        AppLogger.d(TAG) { "Credential type: ${credential.javaClass.simpleName}" }

        when (credential) {
            is CustomCredential -> {
                AppLogger.d(TAG) {
                    getString(R.string.login_custom_credential_type, credential.type)
                }
                if (credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                    try {
                        AppLogger.d(TAG) { getString(R.string.login_parsing_token) }
                        val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
                        AppLogger.d(TAG) {
                            getString(R.string.login_google_id, googleIdTokenCredential.id)
                        }
                        AppLogger.d(TAG) {
                            getString(
                                R.string.login_display_name,
                                googleIdTokenCredential.displayName ?: "N/A"
                            )
                        }
                        AppLogger.d(TAG) {
                            getString(R.string.login_email, googleIdTokenCredential.id)
                        }
                        firebaseAuthWithGoogle(googleIdTokenCredential.idToken)
                    } catch (e: GoogleIdTokenParsingException) {
                        AppLogger.e(TAG, "Invalid Google ID token", e)
                        showToast(getString(R.string.login_error_token_google))
                        viewModel.onGoogleSignInError(getString(R.string.login_error_token_google))
                    }
                } else {
                    AppLogger.e(TAG, "Unexpected credential type: ${credential.type}")
                    showToast(getString(R.string.login_error_unsupported_credential))
                    viewModel.onGoogleSignInError(getString(R.string.login_error_unsupported_credential))
                }
            }
            else -> {
                AppLogger.e(TAG, "Not a CustomCredential: ${credential.javaClass.name}")
                showToast(getString(R.string.login_error_invalid_credential))
                viewModel.onGoogleSignInError(getString(R.string.login_error_invalid_credential))
            }
        }
    }

    /**
     * Autentica com Firebase usando o token do Google.
     */
    private fun firebaseAuthWithGoogle(idToken: String) {
        AppLogger.d(TAG) { "=== ${getString(R.string.login_signin_with_credential)} ===" }
        AppLogger.d(TAG) { "Creating Firebase credential with Google ID token" }

        val credential = GoogleAuthProvider.getCredential(idToken, null)

        AppLogger.d(TAG) { "Signing in with Firebase credential" }
        auth.signInWithCredential(credential)
            .addOnCompleteListener(this) { task ->
                AppLogger.d(TAG) { getString(R.string.login_signin_credential_completed) }

                if (task.isSuccessful) {
                    val user = auth.currentUser
                    AppLogger.d(TAG) {
                        getString(R.string.login_signin_success, user?.uid ?: "null")
                    }
                    AppLogger.d(TAG) {
                        getString(R.string.login_user_email, user?.email ?: "N/A")
                    }
                    AppLogger.d(TAG) {
                        getString(
                            R.string.login_user_display_name,
                            user?.displayName ?: "N/A"
                        )
                    }
                    AppLogger.d(TAG) { getString(R.string.login_calling_viewmodel) }
                    viewModel.onGoogleSignInSuccess()
                } else {
                    AppLogger.e(
                        TAG,
                        "${getString(R.string.login_signin_failure)} - ${task.exception?.message}",
                        task.exception
                    )
                    val errorMsg = task.exception?.message
                        ?: getString(R.string.error_authentication)
                    showToast(getString(R.string.login_error_firebase, errorMsg))
                    viewModel.onGoogleSignInError(errorMsg)
                }
            }
    }

    /**
     * Exibe um toast message.
     */
    private fun showToast(message: String) {
        Toast.makeText(this@LoginActivityCompose, message, Toast.LENGTH_LONG).show()
    }

    /**
     * Navega para a tela principal.
     */
    private fun navigateToMain() {
        val intent = Intent(this, MainActivityCompose::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
