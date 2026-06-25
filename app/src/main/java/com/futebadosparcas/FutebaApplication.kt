package com.futebadosparcas

import android.app.Application
import android.os.Handler
import android.os.Looper
import androidx.work.Configuration
import com.futebadosparcas.data.local.CacheCleanupWorker
import com.futebadosparcas.di.koin.allKoinModules
import com.futebadosparcas.ui.theme.CoilConfig
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

        // Configurar Coil 3 (KMP) para carregamento de imagens otimizado.
        CoilConfig.setupCoil(this)

        // Aplicar preferência de tema salva (padrão: claro)
        val preferencesManager: PreferencesManager by inject()
        val theme = preferencesManager.getThemePreference()
        ThemeHelper.applyTheme(theme)

        Handler(Looper.getMainLooper()).post {
            CacheCleanupWorker.schedule(applicationContext)
        }
    }
}
