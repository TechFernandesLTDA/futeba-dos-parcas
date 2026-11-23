package com.futebadosparcas.platform.firebase

import com.futebadosparcas.platform.firebase.PublicPlayerProjection.LeaguePlayer
import com.futebadosparcas.platform.firebase.PublicPlayerProjection.LeaguePlayersResponse
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Mapeamento da resposta de `getLeaguePlayers` para perfis públicos (#3691). */
class PublicPlayerProjectionTest {

    @Test
    fun usersFromResponse_mapeiaNomeFotoEEstatisticas() {
        val response = LeaguePlayersResponse(
            players = listOf(
                LeaguePlayer(
                    userId = "u1", userName = "Carlos Silva",
                    userPhoto = "https://exemplo.test/u1.jpg", favoriteTeam = "Santos",
                    level = 7, experiencePoints = 2450, preferredPosition = "ZAGUEIRO",
                    strikerRating = 3.5, gkRating = 1.0, strikerRatingSet = true,
                    autoMidRating = 2.25, autoRatingSamples = 4
                )
            )
        )

        val user = PublicPlayerProjection.usersFromResponse(response).single()

        assertEquals("u1", user.id)
        assertEquals("Carlos Silva", user.name)
        assertEquals("https://exemplo.test/u1.jpg", user.photoUrl)
        assertEquals("Santos", user.favoriteTeam)
        assertEquals(7, user.level)
        assertEquals(2450L, user.experiencePoints)
        assertEquals("ZAGUEIRO", user.preferredPosition)
        assertEquals(3.5, user.strikerRating)
        assertEquals(1.0, user.gkRating)
        assertTrue(user.strikerRatingSet)
        assertEquals(2.25, user.autoMidRating)
        assertEquals(4, user.autoRatingSamples)
        assertTrue(user.isSearchable)
    }

    @Test
    fun usersFromResponse_descartaJogadorSemUserId() {
        val response = LeaguePlayersResponse(
            players = listOf(
                LeaguePlayer(userName = "Sem id"),
                LeaguePlayer(userId = "", userName = "Vazio"),
                LeaguePlayer(userId = "u4")
            )
        )

        val users = PublicPlayerProjection.usersFromResponse(response)

        assertEquals(listOf("u4"), users.map { it.id })
        assertEquals("", users.single().name)
        assertNull(users.single().photoUrl)
    }

    @Test
    fun usersFromCallableData_mapDoSdkAndroid_aceitaIntELongDoJava() {
        val data = mapOf(
            "players" to listOf(
                mapOf(
                    "userId" to "u2",
                    "userName" to "Ana",
                    "level" to 3,
                    "experiencePoints" to 900L,
                    "midRating" to 4,
                    "userPhoto" to null
                )
            )
        )

        val user = PublicPlayerProjection.usersFromCallableData(data).single()

        assertEquals("u2", user.id)
        assertEquals("Ana", user.name)
        assertEquals(3, user.level)
        assertEquals(900L, user.experiencePoints)
        assertEquals(4.0, user.midRating)
        assertNull(user.photoUrl)
    }

    @Test
    fun usersFromCallableData_naoTrazCamposPessoais() {
        // A callable nunca devolve e-mail; o perfil montado fica com os padrões vazios.
        val data = mapOf("players" to listOf(mapOf("userId" to "u3", "userName" to "Bia")))

        val user = PublicPlayerProjection.usersFromCallableData(data).single()

        assertEquals("", user.email)
        assertNull(user.phone)
        assertNull(user.birthDate)
        assertNull(user.fcmToken)
    }

    @Test
    fun usersFromCallableData_respostaInesperada_retornaListaVazia() {
        assertTrue(PublicPlayerProjection.usersFromCallableData(null).isEmpty())
        assertTrue(PublicPlayerProjection.usersFromCallableData("x").isEmpty())
        assertTrue(PublicPlayerProjection.usersFromCallableData(mapOf("success" to true)).isEmpty())
    }

    @Test
    fun request_enviaIdsELimiteDoLote() {
        val body = PublicPlayerProjection.request(listOf("a", "b", "c"))

        assertEquals(listOf("a", "b", "c"), body["userIds"])
        assertEquals(3, body["limit"])
    }
}
