package com.futebadosparcas.domain.monetization

/**
 * Uma oferta da assinatura como a Play devolve (`SubscriptionOfferDetails`), só com o que a escolha
 * precisa. `offerId == null` = a oferta base do plano (o preço cheio).
 */
data class PlayOfferCandidate(
    val basePlanId: String,
    val offerId: String?,
    val offerToken: String,
    val lastPhasePrice: String?,
)

/** A oferta que o app vende: token para a compra e o preço que aparece na tela. */
data class ChosenPlayOffer(val offerToken: String, val price: String)

/**
 * Escolha de propósito da oferta da assinatura no Google Play.
 *
 * Só serve a oferta base do plano anual (`offerId == null`). Ofertas criadas depois no Console
 * (teste grátis, desconto, win-back) a Play também devolve, para quem tiver direito: ficam de fora
 * até o app decidir usar cada uma. Sem a base, a resposta é "indisponível", nunca uma promoção.
 * O preço é o da última fase de preço, a que se repete (o que a pessoa paga todo ano).
 */
object PlayOfferSelection {
    fun choose(
        offers: List<PlayOfferCandidate>,
        basePlanId: String = MonetizationConfig.PLAY_BASE_PLAN_ANUAL,
    ): ChosenPlayOffer? {
        val base = offers.firstOrNull { it.basePlanId == basePlanId && it.offerId == null && it.offerToken.isNotEmpty() }
            ?: return null
        val price = base.lastPhasePrice?.takeIf { it.isNotBlank() } ?: return null
        return ChosenPlayOffer(base.offerToken, price)
    }
}
