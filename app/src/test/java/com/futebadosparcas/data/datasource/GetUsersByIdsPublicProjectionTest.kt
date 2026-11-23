package com.futebadosparcas.data.datasource

import com.futebadosparcas.util.MockLogExtension
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.HttpsCallableReference
import com.google.firebase.functions.HttpsCallableResult
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * `getUsersByIds` busca outros jogadores pela projeção pública (`getLeaguePlayers`),
 * não por LIST em `users`, que as regras só liberam para admin desde o #3691.
 * Antes, a consulta era negada e o ranking mostrava "Jogador" no lugar do nome.
 */
@ExtendWith(MockLogExtension::class)
@DisplayName("FirebaseDataSourceImpl.getUsersByIds")
class GetUsersByIdsPublicProjectionTest {

    @Suppress("UNCHECKED_CAST")
    private fun callableResult(data: Any?): HttpsCallableResult {
        val constructor = HttpsCallableResult::class.java.declaredConstructors[0]
        constructor.isAccessible = true
        return constructor.newInstance(data) as HttpsCallableResult
    }

    @Test
    @DisplayName("usa a callable getLeaguePlayers e não consulta a coleção users")
    fun getUsersByIds_outrosJogadores_usaProjecaoPublica() = runTest {
        val firestore = mockk<FirebaseFirestore>(relaxed = true)
        val auth = mockk<FirebaseAuth> { every { currentUser } returns null }
        val functions = mockk<FirebaseFunctions>()
        val callable = mockk<HttpsCallableReference>()
        val body = slot<Any>()
        every { functions.getHttpsCallable("getLeaguePlayers") } returns callable
        every { callable.call(capture(body)) } returns Tasks.forResult(
            callableResult(
                mapOf(
                    "players" to listOf(
                        mapOf("userId" to "u2", "userName" to "Ana", "level" to 3),
                        mapOf("userId" to "u1", "userName" to "Carlos")
                    )
                )
            )
        )

        val result = FirebaseDataSourceImpl(firestore, auth, functions)
            .getUsersByIds(listOf("u1", "u2", "u1", "sem-perfil"))

        assertTrue(result.isSuccess)
        val users = result.getOrThrow()
        // Ordem do pedido, sem repetição; quem não está na projeção fica de fora.
        assertEquals(listOf("u1", "u2"), users.map { it.id })
        assertEquals(listOf("Carlos", "Ana"), users.map { it.name })
        assertEquals(mapOf("userIds" to listOf("u1", "u2", "sem-perfil"), "limit" to 3), body.captured)
        verify(exactly = 0) { firestore.collection("users") }
    }

    @Test
    @DisplayName("lista vazia não chama a função")
    fun getUsersByIds_listaVazia_naoChamaFuncao() = runTest {
        val functions = mockk<FirebaseFunctions>()
        val auth = mockk<FirebaseAuth> { every { currentUser } returns null }

        val result = FirebaseDataSourceImpl(mockk(relaxed = true), auth, functions)
            .getUsersByIds(listOf("", " "))

        assertEquals(emptyList<Any>(), result.getOrThrow())
        verify(exactly = 0) { functions.getHttpsCallable(any<String>()) }
    }
}
