package com.futebadosparcas.platform.storage

/**
 * Persiste o último `buildNumber` cujas novidades já foram exibidas **neste
 * dispositivo**.
 *
 * Decisão de design (spec §3.6): a persistência é **por dispositivo**, não por
 * usuário. O pop-up "Novidades" comunica "este aparelho acabou de ser
 * atualizado" — um evento de dispositivo. Uma instalação nova legitimamente vê
 * as novidades, e evita-se leitura/escrita extra no documento do usuário a cada
 * boot.
 *
 * - Android: `SharedPreferences`.
 * - iOS: `NSUserDefaults`.
 * - wasmJs: stub em memória (a Web replica a lógica em `localStorage` — §3.6).
 */
expect class LastSeenVersionStore {

    /** Último build visto; `0` se nenhum (instalação nova). */
    suspend fun getLastSeenBuild(): Int

    /** Marca [build] como o último build cujas novidades já foram vistas. */
    suspend fun setLastSeenBuild(build: Int)
}
