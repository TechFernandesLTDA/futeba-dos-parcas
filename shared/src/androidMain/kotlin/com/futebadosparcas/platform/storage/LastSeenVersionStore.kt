package com.futebadosparcas.platform.storage

import android.content.Context
import android.content.SharedPreferences

/**
 * Implementação Android do [LastSeenVersionStore] via `SharedPreferences`.
 */
actual class LastSeenVersionStore(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("futeba_prefs", Context.MODE_PRIVATE)

    actual suspend fun getLastSeenBuild(): Int =
        prefs.getInt(KEY_LAST_SEEN_BUILD, 0)

    actual suspend fun setLastSeenBuild(build: Int) {
        prefs.edit().putInt(KEY_LAST_SEEN_BUILD, build).apply()
    }

    private companion object {
        const val KEY_LAST_SEEN_BUILD = "last_seen_release_build"
    }
}
