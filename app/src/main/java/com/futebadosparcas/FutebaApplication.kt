package com.futebadosparcas

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.futebadosparcas.data.local.CacheCleanupWorker
import com.futebadosparcas.util.PreferencesManager
import com.futebadosparcas.util.ThemeHelper
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory

@HiltAndroidApp
class FutebaApplication : Application(), Configuration.Provider {

    @Inject
    lateinit var preferencesManager: PreferencesManager

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()

        // Initialize Firebase App Check
        FirebaseApp.initializeApp(this)
        val firebaseAppCheck = FirebaseAppCheck.getInstance()

        if (BuildConfig.DEBUG) {
            firebaseAppCheck.installAppCheckProviderFactory(
                DebugAppCheckProviderFactory.getInstance()
            )
        } else {
            firebaseAppCheck.installAppCheckProviderFactory(
                PlayIntegrityAppCheckProviderFactory.getInstance()
            )
        }

        // Apply saved theme preference (default: light)
        val theme = preferencesManager.getThemePreference()
        ThemeHelper.applyTheme(theme)

        // Schedule cache cleanup worker (every 12 hours)
        CacheCleanupWorker.schedule(this)
    }
}
