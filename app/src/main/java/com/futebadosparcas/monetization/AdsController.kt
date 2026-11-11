package com.futebadosparcas.monetization

import android.app.Activity
import android.content.Context
import com.futebadosparcas.domain.monetization.AdsFreeEntitlement
import com.futebadosparcas.domain.monetization.AdsGate
import com.futebadosparcas.domain.monetization.AdsState
import com.futebadosparcas.domain.monetization.EntitlementDecision
import com.futebadosparcas.util.AppLogger
import com.google.android.gms.ads.MobileAds
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AdsUiState(
    val adsFree: Boolean = false,
    val firstWinReached: Boolean = false,
    val canRequestAds: Boolean = false,
    val privacyOptionsRequired: Boolean = false,
)

/**
 * Orquestra anúncios no Android: consentimento do Google (UMP), inicialização do SDK e o
 * direito "Sem anúncios" (Play Billing). As regras de quando pode ficar ativo estão em
 * [AdsGate] (shared, testadas):
 *
 * - assinante: o SDK nem é inicializado e nenhum formulário aparece;
 * - sem primeira vitória (presença confirmada ou jogo criado): nada começa;
 * - sem unidade de anúncio na config de build: nada começa;
 * - o SDK só inicializa quando o UMP permite pedir anúncios.
 */
class AdsController(
    context: Context,
    private val state: AdsState,
    private val billing: PlayBillingManager,
) {
    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val _uiState = MutableStateFlow(
        AdsUiState(adsFree = state.adsFree, firstWinReached = state.firstWinReached)
    )
    val uiState: StateFlow<AdsUiState> = _uiState.asStateFlow()

    private var sdkStarted = false
    private var consentRunning = false
    private var started = false

    /** Chamado uma vez pelo Application: passa a ouvir a primeira vitória e as compras. */
    fun start() {
        if (started) return
        started = true
        scope.launch {
            MonetizationEvents.firstWinEvents.collect {
                state.markFirstWin()
                publish()
            }
        }
        scope.launch {
            billing.purchaseEvents.collect { event ->
                if (event is PurchaseEvent.Completed) {
                    state.apply(EntitlementDecision.GRANT)
                    publish()
                }
            }
        }
        scope.launch { refreshEntitlement() }
    }

    /** Confere a assinatura na loja (abertura do app). Sem a loja, nunca revoga. */
    suspend fun refreshEntitlement() {
        val decision = AdsFreeEntitlement.decide(billing.queryEntitlement())
        state.apply(decision)
        publish()
    }

    /** Quando uma tela de compra termina (assinou ou restaurou), reflete o novo estado. */
    fun onEntitlementChanged() = publish()

    /** Chamado quando uma Activity aparece. Só faz algo se as regras permitirem anúncio. */
    fun onActivityStarted(activity: Activity) {
        if (!AdsGate.shouldStartAds(state.adsFree, state.firstWinReached, AdsConfig.unitConfigured)) return
        val info = UserMessagingPlatform.getConsentInformation(activity)
        // Sessão anterior já tinha consentimento resolvido: inicializa já, e atualiza em seguida.
        if (info.canRequestAds()) startSdk()
        if (consentRunning) return
        consentRunning = true
        info.requestConsentInfoUpdate(
            activity,
            ConsentRequestParameters.Builder().build(),
            {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { formError ->
                    if (formError != null) {
                        AppLogger.w(TAG) { "Formulário de consentimento: ${formError.message}" }
                    }
                    consentRunning = false
                    afterConsent(info)
                }
            },
            { requestError ->
                AppLogger.w(TAG) { "Consentimento indisponível: ${requestError.message}" }
                consentRunning = false
                afterConsent(info)
            },
        )
    }

    private fun afterConsent(info: ConsentInformation) {
        if (info.canRequestAds()) startSdk()
        publish(info)
    }

    private fun startSdk() {
        if (sdkStarted) return
        sdkStarted = true
        scope.launch(Dispatchers.IO) {
            MobileAds.initialize(appContext) {}
            publish()
        }
    }

    /** Abre o formulário "Opções de privacidade" do UMP (exigido quando a região pede). */
    fun showPrivacyOptions(activity: Activity) {
        UserMessagingPlatform.showPrivacyOptionsForm(activity) { error ->
            if (error != null) AppLogger.w(TAG) { "Opções de privacidade: ${error.message}" }
            publish()
        }
    }

    private fun publish(info: ConsentInformation? = null) {
        _uiState.update { current ->
            current.copy(
                adsFree = state.adsFree,
                firstWinReached = state.firstWinReached,
                canRequestAds = sdkStarted && !state.adsFree,
                privacyOptionsRequired = info?.let {
                    it.privacyOptionsRequirementStatus ==
                        ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
                } ?: current.privacyOptionsRequired,
            )
        }
    }

    private companion object {
        const val TAG = "AdsController"
    }
}
