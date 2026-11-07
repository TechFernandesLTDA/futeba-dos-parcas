package com.futebadosparcas.ui.account

import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import platform.Foundation.NSString
import platform.Foundation.NSTemporaryDirectory
import platform.Foundation.NSURL
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.create
import platform.Foundation.writeToFile
import platform.UIKit.UIActivityViewController
import platform.UIKit.UIApplication
import platform.UIKit.UISceneActivationStateForegroundActive
import platform.UIKit.UIWindow
import platform.UIKit.UIWindowScene
import platform.UIKit.popoverPresentationController

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
actual suspend fun shareExportedJsonFile(fileName: String, json: String): Boolean =
    withContext(Dispatchers.Main) {
        try {
            val safeName = fileName.replace("/", "_")
            val baseDir = NSTemporaryDirectory().trimEnd('/')
            val filePath = "$baseDir/$safeName"
            val nsString = NSString.create(string = json)
            val written = nsString.writeToFile(
                path = filePath,
                atomically = true,
                encoding = NSUTF8StringEncoding,
                error = null
            )
            if (!written) return@withContext false

            val fileUrl = NSURL.fileURLWithPath(filePath)
            val rootViewController = activeRootViewController() ?: return@withContext false

            val activityViewController = UIActivityViewController(
                activityItems = listOf(fileUrl),
                applicationActivities = null
            )
            activityViewController.popoverPresentationController?.sourceView = rootViewController.view

            rootViewController.presentViewController(
                activityViewController,
                animated = true,
                completion = null
            )
            true
        } catch (_: Exception) {
            false
        }
    }

@Suppress("UNCHECKED_CAST")
private fun activeRootViewController() =
    (UIApplication.sharedApplication.connectedScenes
        .filterIsInstance<UIWindowScene>()
        .firstOrNull { it.activationState == UISceneActivationStateForegroundActive }
        ?.windows as? List<UIWindow>)
        ?.firstOrNull { it.isKeyWindow() }
        ?.rootViewController
        ?: (UIApplication.sharedApplication.connectedScenes
            .filterIsInstance<UIWindowScene>()
            .firstOrNull()
            ?.windows as? List<UIWindow>)
            ?.firstOrNull()
            ?.rootViewController
