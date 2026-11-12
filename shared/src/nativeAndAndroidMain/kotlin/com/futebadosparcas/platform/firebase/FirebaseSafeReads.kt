package com.futebadosparcas.platform.firebase

import dev.gitlive.firebase.firestore.DocumentReference
import dev.gitlive.firebase.firestore.DocumentSnapshot
import dev.gitlive.firebase.firestore.Timestamp

/**
 * Leituras e escritas tolerantes para o Kotlin/Native (iOS).
 *
 * `get<Any?>`, `get<List<*>?>`, `get<Map<*, *>?>` e `update(Map<String, Any>)` pedem ao
 * kotlinx.serialization um serializador para `Any`, que não existe: no iOS isso lança
 * "Serializer for class 'Any' is not found" (e quebrava o login logo depois de autenticar,
 * ao montar o `User`). Aqui cada leitura usa um tipo concreto e nunca lança.
 */
internal inline fun <reified T> DocumentSnapshot.tryGet(field: String): T? =
    try { get<T?>(field) } catch (_: Throwable) { null }

/** Valor escalar do campo (Timestamp, Long, Double, Boolean ou String), ou nulo. */
internal fun DocumentSnapshot.getScalar(field: String): Any? =
    tryGet<Timestamp>(field)
        ?: tryGet<Long>(field)
        ?: tryGet<Double>(field)
        ?: tryGet<Boolean>(field)
        ?: tryGet<String>(field)

internal fun DocumentSnapshot.getStringList(field: String): List<String>? = tryGet<List<String>>(field)

internal fun DocumentSnapshot.getIntList(field: String): List<Int>? =
    tryGet<List<Long>>(field)?.map { it.toInt() } ?: tryGet<List<Int>>(field)

/** Mapa de valores conhecidos (listas de texto, números, textos ou mapas aninhados de números). */
internal fun DocumentSnapshot.getLooseMap(field: String): Map<*, *>? =
    tryGet<Map<String, List<String>>>(field)
        ?: tryGet<Map<String, Map<String, Double>>>(field)
        ?: tryGet<Map<String, Map<String, String?>>>(field)
        ?: tryGet<Map<String, Double>>(field)
        ?: tryGet<Map<String, String>>(field)

/** `update` com mapa heterogêneo: usa os pares, que o GitLive codifica pelo tipo real do valor. */
internal suspend fun DocumentReference.updateLoose(updates: Map<String, Any?>) {
    update(*updates.entries.map { it.key to it.value }.toTypedArray())
}
