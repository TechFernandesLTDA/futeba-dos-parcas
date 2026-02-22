package com.futebadosparcas.platform

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider

/**
 * Implementação Android de PlatformShare usando Intent.ACTION_SEND
 */
class AndroidPlatformShare(private val context: Context) : PlatformShare {

    override suspend fun share(text: String, url: String?, title: String?): Boolean {
        return try {
            val shareText = if (url != null) "$text\n$url" else text

            val sendIntent = Intent().apply {
                action = Intent.ACTION_SEND
                putExtra(Intent.EXTRA_TEXT, shareText)
                title?.let { putExtra(Intent.EXTRA_TITLE, it) }
                type = "text/plain"
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            val chooserIntent = Intent.createChooser(sendIntent, title ?: "Compartilhar")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

            context.startActivity(chooserIntent)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    override suspend fun shareImage(uri: PlatformUri, text: String?, title: String?): Boolean {
        return try {
            val sendIntent = Intent().apply {
                action = Intent.ACTION_SEND
                putExtra(Intent.EXTRA_STREAM, uri.uri)
                text?.let { putExtra(Intent.EXTRA_TEXT, it) }
                title?.let { putExtra(Intent.EXTRA_TITLE, it) }
                type = "image/*"
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooserIntent = Intent.createChooser(sendIntent, title ?: "Compartilhar imagem")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

            context.startActivity(chooserIntent)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    override fun isSupported(): Boolean = true
}

/**
 * Factory Android - requer Context
 */
actual object PlatformShareFactory {
    private var contextProvider: (() -> Context)? = null

    /**
     * Inicializar com um Context provider (deve ser chamado no Application.onCreate())
     */
    fun initialize(provider: () -> Context) {
        contextProvider = provider
    }

    actual fun create(): PlatformShare {
        val context = contextProvider?.invoke()
            ?: throw IllegalStateException("PlatformShareFactory não foi inicializado. Chame initialize() no Application.onCreate()")
        return AndroidPlatformShare(context)
    }
}
