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
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.Coil

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

        // Configure Coil for optimal image loading performance
        val imageLoader = ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.25) // 25% da memória disponível
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizeBytes(50 * 1024 * 1024) // 50MB
                    .build()
            }
            .crossfade(true) // Transições suaves
            .respectCacheHeaders(false) // Não respeitar headers de cache do servidor
            .build()

        Coil.setImageLoader(imageLoader)

        // Apply saved theme preference (default: light)
        val theme = preferencesManager.getThemePreference()
        ThemeHelper.applyTheme(theme)

        // Schedule cache cleanup worker (every 12 hours)
        CacheCleanupWorker.schedule(this)
    }
}
