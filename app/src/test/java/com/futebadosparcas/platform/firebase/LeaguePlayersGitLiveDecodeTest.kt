package com.futebadosparcas.platform.firebase

import dev.gitlive.firebase.internal.decode
import kotlinx.serialization.json.JsonElement
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

/**
 * O `:shared` lê a resposta de `getLeaguePlayers` pelo decodificador do SDK GitLive, que
 * recebe o mesmo `Map` que o SDK Android devolve. Este teste passa esse `Map` pelo
 * decodificador de verdade (o teste do `:shared` monta a classe já decodificada).
 */
@DisplayName("Resposta de getLeaguePlayers pelo decodificador do GitLive")
class LeaguePlayersGitLiveDecodeTest {

    // Formato do SDK Android: HashMap e ArrayList, inteiros como Integer ou Long,
    // decimais como Double, foto nula e campos que a classe não declara.
    private fun respostaDoSdk(): Map<String, Any?> = hashMapOf(
        "success" to true,
        "totalCount" to 2,
        "hasMore" to false,
        "nextPageToken" to null,
        "players" to arrayListOf(
            hashMapOf(
                "id" to "part-1",
                "userId" to "u1",
                "userName" to "Carlos Silva",
                "userPhoto" to null,
                "level" to 7,
                "experiencePoints" to 2450L,
                "strikerRating" to 3,
                "midRating" to 2.5,
                "strikerRatingSet" to true,
                "autoRatingSamples" to 4,
                "division" to "OURO"
            ),
            hashMapOf("userId" to "u2", "userName" to "Ana")
        )
    )

    @Test
    fun `classe da resposta decodifica o Map do SDK com nomes e numeros`() {
        val response = decode(PublicPlayerProjection.LeaguePlayersResponse.serializer(), respostaDoSdk())

        val users = PublicPlayerProjection.usersFromResponse(response)

        assertEquals(listOf("u1", "u2"), users.map { it.id })
        val carlos = users.first()
        assertEquals("Carlos Silva", carlos.name)
        assertNull(carlos.photoUrl)
        assertEquals(7, carlos.level)
        assertEquals(2450L, carlos.experiencePoints)
        assertEquals(3.0, carlos.strikerRating)
        assertEquals(2.5, carlos.midRating)
        assertEquals(true, carlos.strikerRatingSet)
        assertEquals(4, carlos.autoRatingSamples)
        assertEquals("Ana", users[1].name)
        assertEquals(0, users[1].level)
    }

    @Test
    fun `JsonElement nao decodifica pelo GitLive, por isso o shared usa a classe`() {
        // Era o que o :shared pedia antes: a exceção era engolida e o ranking ficava sem nomes.
        assertThrows<Exception> {
            decode(JsonElement.serializer(), respostaDoSdk())
        }
    }
}
