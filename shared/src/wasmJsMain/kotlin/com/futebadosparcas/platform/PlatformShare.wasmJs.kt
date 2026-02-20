package com.futebadosparcas.platform

import kotlinx.coroutines.await
import kotlin.js.Promise

/**
 * Implementação Web de PlatformShare usando Web Share API (navigator.share)
 */
class WebPlatformShare : PlatformShare {

    override suspend fun share(text: String, url: String?, title: String?): Boolean {
        return try {
            if (!isSupported()) {
                // Fallback: copiar para clipboard ou abrir em nova janela
                copyToClipboard("$text ${url ?: ""}")
                return true
            }

            val data = js("({})")
            data["text"] = text
            url?.let { data["url"] = it }
            title?.let { data["title"] = it }

            // Chamar navigator.share() e aguardar Promise
            val sharePromise = js("navigator.share(data)") as Promise<Unit>
            sharePromise.await()
            true
        } catch (e: Throwable) {
            e.printStackTrace()
            // Fallback: copiar para clipboard
            copyToClipboard("$text ${url ?: ""}")
            false
        }
    }

    override suspend fun shareImage(uri: PlatformUri, text: String?, title: String?): Boolean {
        return try {
            if (!isSupported()) {
                // Fallback: abrir imagem em nova janela
                js("window.open(uri.asString(), '_blank')")
                return true
            }

            // Web Share API Level 2 suporta files
            // Por ora, compartilhar apenas o URL da imagem
            share(text ?: "", uri.asString(), title)
        } catch (e: Throwable) {
            e.printStackTrace()
            false
        }
    }

    override fun isSupported(): Boolean {
        return try {
            js("'share' in navigator") as Boolean
        } catch (e: Throwable) {
            false
        }
    }

    private fun copyToClipboard(text: String) {
        try {
            js("navigator.clipboard.writeText(text)")
        } catch (e: Throwable) {
            // Fallback silencioso
        }
    }
}

/**
 * Factory Web - sem dependências
 */
actual object PlatformShareFactory {
    actual fun create(): PlatformShare = WebPlatformShare()
}
