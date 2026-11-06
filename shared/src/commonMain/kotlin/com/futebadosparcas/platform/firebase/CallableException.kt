package com.futebadosparcas.platform.firebase

/**
 * Grupo citado em `details.groups` de uma callable (ex.: grupos em que o usuário
 * é o único dono, que bloqueiam a exclusão de conta).
 */
data class CallableGroup(val id: String, val name: String)

/**
 * Falha de uma callable do Cloud Functions com o código do protocolo
 * (`not-found`, `unauthenticated`, `failed-precondition`, `unavailable`...).
 *
 * Existe para que módulos sem dependência direta do SDK GitLive (como o
 * `composeApp`) consigam reagir ao código do erro sem inspecionar a mensagem.
 *
 * #4440: o mesmo `failed-precondition` pode ter motivos distintos; o servidor os
 * separa em `HttpsError.details.reason` (e `details.groups`), expostos aqui como
 * [reason] e [groups]. Se o SDK da plataforma não entregar `details`, ficam
 * `null`/vazio e o chamador deve tratar como motivo desconhecido.
 */
class CallableException(
    val code: String,
    message: String?,
    cause: Throwable? = null,
    val reason: String? = null,
    val groups: List<CallableGroup> = emptyList()
) : Exception(message, cause) {
    companion object {
        const val NOT_FOUND = "not-found"
        const val UNAUTHENTICATED = "unauthenticated"
        const val FAILED_PRECONDITION = "failed-precondition"
        const val RESOURCE_EXHAUSTED = "resource-exhausted"
        const val UNAVAILABLE = "unavailable"
        const val UNKNOWN = "unknown"

        /** `details.reason` da callable `deleteAccount` (functions/src/auth/delete-account.ts). */
        const val REASON_REQUIRES_RECENT_LOGIN = "requires-recent-login"
        const val REASON_SOLE_OWNER_GROUPS = "sole-owner-groups"

        /** `details.reason` da callable `exportMyData` (functions/src/auth/export-my-data.ts). */
        const val REASON_EXPORT_TOO_LARGE = "export-too-large"

        /** Lê `details.reason` de um `details` bruto do SDK (Map no Android e no iOS). */
        fun reasonFromDetails(details: Any?): String? =
            (details as? Map<*, *>)?.get("reason") as? String

        /** Lê `details.groups` (lista de `{id, name}`), ignorando itens malformados. */
        fun groupsFromDetails(details: Any?): List<CallableGroup> {
            val raw = (details as? Map<*, *>)?.get("groups") as? List<*> ?: return emptyList()
            return raw.mapNotNull { item ->
                val map = item as? Map<*, *> ?: return@mapNotNull null
                val id = map["id"] as? String ?: return@mapNotNull null
                CallableGroup(id = id, name = (map["name"] as? String).orEmpty())
            }
        }
    }
}
