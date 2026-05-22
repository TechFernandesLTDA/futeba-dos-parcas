package com.futebadosparcas.platform.storage

/**
 * Stub wasmJs do [LastSeenVersionStore] — armazenamento em memória.
 *
 * A Web NÃO consome a camada KMP: ela replica a lógica de "último build visto"
 * em `localStorage` (spec §3.6). Este stub existe apenas para o alvo `wasmJs`
 * do módulo `shared` compilar.
 */
actual class LastSeenVersionStore {

    private var lastSeenBuild: Int = 0

    actual suspend fun getLastSeenBuild(): Int = lastSeenBuild

    actual suspend fun setLastSeenBuild(build: Int) {
        lastSeenBuild = build
    }
}
