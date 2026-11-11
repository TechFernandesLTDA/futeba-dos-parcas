package com.futebadosparcas.monetization

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.futebadosparcas.domain.monetization.AdsFreeEntitlement
import com.futebadosparcas.domain.monetization.MonetizationConfig
import com.futebadosparcas.domain.monetization.StoreAnswer
import com.futebadosparcas.domain.monetization.StorePurchase
import com.futebadosparcas.domain.monetization.StorePurchaseState
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull

/** Preço e oferta da assinatura anual, como a Play devolve. */
data class SubscriptionOffer(val price: String)

sealed interface PurchaseEvent {
    data object Completed : PurchaseEvent
    data object Pending : PurchaseEvent
    data object Cancelled : PurchaseEvent
    data class Failed(val code: Int) : PurchaseEvent
}

/**
 * Play Billing para a assinatura anual `sem_anuncios_anual` (plano básico `anual`).
 *
 * - O resultado da compra chega por evento ([purchaseEvents]), não pelo retorno de [launchPurchase].
 * - Compra paga e não confirmada é confirmada (acknowledge) na hora, senão o Google estorna em 3 dias.
 * - Toda consulta tem prazo: sem internet ou sem Play Store a conexão pode ficar pendurada.
 * - Sem a loja (app fora da Play, sem conta Google) a resposta é [StoreAnswer.Unavailable], que
 *   nunca revoga o direito já guardado.
 */
class PlayBillingManager(context: Context) {

    private val appContext = context.applicationContext
    private val connectMutex = Mutex()
    private var productDetails: ProductDetails? = null
    private var offerToken: String? = null

    private val _purchaseEvents = MutableSharedFlow<PurchaseEvent>(extraBufferCapacity = 8)
    val purchaseEvents: SharedFlow<PurchaseEvent> = _purchaseEvents.asSharedFlow()

    private val purchasesListener = PurchasesUpdatedListener { result, purchases ->
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> handlePurchases(purchases.orEmpty())
            BillingClient.BillingResponseCode.USER_CANCELED -> _purchaseEvents.tryEmit(PurchaseEvent.Cancelled)
            else -> _purchaseEvents.tryEmit(PurchaseEvent.Failed(result.responseCode))
        }
    }

    private val client: BillingClient = BillingClient.newBuilder(appContext)
        .setListener(purchasesListener)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .build()

    private suspend fun ensureConnected(): Boolean = connectMutex.withLock {
        if (client.isReady) return@withLock true
        val done = CompletableDeferred<Boolean>()
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                done.complete(result.responseCode == BillingClient.BillingResponseCode.OK)
            }

            override fun onBillingServiceDisconnected() {
                done.complete(false)
            }
        })
        withTimeoutOrNull(PRAZO_LOJA_MS) { done.await() } ?: false
    }

    /** Busca preço e oferta. `null` = indisponível (sem rede, sem Play, plano não propagado). */
    suspend fun loadOffer(): SubscriptionOffer? {
        if (!ensureConnected()) return null
        val query = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(MonetizationConfig.PRODUCT_ID_SEM_ANUNCIOS_ANUAL)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                )
            )
            .build()
        val done = CompletableDeferred<List<ProductDetails>>()
        client.queryProductDetailsAsync(query) { result, details ->
            done.complete(
                if (result.responseCode == BillingClient.BillingResponseCode.OK) details.productDetailsList else emptyList()
            )
        }
        val product = withTimeoutOrNull(PRAZO_LOJA_MS) { done.await() }
            ?.firstOrNull { it.productId == MonetizationConfig.PRODUCT_ID_SEM_ANUNCIOS_ANUAL }
            ?: return null
        val offer = product.subscriptionOfferDetails
            ?.firstOrNull { it.basePlanId == MonetizationConfig.PLAY_BASE_PLAN_ANUAL && it.offerId == null }
            ?: product.subscriptionOfferDetails?.firstOrNull { it.basePlanId == MonetizationConfig.PLAY_BASE_PLAN_ANUAL }
            ?: return null
        val price = offer.pricingPhases.pricingPhaseList.lastOrNull()?.formattedPrice ?: return null
        productDetails = product
        offerToken = offer.offerToken
        return SubscriptionOffer(price)
    }

    /** Abre a tela de compra da Play. O resultado vem em [purchaseEvents]. */
    fun launchPurchase(activity: Activity): Boolean {
        val details = productDetails ?: return false
        val token = offerToken ?: return false
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(
                listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(details)
                        .setOfferToken(token)
                        .build()
                )
            )
            .build()
        return client.launchBillingFlow(activity, params).responseCode == BillingClient.BillingResponseCode.OK
    }

    /**
     * Lê as assinaturas ativas da conta da Play (serve de "Restaurar compras" e de conferência
     * na abertura). Confirma a paga e ainda não confirmada.
     */
    suspend fun queryEntitlement(): StoreAnswer {
        if (!ensureConnected()) return StoreAnswer.Unavailable
        val done = CompletableDeferred<List<Purchase>?>()
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
        ) { result, purchases ->
            done.complete(if (result.responseCode == BillingClient.BillingResponseCode.OK) purchases else null)
        }
        val purchases = withTimeoutOrNull(PRAZO_LOJA_MS) { done.await() } ?: return StoreAnswer.Unavailable
        val mapped = purchases.flatMap { purchase -> purchase.products.map { id -> id to purchase } }
            .map { (id, purchase) -> toStorePurchase(id, purchase) }
        purchases.forEach { acknowledgeIfNeeded(it) }
        return StoreAnswer.Answered(mapped)
    }

    private fun handlePurchases(purchases: List<Purchase>) {
        val ours = purchases.filter { MonetizationConfig.PRODUCT_ID_SEM_ANUNCIOS_ANUAL in it.products }
        when {
            ours.any { it.purchaseState == Purchase.PurchaseState.PURCHASED } -> {
                ours.forEach { acknowledgeIfNeeded(it) }
                _purchaseEvents.tryEmit(PurchaseEvent.Completed)
            }
            ours.any { it.purchaseState == Purchase.PurchaseState.PENDING } ->
                _purchaseEvents.tryEmit(PurchaseEvent.Pending)
            else -> _purchaseEvents.tryEmit(PurchaseEvent.Cancelled)
        }
    }

    private fun toStorePurchase(productId: String, purchase: Purchase) = StorePurchase(
        productId = productId,
        state = when (purchase.purchaseState) {
            Purchase.PurchaseState.PURCHASED -> StorePurchaseState.PURCHASED
            Purchase.PurchaseState.PENDING -> StorePurchaseState.PENDING
            else -> StorePurchaseState.UNKNOWN
        },
        suspended = purchase.isSuspended,
        acknowledged = purchase.isAcknowledged,
    )

    private fun acknowledgeIfNeeded(purchase: Purchase) {
        val mapped = purchase.products.map { toStorePurchase(it, purchase) }
        if (mapped.none { AdsFreeEntitlement.needsAcknowledge(it) }) return
        client.acknowledgePurchase(
            AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()
        ) { result ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                // A próxima abertura do app tenta de novo (queryEntitlement confirma).
                AppLogger.w(TAG) { "Falha ao confirmar assinatura: ${result.responseCode}" }
            }
        }
    }

    private companion object {
        const val TAG = "PlayBillingManager"
        const val PRAZO_LOJA_MS = 10_000L
    }
}
