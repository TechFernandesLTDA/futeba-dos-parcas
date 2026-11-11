package com.futebadosparcas.domain.monetization

/**
 * Constantes da monetização do Futeba dos Parças: banner AdMob (Android/iOS) e a
 * assinatura anual "Sem anúncios", a mesma lógica de produto dos outros apps TECHFERNANDES.
 *
 * Nada aqui é segredo. O ID do app e das unidades do AdMob NÃO ficam aqui: são config de
 * build (Android: `local.properties`/Gradle; iOS: xcconfig por configuração), ver
 * `docs/MONETIZACAO.md`.
 */
object MonetizationConfig {
    /** ID do produto, igual no Google Play e na App Store (não dá para mudar depois). */
    const val PRODUCT_ID_SEM_ANUNCIOS_ANUAL = "sem_anuncios_anual"

    /** ID do plano básico da assinatura no Google Play. */
    const val PLAY_BASE_PLAN_ANUAL = "anual"

    /** Preço de referência (R$ por ano). A tela sempre mostra o preço que a LOJA devolve. */
    const val PRECO_REFERENCIA_BRL = "R$ 9,90"

    const val PRIVACY_POLICY_URL = "https://futebadosparcas.com.br/privacy_policy.html"
    const val TERMS_OF_SERVICE_URL = "https://futebadosparcas.com.br/terms_of_service.html"

    /** EULA padrão da Apple (diretriz 3.1.2): os termos de uso da assinatura no iOS. */
    const val APPLE_STANDARD_EULA_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"

    /** Onde o assinante cancela. */
    const val PLAY_SUBSCRIPTIONS_URL = "https://play.google.com/store/account/subscriptions"
    const val APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions"

    /** Chaves de preferência (aparelho). Nunca guardam dado pessoal. */
    const val PREF_FIRST_WIN = "monetizacao.primeira_vitoria"
    const val PREF_ADS_FREE = "monetizacao.sem_anuncios"
    const val PREF_ATT_ASKED = "monetizacao.att_pedido"
}
