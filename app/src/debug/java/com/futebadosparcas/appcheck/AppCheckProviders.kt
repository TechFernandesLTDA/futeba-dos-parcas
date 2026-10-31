package com.futebadosparcas.appcheck

import com.google.firebase.appcheck.AppCheckProviderFactory
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory

/**
 * Provider de App Check do build debug: usa o token de debug do Firebase.
 *
 * Existe só no source set `debug`; release e benchmark usam a versão de
 * `src/nonDebug`, assim `firebase-appcheck-debug` (debugImplementation) não
 * entra no APK/AAB de produção. Spec: PERF_ANDROID_OPTIMIZATIONS_2026_10_31.
 */
internal object AppCheckProviders {
    fun factory(): AppCheckProviderFactory = DebugAppCheckProviderFactory.getInstance()
}
