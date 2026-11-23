package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.User
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

/**
 * Perfil público de outros jogadores, lido pela callable `getLeaguePlayers` (#3691).
 *
 * Desde o #3691 a regra de `users` só libera LIST para admin, porque uma consulta LIST
 * não garante a ausência de e-mail e dos outros campos pessoais. A web já buscava
 * os perfis de outros jogadores por essa callable (projeção com lista fechada de
 * campos); o Android e o iOS ainda faziam `whereIn` em `users`, a consulta era negada
 * e o ranking mostrava "Jogador" no lugar do nome.
 *
 * Este objeto concentra o contrato da chamada, para o módulo compartilhado (Android e
 * iOS) e o `:app` usarem o mesmo mapeamento.
 */
object PublicPlayerProjection {

    const val CALLABLE_NAME = "getLeaguePlayers"

    /** Limite de `userIds` por chamada (`ABSOLUTE_MAX_LIMIT` da função). */
    const val MAX_IDS_PER_CALL = 500

    /** Corpo da chamada para um lote de até [MAX_IDS_PER_CALL] IDs. */
    fun request(userIds: List<String>): Map<String, Any> = mapOf(
        "userIds" to userIds,
        "limit" to userIds.size
    )

    /**
     * Converte a resposta da callable (`{ players: [...] }`) em [User] só com campos
     * públicos. Aceita o `JsonElement` do SDK GitLive e o `Map` do SDK Android.
     * Jogadores sem `userId` são descartados.
     */
    fun usersFromCallableData(data: Any?): List<User> {
        val players = when (val root = normalize(data)) {
            is Map<*, *> -> root["players"] as? List<*>
            else -> null
        } ?: return emptyList()

        return players.mapNotNull { item ->
            val player = item as? Map<*, *> ?: return@mapNotNull null
            val userId = player.string("userId") ?: return@mapNotNull null
            User(
                id = userId,
                name = player.string("userName").orEmpty(),
                photoUrl = player.string("userPhoto"),
                favoriteTeam = player.string("favoriteTeam"),
                preferredPosition = player.string("preferredPosition"),
                level = player.long("level")?.toInt() ?: 0,
                experiencePoints = player.long("experiencePoints") ?: 0L,
                isSearchable = true,
                strikerRating = player.double("strikerRating") ?: 0.0,
                midRating = player.double("midRating") ?: 0.0,
                defenderRating = player.double("defenderRating") ?: 0.0,
                gkRating = player.double("gkRating") ?: 0.0,
                strikerRatingSet = player.boolean("strikerRatingSet") ?: false,
                midRatingSet = player.boolean("midRatingSet") ?: false,
                defenderRatingSet = player.boolean("defenderRatingSet") ?: false,
                gkRatingSet = player.boolean("gkRatingSet") ?: false,
                autoStrikerRating = player.double("autoStrikerRating") ?: 0.0,
                autoMidRating = player.double("autoMidRating") ?: 0.0,
                autoDefenderRating = player.double("autoDefenderRating") ?: 0.0,
                autoGkRating = player.double("autoGkRating") ?: 0.0,
                autoRatingSamples = player.long("autoRatingSamples")?.toInt() ?: 0
            )
        }
    }

    // Converte JsonElement em Map/List/primitivos para um único caminho de leitura.
    private fun normalize(value: Any?): Any? = when (value) {
        null, JsonNull -> null
        is JsonObject -> value.mapValues { normalize(it.value) }
        is JsonArray -> value.map { normalize(it) }
        is JsonPrimitive -> when {
            value.isString -> value.content
            value.booleanOrNull != null -> value.booleanOrNull
            value.longOrNull != null -> value.longOrNull
            else -> value.doubleOrNull
        }
        is JsonElement -> null
        is Map<*, *> -> value.entries.associate { (k, v) -> k.toString() to normalize(v) }
        is Iterable<*> -> value.map { normalize(it) }
        else -> value
    }

    private fun Map<*, *>.string(key: String): String? =
        (this[key] as? String)?.takeIf { it.isNotBlank() }

    private fun Map<*, *>.long(key: String): Long? = (this[key] as? Number)?.toLong()

    private fun Map<*, *>.double(key: String): Double? = (this[key] as? Number)?.toDouble()

    private fun Map<*, *>.boolean(key: String): Boolean? = this[key] as? Boolean
}
