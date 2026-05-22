package com.futebadosparcas.platform.storage

import platform.Foundation.NSUserDefaults

/**
 * Implementação iOS do [LastSeenVersionStore] via `NSUserDefaults`.
 *
 * `integerForKey` retorna `0` quando a chave não existe — exatamente o valor
 * padrão desejado para uma instalação nova.
 */
actual class LastSeenVersionStore {

    private val userDefaults = NSUserDefaults.standardUserDefaults

    actual suspend fun getLastSeenBuild(): Int =
        userDefaults.integerForKey(KEY_LAST_SEEN_BUILD).toInt()

    actual suspend fun setLastSeenBuild(build: Int) {
        userDefaults.setInteger(build.toLong(), forKey = KEY_LAST_SEEN_BUILD)
        userDefaults.synchronize()
    }

    private companion object {
        const val KEY_LAST_SEEN_BUILD = "last_seen_release_build"
    }
}
