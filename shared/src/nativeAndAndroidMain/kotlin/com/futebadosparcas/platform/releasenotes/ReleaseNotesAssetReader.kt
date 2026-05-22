package com.futebadosparcas.platform.releasenotes

/**
 * Lê o JSON de release notes **embarcado no build** (fallback offline — spec §3.8).
 *
 * O arquivo é gerado por `scripts/release-notes.js bundle`:
 * - Android: `app/src/main/assets/release-notes.json`.
 * - iOS: recurso `release-notes.json` empacotado no app bundle.
 *
 * Expect/actual vive em `nativeAndAndroidMain` porque só Android e iOS têm um
 * fallback embarcado; a Web replica a leitura separadamente (spec §3.6).
 */
expect class ReleaseNotesAssetReader {

    /** Conteúdo cru do JSON embarcado, ou `null` se ausente/ilegível. */
    fun readBundleJson(): String?
}
