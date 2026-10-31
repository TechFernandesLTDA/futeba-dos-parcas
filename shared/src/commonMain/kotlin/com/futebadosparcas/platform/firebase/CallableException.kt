package com.futebadosparcas.platform.firebase

/**
 * Falha de uma callable do Cloud Functions com o código do protocolo
 * (`not-found`, `unauthenticated`, `failed-precondition`, `unavailable`...).
 *
 * Existe para que módulos sem dependência direta do SDK GitLive (como o
 * `composeApp`) consigam reagir ao código do erro sem inspecionar a mensagem.
 */
class CallableException(
    val code: String,
    message: String?,
    cause: Throwable? = null
) : Exception(message, cause) {
    companion object {
        const val NOT_FOUND = "not-found"
        const val UNAUTHENTICATED = "unauthenticated"
        const val FAILED_PRECONDITION = "failed-precondition"
        const val UNAVAILABLE = "unavailable"
        const val UNKNOWN = "unknown"
    }
}
