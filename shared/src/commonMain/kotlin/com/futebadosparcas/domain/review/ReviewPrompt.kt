package com.futebadosparcas.domain.review

import com.futebadosparcas.platform.storage.PreferencesService

/** Chaves e limites do pedido de avaliação nativo. Nada aqui é dado pessoal. */
object ReviewConfig {
    /** Momentos de sucesso (jogos encerrados com XP) antes de pedir a avaliação. */
    const val SUCCESS_THRESHOLD = 3

    const val PREF_ASKED = "avaliacao.ja_pediu"
    const val PREF_SUCCESS_COUNT = "avaliacao.momentos_de_sucesso"
    const val PREF_LAST_EVENT_ID = "avaliacao.ultimo_evento"
}

/** Persistência mínima do pedido de avaliação (aparelho). */
interface ReviewStateStore {
    fun getBoolean(key: String): Boolean
    fun putBoolean(key: String, value: Boolean)
    fun getInt(key: String): Int
    fun putInt(key: String, value: Int)
    fun getString(key: String): String?
    fun putString(key: String, value: String)
}

class PreferencesReviewStateStore(private val preferences: PreferencesService) : ReviewStateStore {
    override fun getBoolean(key: String): Boolean = preferences.getBoolean(key, false)
    override fun putBoolean(key: String, value: Boolean) = preferences.putBoolean(key, value)
    override fun getInt(key: String): Int = preferences.getInt(key, 0)
    override fun putInt(key: String, value: Int) = preferences.putInt(key, value)
    override fun getString(key: String): String? = preferences.getString(key, null)
    override fun putString(key: String, value: String) = preferences.putString(key, value)
}

/** Decisão pura de "pedir avaliação agora?". Sem estado, sem plataforma. */
object ReviewPolicy {
    /**
     * Pede uma única vez, no momento de sucesso que completa [ReviewConfig.SUCCESS_THRESHOLD].
     * Nunca pede: se já pediu, se o momento não é positivo, se acabou de aparecer anúncio em
     * tela cheia ou se o usuário está num fluxo crítico (pagamento, cadastro).
     */
    fun shouldAsk(
        alreadyAsked: Boolean,
        successCount: Int,
        positiveMoment: Boolean = true,
        fullscreenAdJustShown: Boolean = false,
        inCriticalFlow: Boolean = false,
    ): Boolean =
        !alreadyAsked &&
            successCount >= ReviewConfig.SUCCESS_THRESHOLD &&
            positiveMoment &&
            !fullscreenAdJustShown &&
            !inCriticalFlow
}

/**
 * Conta momentos de sucesso e, quando a regra manda, dispara o pedido nativo.
 *
 * - O momento é contado uma vez por [eventId] (reabrir o mesmo resultado não conta de novo).
 * - "Já pediu" só é gravado quando houve tentativa real ([launch], p.ex. `NativeReviewLauncher::launch`, devolve
 *   `true`); sem tentativa (sem Activity, sem Play Services, sem cena no iOS) tenta de novo no
 *   próximo momento de sucesso.
 * - Nunca pergunta "está gostando?" antes: o pedido é só o diálogo nativo da loja.
 */
class ReviewPromptCoordinator(
    private val store: ReviewStateStore,
    private val launch: suspend () -> Boolean,
) {
    suspend fun onSuccessMoment(
        eventId: String,
        positiveMoment: Boolean = true,
        fullscreenAdJustShown: Boolean = false,
        inCriticalFlow: Boolean = false,
    ): Boolean {
        if (store.getBoolean(ReviewConfig.PREF_ASKED)) return false
        if (store.getString(ReviewConfig.PREF_LAST_EVENT_ID) != eventId) {
            store.putString(ReviewConfig.PREF_LAST_EVENT_ID, eventId)
            store.putInt(ReviewConfig.PREF_SUCCESS_COUNT, store.getInt(ReviewConfig.PREF_SUCCESS_COUNT) + 1)
        }
        val ask = ReviewPolicy.shouldAsk(
            alreadyAsked = false,
            successCount = store.getInt(ReviewConfig.PREF_SUCCESS_COUNT),
            positiveMoment = positiveMoment,
            fullscreenAdJustShown = fullscreenAdJustShown,
            inCriticalFlow = inCriticalFlow,
        )
        if (!ask) return false
        val attempted = runCatching { launch() }.getOrDefault(false)
        if (attempted) store.putBoolean(ReviewConfig.PREF_ASKED, true)
        return attempted
    }
}
