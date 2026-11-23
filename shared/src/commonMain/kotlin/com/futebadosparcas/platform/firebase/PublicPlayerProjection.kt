package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.User
import kotlinx.serialization.Serializable

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
     * Resposta da callable, no formato que o SDK GitLive decodifica.
     *
     * O GitLive decodifica a resposta com o próprio decodificador, que não é de JSON:
     * pedir `JsonElement` lança exceção. Por isso a resposta vira esta classe. Todos os
     * campos têm valor padrão, porque o decodificador pula o que não vier na resposta, e
     * os campos que a função devolve e a classe não declara são ignorados.
     */
    @Serializable
    data class LeaguePlayersResponse(
        val players: List<LeaguePlayer> = emptyList()
    )

    /** Um jogador da projeção pública (lista fechada de campos, sem dados pessoais). */
    @Serializable
    data class LeaguePlayer(
        val userId: String? = null,
        val userName: String? = null,
        val userPhoto: String? = null,
        val favoriteTeam: String? = null,
        val preferredPosition: String? = null,
        val level: Long? = null,
        val experiencePoints: Long? = null,
        val strikerRating: Double? = null,
        val midRating: Double? = null,
        val defenderRating: Double? = null,
        val gkRating: Double? = null,
        val strikerRatingSet: Boolean? = null,
        val midRatingSet: Boolean? = null,
        val defenderRatingSet: Boolean? = null,
        val gkRatingSet: Boolean? = null,
        val autoStrikerRating: Double? = null,
        val autoMidRating: Double? = null,
        val autoDefenderRating: Double? = null,
        val autoGkRating: Double? = null,
        val autoRatingSamples: Long? = null
    )

    /** Converte a resposta decodificada pelo GitLive em [User]. Descarta jogador sem `userId`. */
    fun usersFromResponse(response: LeaguePlayersResponse): List<User> =
        response.players.mapNotNull { it.toUser() }

    /**
     * Converte a resposta crua do SDK Android (`Map` com `players`) em [User].
     * Jogadores sem `userId` são descartados.
     */
    fun usersFromCallableData(data: Any?): List<User> {
        val players = (data as? Map<*, *>)?.get("players") as? List<*> ?: return emptyList()
        return players.mapNotNull { item -> (item as? Map<*, *>)?.toLeaguePlayer()?.toUser() }
    }

    private fun Map<*, *>.toLeaguePlayer() = LeaguePlayer(
        userId = string("userId"),
        userName = string("userName"),
        userPhoto = string("userPhoto"),
        favoriteTeam = string("favoriteTeam"),
        preferredPosition = string("preferredPosition"),
        level = long("level"),
        experiencePoints = long("experiencePoints"),
        strikerRating = double("strikerRating"),
        midRating = double("midRating"),
        defenderRating = double("defenderRating"),
        gkRating = double("gkRating"),
        strikerRatingSet = this["strikerRatingSet"] as? Boolean,
        midRatingSet = this["midRatingSet"] as? Boolean,
        defenderRatingSet = this["defenderRatingSet"] as? Boolean,
        gkRatingSet = this["gkRatingSet"] as? Boolean,
        autoStrikerRating = double("autoStrikerRating"),
        autoMidRating = double("autoMidRating"),
        autoDefenderRating = double("autoDefenderRating"),
        autoGkRating = double("autoGkRating"),
        autoRatingSamples = long("autoRatingSamples")
    )

    private fun LeaguePlayer.toUser(): User? {
        val id = userId?.takeIf { it.isNotBlank() } ?: return null
        return User(
            id = id,
            name = userName?.takeIf { it.isNotBlank() }.orEmpty(),
            photoUrl = userPhoto?.takeIf { it.isNotBlank() },
            favoriteTeam = favoriteTeam?.takeIf { it.isNotBlank() },
            preferredPosition = preferredPosition?.takeIf { it.isNotBlank() },
            level = level?.toInt() ?: 0,
            experiencePoints = experiencePoints ?: 0L,
            isSearchable = true,
            strikerRating = strikerRating ?: 0.0,
            midRating = midRating ?: 0.0,
            defenderRating = defenderRating ?: 0.0,
            gkRating = gkRating ?: 0.0,
            strikerRatingSet = strikerRatingSet ?: false,
            midRatingSet = midRatingSet ?: false,
            defenderRatingSet = defenderRatingSet ?: false,
            gkRatingSet = gkRatingSet ?: false,
            autoStrikerRating = autoStrikerRating ?: 0.0,
            autoMidRating = autoMidRating ?: 0.0,
            autoDefenderRating = autoDefenderRating ?: 0.0,
            autoGkRating = autoGkRating ?: 0.0,
            autoRatingSamples = autoRatingSamples?.toInt() ?: 0
        )
    }

    private fun Map<*, *>.string(key: String): String? = this[key] as? String

    private fun Map<*, *>.long(key: String): Long? = (this[key] as? Number)?.toLong()

    private fun Map<*, *>.double(key: String): Double? = (this[key] as? Number)?.toDouble()
}
