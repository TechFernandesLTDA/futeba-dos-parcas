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
    /** ID do produto no Google Play (cada app do Play tem os próprios IDs). */
    const val PRODUCT_ID_SEM_ANUNCIOS_ANUAL = "sem_anuncios_anual"

    /**
     * ID do produto na App Store. Diferente do Play: a App Store Connect não deixa reusar na mesma
     * conta Apple o `sem_anuncios_anual` que já é do Cuidia. Não dá para mudar depois.
     */
    const val PRODUCT_ID_IOS_SEM_ANUNCIOS_ANUAL = "futeba_sem_anuncios_anual"

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

    /**
     * Anúncios personalizados. DESLIGADO de propósito: o app aceita contas de 13 a 17 anos e a
     * política de privacidade promete "sem publicidade direcionada" para menores (LGPD art. 14 e
     * Estatuto Digital da Criança e do Adolescente, Lei 15.211/2025). Como a data de nascimento é
     * opcional e a idade não é verificada, todo pedido de anúncio é NÃO personalizado, em todas
     * as plataformas. Mudar isso exige decisão do Renan e revisão jurídica (docs/MONETIZACAO.md).
     */
    const val ALLOW_PERSONALIZED_ADS = false

    /** Chaves de preferência (aparelho). Nunca guardam dado pessoal. */
    const val PREF_FIRST_WIN = "monetizacao.primeira_vitoria"
    const val PREF_ADS_FREE = "monetizacao.sem_anuncios"
    const val PREF_ATT_ASKED = "monetizacao.att_pedido"
}
