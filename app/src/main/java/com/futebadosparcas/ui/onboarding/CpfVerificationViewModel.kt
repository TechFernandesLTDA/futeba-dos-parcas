package com.futebadosparcas.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.functions.FirebaseFunctions
import com.futebadosparcas.domain.util.CpfValidator
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * ViewModel para verificacao de CPF.
 *
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md (R3, R6, Fase 3 #446)
 *
 * Fluxo:
 * 1. Valida CPF client-side (CpfValidator KMP shared)
 * 2. Chama Cloud Function verifyCpf (duplicate check + users_private)
 * 3. Chama Cloud Function setUserVerified (custom claim verified=true)
 * 4. Force token refresh para refletir custom claim
 */
class CpfVerificationViewModel(
    private val functions: FirebaseFunctions,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _uiState = MutableStateFlow<CpfVerificationUiState>(
        CpfVerificationUiState.Idle,
    )
    val uiState: StateFlow<CpfVerificationUiState> = _uiState.asStateFlow()

    private var pendingJob: Job? = null

    /**
     * Submete CPF para verificacao server-side.
     */
    fun verifyCpf(cpf: String) {
        if (!CpfValidator.isValid(cpf)) {
            _uiState.value = CpfVerificationUiState.Error(
                "CPF invalido. Confira os digitos.",
            )
            return
        }
        val user = auth.currentUser
        if (user == null) {
            _uiState.value = CpfVerificationUiState.Error(
                "Sessao expirou. Faca login novamente.",
            )
            return
        }

        pendingJob?.cancel()
        pendingJob = viewModelScope.launch {
            _uiState.value = CpfVerificationUiState.Verifying
            try {
                // Cloud Function valida + checa duplicate + salva users_private
                val verifyResult = functions
                    .getHttpsCallable("verifyCpf")
                    .call(mapOf("cpf" to CpfValidator.strip(cpf)))
                    .await()

                @Suppress("UNCHECKED_CAST")
                val data = verifyResult.data as? Map<String, Any?>
                val success = data?.get("success") as? Boolean ?: false
                if (!success) {
                    throw IllegalStateException("verifyCpf returned success=false")
                }

                // Marca usuario como verified=true (custom claim)
                functions
                    .getHttpsCallable("setUserVerified")
                    .call(emptyMap<String, Any?>())
                    .await()

                // Force token refresh para refletir verified=true
                user.getIdToken(true).await()

                _uiState.value = CpfVerificationUiState.Success
            } catch (e: Exception) {
                AppLogger.e("CpfVerification", "verifyCpf failed", e)
                val msg = parseError(e)
                _uiState.value = CpfVerificationUiState.Error(msg)
            }
        }
    }

    private fun parseError(e: Exception): String {
        val msg = e.message.orEmpty()
        return when {
            msg.contains("already-exists") ->
                "Este CPF ja esta cadastrado em outra conta"
            msg.contains("invalid-argument") -> "CPF invalido"
            msg.contains("permission-denied") ->
                "CPF ja cadastrado. Entre em contato com o suporte."
            msg.contains("unauthenticated") ->
                "Login expirou. Faca login novamente."
            else -> "Erro ao verificar CPF. Tente novamente."
        }
    }

    override fun onCleared() {
        super.onCleared()
        pendingJob?.cancel()
    }
}

sealed class CpfVerificationUiState {
    object Idle : CpfVerificationUiState()
    object Verifying : CpfVerificationUiState()
    object Success : CpfVerificationUiState()
    data class Error(val message: String) : CpfVerificationUiState()
}
