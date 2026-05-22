package com.futebadosparcas.platform.releasenotes

import android.content.Context

/**
 * Implementação Android: lê `release-notes.json` de `assets/`.
 */
actual class ReleaseNotesAssetReader(private val context: Context) {

    actual fun readBundleJson(): String? = try {
        context.assets.open(ASSET_NAME).bufferedReader().use { it.readText() }
    } catch (_: Exception) {
        // Asset ausente ou ilegível — sem fallback embarcado.
        null
    }

    private companion object {
        const val ASSET_NAME = "release-notes.json"
    }
}
