package com.futebadosparcas.data.util

import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.GroupMemberStatus
import com.futebadosparcas.data.model.GroupStatus
import com.futebadosparcas.data.model.UserGroup
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.CollectionReference
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.DocumentSnapshot
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
import java.util.Date
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/**
 * Regressão dos fechamentos por `@DocumentId` (1.43.2 e 1.43.3):
 *
 *   'id' was found from document groups/x/members/y, cannot apply @DocumentId on this property for class
 *   com.futebadosparcas.data.model.GroupMember
 *
 * Os snapshots são mocks, mas o `toObject` deles chama o mapper real do Firestore sobre os modelos reais do
 * app. Assim o teste reproduz a exceção de produção e confere que as leituras tolerantes a resolvem.
 * Spec: specs/bugfix-2026-11-15-android-documentid-leitura-tolerante.md.
 */
class FirestoreSafeMappingTest {

    @BeforeEach
    fun setUp() {
        mockkObject(AppLogger)
        every { AppLogger.e(any(), any(), any()) } just runs
    }

    @AfterEach
    fun tearDown() {
        unmockkObject(AppLogger)
    }

    private fun reference(collectionId: String, docId: String): DocumentReference {
        val parent = mockk<CollectionReference> { every { id } returns collectionId }
        return mockk {
            every { id } returns docId
            every { path } returns "raiz/x/$collectionId/$docId"
            every { this@mockk.parent } returns parent
        }
    }

    /** Snapshot cujo `toObject` usa o mapper real do Firestore, como no aparelho. */
    private fun <T : Any> snapshot(
        collectionId: String,
        docId: String,
        data: Map<String, Any?>,
        clazz: Class<T>
    ): QueryDocumentSnapshot {
        val ref = reference(collectionId, docId)
        return mockk {
            every { id } returns docId
            every { this@mockk.data } returns data
            every { this@mockk.reference } returns ref
            every { toObject(clazz) } answers { CustomClassMapper.convertToCustomClass(data, clazz, ref) }
        }
    }

    // Formato dos 8 documentos de produção em groups/{id}/members que têm o campo `id` gravado.
    private val membroComCampoId = mapOf(
        "id" to "uid-1",
        "user_id" to "uid-1",
        "user_name" to "Fulano",
        "user_photo" to null,
        "role" to GroupMemberRole.ADMIN.name,
        "status" to GroupMemberStatus.ACTIVE.name,
        "joined_at" to Date(1_700_000_000_000),
        "nickname" to "Fu"
    )

    private val espelhoComCampoId = mapOf(
        "id" to "grupo-1",
        "group_id" to "grupo-1",
        "group_name" to "Pelada de quinta",
        "role" to GroupMemberRole.OWNER.name,
        "member_count" to 12L,
        "joined_at" to Date(1_700_000_000_000)
    )

    @Test
    fun `mapper real do Firestore lanca quando o documento tem o campo id gravado`() {
        val doc = snapshot("members", "uid-1", membroComCampoId, GroupMember::class.java)

        val erro = assertFailsWith<RuntimeException> { doc.toObject(GroupMember::class.java) }

        assertTrue("cannot apply @DocumentId" in erro.message.orEmpty())
        assertEquals("id", documentIdConflictField(erro))
    }

    @Test
    fun `GroupMember com campo id gravado e lido sem lancar`() {
        val doc = snapshot("members", "uid-1", membroComCampoId, GroupMember::class.java)

        val membro = doc.toObjectTolerant(GroupMember::class.java)

        assertEquals("uid-1", membro?.id)
        assertEquals("uid-1", membro?.userId)
        assertEquals("Fulano", membro?.userName)
        assertEquals(GroupMemberRole.ADMIN.name, membro?.role)
        assertEquals(GroupMemberStatus.ACTIVE.name, membro?.status)
        assertEquals(Date(1_700_000_000_000), membro?.joinedAt)
        assertEquals("Fu", membro?.nickname)
    }

    @Test
    fun `id vem do ID do documento e nao do campo gravado`() {
        val doc = snapshot("members", "uid-1", membroComCampoId + ("id" to "outro"), GroupMember::class.java)

        assertEquals("uid-1", doc.toObjectTolerant(GroupMember::class.java)?.id)
    }

    @Test
    fun `UserGroup com campo id gravado e lido sem lancar`() {
        val doc = snapshot("groups", "grupo-1", espelhoComCampoId, UserGroup::class.java)

        val grupo = doc.toObjectTolerant<UserGroup>()

        assertEquals("grupo-1", grupo?.id)
        assertEquals("grupo-1", grupo?.groupId)
        assertEquals("Pelada de quinta", grupo?.groupName)
        assertEquals(GroupMemberRole.OWNER.name, grupo?.role)
        assertEquals(12, grupo?.memberCount)
        assertEquals(GroupStatus.ACTIVE.name, grupo?.groupStatus)
    }

    @Test
    fun `documento sem o campo id da o mesmo resultado do toObject`() {
        val semId = membroComCampoId - "id"
        val doc = snapshot("members", "uid-1", semId, GroupMember::class.java)

        assertEquals(doc.toObject(GroupMember::class.java), doc.toObjectTolerant(GroupMember::class.java))
        verify(exactly = 0) { AppLogger.e(any(), any(), any()) }
    }

