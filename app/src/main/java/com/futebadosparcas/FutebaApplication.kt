package com.futebadosparcas

import android.app.Application
import android.os.StrictMode
import androidx.work.Configuration
import com.futebadosparcas.appcheck.AppCheckProviders
import com.futebadosparcas.data.local.CacheCleanupWorker
import com.futebadosparcas.di.koin.allKoinModules
import com.futebadosparcas.ui.theme.CoilConfig
import com.futebadosparcas.util.BuildConfigHelper
import com.futebadosparcas.util.PreferencesManager
import com.futebadosparcas.util.ThemeHelper
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.koin.android.ext.android.inject
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.androidx.workmanager.factory.KoinWorkerFactory
import org.koin.androidx.workmanager.koin.workManagerFactory
import org.koin.core.context.startKoin
import org.koin.core.logger.Level

class FutebaApplication : Application(), Configuration.Provider {

    // Escopo do processo para trabalho de inicialização fora da main thread.
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(KoinWorkerFactory())
            .build()

    override fun onCreate() {
        super.onCreate()

        // StrictMode só em debug e só com log (sem crash): expõe I/O e rede na
        // main thread e vazamentos de objetos durante o desenvolvimento.
        if (BuildConfigHelper.shouldEnableStrictMode()) {
            enableStrictMode()
        }

        // Inicializar Koin.
        // PERF: logger do Koin só em debug. Em release o nível INFO gerava log de
        // carga de módulos no caminho crítico do cold start sem uso em produção.
        startKoin {
            androidLogger(if (BuildConfig.DEBUG) Level.INFO else Level.NONE)
            androidContext(this@FutebaApplication)
            workManagerFactory()
            modules(allKoinModules)
        }

        // Inicializar Firebase App Check com tratamento de erros.
        // O provider vem do source set da variante: debug usa o token de debug,
        // release/benchmark usam Play Integrity (src/nonDebug).
        try {
            FirebaseApp.initializeApp(this)
            FirebaseAppCheck.getInstance()
                .installAppCheckProviderFactory(AppCheckProviders.factory())
        } catch (e: Exception) {
            com.futebadosparcas.util.AppLogger.e(
                "FutebaApplication",
                "Error initializing Firebase: ${e.message}",
                e
            )
        }

        // Monetização: passa a ouvir a primeira vitória e a conferir a assinatura (loja).
        // Não inicializa o SDK de anúncios: isso só acontece depois da primeira vitória.
        org.koin.java.KoinJavaComponent.get<com.futebadosparcas.monetization.AdsController>(
            com.futebadosparcas.monetization.AdsController::class.java
        ).start()

        // Registrar a fábrica do Coil 3 (KMP). O ImageLoader é criado sob demanda
        // na primeira imagem, fora do caminho crítico do cold start.
        CoilConfig.setupCoil(this)

        // Aplicar preferência de tema salva (padrão: claro)
        val preferencesManager: PreferencesManager by inject()
        val theme = preferencesManager.getThemePreference()
        ThemeHelper.applyTheme(theme)

        // PERF: WorkManager é inicializado sob demanda (initializer removido no
        // manifesto); o primeiro getInstance monta banco e schedulers. Fazer isso
        // fora da main thread tira esse custo da janela do primeiro frame.
        appScope.launch {
            CacheCleanupWorker.schedule(applicationContext)
        }
    }

    private fun enableStrictMode() {
        StrictMode.setThreadPolicy(
            StrictMode.ThreadPolicy.Builder()
                .detectAll()
                .penaltyLog()
                .build()
        )
        StrictMode.setVmPolicy(
            StrictMode.VmPolicy.Builder()
                .detectLeakedClosableObjects()
                .detectLeakedSqlLiteObjects()
                .detectActivityLeaks()
                .penaltyLog()
                .build()
        )
    }
}
