package com.futebadosparcas.platform

import kotlinx.cinterop.ExperimentalForeignApi
import platform.UIKit.UIActivityViewController
import platform.UIKit.UIApplication

/**
 * Implementação iOS de PlatformShare usando UIActivityViewController
 */
@OptIn(ExperimentalForeignApi::class)
class IOSPlatformShare : PlatformShare {

    override suspend fun share(text: String, url: String?, title: String?): Boolean {
        return try {
            val items = mutableListOf<Any>()
            items.add(text)
            url?.let { items.add(it) }

            val activityViewController = UIActivityViewController(
                activityItems = items,
                applicationActivities = null
            )

            val rootViewController = UIApplication.sharedApplication.keyWindow?.rootViewController
            rootViewController?.presentViewController(
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

    override suspend fun shareImage(uri: PlatformUri, text: String?, title: String?): Boolean {
        return try {
            val items = mutableListOf<Any>()
            items.add(uri.nsUrl)
            text?.let { items.add(it) }

            val activityViewController = UIActivityViewController(
                activityItems = items,
                applicationActivities = null
            )

            val rootViewController = UIApplication.sharedApplication.keyWindow?.rootViewController
            rootViewController?.presentViewController(
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

    override fun isSupported(): Boolean = true
}

/**
 * Factory iOS - sem dependências
 */
actual object PlatformShareFactory {
    actual fun create(): PlatformShare = IOSPlatformShare()
}
