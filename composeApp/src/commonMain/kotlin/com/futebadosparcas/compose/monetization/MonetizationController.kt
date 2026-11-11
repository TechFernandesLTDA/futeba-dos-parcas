package com.futebadosparcas.compose.monetization

import com.futebadosparcas.domain.monetization.AdsFreeEntitlement
import com.futebadosparcas.domain.monetization.AdsGate
import com.futebadosparcas.domain.monetization.AdsState
import com.futebadosparcas.domain.monetization.MonetizationConfig
import com.futebadosparcas.domain.monetization.StoreAnswer
import com.futebadosparcas.domain.monetization.StorePurchase
import com.futebadosparcas.domain.monetization.StorePurchaseState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class MonetizationUiState(
    val adsFree: Boolean = false,
    val firstWinReached: Boolean = false,
    val canRequestAds: Boolean = false,
    val nonPersonalized: Boolean = false,
    val privacyOptionsRequired: Boolean = false,
)

/** Ponte entre os dois holders: o Swift entrega as pontes na abertura; o App() as lê daqui. */
object MonetizationHolder {
    var ads: AdsBridge? = null
    var store: StoreBridge? = null
    var controller: MonetizationController? = null

    /** Primeira vitória (presença confirmada ou jogo criado). Seguro chamar sem controller. */
    fun onFirstWin() {
        controller?.onFirstWin()
    }
}

/**
 * Regras de anúncio e do direito "Sem anúncios" no iOS. Mesma lógica de produto do Android
 * (ver [AdsGate] e [AdsFreeEntitlement], compartilhados e testados):
 *
 * - assinante: nenhum UMP, nenhum ATT, SDK nem inicia, banner some;
 * - antes da primeira vitória: nada inicia;
 * - sem ID de unidade (config de build vazia): nada inicia;
 * - ATT negado: só anúncio não personalizado.
 */
class MonetizationController(
    private val state: AdsState,
    private val ads: AdsBridge?,
    private val store: StoreBridge?,
) {
    private val _ui = MutableStateFlow(
        MonetizationUiState(adsFree = state.adsFree, firstWinReached = state.firstWinReached)
    )
    val ui: StateFlow<MonetizationUiState> = _ui.asStateFlow()

    private var adsStarted = false
    private var canRequestAds = false
    private var attAuthorized: Boolean? = null

    /** Na abertura: confere a assinatura na loja e, se as regras permitirem, inicia anúncios. */
    fun start() {
        publish()
        maybeStartAds()
        store?.currentEntitlement { outcome -> applyEntitlement(outcome) }
    }

    fun onFirstWin() {
        state.markFirstWin()
        publish()
        maybeStartAds()
    }

    /** Resultado de compra, restauração ou conferência. */
    fun applyEntitlement(outcome: StoreOutcome) {
        state.apply(AdsFreeEntitlement.decide(toAnswer(outcome)))
        publish()
        maybeStartAds()
    }

    fun showPrivacyOptions() {
        ads?.showPrivacyOptions { publish() }
    }

    private fun maybeStartAds() {
        val bridge = ads ?: return
        if (adsStarted) return
        if (!AdsGate.shouldStartAds(state.adsFree, state.firstWinReached, bridge.unitConfigured)) return
        adsStarted = true
        bridge.startAds { can, att ->
            canRequestAds = can
            attAuthorized = when (att) {
                1 -> true
                0 -> false
                else -> null
            }
            publish()
        }
    }

    private fun publish() {
        _ui.value = MonetizationUiState(
            adsFree = state.adsFree,
            firstWinReached = state.firstWinReached,
            canRequestAds = canRequestAds && adsStarted && !state.adsFree,
            nonPersonalized = AdsGate.requestNonPersonalized(attAuthorized),
            privacyOptionsRequired = ads?.privacyOptionsRequired == true,
        )
    }

    internal companion object {
        fun toAnswer(outcome: StoreOutcome): StoreAnswer = when (outcome) {
            StoreOutcome.ACTIVE -> StoreAnswer.Answered(listOf(ours(StorePurchaseState.PURCHASED)))
            StoreOutcome.NONE -> StoreAnswer.Answered(emptyList())
            StoreOutcome.PENDING -> StoreAnswer.Answered(listOf(ours(StorePurchaseState.PENDING)))
            StoreOutcome.UNAVAILABLE, StoreOutcome.CANCELLED, StoreOutcome.FAILED -> StoreAnswer.Unavailable
        }

        private fun ours(state: StorePurchaseState) =
            StorePurchase(MonetizationConfig.PRODUCT_ID_IOS_SEM_ANUNCIOS_ANUAL, state)
    }
}
