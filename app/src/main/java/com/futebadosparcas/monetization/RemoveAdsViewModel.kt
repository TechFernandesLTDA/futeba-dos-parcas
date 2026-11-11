package com.futebadosparcas.monetization

import android.app.Activity
import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.R
import com.futebadosparcas.domain.monetization.AdsFreeEntitlement
import com.futebadosparcas.domain.monetization.AdsState
import com.futebadosparcas.domain.monetization.EntitlementDecision
import com.futebadosparcas.domain.monetization.StoreAnswer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class RemoveAdsUiState(
    val loading: Boolean = true,
    /** Preço anual como a loja devolve. `null` com [loading] falso = loja indisponível. */
    val price: String? = null,
    val adsFree: Boolean = false,
    val busy: Boolean = false,
    @StringRes val messageResId: Int? = null,
)

/** Tela "Sem anúncios": assinar, restaurar compra e gerenciar a assinatura. */
class RemoveAdsViewModel(
    private val billing: PlayBillingManager,
    private val adsController: AdsController,
    private val state: AdsState,
) : ViewModel() {

    private val _uiState = MutableStateFlow(RemoveAdsUiState(adsFree = state.adsFree))
    val uiState: StateFlow<RemoveAdsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val offer = billing.loadOffer()
            _uiState.update { it.copy(loading = false, price = offer?.price) }
        }
        viewModelScope.launch {
            billing.purchaseEvents.collect { event ->
                _uiState.update {
                    when (event) {
                        PurchaseEvent.Completed ->
                            it.copy(busy = false, adsFree = true, messageResId = R.string.remove_ads_msg_done)
                        PurchaseEvent.Pending ->
                            it.copy(busy = false, messageResId = R.string.remove_ads_msg_pending)
                        PurchaseEvent.Cancelled -> it.copy(busy = false)
                        is PurchaseEvent.Failed ->
                            it.copy(busy = false, messageResId = R.string.remove_ads_msg_failed)
                    }
                }
            }
        }
    }

    fun subscribe(activity: Activity) {
        if (_uiState.value.busy) return
        _uiState.update { it.copy(busy = true, messageResId = null) }
        if (!billing.launchPurchase(activity)) {
            _uiState.update { it.copy(busy = false, messageResId = R.string.remove_ads_msg_unavailable) }
        }
    }

    /** "Restaurar compra": relê as assinaturas da conta da Play. */
    fun restore() {
        if (_uiState.value.busy) return
        _uiState.update { it.copy(busy = true, messageResId = null) }
        viewModelScope.launch {
            val answer = billing.queryEntitlement()
            val decision = AdsFreeEntitlement.decide(answer)
            state.apply(decision)
            adsController.onEntitlementChanged()
            _uiState.update {
                it.copy(
                    busy = false,
                    adsFree = state.adsFree,
                    messageResId = when {
                        answer is StoreAnswer.Unavailable -> R.string.remove_ads_msg_unavailable
                        decision == EntitlementDecision.GRANT -> R.string.remove_ads_msg_restored
                        else -> R.string.remove_ads_msg_nothing_to_restore
                    },
                )
            }
        }
    }

    fun messageShown() = _uiState.update { it.copy(messageResId = null) }
}
