package com.futebadosparcas.platform.firebase

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Mapeamento da resposta de `getLeaguePlayers` para perfis públicos (#3691). */
class PublicPlayerProjectionTest {

    @Test
    fun usersFromCallableData_jsonDoGitLive_mapeiaNomeFotoEEstatisticas() {
        val data = Json.parseToJsonElement(
            """
            {"success": true, "players": [{
              "id": "part-1", "userId": "u1", "userName": "Carlos Silva",
              "userPhoto": "https://exemplo.test/u1.jpg", "favoriteTeam": "Santos",
              "level": 7, "experiencePoints": 2450, "preferredPosition": "ZAGUEIRO",
              "strikerRating": 3.5, "gkRating": 1, "strikerRatingSet": true,
              "autoMidRating": 2.25, "autoRatingSamples": 4
            }]}
            """.trimIndent()
        )

        val users = PublicPlayerProjection.usersFromCallableData(data)

        assertEquals(1, users.size)
        val user = users.single()
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
                    "midRating" to 4
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
    fun usersFromCallableData_descartaJogadorSemUserId() {
        val data = Json.parseToJsonElement(
            """{"players": [{"userName": "Sem id"}, {"userId": "", "userName": "Vazio"}, {"userId": "u4"}]}"""
        )

        val users = PublicPlayerProjection.usersFromCallableData(data)

        assertEquals(listOf("u4"), users.map { it.id })
        assertEquals("", users.single().name)
    }

    @Test
    fun usersFromCallableData_respostaInesperada_retornaListaVazia() {
        assertTrue(PublicPlayerProjection.usersFromCallableData(null).isEmpty())
        assertTrue(PublicPlayerProjection.usersFromCallableData("x").isEmpty())
        val semPlayers: JsonElement = Json.parseToJsonElement("""{"success": true}""")
        assertTrue(PublicPlayerProjection.usersFromCallableData(semPlayers).isEmpty())
    }

    @Test
    fun request_enviaIdsELimiteDoLote() {
        val body = PublicPlayerProjection.request(listOf("a", "b", "c"))

        assertEquals(listOf("a", "b", "c"), body["userIds"])
        assertEquals(3, body["limit"])
    }
}
