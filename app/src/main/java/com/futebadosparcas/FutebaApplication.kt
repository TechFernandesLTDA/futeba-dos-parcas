package com.futebadosparcas

import android.app.Application
import androidx.work.Configuration
import coil.Coil
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.futebadosparcas.data.local.CacheCleanupWorker
import com.futebadosparcas.di.koin.allKoinModules
import com.futebadosparcas.util.PreferencesManager
import com.futebadosparcas.util.ThemeHelper
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import org.koin.android.ext.android.inject
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.androidx.workmanager.factory.KoinWorkerFactory
import org.koin.androidx.workmanager.koin.workManagerFactory
import org.koin.core.context.startKoin

class FutebaApplication : Application(), Configuration.Provider {

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(KoinWorkerFactory())
            .build()

    override fun onCreate() {
        super.onCreate()

        // Inicializar Koin
        startKoin {
            androidLogger()
            androidContext(this@FutebaApplication)
            workManagerFactory()
            modules(allKoinModules)
        }

        // Inicializar Firebase App Check com tratamento de erros
        try {
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
        } catch (e: Exception) {
            com.futebadosparcas.util.AppLogger.e(
                "FutebaApplication",
                "Error initializing Firebase: ${e.message}",
                e
            )
        }

        // Configurar Coil para carregamento de imagens otimizado
        val imageLoader = ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.25)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizeBytes(100 * 1024 * 1024) // 100MB
                    .build()
            }
            .crossfade(true)
            .respectCacheHeaders(false)
            .build()

        Coil.setImageLoader(imageLoader)

        // Aplicar preferência de tema salva (padrão: claro)
        val preferencesManager: PreferencesManager by inject()
        val theme = preferencesManager.getThemePreference()
        ThemeHelper.applyTheme(theme)

        // Agendar worker de limpeza de cache (a cada 12 horas)
        CacheCleanupWorker.schedule(this)
    }
}
