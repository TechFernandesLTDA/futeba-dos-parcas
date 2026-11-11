package com.futebadosparcas.domain.monetization

enum class StorePurchaseState { PURCHASED, PENDING, UNKNOWN }

/** Compra devolvida pela loja (Play Billing ou StoreKit 2), já reduzida ao que importa aqui. */
data class StorePurchase(
    val productId: String,
    val state: StorePurchaseState,
    /** Pagamento suspenso (cartão recusado, Play). Suspensa não vale como "sem anúncios". */
    val suspended: Boolean = false,
    /** Android: compra paga ainda não confirmada (acknowledge). Sem confirmar, o Google estorna em 3 dias. */
    val acknowledged: Boolean = true,
)

/** O que a loja respondeu. [Unavailable] = sem rede, sem loja, erro: nunca revoga nada. */
sealed interface StoreAnswer {
    data class Answered(val purchases: List<StorePurchase>) : StoreAnswer
    data object Unavailable : StoreAnswer
}

enum class EntitlementDecision { GRANT, REVOKE, KEEP }

/**
 * Decide o direito "Sem anúncios" a partir da resposta da loja. Porte da conferência de
 * compras do Cuidia (`compras.ts`):
 *
 * - achou assinatura NOSSA paga e sem pagamento suspenso: libera;
 * - a loja RESPONDEU e não há nenhum registro nosso, ou só com pagamento suspenso: revoga
 *   (assinatura vencida, cancelada ao fim do ano, reembolso);
 * - loja indisponível, compra pendente ou estado desconhecido: mantém o que o aparelho já
 *   tinha, nunca revoga por dúvida.
 */
object AdsFreeEntitlement {

    fun isOurs(purchase: StorePurchase): Boolean =
        purchase.productId == MonetizationConfig.PRODUCT_ID_SEM_ANUNCIOS_ANUAL

    /** Vale como "sem anúncios": paga (não pendente) e sem pagamento suspenso. */
    fun isValid(purchase: StorePurchase): Boolean =
        isOurs(purchase) && purchase.state == StorePurchaseState.PURCHASED && !purchase.suspended

    fun decide(answer: StoreAnswer): EntitlementDecision {
        if (answer !is StoreAnswer.Answered) return EntitlementDecision.KEEP
        if (answer.purchases.any(::isValid)) return EntitlementDecision.GRANT
        // Pendente ou estado desconhecido de uma compra nossa: espera a próxima abertura.
        val doubt = answer.purchases.any { purchase ->
            isOurs(purchase) && !purchase.suspended && purchase.state != StorePurchaseState.PURCHASED
        }
        return if (doubt) EntitlementDecision.KEEP else EntitlementDecision.REVOKE
    }

    /** Compra nossa, paga e ainda não confirmada: confirmar agora (Android). */
    fun needsAcknowledge(purchase: StorePurchase): Boolean = isValid(purchase) && !purchase.acknowledged
}
