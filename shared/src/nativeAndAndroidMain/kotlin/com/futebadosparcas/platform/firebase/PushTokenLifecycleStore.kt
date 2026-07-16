package com.futebadosparcas.platform.firebase

internal data class StoredPushToken(
    val deviceId: String,
    val sequence: Long
)

/** Estado mínimo da instalação necessário para unregister antes do logout. */
internal expect object PushTokenLifecycleStore {
    fun nextForUnregister(): StoredPushToken?
    fun clearToken()
}
