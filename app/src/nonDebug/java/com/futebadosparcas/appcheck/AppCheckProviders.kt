package com.futebadosparcas.appcheck

import com.google.firebase.appcheck.AppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory

/**
 * Provider de App Check dos builds release e benchmark: Play Integrity.
 *
 * Source set compartilhado por `release` e `benchmark` (ver app/build.gradle.kts).
 * O build debug tem a sua própria versão em `src/debug`.
 * Spec: PERF_ANDROID_OPTIMIZATIONS_2026_10_31.
 */
internal object AppCheckProviders {
    fun factory(): AppCheckProviderFactory = PlayIntegrityAppCheckProviderFactory.getInstance()
}
