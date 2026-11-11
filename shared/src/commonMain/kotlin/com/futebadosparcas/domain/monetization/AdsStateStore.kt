package com.futebadosparcas.domain.monetization

import com.futebadosparcas.platform.storage.PreferencesService

/** Persistência mínima do estado de monetização (aparelho). Não guarda dado pessoal. */
interface AdsStateStore {
    fun getBoolean(key: String): Boolean
    fun putBoolean(key: String, value: Boolean)
}

class PreferencesAdsStateStore(private val preferences: PreferencesService) : AdsStateStore {
    override fun getBoolean(key: String): Boolean = preferences.getBoolean(key, false)
    override fun putBoolean(key: String, value: Boolean) = preferences.putBoolean(key, value)
}

/**
 * Estado local de anúncios: "primeira vitória" e "sem anúncios" guardado. A liberação
 * guardada segue valendo até a loja responder que não há assinatura ([AdsFreeEntitlement]).
 */
class AdsState(private val store: AdsStateStore) {
    val firstWinReached: Boolean get() = store.getBoolean(MonetizationConfig.PREF_FIRST_WIN)
    val adsFree: Boolean get() = store.getBoolean(MonetizationConfig.PREF_ADS_FREE)

    /** Primeira presença confirmada ou primeiro jogo criado. Idempotente. */
    fun markFirstWin() {
        if (!firstWinReached) store.putBoolean(MonetizationConfig.PREF_FIRST_WIN, true)
    }

    fun apply(decision: EntitlementDecision) {
        when (decision) {
            EntitlementDecision.GRANT -> store.putBoolean(MonetizationConfig.PREF_ADS_FREE, true)
            EntitlementDecision.REVOKE -> store.putBoolean(MonetizationConfig.PREF_ADS_FREE, false)
            EntitlementDecision.KEEP -> Unit
        }
    }
}
