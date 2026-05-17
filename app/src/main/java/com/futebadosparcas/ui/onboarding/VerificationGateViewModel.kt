package com.futebadosparcas.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * Estados possiveis do gate de verificacao pos-login.
 *
 * Spec: SPEC_BUGFIX_2026-05-17_C1_ANDROID_ANTIBOT_ENFORCEMENT.md (Opcao b)
 * Issue: #1302
 */
sealed class VerifiedState {
    /** Verificacao inicial em andamento — exibir loading. */
    object Unknown : VerifiedState()

    /** Claim `verified == true` confirmado — libera o app. */
    object Verified : VerifiedState()

    /**
     * Usuario nao verificado.
     *
     * @param hasPhone true se auth.currentUser.phoneNumber nao e nulo/vazio.
     *   Se true: pular step de telefone e ir direto ao CPF (portabilidade #1024 web).
     */
    data class Unverified(val hasPhone: Boolean) : VerifiedState()

    /**
     * Falha irrecuperavel (usuario nulo, token ilegivel).
     * Exibir mensagem + botao de retry sem loop automatico.
     *
     * @param message Mensagem de erro legivel para o usuario.
     */
    data class Failed(val message: String) : VerifiedState()
}

/**
 * ViewModel do gate anti-bot pos-login.
 *
 * Responsabilidades:
 * 1. [check]: Leitura inicial do claim `verified` via token cacheado (getIdToken(false)).
 * 2. [recheckAfterVerify]: Refresh forcado UMA vez apos conclusao do fluxo CPF (getIdToken(true)).
 *    Se ainda false => [VerifiedState.Failed] (sem loop automatico).
 *
 * Prevencao de loop (documentada):
 * - check() usa forceRefresh=false (cache) — sem roundtrip de rede.
 * - recheckAfterVerify() usa forceRefresh=true e chega a ser chamado apenas uma vez
 *   pelo callback onSuccess da CpfVerificationScreen.
 * - Se recheckAfterVerify() retornar verified=false => Failed (nao redireciona de volta
 *   p/ fluxo, exige acao do usuario).
 *
 * Spec: SPEC_BUGFIX_2026-05-17_C1_ANDROID_ANTIBOT_ENFORCEMENT.md
 * Issue: #1302
 */
class VerificationGateViewModel(
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _state = MutableStateFlow<VerifiedState>(VerifiedState.Unknown)
    val state: StateFlow<VerifiedState> = _state.asStateFlow()

    /**
     * Verifica claim `verified` usando token cacheado (getIdToken(false)).
     * Deve ser chamado uma vez na composicao inicial do gate.
     *
     * Em caso de usuario nulo: [VerifiedState.Failed] (sessao invalida).
     */
    fun check() {
        viewModelScope.launch {
            _state.value = VerifiedState.Unknown
            val user = auth.currentUser
            if (user == null) {
                AppLogger.w("VerificationGate") { "check(): usuario nulo — sessao invalida" }
                _state.value = VerifiedState.Failed("Sessao expirou. Faca login novamente.")
                return@launch
            }
            try {
                val result = user.getIdToken(false).await()
                val verified = result?.claims?.get("verified") == true
                if (verified) {
                    AppLogger.d("VerificationGate") { "check(): verified=true — liberando app" }
                    _state.value = VerifiedState.Verified
                } else {
                    val hasPhone = !user.phoneNumber.isNullOrEmpty()
                    AppLogger.d("VerificationGate") {
                        "check(): verified=false, hasPhone=$hasPhone — iniciando fluxo"
                    }
                    _state.value = VerifiedState.Unverified(hasPhone = hasPhone)
                }
            } catch (e: Exception) {
                AppLogger.e("VerificationGate", "check(): falha ao ler token", e)
                _state.value = VerifiedState.Failed("Erro ao verificar sessao. Tente novamente.")
            }
        }
    }

    /**
     * Revalida o claim `verified` apos o usuario concluir o fluxo CPF.
     * Usa getIdToken(true) para garantir que o claim recentemente concedido seja refletido.
     *
     * Chamado exatamente UMA vez pelo callback onSuccess da [CpfVerificationScreen].
     * Se o token ainda nao tiver verified=true: transiciona para [VerifiedState.Failed]
     * (nao re-roteia automaticamente para evitar loop).
     */
    fun recheckAfterVerify() {
        viewModelScope.launch {
            _state.value = VerifiedState.Unknown
            val user = auth.currentUser
            if (user == null) {
                AppLogger.w("VerificationGate") { "recheckAfterVerify(): usuario nulo" }
                _state.value = VerifiedState.Failed("Sessao expirou. Faca login novamente.")
                return@launch
            }
            try {
                val result = user.getIdToken(true).await()
                val verified = result?.claims?.get("verified") == true
                if (verified) {
                    AppLogger.d("VerificationGate") {
                        "recheckAfterVerify(): verified=true — liberando app"
                    }
                    _state.value = VerifiedState.Verified
                } else {
                    AppLogger.w("VerificationGate") {
                        "recheckAfterVerify(): token ainda sem verified=true apos fluxo"
                    }
                    _state.value = VerifiedState.Failed(
                        "Verificacao nao confirmada. Aguarde alguns segundos e tente novamente.",
                    )
                }
            } catch (e: Exception) {
                AppLogger.e("VerificationGate", "recheckAfterVerify(): falha ao refrescar token", e)
                _state.value = VerifiedState.Failed("Erro ao confirmar verificacao. Tente novamente.")
            }
        }
    }
}
