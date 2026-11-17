package com.futebadosparcas.permissions

import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.GroupMemberStatus
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.util.MockLogExtension
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.CollectionReference
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Papel efetivo do membro no grupo: a saída e a remoção mudam o `status` do documento
 * e mantêm o papel gravado. Quem está REMOVED ou INACTIVE não deveria manter papel ativo.
 */
@ExtendWith(MockLogExtension::class)
class GroupMemberStatusRoleTest {

    private val firestore = mockk<FirebaseFirestore>(relaxed = true)
    private val auth = mockk<FirebaseAuth>()
    private val groupsCollection = mockk<CollectionReference>(relaxed = true)
    private val membersCollection = mockk<CollectionReference>()
    private lateinit var repository: GroupRepository

    @BeforeEach
    fun setUp() {
        val usuario = mockk<FirebaseUser>()
        every { usuario.uid } returns "ex-admin-1"
        every { auth.currentUser } returns usuario
        every { firestore.collection("groups") } returns groupsCollection
        repository = GroupRepository(firestore, auth, mockk(relaxed = true), mockk(relaxed = true))
    }

    private fun membroComDocumento(role: String, status: String) {
        val member = GroupMember(userId = "ex-admin-1", userName = "Ex-admin", role = role, status = status)
        val snapshot = mockk<DocumentSnapshot>()
        every { snapshot.exists() } returns true
        every { snapshot.toObject(GroupMember::class.java) } returns member
        val memberDoc = mockk<DocumentReference>()
        every { memberDoc.get() } returns Tasks.forResult(snapshot)
        every { membersCollection.document("ex-admin-1") } returns memberDoc
        val groupDoc = mockk<DocumentReference>()
        every { groupDoc.collection("members") } returns membersCollection
        every { groupsCollection.document("group-1") } returns groupDoc
    }

    @Test
    fun getMyRoleInGroup_membroAtivo_devolvePapelGravado() = runTest {
        membroComDocumento(role = GroupMemberRole.ADMIN.name, status = GroupMemberStatus.ACTIVE.name)

        val papel = repository.getMyRoleInGroup("group-1").getOrNull()

        assertEquals(GroupMemberRole.ADMIN, papel)
    }

    @Test
    @Disabled("DEFEITO: app/src/main/java/com/futebadosparcas/data/repository/GroupRepository.kt:405")
    fun getMyRoleInGroup_adminRemovido_naoDevolvePapelAtivo() = runTest {
        // Esperado: após remoção (status REMOVED) o papel efetivo deve ser nulo, como em não-membro.
        // Hoje o método só checa exists(), então o ADMIN removido segue com papel ADMIN
        // e InviteRepositoryImpl/InviteToGroupUseCase o aceitam para convidar.
        membroComDocumento(role = GroupMemberRole.ADMIN.name, status = GroupMemberStatus.REMOVED.name)

        val papel = repository.getMyRoleInGroup("group-1").getOrNull()

        assertEquals(null, papel)
    }
}
