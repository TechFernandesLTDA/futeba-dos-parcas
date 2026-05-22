package com.futebadosparcas.platform.releasenotes

import platform.Foundation.NSBundle
import platform.Foundation.NSString
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.stringWithContentsOfFile

/**
 * Implementação iOS: lê `release-notes.json` empacotado no app bundle.
 *
 * Se o recurso não estiver no bundle (ex.: empacotamento ainda não ajustado),
 * retorna `null` e o repositório segue só com o Firestore — o wiring/verificação
 * do bundle iOS é feito na Fase G (smoke test no iOS Simulator).
 */
actual class ReleaseNotesAssetReader {

    actual fun readBundleJson(): String? {
        val path = NSBundle.mainBundle.pathForResource(RESOURCE_NAME, RESOURCE_EXT)
            ?: return null
        return NSString.stringWithContentsOfFile(path, NSUTF8StringEncoding, null)
    }

    private companion object {
        const val RESOURCE_NAME = "release-notes"
        const val RESOURCE_EXT = "json"
    }
}
