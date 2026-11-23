package com.futebadosparcas.platform.review

/**
 * Dispara o pedido de avaliação nativo da loja.
 *
 * - Android: Play In-App Review (`ReviewManager`).
 * - iOS: `SKStoreReviewController`.
 *
 * Erros são engolidos. Devolve `true` só quando houve tentativa real de mostrar o pedido
 * (a loja decide se exibe; a cota é dela).
 */
expect class NativeReviewLauncher {
    suspend fun launch(): Boolean
}
