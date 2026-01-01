package com.futebadosparcas

import android.app.Application
import com.futebadosparcas.util.PreferencesManager
import com.futebadosparcas.util.ThemeHelper
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory
import com.futebadosparcas.BuildConfig

@HiltAndroidApp
class FutebaApplication : Application() {

    @Inject
    lateinit var preferencesManager: PreferencesManager

    override fun onCreate() {
        super.onCreate()

        // Initialize ThreeTenABP for date/time handling
        // AndroidThreeTen.init(this) // Removed: Migrated to java.time

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

        // Apply saved theme preference (default: system)
        val theme = preferencesManager.getThemePreference()
        ThemeHelper.applyTheme(theme)
    }
}
