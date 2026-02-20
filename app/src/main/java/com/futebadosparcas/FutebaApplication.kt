package com.futebadosparcas

import android.app.Application
import androidx.work.Configuration
import coil3.SingletonImageLoader
import coil3.ImageLoader
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import okhttp3.OkHttpClient
import okio.Path.Companion.toOkioPath
import java.util.concurrent.TimeUnit
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

        // Configurar Coil 3 (KMP) para carregamento de imagens otimizado
        // OkHttp client configurado
        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        val imageLoader = ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder()
                    .maxSizePercent(percent = 0.25, context = this)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache").toPath().toOkioPath())
                    .maxSizeBytes(100 * 1024 * 1024) // 100MB
                    .build()
            }
            // Coil 3 requires explicit network fetcher
            .components {
                add(OkHttpNetworkFetcherFactory(callFactory = okHttpClient))
            }
            .crossfade(true)
            .build()

        SingletonImageLoader.setSafe { imageLoader }

        // Aplicar preferência de tema salva (padrão: claro)
        val preferencesManager: PreferencesManager by inject()
        val theme = preferencesManager.getThemePreference()
        ThemeHelper.applyTheme(theme)

        // Agendar worker de limpeza de cache (a cada 12 horas)
        CacheCleanupWorker.schedule(this)
    }
}
