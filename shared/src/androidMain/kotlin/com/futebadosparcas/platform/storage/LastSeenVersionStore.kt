package com.futebadosparcas.platform.storage

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Implementação Android do [LastSeenVersionStore] via `SharedPreferences`.
 */
actual class LastSeenVersionStore(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("futeba_prefs", Context.MODE_PRIVATE)

    actual suspend fun getLastSeenBuild(): Int = withContext(Dispatchers.IO) {
        prefs.getInt(KEY_LAST_SEEN_BUILD, 0)
    }

    actual suspend fun setLastSeenBuild(build: Int) {
        // commit() (síncrono) em vez de apply(): o marcador "último build visto"
        // precisa sobreviver a morte de processo e a Activity.recreate() logo
        // após fechar o pop-up — caso contrário ele poderia reaparecer.
        withContext(Dispatchers.IO) {
            prefs.edit().putInt(KEY_LAST_SEEN_BUILD, build).commit()
        }
    }

    private companion object {
        const val KEY_LAST_SEEN_BUILD = "last_seen_release_build"
    }
}
