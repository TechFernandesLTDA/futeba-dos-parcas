package com.futebadosparcas

import android.app.Application
import com.futebadosparcas.util.PreferencesManager
import com.futebadosparcas.util.ThemeHelper
import com.jakewharton.threetenabp.AndroidThreeTen
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory

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
        firebaseAppCheck.installAppCheckProviderFactory(
            PlayIntegrityAppCheckProviderFactory.getInstance()
        )

        // Apply saved theme preference (default: system)
        val theme = preferencesManager.getThemePreference()
        ThemeHelper.applyTheme(theme)
    }
}