    @Test
    fun `conflito vira nao fatal uma vez por modelo e colecao e sem o caminho do documento`() {
        val a = snapshot("members_unica", "uid-1", membroComCampoId, GroupMember::class.java)
        val b = snapshot("members_unica", "uid-2", membroComCampoId + ("id" to "uid-2"), GroupMember::class.java)

        a.toObjectTolerant(GroupMember::class.java)
        b.toObjectTolerant(GroupMember::class.java)

        verify(exactly = 1) {
            AppLogger.e(
                any(),
                match { "members_unica" in it && "uid-1" !in it },
                match { "uid-1" !in it.message.orEmpty() }
            )
        }
    }

    @Test
    fun `outra falha de conversao e relancada pelo toObjectTolerant`() {
        val tipoErrado = (membroComCampoId - "id") + ("user_name" to mapOf("x" to 1))
        val doc = snapshot("members", "uid-1", tipoErrado, GroupMember::class.java)

        assertFailsWith<RuntimeException> { doc.toObjectTolerant(GroupMember::class.java) }
    }

    @Test
    fun `toObjectOrNullSafely nunca lanca e registra a falha`() {
        val tipoErrado = (membroComCampoId - "id") + ("user_name" to mapOf("x" to 1))
        val quebrado = snapshot("members", "uid-quebrado", tipoErrado, GroupMember::class.java)
        val comId = snapshot("members", "uid-1", membroComCampoId, GroupMember::class.java)

        assertNull(quebrado.toObjectOrNullSafely(GroupMember::class.java))
        assertEquals("uid-1", comId.toObjectOrNullSafely<GroupMember>()?.id)
        verify { AppLogger.e(any(), match { "uid-quebrado" in it }, any()) }
    }

    @Test
    fun `toObjectsTolerant le a lista inteira quando um documento tem o campo id`() {
        val docs = listOf(
            snapshot("members", "uid-1", membroComCampoId, GroupMember::class.java),
            snapshot("members", "uid-2", mapOf("user_id" to "uid-2", "user_name" to "Sicrano"), GroupMember::class.java)
        )
        val query = mockk<QuerySnapshot> {
            every { documents } returns docs
            // QuerySnapshot.toObjects real: converte um a um e propaga a primeira exceção.
            every { toObjects(GroupMember::class.java) } answers { docs.map { it.toObject(GroupMember::class.java) } }
        }

        assertFailsWith<RuntimeException> { query.toObjects(GroupMember::class.java) }
        assertEquals(listOf("uid-1", "uid-2"), query.toObjectsTolerant(GroupMember::class.java).map { it.id })
    }

    @Test
    fun `toObjectsTolerant deixa de fora so o documento ilegivel`() {
        val tipoErrado = mapOf("user_name" to mapOf("x" to 1))
        val docs = listOf(
            snapshot("members", "uid-quebrado", tipoErrado, GroupMember::class.java),
            snapshot("members", "uid-1", membroComCampoId, GroupMember::class.java)
        )
        val query = mockk<QuerySnapshot> {
            every { documents } returns docs
            every { toObjects(GroupMember::class.java) } answers { docs.map { it.toObject(GroupMember::class.java) } }
        }

        assertEquals(listOf("uid-1"), query.toObjectsTolerant<GroupMember>().map { it.id })
    }

    @Test
    fun `toObjectsTolerant sem falha usa o caminho normal`() {
        val esperado = listOf(GroupMember(id = "uid-1"))
        val query = mockk<QuerySnapshot> { every { toObjects(GroupMember::class.java) } returns esperado }

        assertEquals(esperado, query.toObjectsTolerant(GroupMember::class.java))
        verify(exactly = 0) { query.documents }
    }

    @Test
    fun `documentIdConflictField le o campo da mensagem e das causas`() {
        val conflito = RuntimeException(
            "'period' was found from document a/b, cannot apply @DocumentId on this property for class X"
        )

        assertEquals("period", documentIdConflictField(conflito))
        assertEquals("period", documentIdConflictField(RuntimeException("Could not deserialize", conflito)))
        assertNull(documentIdConflictField(RuntimeException("Failed to convert value of type String to long")))
        assertNull(documentIdConflictField(RuntimeException()))
    }

    @Test
    fun `convertIgnoringDocumentIdConflicts remove um campo por tentativa`() {
        fun conflito(campo: String) = RuntimeException(
            "'$campo' was found from document a/b, cannot apply @DocumentId on this property for class X"
        )
        val vistos = mutableListOf<Set<String>>()

        val resultado = convertIgnoringDocumentIdConflicts(
            mapOf("id" to "1", "name" to "n", "valor" to 3),
            conflito("id")
        ) { limpo ->
            vistos += limpo.keys.toSet()
            if ("name" in limpo) throw conflito("name")
            limpo["valor"]
        }

        assertEquals(3, resultado)
        assertEquals(listOf(setOf("name", "valor"), setOf("valor")), vistos)
    }

    @Test
    fun `convertIgnoringDocumentIdConflicts relanca quando o campo nao esta no primeiro nivel`() {
        val conflito = RuntimeException(
            "'id' was found from document a/b, cannot apply @DocumentId on this property for class X"
        )

        val erro = assertFailsWith<RuntimeException> {
            convertIgnoringDocumentIdConflicts(mapOf("aninhado" to mapOf("id" to "1")), conflito) { "nunca" }
        }

        assertEquals(conflito, erro)
    }
}
