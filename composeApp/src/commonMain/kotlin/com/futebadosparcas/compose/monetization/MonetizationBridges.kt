package com.futebadosparcas.compose.monetization

/**
 * Pontes entre o Kotlin compartilhado (composeApp) e os SDKs nativos do iOS, que o Kotlin não
 * alcança: Google Mobile Ads + UMP (Swift) e StoreKit 2 (Swift, só async). O Swift implementa
 * estas interfaces em `iosApp/iosApp/Services/` e entrega ao `MainViewController` na abertura.
 *
 * Tudo aqui é em callbacks simples, sem tipos de plataforma, para sair limpo no Swift.
 */

/** Resposta da loja (StoreKit 2). */
enum class StoreOutcome {
    /** Assinatura nossa ativa. */
    ACTIVE,

    /** A loja respondeu e não há assinatura nossa ativa. */
    NONE,

    /** Compra paga, mas pendente (Ask to Buy, SCA). Não libera nem revoga. */
    PENDING,

    /** Sem loja, sem rede, erro: nunca revoga o direito guardado. */
    UNAVAILABLE,

    /** Pessoa fechou a folha de compra. */
    CANCELLED,

    /** Erro na compra. */
    FAILED,
}

interface StoreBridge {
    /** Preço anual localizado (`displayPrice` da loja) ou `null` se o produto não carregou. */
    fun loadPriceLabel(callback: (String?) -> Unit)

    /** Abre a folha de compra da assinatura. Responde ACTIVE, PENDING, CANCELLED ou FAILED. */
    fun purchase(callback: (StoreOutcome) -> Unit)

    /** "Restaurar compra" (sincroniza com a App Store). Responde ACTIVE, NONE ou UNAVAILABLE. */
    fun restore(callback: (StoreOutcome) -> Unit)

    /** Confere o direito na abertura, sem pedir login. Responde ACTIVE, NONE, PENDING ou UNAVAILABLE. */
    fun currentEntitlement(callback: (StoreOutcome) -> Unit)

    /** Abre a tela de assinaturas do iPhone. */
    fun manageSubscriptions()
}

interface AdsBridge {
    /** `false` quando o app não tem ID de unidade (config de build vazia): então nada inicia. */
    val unitConfigured: Boolean

    /** O iOS pede a opção "Opções de privacidade" do UMP nesta região. */
    val privacyOptionsRequired: Boolean

    /**
     * Fluxo completo, só depois da primeira vitória e sem assinatura: formulário de
     * consentimento do Google (UMP, se a região exigir), pedido de rastreamento (ATT) e então
     * inicia o SDK. [onResult] recebe se já pode pedir anúncios e o estado do ATT:
     * 1 = autorizado, 0 = negado/restrito, -1 = não decidido.
     */
    fun startAds(onResult: (canRequestAds: Boolean, attStatus: Int) -> Unit)

    fun showPrivacyOptions(onClosed: () -> Unit)
}
