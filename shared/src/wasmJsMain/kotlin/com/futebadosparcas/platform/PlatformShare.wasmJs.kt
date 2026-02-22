package com.futebadosparcas.platform

import kotlinx.coroutines.await

/**
 * Implementação Web de PlatformShare usando Web Share API (navigator.share)
 *
 * Referências:
 * - [Kotlin/Wasm JS Interop](https://kotlinlang.org/docs/wasm-js-interop.html)
 * - [Web Share API](https://w3c.github.io/web-share/)
 * - [Promise.await() wasmJs](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/await.html)
 *
 * External declarations estão em BrowserExternals.kt
 */
class WebPlatformShare : PlatformShare {

    override suspend fun share(text: String, url: String?, title: String?): Boolean {
        return try {
            if (!isSupported()) {
                // Fallback: copiar para clipboard
                copyToClipboard("$text ${url ?: ""}")
                return true
            }

            val shareData = createShareData(text, url ?: "", title ?: "")

            // Chamar navigator.share() e aguardar Promise
            navigator.share(shareData).await<Unit>()
            true
        } catch (e: Throwable) {
            // Fallback: copiar para clipboard
            try {
                copyToClipboard("$text ${url ?: ""}")
            } catch (clipboardError: Throwable) {
                // Silenciosamente falhar se clipboard também falhar
            }
            false
        }
    }

    override suspend fun shareImage(uri: PlatformUri, text: String?, title: String?): Boolean {
        return try {
            if (!isSupported()) {
                // Fallback: abrir imagem em nova janela via js()
                openInNewWindow(uri.asString())
                return true
            }

            // Web Share API Level 2 suporta files
            // Por ora, compartilhar apenas o URL da imagem
            share(text ?: "", uri.asString(), title)
        } catch (e: Throwable) {
            false
        }
    }

    override fun isSupported(): Boolean {
        return try {
            hasShareSupport()
        } catch (e: Throwable) {
            false
        }
    }

    private suspend fun copyToClipboard(text: String) {
        try {
            navigator.clipboard.writeText(text).await<Unit>()
        } catch (e: Throwable) {
            // Fallback silencioso - clipboard pode estar bloqueado
        }
    }
}

/**
 * Factory Web - sem dependências
 */
actual object PlatformShareFactory {
    actual fun create(): PlatformShare = WebPlatformShare()
}
