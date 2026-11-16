package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.CollectionReference
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.QueryDocumentSnapshot
import com.google.firebase.firestore.QuerySnapshot
import com.google.firebase.firestore.util.CustomClassMapper
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.runs
import io.mockk.unmockkObject
import io.mockk.verify
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/**
 * Regressão do #4576: jogo lido sem o ID do documento.
 *
 * O modelo `Game` do Android não usa `@DocumentId` e os jogos de produção não têm o campo `id` gravado (o web
 * cria com `addDoc`). O detalhe e os listeners de lista devolviam o jogo com `id` vazio.
 *
 * Os snapshots são mocks, mas o `toObject` deles chama o mapper real do Firestore sobre o modelo real.
 * Spec: specs/bugfix-2026-11-15-android-jogo-sem-id-do-documento.md.
 */
class GameSnapshotMappingTest {

    @BeforeEach
    fun setUp() {
        mockkObject(AppLogger)
        every { AppLogger.e(any(), any(), any()) } just runs
    }

    @AfterEach
    fun tearDown() {
        unmockkObject(AppLogger)
    }

    /** Snapshot de `games/{docId}` cujo `toObject` usa o mapper real do Firestore, como no aparelho. */
    private fun jogo(docId: String, data: Map<String, Any?>): QueryDocumentSnapshot {
        val parent = mockk<CollectionReference> { every { id } returns "games" }
        val ref = mockk<DocumentReference> {
            every { id } returns docId
            every { path } returns "games/$docId"
            every { this@mockk.parent } returns parent
        }
        return mockk {
            every { id } returns docId
            every { this@mockk.data } returns data
            every { reference } returns ref
            every { toObject(Game::class.java) } answers {
                CustomClassMapper.convertToCustomClass(data, Game::class.java, ref)
            }
        }
    }

    private fun lista(vararg docs: QueryDocumentSnapshot): QuerySnapshot =
        mockk { every { documents } returns docs.toList() }

    // Formato gravado pelo web: sem o campo `id`.
    private val jogoDoWeb = mapOf(
        "owner_id" to "uid-dono",
        "owner_name" to "Dono",
        "status" to GameStatus.SCHEDULED.name,
        "date" to "2026-12-01",
        "time" to "20:00",
        "players_count" to 3L,
        "max_players" to 14L
    )

    @Test
    fun `mapper do Firestore sozinho devolve o jogo do web com id vazio`() {
        val doc = jogo("jogo-1", jogoDoWeb)

        assertEquals("", doc.toObject(Game::class.java).id)
    }

    @Test
    fun `detalhe do jogo criado pelo web vem com o ID do documento`() {
        val game = jogo("jogo-1", jogoDoWeb).toAndroidGame()

        assertEquals("jogo-1", game?.id)
        assertEquals("uid-dono", game?.ownerId)
        assertEquals(GameStatus.SCHEDULED.name, game?.status)
        assertEquals(3, game?.playersCount)
    }

    @Test
    fun `ID do documento prevalece sobre o campo id gravado`() {
        val game = jogo("jogo-1", jogoDoWeb + ("id" to "outro")).toAndroidGame()

        assertEquals("jogo-1", game?.id)
    }

    @Test
    fun `listener de detalhe vem com o ID do documento`() {
        assertEquals("jogo-1", jogo("jogo-1", jogoDoWeb).toAndroidGameOrNull()?.id)
    }

    @Test
    fun `lista mantem jogos diferentes com IDs diferentes`() {
        val games = lista(jogo("jogo-1", jogoDoWeb), jogo("jogo-2", jogoDoWeb)).toAndroidGames()

        assertEquals(listOf("jogo-1", "jogo-2"), games.map { it.id })
        // A tela de jogos remove duplicados pelo id: com id vazio os dois viravam um.
        assertEquals(2, games.distinctBy { it.id }.size)
    }

    @Test
    fun `lista deixa de fora so o documento ilegivel`() {
        val ilegivel = jogoDoWeb + ("owner_id" to mapOf("x" to 1))

        val games = lista(jogo("jogo-quebrado", ilegivel), jogo("jogo-2", jogoDoWeb)).toAndroidGames()

        assertEquals(listOf("jogo-2"), games.map { it.id })
        verify { AppLogger.e(any(), match { "jogo-quebrado" in it }, any()) }
    }

    @Test
    fun `documento ilegivel lanca fora de listener e vira null dentro`() {
        val ilegivel = jogoDoWeb + ("owner_id" to mapOf("x" to 1))

        assertFailsWith<RuntimeException> { jogo("jogo-quebrado", ilegivel).toAndroidGame() }
        assertNull(jogo("jogo-quebrado", ilegivel).toAndroidGameOrNull())
    }
}
