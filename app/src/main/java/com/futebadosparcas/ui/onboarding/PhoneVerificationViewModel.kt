package com.futebadosparcas.ui.onboarding

import android.app.Activity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.functions.FirebaseFunctions
import com.futebadosparcas.R
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.FirebaseRegions
import com.futebadosparcas.util.ResourceManager
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.concurrent.TimeUnit

/**
 * ViewModel para verificacao de telefone via Firebase Phone Auth.
 *
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md (R2, Fase 3 #446)
 *
 * Fluxo:
 * 1. sendVerificationCode(activity, phone) - dispara SMS
 * 2. verifyCode(code) - valida OTP e vincula a conta atual
 *
 * Auto-detect SMS funciona via SmsRetriever (sem permissao READ_SMS).
 */
class PhoneVerificationViewModel(
    private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(FirebaseRegions.FUNCTIONS),
    private val resourceManager: ResourceManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow<PhoneVerificationUiState>(
        PhoneVerificationUiState.Idle,
    )
    val uiState: StateFlow<PhoneVerificationUiState> = _uiState.asStateFlow()

    private var verificationId: String? = null
    private var resendToken: PhoneAuthProvider.ForceResendingToken? = null
    private var pendingJob: Job? = null

    private val callbacks = object :
        PhoneAuthProvider.OnVerificationStateChangedCallbacks() {

        override fun onVerificationCompleted(credential: PhoneAuthCredential) {
            // Auto-detect: SMS captura o codigo automaticamente
            AppLogger.d("PhoneVerification") { "auto-completed via SMS retriever" }
            linkCredential(credential)
        }

        override fun onVerificationFailed(e: FirebaseException) {
            AppLogger.e("PhoneVerification", "verification failed", e)
            val msg = when (e) {
                is FirebaseAuthInvalidCredentialsException ->
                    resourceManager.getString(R.string.phone_error_invalid_number)
                else -> e.message ?: resourceManager.getString(R.string.phone_error_sms_send)
            }
            _uiState.value = PhoneVerificationUiState.Error(msg)
        }

        override fun onCodeSent(
            id: String,
            token: PhoneAuthProvider.ForceResendingToken,
        ) {
            verificationId = id
            resendToken = token
            _uiState.value = PhoneVerificationUiState.CodeSent
        }
    }

    /**
     * Dispara SMS OTP. Phone deve estar em formato E.164 (+5511999998888).
     *
     * FIX #933: consulta canSendSmsOtp (Cloud Function) antes de iniciar o
     * fluxo de Phone Auth. Isso aplica rate limiting server-side por número/IP,
     * prevenindo abuso de envio de SMS.
     *
     * NOTA: a enforcement é advisory (cliente legítimo respeita; cliente malicioso
     * pode bypassar chamando Firebase Phone Auth diretamente). Enforcement completa
     * requer Auth Blocking Functions — ver #940.
     */
    fun sendVerificationCode(activity: Activity, phone: String) {
        val normalized = phone.replace("\\s".toRegex(), "")
        if (!normalized.matches(Regex("^\\+\\d{10,15}$"))) {
            _uiState.value =
                PhoneVerificationUiState.Error(resourceManager.getString(R.string.phone_error_invalid_format))
            return
        }
        _uiState.value = PhoneVerificationUiState.SendingCode

        pendingJob?.cancel()
        pendingJob = viewModelScope.launch {
            try {
                // Verificar rate limit OTP via Cloud Function antes de disparar SMS.
                // Se a callable falhar por rede/App Check, seguimos para o Phone Auth:
                // o preflight é consultivo e não pode travar cadastro legítimo.
                val canSendResult = functions
                    .getHttpsCallable("canSendSmsOtp")
                    .call(mapOf("phone" to normalized))
                    .await()

                @Suppress("UNCHECKED_CAST")
                val resultData = canSendResult.data as? Map<String, Any>
                val allowed = resultData?.get("allowed") as? Boolean ?: false

                if (!allowed) {
                    val retryAfterSec = resultData?.get("retryAfterSec") as? Number
                    val msg = if (retryAfterSec != null && retryAfterSec.toInt() > 0) {
                        resourceManager.getString(R.string.phone_error_too_many_attempts_with_time, retryAfterSec.toInt())
                    } else {
                        resourceManager.getString(R.string.phone_error_too_many_attempts)
                    }
                    _uiState.value = PhoneVerificationUiState.Error(msg)
                    return@launch
                }
            } catch (e: Exception) {
                AppLogger.e(
                    "PhoneVerification",
                    "Erro no preflight OTP; continuando com Firebase Phone Auth",
                    e,
                )
            }

            try {
                val options = PhoneAuthOptions.newBuilder(auth)
                    .setPhoneNumber(normalized)
                    .setTimeout(60L, TimeUnit.SECONDS)
                    .setActivity(activity)
                    .setCallbacks(callbacks)
                    .apply { resendToken?.let { setForceResendingToken(it) } }
                    .build()

                PhoneAuthProvider.verifyPhoneNumber(options)
            } catch (e: Exception) {
                AppLogger.e("PhoneVerification", "Erro ao iniciar Phone Auth", e)
                _uiState.value = PhoneVerificationUiState.Error(
                    resourceManager.getString(R.string.phone_error_connection)
                )
            }
        }
    }

    fun reportRecoverableError(message: String) {
        _uiState.value = PhoneVerificationUiState.Error(message)
    }

    fun clearCollision() {
        _uiState.value = PhoneVerificationUiState.Idle
    }

    /**
     * Verifica codigo OTP digitado e vincula a conta atual.
     */
    fun verifyCode(code: String) {
        if (!code.matches(Regex("^\\d{6}$"))) {
            _uiState.value =
                PhoneVerificationUiState.Error(resourceManager.getString(R.string.phone_error_code_length))
            return
        }
        val id = verificationId
        if (id == null) {
            _uiState.value =
                PhoneVerificationUiState.Error(resourceManager.getString(R.string.phone_error_session_expired))
            return
        }
        val credential = PhoneAuthProvider.getCredential(id, code)
        linkCredential(credential)
    }

    private fun linkCredential(credential: PhoneAuthCredential) {
        pendingJob?.cancel()
        pendingJob = viewModelScope.launch {
            _uiState.value = PhoneVerificationUiState.Verifying
            try {
                val currentUser = auth.currentUser
                if (currentUser == null) {
                    _uiState.value = PhoneVerificationUiState.Error(
                        resourceManager.getString(R.string.phone_error_login_expired),
                    )
                    return@launch
                }
                val linkedUser = currentUser.linkWithCredential(credential).await().user
                    ?: auth.currentUser
                    ?: currentUser
                linkedUser.reload().await()
                linkedUser.getIdToken(true).await()

                _uiState.value = PhoneVerificationUiState.Success
            } catch (e: Exception) {
                AppLogger.e("PhoneVerification", "linkWithCredential failed", e)
                if (e.message?.contains("credential-already-in-use") == true) {
                    _uiState.value = PhoneVerificationUiState.AccountCollision(credential)
                    return@launch
                }
                val msg = when {
                    e.message?.contains("invalid-verification-code") == true ->
                        resourceManager.getString(R.string.phone_error_invalid_code)
                    e.message?.contains("code-expired") == true ->
                        resourceManager.getString(R.string.phone_error_code_expired)
                    else -> resourceManager.getString(R.string.phone_error_invalid_code_retry)
                }
                _uiState.value = PhoneVerificationUiState.Error(msg)
            }
        }
    }

    fun claimExistingAccount(requestMerge: Boolean) {
        val collision = _uiState.value as? PhoneVerificationUiState.AccountCollision
        if (collision == null) {
            _uiState.value = PhoneVerificationUiState.Error(
                resourceManager.getString(R.string.phone_error_session_expired),
            )
            return
        }

        pendingJob?.cancel()
        pendingJob = viewModelScope.launch {
            _uiState.value = if (requestMerge) {
                PhoneVerificationUiState.RequestingMerge(collision.credential)
            } else {
                PhoneVerificationUiState.ClaimingAccount(collision.credential)
            }

            try {
                val currentUser = auth.currentUser
                val sourceIdToken = if (requestMerge) {
                    currentUser
                        ?.getIdToken(true)
                        ?.await()
                        ?.token
                } else {
                    null
                }

                if (requestMerge && sourceIdToken.isNullOrBlank()) {
                    _uiState.value = PhoneVerificationUiState.Error(
                        resourceManager.getString(R.string.phone_error_login_expired),
                    )
                    return@launch
                }

                val result = auth.signInWithCredential(collision.credential).await()
                result.user?.getIdToken(true)?.await()

                if (requestMerge && !sourceIdToken.isNullOrBlank()) {
                    try {
                        functions
                            .getHttpsCallable("requestAccountMerge")
                            .call(mapOf("sourceIdToken" to sourceIdToken))
                            .await()
                    } catch (mergeErr: Exception) {
                        AppLogger.e(
                            "PhoneVerification",
                            "requestAccountMerge failed after account claim",
                            mergeErr,
                        )
                        _uiState.value = PhoneVerificationUiState.Error(
                            resourceManager.getString(R.string.phone_merge_request_error),
                        )
                        return@launch
                    }
                }

                _uiState.value = PhoneVerificationUiState.Success
            } catch (e: Exception) {
                AppLogger.e("PhoneVerification", "claimExistingAccount failed", e)
                _uiState.value = PhoneVerificationUiState.Error(
                    resourceManager.getString(R.string.phone_claim_error),
                )
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        pendingJob?.cancel()
    }
}

sealed class PhoneVerificationUiState {
    object Idle : PhoneVerificationUiState()
    object SendingCode : PhoneVerificationUiState()
    object CodeSent : PhoneVerificationUiState()
    object Verifying : PhoneVerificationUiState()
    object Success : PhoneVerificationUiState()
    data class AccountCollision(val credential: PhoneAuthCredential) : PhoneVerificationUiState()
    data class ClaimingAccount(val credential: PhoneAuthCredential) : PhoneVerificationUiState()
    data class RequestingMerge(val credential: PhoneAuthCredential) : PhoneVerificationUiState()
    data class Error(val message: String) : PhoneVerificationUiState()
}
