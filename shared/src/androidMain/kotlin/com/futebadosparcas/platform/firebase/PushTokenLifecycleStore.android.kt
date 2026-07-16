package com.futebadosparcas.platform.firebase

/** Android mantém seu ciclo FCM próprio; não altera esse fluxo nesta correção iOS. */
internal actual object PushTokenLifecycleStore {
    actual fun nextForUnregister(): StoredPushToken? = null
    actual fun clearToken() = Unit
}
