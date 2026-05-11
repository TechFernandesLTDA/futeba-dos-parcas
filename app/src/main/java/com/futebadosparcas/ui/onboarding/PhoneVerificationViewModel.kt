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
import com.futebadosparcas.util.AppLogger
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
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance(),
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
                    "Numero de telefone invalido"
                else -> e.message ?: "Erro ao enviar SMS. Tente novamente."
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
                PhoneVerificationUiState.Error("Formato invalido. Use +5511999998888")
            return
        }
        _uiState.value = PhoneVerificationUiState.SendingCode

        pendingJob?.cancel()
        pendingJob = viewModelScope.launch {
            try {
                // Verificar rate limit OTP via Cloud Function antes de disparar SMS
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
                        "Muitas tentativas. Tente novamente em ${retryAfterSec.toInt()}s"
                    } else {
                        "Muitas tentativas. Tente novamente mais tarde."
                    }
                    _uiState.value = PhoneVerificationUiState.Error(msg)
                    return@launch
                }

                // Rate limit OK — iniciar verificação de telefone
                val options = PhoneAuthOptions.newBuilder(auth)
                    .setPhoneNumber(normalized)
                    .setTimeout(60L, TimeUnit.SECONDS)
                    .setActivity(activity)
                    .setCallbacks(callbacks)
                    .apply { resendToken?.let { setForceResendingToken(it) } }
                    .build()

                PhoneAuthProvider.verifyPhoneNumber(options)
            } catch (e: Exception) {
                AppLogger.e("PhoneVerification", "Erro ao verificar rate limit OTP", e)
                // Em caso de falha na CF (ex: offline), prosseguir com envio
                // para não degradar a experiência quando há problemas de rede.
                // O Firebase Phone Auth tem seus próprios limites de quota.
                val options = PhoneAuthOptions.newBuilder(auth)
                    .setPhoneNumber(normalized)
                    .setTimeout(60L, TimeUnit.SECONDS)
                    .setActivity(activity)
                    .setCallbacks(callbacks)
                    .apply { resendToken?.let { setForceResendingToken(it) } }
                    .build()
                PhoneAuthProvider.verifyPhoneNumber(options)
            }
        }
    }

    /**
     * Verifica codigo OTP digitado e vincula a conta atual.
     */
    fun verifyCode(code: String) {
        if (!code.matches(Regex("^\\d{6}$"))) {
            _uiState.value =
                PhoneVerificationUiState.Error("O codigo deve ter 6 digitos")
            return
        }
        val id = verificationId
        if (id == null) {
            _uiState.value =
                PhoneVerificationUiState.Error("Sessao expirou. Reinicie o processo.")
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
                        "Login expirou. Faca login novamente.",
                    )
                    return@launch
                }
                currentUser.linkWithCredential(credential).await()
                _uiState.value = PhoneVerificationUiState.Success
            } catch (e: Exception) {
                AppLogger.e("PhoneVerification", "linkWithCredential failed", e)
                val msg = when {
                    e.message?.contains("invalid-verification-code") == true ->
                        "Codigo incorreto"
                    e.message?.contains("code-expired") == true ->
                        "Codigo expirou. Solicite novo SMS."
                    e.message?.contains("credential-already-in-use") == true ->
                        "Este telefone ja esta vinculado a outra conta"
                    else -> "Codigo invalido. Tente novamente."
                }
                _uiState.value = PhoneVerificationUiState.Error(msg)
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
    data class Error(val message: String) : PhoneVerificationUiState()
}
