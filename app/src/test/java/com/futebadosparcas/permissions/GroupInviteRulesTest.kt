package com.futebadosparcas.permissions

import com.futebadosparcas.data.InviteRepositoryImpl
import com.futebadosparcas.data.model.GroupInvite as FirestoreGroupInvite
import com.futebadosparcas.domain.model.GroupInvite
import com.futebadosparcas.domain.model.InviteStatus
import com.futebadosparcas.domain.model.calculateGroupInviteExpirationDate
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
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Regras de convite de grupo: ciclo de vida (pendente, aceito, recusado, expirado, cancelado)
 * e as respostas do repositório a aceitar/recusar (convite de outro usuário, expirado, inexistente).
 */
@ExtendWith(MockLogExtension::class)
class GroupInviteRulesTest {

    private val umaHora = 60L * 60 * 1000
    private val auth = mockk<FirebaseAuth>()
    private val firestore = mockk<FirebaseFirestore>()
    private val groupsCollection = mockk<CollectionReference>(relaxed = true)
    private val invitesCollection = mockk<CollectionReference>()
    private val usersCollection = mockk<CollectionReference>(relaxed = true)
    private lateinit var repository: InviteRepositoryImpl

    @BeforeEach
    fun setUp() {
        every { firestore.collection("groups") } returns groupsCollection
        every { firestore.collection("group_invites") } returns invitesCollection
        every { firestore.collection("users") } returns usersCollection
        loginAs("invitee-1")
        repository = InviteRepositoryImpl(auth, firestore)
    }

    private fun loginAs(uid: String?) {
        if (uid == null) {
            every { auth.currentUser } returns null
            return
        }
        val user = mockk<FirebaseUser>()
        every { user.uid } returns uid
        every { auth.currentUser } returns user
    }

    private fun invite(
        status: String = InviteStatus.PENDING.name,
        invitedUserId: String = "invitee-1",
        expiresAt: Long? = System.currentTimeMillis() + umaHora
    ) = GroupInvite(
        id = "inv-1",
        groupId = "group-1",
        groupName = "Pelada FC",
        invitedUserId = invitedUserId,
        invitedUserEmail = "convidado@example.test",
        invitedById = "owner-1",
        status = status,
        expiresAt = expiresAt
    )

    /**
     * Registra o documento do convite e devolve o DocumentReference para verificações de escrita.
     * O repositório lê o documento pelo modelo do Firestore (`data.model.GroupInvite`, snake_case) e
     * converte para o domínio, então o stub devolve o modelo do Firestore com os mesmos valores.
     */
    private fun stubInviteDocument(id: String, invite: GroupInvite?): DocumentReference {
        val snapshot = mockk<DocumentSnapshot>()
        every { snapshot.exists() } returns (invite != null)
        every { snapshot.toObject(FirestoreGroupInvite::class.java) } returns invite?.toFirestoreModel()
        val docRef = mockk<DocumentReference>()
        every { docRef.get() } returns Tasks.forResult(snapshot)
        every { docRef.update(any<Map<String, Any>>()) } returns Tasks.forResult<Void?>(null)
        every { invitesCollection.document(id) } returns docRef
        return docRef
    }

    private fun GroupInvite.toFirestoreModel(): FirestoreGroupInvite = FirestoreGroupInvite(
        id = id,
        groupId = groupId,
        groupName = groupName,
        invitedUserId = invitedUserId,
        invitedUserEmail = invitedUserEmail,
        invitedById = invitedById,
        status = status,
        expiresAt = expiresAt?.let { java.util.Date(it) }
    )

    // ---------- Modelo: ciclo de vida do convite ----------

    @Test
    fun canRespond_pendenteDentroDoPrazo_permiteResponder() {
        assertTrue(invite().canRespond())
    }

    @Test
    fun canRespond_pendenteVencido_negaResponder() {
        val vencido = invite(expiresAt = System.currentTimeMillis() - 1_000)

        assertTrue(vencido.hasExpired())
        assertFalse(vencido.canRespond())
    }

    @Test
    fun canRespond_aceitoRecusadoOuCancelado_negaNovaResposta() {
        listOf(
            InviteStatus.ACCEPTED,
            InviteStatus.DECLINED,
            InviteStatus.CANCELLED
        ).forEach { status ->
            assertFalse(invite(status = status.name).canRespond(), "status ${status.name}")
        }
    }

    // ---------- Repositório: aceitar e recusar ----------

    @Test
    fun acceptInvite_convitePendenteDoConvidado_gravaStatusAceito() = runTest {
        val docRef = stubInviteDocument("inv-1", invite())

        val result = repository.acceptInvite("inv-1")

        assertTrue(result.isSuccess)
        verify(exactly = 1) {
            docRef.update(match<Map<String, Any>> { it["status"] == InviteStatus.ACCEPTED.name })
        }
    }

    @Test
    fun acceptInvite_conviteDeOutroUsuario_negaENaoGrava() = runTest {
        val docRef = stubInviteDocument("inv-1", invite(invitedUserId = "outro-usuario"))

        val result = repository.acceptInvite("inv-1")

        assertTrue(result.isFailure)
        assertEquals("Este convite não é para você", result.exceptionOrNull()?.message)
        verify(exactly = 0) { docRef.update(any<Map<String, Any>>()) }
    }

    @Test
    fun acceptInvite_conviteExpirado_negaEAceitaNada() = runTest {
        val docRef = stubInviteDocument(
            "inv-1",
            invite(expiresAt = System.currentTimeMillis() - 1_000)
        )

        val result = repository.acceptInvite("inv-1")

        assertTrue(result.isFailure)
        verify(exactly = 0) { docRef.update(any<Map<String, Any>>()) }
    }

    @Test
    fun acceptInvite_conviteInexistente_negaConviteNaoEncontrado() = runTest {
        stubInviteDocument("inv-404", null)

        val result = repository.acceptInvite("inv-404")

        assertEquals("Convite não encontrado", result.exceptionOrNull()?.message)
    }

    @Test
    fun acceptInvite_conviteJaRespondido_negaNovaResposta() = runTest {
        stubInviteDocument("inv-1", invite(status = InviteStatus.DECLINED.name))

        val result = repository.acceptInvite("inv-1")

        assertTrue(result.isFailure)
    }

    @Test
    fun acceptInvite_semLogin_negaSemConsultarConvite() = runTest {
        loginAs(null)

        val result = repository.acceptInvite("inv-1")

        assertEquals("Usuário não autenticado", result.exceptionOrNull()?.message)
    }

    @Test
    fun declineInvite_convitePendenteDoConvidado_gravaStatusRecusado() = runTest {
        val docRef = stubInviteDocument("inv-1", invite())

        val result = repository.declineInvite("inv-1")

        assertTrue(result.isSuccess)
        verify(exactly = 1) {
            docRef.update(match<Map<String, Any>> { it["status"] == InviteStatus.DECLINED.name })
        }
    }

}
