package com.futebadosparcas.platform

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import platform.UIKit.UIActivityViewController
import platform.UIKit.UIApplication
import platform.UIKit.UIWindow
import platform.UIKit.UIWindowScene

/**
 * Implementação iOS de PlatformShare usando UIActivityViewController.
 *
 * IMPORTANTE: UIKit exige main thread para todas as operações de UI.
 * Usar withContext(Dispatchers.Main) garante isso independente do dispatcher
 * do caller (issue #876).
 *
 * keyWindow está deprecated desde iOS 13. Usa connectedScenes para obter
 * o rootViewController da cena ativa de forma correta (issue #876).
 */
@OptIn(ExperimentalForeignApi::class)
class IOSPlatformShare : PlatformShare {

    /**
     * Retorna o rootViewController da janela ativa (iOS 13+).
     * Itera connectedScenes → UIWindowScene ativo → janela chave → rootViewController.
     */
    @Suppress("UNCHECKED_CAST")
    private fun activeRootViewController() =
        (UIApplication.sharedApplication.connectedScenes
            .filterIsInstance<UIWindowScene>()
            .firstOrNull { it.activationState == platform.UIKit.UISceneActivationStateForegroundActive }
            ?.windows as? Set<UIWindow>)
            ?.firstOrNull { it.isKeyWindow() }
            ?.rootViewController

    override suspend fun share(text: String, url: String?, title: String?): Boolean {
        return withContext(Dispatchers.Main) {
            try {
                val items = mutableListOf<Any>()
                items.add(text)
                url?.let { items.add(it) }

                val activityViewController = UIActivityViewController(
                    activityItems = items,
                    applicationActivities = null
                )

                activeRootViewController()?.presentViewController(
                    activityViewController,
                    animated = true,
                    completion = null
                )

                true
            } catch (e: Exception) {
                e.printStackTrace()
                false
            }
        }
    }

    override suspend fun shareImage(uri: PlatformUri, text: String?, title: String?): Boolean {
        return withContext(Dispatchers.Main) {
            try {
                val items = mutableListOf<Any>()
                items.add(uri.nsUrl)
                text?.let { items.add(it) }

                val activityViewController = UIActivityViewController(
                    activityItems = items,
                    applicationActivities = null
                )

                activeRootViewController()?.presentViewController(
                    activityViewController,
                    animated = true,
                    completion = null
                )

                true
            } catch (e: Exception) {
                e.printStackTrace()
                false
            }
        }
    }

    override fun isSupported(): Boolean = true
}

/**
 * Factory iOS - sem dependências
 */
actual object PlatformShareFactory {
    actual fun create(): PlatformShare = IOSPlatformShare()
}
