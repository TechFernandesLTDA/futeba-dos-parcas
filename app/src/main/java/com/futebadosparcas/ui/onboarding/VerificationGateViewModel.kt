package com.futebadosparcas.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout

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
     * @param postVerify true se a falha veio de [VerificationGateViewModel.recheckAfterVerify]
     *   (pos-fluxo CPF); false se veio de [VerificationGateViewModel.check] (pre-fluxo).
     *   O composable usa esse flag para decidir qual metodo chamar no retry:
     *   - postVerify=true  => recheckAfterVerify() (re-tenta refresh forcado, sem re-rodar CPF)
     *   - postVerify=false => check() (re-verifica sessao normalmente)
     */
    data class Failed(val message: String, val postVerify: Boolean = false) : VerifiedState()
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
    private val tokenTimeoutMillis: Long = TOKEN_TIMEOUT_MILLIS,
) : ViewModel() {

    companion object {
        /**
         * Teto para ler o token no [check]. getIdToken(false) vai à rede quando o token
         * expirou; sem teto, o loading do gate podia ficar para sempre (spec
         * BUGFIX_2026-11-09_SPLASH_TRAVADA_REVISAO_PLAY). Estourou: [VerifiedState.Failed]
         * com botão de nova tentativa.
         */
        const val TOKEN_TIMEOUT_MILLIS = 15_000L
    }

    private val _state = MutableStateFlow<VerifiedState>(VerifiedState.Unknown)
    val state: StateFlow<VerifiedState> = _state.asStateFlow()

    /**
     * Tenta refresh forcado do token com backoff exponencial (ate 3 tentativas).
     *
     * Espelha o padrao [CpfVerificationViewModel.refreshTokenWithRetry] para cobrir
     * a janela transiente pos-revokeRefreshTokens (chamado por setUserVerified server-side).
     * Sem retry aqui, a janela transiente poderia fazer recheckAfterVerify() falhar mesmo
     * apos o fluxo CPF ter sido concluido com sucesso.
     *
     * Backoff: 600ms / 1200ms entre tentativas (attempt+1 * 600ms).
     * Se todas as 3 tentativas falharem, propaga a excecao da ultima.
     *
     * Fix: spec §3.2 passo 4 / §3.3 "Gate do claim le token stale" (#1302)
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
                val result = withTimeout(tokenTimeoutMillis) {
                    user.getIdToken(false).await()
                }
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
            } catch (e: TimeoutCancellationException) {
                AppLogger.e("VerificationGate", "check(): token não chegou a tempo", e)
                _state.value = VerifiedState.Failed("Erro ao verificar sessao. Tente novamente.")
            } catch (e: Exception) {
                AppLogger.e("VerificationGate", "check(): falha ao ler token", e)
                _state.value = VerifiedState.Failed("Erro ao verificar sessao. Tente novamente.")
            }
        }
    }

    /**
     * Revalida o claim `verified` apos o usuario concluir o fluxo CPF.
     * Usa [refreshTokenWithRetry] (ate 3 tentativas com backoff) para cobrir a janela
     * transiente apos setCustomUserClaims. Single-shot era regressao do fix #1303:
     * o budget de retry do CpfVerificationViewModel ja estava esgotado nessa camada.
     *
     * Chamado exatamente UMA vez pelo callback onSuccess da [CpfVerificationScreen].
     * Se o token ainda nao tiver verified=true: transiciona para [VerifiedState.Failed]
     * com postVerify=true (nao re-roteia automaticamente para evitar loop; o composable
     * usa postVerify=true para chamar recheckAfterVerify() novamente ao inves de check()).
     */
    fun recheckAfterVerify() {
        viewModelScope.launch {
            _state.value = VerifiedState.Unknown
            val user = auth.currentUser
            if (user == null) {
                AppLogger.w("VerificationGate") { "recheckAfterVerify(): usuario nulo" }
                _state.value = VerifiedState.Failed(
                    "Sessao expirou. Faca login novamente.",
                    postVerify = true,
                )
                return@launch
            }
            try {
                // Usa retry/backoff para cobrir janela transiente apos setCustomUserClaims.
                // Fix spec §3.2 passo 4 / §3.3 "Gate do claim le token stale" (#1302)
                refreshTokenWithRetry(user)
                val result = user.getIdToken(false).await()
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
                        postVerify = true,
                    )
                }
            } catch (e: Exception) {
                AppLogger.e("VerificationGate", "recheckAfterVerify(): falha ao refrescar token", e)
                _state.value = VerifiedState.Failed(
                    "Erro ao confirmar verificacao. Tente novamente.",
                    postVerify = true,
                )
            }
        }
    }
}
