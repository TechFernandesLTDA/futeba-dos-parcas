package com.futebadosparcas.domain.monetization

/**
 * Regras de quando o app pode inicializar o SDK de anúncios, pedir consentimento e mostrar
 * o banner. Mesma lógica de produto dos outros apps TECHFERNANDES:
 *
 * - quem assina "Sem anúncios" nunca vê anúncio, nem formulário de consentimento, nem o
 *   pedido de rastreamento da Apple (ATT), e o SDK nem é inicializado;
 * - login, push e anúncio só depois da primeira vitória (primeira presença confirmada ou
 *   primeiro jogo criado);
 * - o banner só aparece em telas da lista de permissão ([AdsPolicy]);
 * - sem unidade de anúncio configurada (config de build vazia) não há SDK nem banner.
 */
object AdsGate {

    /** O SDK só começa (e o UMP/ATT só aparecem) depois da primeira vitória e sem assinatura. */
    fun shouldStartAds(adsFree: Boolean, firstWinReached: Boolean, unitConfigured: Boolean): Boolean =
        !adsFree && firstWinReached && unitConfigured

    /** O banner aparece quando o SDK pode pedir anúncios, a tela permite e o consentimento deixa. */
    fun shouldShowBanner(
        adsFree: Boolean,
        firstWinReached: Boolean,
        unitConfigured: Boolean,
        canRequestAds: Boolean,
        route: String?,
    ): Boolean =
        shouldStartAds(adsFree, firstWinReached, unitConfigured) &&
            canRequestAds &&
            AdsPolicy.isBannerRouteAllowed(route)

    /**
     * Anúncio não personalizado: sempre, enquanto [MonetizationConfig.ALLOW_PERSONALIZED_ADS] for
     * falso (contas de 13 a 17 anos, sem verificação de idade). Se um dia for liberado, vale a
     * recusa do ATT no iOS ([attAuthorized] `false`); `null` = fora do iOS ou antes do pedido.
     */
    fun requestNonPersonalized(
        attAuthorized: Boolean?,
        personalizedAllowed: Boolean = MonetizationConfig.ALLOW_PERSONALIZED_ADS,
    ): Boolean = !personalizedAllowed || attAuthorized == false
}
