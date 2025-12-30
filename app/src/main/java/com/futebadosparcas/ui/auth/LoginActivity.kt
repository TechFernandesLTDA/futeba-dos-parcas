package com.futebadosparcas.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.GetCredentialException
import androidx.lifecycle.lifecycleScope
import com.futebadosparcas.R
import com.futebadosparcas.databinding.ActivityLoginBinding
import com.futebadosparcas.ui.main.MainActivity
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

@AndroidEntryPoint
class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
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
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Initialize Firebase Auth
        auth = Firebase.auth
        credentialManager = CredentialManager.create(this)

        setupViews()
        observeViewModel()
        
        // Tentar autenticação biométrica se disponível
        tryBiometricAuth()
    }
    
    private fun tryBiometricAuth() {
        val biometricHelper = BiometricHelper(this)
        
        // Verificar se biometria está disponível E se usuário já fez login antes
        if (biometricHelper.isBiometricAvailable() && 
            preferencesManager.getLastLoginTime() > 0 &&
            auth.currentUser != null) {
            
            biometricHelper.showBiometricPrompt(
                activity = this,
                title = "Bem-vindo de volta!",
                subtitle = "Use sua digital para entrar",
                negativeButtonText = "Usar Google",
                onSuccess = {
                    // Autenticação biométrica bem-sucedida
                    preferencesManager.setLastLoginTime()
                    navigateToMain()
                },
                onError = { error ->
                    // Erro na biometria - mostrar botão Google
                    AppLogger.d("BiometricAuth") { "Erro: $error" }
                },
                onFailed = {
                    // Falha na autenticação - mostrar botão Google
                    AppLogger.d("BiometricAuth") { "Falha na autenticação" }
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

    private fun setupViews() {
        // Esconder campos de email/senha - usamos apenas Google Sign-In
        binding.tilEmail.visibility = View.GONE
        binding.tilPassword.visibility = View.GONE
        binding.btnLogin.visibility = View.GONE
        binding.registerLayout.visibility = View.GONE

        // Configurar versão dinâmica
        binding.tvVersion.text = "v${com.futebadosparcas.BuildConfig.VERSION_NAME}"

        binding.btnGoogleSignIn.setOnClickListener {
            signInWithGoogle()
        }
    }

    private fun signInWithGoogle() {
        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(getString(R.string.default_web_client_id))
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        lifecycleScope.launch {
            try {
                binding.progressBar.visibility = View.VISIBLE
                binding.btnGoogleSignIn.isEnabled = false

                val result = credentialManager.getCredential(
                    request = request,
                    context = this@LoginActivity
                )
                handleSignInResult(result)
            } catch (e: GetCredentialException) {
                AppLogger.e(TAG, "Google Sign-In failed: ${e.message}", e)
                binding.progressBar.visibility = View.GONE
                binding.btnGoogleSignIn.isEnabled = true
                Toast.makeText(this@LoginActivity, "Erro ao fazer login com Google", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun handleSignInResult(result: GetCredentialResponse) {
        val credential = result.credential

        when (credential) {
            is CustomCredential -> {
                if (credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                    try {
                        val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
                        firebaseAuthWithGoogle(googleIdTokenCredential.idToken)
                    } catch (e: GoogleIdTokenParsingException) {
                        AppLogger.e(TAG, "Invalid Google ID token", e)
                        binding.progressBar.visibility = View.GONE
                        binding.btnGoogleSignIn.isEnabled = true
                    }
                } else {
                    AppLogger.e(TAG, "Unexpected credential type")
                    binding.progressBar.visibility = View.GONE
                    binding.btnGoogleSignIn.isEnabled = true
                }
            }
            else -> {
                AppLogger.e(TAG, "Unexpected credential type")
                binding.progressBar.visibility = View.GONE
                binding.btnGoogleSignIn.isEnabled = true
            }
        }
    }

    private fun firebaseAuthWithGoogle(idToken: String) {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential)
            .addOnCompleteListener(this) { task ->
                binding.progressBar.visibility = View.GONE
                binding.btnGoogleSignIn.isEnabled = true

                if (task.isSuccessful) {
                    AppLogger.d(TAG) { "signInWithCredential:success" }
                    viewModel.onGoogleSignInSuccess()
                } else {
                    AppLogger.e(TAG, "signInWithCredential:failure", task.exception)
                    viewModel.onGoogleSignInError("Erro na autenticacao")
                }
            }
    }

    private fun observeViewModel() {
        lifecycleScope.launch {
            viewModel.loginState.collect { state ->
                when (state) {
                    is LoginState.Idle -> {
                        binding.progressBar.visibility = View.GONE
                        binding.btnGoogleSignIn.isEnabled = true
                    }
                    is LoginState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.btnGoogleSignIn.isEnabled = false
                    }
                    is LoginState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        // Salvar timestamp do login
                        preferencesManager.setLastLoginTime()
                        Toast.makeText(this@LoginActivity, "Bem-vindo, ${state.user.name}!", Toast.LENGTH_SHORT).show()
                        navigateToMain()
                    }
                    is LoginState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        binding.btnGoogleSignIn.isEnabled = true
                        Toast.makeText(this@LoginActivity, state.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
