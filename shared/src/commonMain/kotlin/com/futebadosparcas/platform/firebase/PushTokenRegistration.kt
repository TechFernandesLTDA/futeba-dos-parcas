package com.futebadosparcas.platform.firebase

enum class PushPlatform(val wireValue: String) {
    IOS("ios"),
    ANDROID("android"),
    WEB("web")
}

/** Payload compartilhado do contrato seguro de registro por instalação. */
data class PushTokenRegistration(
    val token: String,
    val deviceId: String,
    val platform: PushPlatform,
    val sequence: Long
) {
    init {
        require(token.isNotBlank() && token.length <= 4096) { "Token push inválido" }
        require(deviceId.isNotBlank() && deviceId.length <= 200) { "Device ID inválido" }
        require(sequence > 0) { "Sequência da instalação inválida" }
    }

    internal fun toPayload(): Map<String, Any> = mapOf(
        "token" to token.trim(),
        "deviceId" to deviceId.trim(),
        "platform" to platform.wireValue,
        "sequence" to sequence
    )
}
