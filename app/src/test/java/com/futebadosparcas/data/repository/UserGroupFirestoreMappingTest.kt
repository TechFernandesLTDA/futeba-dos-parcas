package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.GroupStatus
import com.futebadosparcas.util.AppLogger
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.runs
import io.mockk.unmockkObject
import io.mockk.verify
import java.util.Date
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/**
 * Regressão do fechamento do app em "Encontrar Grupo" (1.43.2, build 86).
 *
 * O listener de `users/{uid}/groups` usava `toObjects(UserGroup::class.java)`. Um documento com o campo `id`
 * gravado fazia o mapper lançar "'id' was found from document ..., cannot apply @DocumentId", na thread
 * principal. Spec: specs/bugfix-2026-11-15-android-crash-meus-grupos-documentid.md.
 */
class UserGroupFirestoreMappingTest {

    @BeforeEach
    fun setUp() {
        mockkObject(AppLogger)
        every { AppLogger.e(any(), any(), any()) } just runs
    }

    @AfterEach
    fun tearDown() {
        unmockkObject(AppLogger)
    }

    private fun doc(id: String, data: Map<String, Any?>?): DocumentSnapshot = mockk {
        every { this@mockk.id } returns id
        every { this@mockk.data } returns data
    }

    // Formato do documento de produção que fechou o app: campo `id` igual ao ID do documento.
    private val docComCampoId = mapOf(
        "id" to "grupo-1",
        "group_id" to "grupo-1",
        "group_name" to "Pelada de quinta",
        "group_photo" to "https://example.com/foto.jpg",
        "role" to GroupMemberRole.OWNER.name,
        "member_count" to 12L,
        "group_status" to GroupStatus.ACTIVE.name,
        "joined_at" to Date(1_700_000_000_000)
    )

    @Test
    fun `documento com campo id gravado vira UserGroup sem lancar`() {
        val grupo = userGroupFromFirestore("grupo-1", docComCampoId)

        assertEquals("grupo-1", grupo.id)
        assertEquals("grupo-1", grupo.groupId)
        assertEquals("Pelada de quinta", grupo.groupName)
        assertEquals("https://example.com/foto.jpg", grupo.groupPhoto)
        assertEquals(GroupMemberRole.OWNER.name, grupo.role)
        assertEquals(12, grupo.memberCount)
        assertEquals(GroupStatus.ACTIVE.name, grupo.groupStatus)
        assertEquals(Date(1_700_000_000_000), grupo.joinedAt)
    }

    @Test
    fun `id vem do ID do documento mesmo se o campo id gravado for outro`() {
        val grupo = userGroupFromFirestore("grupo-1", docComCampoId + ("id" to "valor-antigo"))

        assertEquals("grupo-1", grupo.id)
    }

    @Test
    fun `campos ausentes caem no padrao do modelo`() {
        val grupo = userGroupFromFirestore("grupo-2", emptyMap())

        assertEquals("grupo-2", grupo.id)
        assertEquals("grupo-2", grupo.groupId)
        assertEquals("", grupo.groupName)
        assertNull(grupo.groupPhoto)
        assertEquals(GroupMemberRole.MEMBER.name, grupo.role)
        assertEquals(0, grupo.memberCount)
        assertEquals(GroupStatus.ACTIVE.name, grupo.groupStatus)
        assertNull(grupo.joinedAt)
    }

    @Test
    fun `tipos inesperados nao lancam`() {
        val grupo = userGroupFromFirestore(
            "grupo-3",
            mapOf(
                "group_name" to 123L,
                "member_count" to "doze",
                "joined_at" to "ontem",
                "role" to null
            )
        )

        assertEquals("", grupo.groupName)
        assertEquals(0, grupo.memberCount)
        assertNull(grupo.joinedAt)
        assertEquals(GroupMemberRole.MEMBER.name, grupo.role)
    }

    @Test
    fun `member_count aceita Long e Double e joined_at aceita Timestamp`() {
        val quando = Date(1_700_000_000_000)

        assertEquals(7, userGroupFromFirestore("g", mapOf("member_count" to 7L)).memberCount)
        assertEquals(7, userGroupFromFirestore("g", mapOf("member_count" to 7.0)).memberCount)
        assertEquals(quando, userGroupFromFirestore("g", mapOf("joined_at" to Timestamp(quando))).joinedAt)
    }

    @Test
    fun `lista so os grupos ativos e inclui o documento com campo id`() {
        val documentos = listOf(
            doc("grupo-1", docComCampoId),
            doc("grupo-arquivado", mapOf("group_status" to GroupStatus.ARCHIVED.name)),
            doc("grupo-sem-status", mapOf("group_name" to "Sem status"))
        )

        val grupos = activeUserGroupsFrom(documentos, "Teste")

        assertEquals(listOf("grupo-1", "grupo-sem-status"), grupos.map { it.id })
    }

    @Test
    fun `documento que lanca ao ser lido fica fora da lista e os outros seguem`() {
        val quebrado = mockk<DocumentSnapshot> {
            every { id } returns "grupo-quebrado"
            every { data } throws RuntimeException("falha do mapper")
        }

        val grupos = activeUserGroupsFrom(listOf(quebrado, doc("grupo-1", docComCampoId)), "Teste")

        assertEquals(listOf("grupo-1"), grupos.map { it.id })
        verify(exactly = 1) { AppLogger.e("Teste", match { "grupo-quebrado" in it }, any()) }
    }

    @Test
    fun `documento sem dados e lista vazia nao lancam`() {
        assertTrue(activeUserGroupsFrom(emptyList(), "Teste").isEmpty())
        assertEquals(listOf("grupo-vazio"), activeUserGroupsFrom(listOf(doc("grupo-vazio", null)), "Teste").map { it.id })
    }
}
