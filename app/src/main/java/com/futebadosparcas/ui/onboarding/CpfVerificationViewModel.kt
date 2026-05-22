package com.futebadosparcas.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import com.futebadosparcas.domain.util.CpfValidator
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * ViewModel para verificacao de CPF.
 *
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md (R3, R6, Fase 3 #446)
 * Fix: SPEC_BUGFIX_2026-05-17_CPF_ANDROID_TOKEN_CLUSTER.md (H1-H3, #1303)
 *
 * Fluxo:
 * 1. Valida CPF client-side (CpfValidator KMP shared)
 * 2. Refresh de token com retry antes do callable (H1+H3)
 * 3. Chama Cloud Function verifyCpf (duplicate check + users_private)
 * 4. Chama Cloud Function setUserVerified (custom claim verified=true)
 * 5. Seta UiState.Success imediatamente apos sucesso server-side (H2)
 * 6. Refresh pós-verify em try/catch isolado e non-fatal (H2+H3)
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
     * Tenta refresh do token do usuario com backoff exponencial (ate 3 tentativas).
     *
     * Backoff: 600ms / 1200ms / 1800ms entre tentativas.
     * Se todas as 3 tentativas falharem, propaga a excecao da ultima.
     *
     * Fix H1+H3: portado da saga web #1284/#1301.
     */
    internal suspend fun refreshTokenWithRetry(user: FirebaseUser) {
        repeat(3) { attempt ->
            try {
                user.getIdToken(true).await()
                return
            } catch (e: Exception) {
                if (attempt == 2) throw e
                delay((attempt + 1) * 600L)
            }
        }
    }

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
                // H1+H3: refresh pre-chamada com retry/backoff para evitar token stale
                // (porta fix web #1284/#1301 — token pode estar stale apos phone-verify)
                refreshTokenWithRetry(user)

                // Cloud Function valida + checa duplicate + salva users_private
                val verifyResult = functions
                    .getHttpsCallable("verifyCpf")
                    .call(mapOf("cpf" to CpfValidator.strip(cpf)))
                    .await()

                @Suppress("UNCHECKED_CAST")
                val data = verifyResult.data as? Map<String, Any?>
                val success = data?.get("success") as? Boolean ?: false
                if (!success) {
                    error("verifyCpf returned success=false")
                }

                // Marca usuario como verified=true (custom claim)
                functions
                    .getHttpsCallable("setUserVerified")
                    .call(emptyMap<String, Any?>())
                    .await()

                // Recomputa claim profileComplete apos salvar CPF + phone.
                // Spec: feat-2026-05-21-profile-complete-gate.md (#1485)
                runCatching {
                    com.google.firebase.functions.FirebaseFunctions
                        .getInstance("southamerica-east1")
                        .getHttpsCallable("recomputeMyProfileClaim")
                        .call(emptyMap<String, Any?>())
                        .await()
                }.onFailure { e ->
                    AppLogger.w("CpfVerification") {
                        "recomputeMyProfileClaim failed (non-fatal): ${e.message}"
                    }
                }
            } catch (e: Exception) {
                AppLogger.e("CpfVerification", "verifyCpf failed", e)
                val msg = parseError(e)
                _uiState.value = CpfVerificationUiState.Error(msg)
                return@launch
            }

            // H2: sucesso server-side seta Success ANTES do refresh pos-verify.
            // setUserVerified revoga refresh tokens — o refresh seguinte pode lancar
            // user-token-expired. Isso NAO e um erro de negocio; isolamos em
            // runCatching non-fatal para garantir que sucesso real nunca vire Error.
            // (porta fix web #1285)
            _uiState.value = CpfVerificationUiState.Success
            runCatching { refreshTokenWithRetry(user) }
                .onFailure { e ->
                    AppLogger.w("CpfVerification") {
                        "Refresh pos-verify falhou (non-fatal): ${e.message}"
                    }
                }
        }
    }

    /**
     * Mapeia excecao para mensagem amigavel.
     *
     * #1310 L4: usa FirebaseFunctionsException.code (estavel) em vez de match
     * fragil na message. Fallback para parsing de string apenas quando a
     * excecao NAO e FirebaseFunctionsException (ex.: erro de rede, mocks).
     */
    private fun parseError(e: Exception): String {
        val ffe = e as? FirebaseFunctionsException
            ?: e.cause as? FirebaseFunctionsException
        if (ffe != null) {
            return when (ffe.code) {
                FirebaseFunctionsException.Code.ALREADY_EXISTS ->
                    "Este CPF ja esta cadastrado em outra conta"
                FirebaseFunctionsException.Code.INVALID_ARGUMENT -> "CPF invalido"
                FirebaseFunctionsException.Code.PERMISSION_DENIED ->
                    "CPF ja cadastrado. Entre em contato com o suporte."
                FirebaseFunctionsException.Code.UNAUTHENTICATED ->
                    "Login expirou. Faca login novamente."
                else -> "Erro ao verificar CPF. Tente novamente."
            }
        }

        // Fallback: excecao nao-Functions (rede, runtime). Mantem parsing por
        // string para compatibilidade com casos sem code estruturado.
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
