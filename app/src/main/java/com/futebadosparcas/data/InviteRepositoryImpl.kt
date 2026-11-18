package com.futebadosparcas.data

import com.futebadosparcas.domain.model.*
import com.futebadosparcas.domain.repository.InviteRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.auth.FirebaseAuth.AuthStateListener
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import com.futebadosparcas.data.model.GroupInvite as FirestoreGroupInvite
import com.futebadosparcas.data.util.toObjectTolerant
import com.futebadosparcas.data.util.toObjectsTolerant
import com.futebadosparcas.util.toKmpGroupInvite
import com.futebadosparcas.util.toKmpGroupInvites
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import java.util.Date

/**
 * Implementacao Android do InviteRepository.
 * Usa Firebase Firestore para gerenciar convites de grupo.
 *
 * O documento de `group_invites` é lido e gravado pelo modelo Android
 * ([FirestoreGroupInvite], com `@PropertyName` em snake_case e `@DocumentId`) e convertido para o
 * modelo do domínio. O modelo do domínio não pode ir direto para o mapper do Firestore: ele só tem
 * `@SerialName`, que o mapper ignora, então os campos sairiam em camelCase (`groupId`, `expiresAt`
 * como número) e as regras recusariam a gravação; na leitura, os campos em snake_case ficariam vazios.
 */
class InviteRepositoryImpl constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) : InviteRepository {

    companion object {
        private const val TAG = "InviteRepository"
    }

    private val groupsCollection = firestore.collection("groups")
    private val invitesCollection = firestore.collection("group_invites")
    private val usersCollection = firestore.collection("users")

    /** Nome do perfil do convidado, ou vazio quando as regras negam a leitura do perfil alheio. */
    private suspend fun readInvitedUserName(invitedUserId: String): String = try {
        val doc = usersCollection.document(invitedUserId).get().await()
        doc.getString("nickname")?.takeIf { it.isNotBlank() } ?: doc.getString("name").orEmpty()
    } catch (e: Exception) {
        AppLogger.d(TAG) { "Perfil do convidado não pôde ser lido; convite segue sem o nome: ${e.message}" }
        ""
    }

    /**
     * `expires_at` em milissegundos. O campo é gravado como data (Timestamp) pelo web e pelo Android;
     * `getLong` lançaria nesse caso. Aceita também número, de gravações antigas.
     */
    private fun DocumentSnapshot.expiresAtMillis(): Long? = when (val raw = get("expires_at")) {
        is Timestamp -> raw.toDate().time
        is Date -> raw.time
        is Number -> raw.toLong()
        else -> null
    }

    override suspend fun createInvite(
        groupId: String,
        invitedUserId: String,
        invitedUserName: String?
    ): Result<GroupInvite> {
        return try {
            val currentUserId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Só o dono do grupo convida: é o que as regras de `group_invites` aceitam
            // (`isGroupOwnerById`, pelo `owner_id` do grupo) e o que o web faz. Um administrador
            // que passasse daqui receberia PERMISSION_DENIED na gravação.
            val groupDoc = groupsCollection.document(groupId).get().await()
            if (!groupDoc.exists()) {
                return Result.failure(Exception("Grupo não encontrado"))
            }
            if (groupDoc.getString("owner_id") != currentUserId) {
                return Result.failure(Exception("Só o dono do grupo pode enviar convites"))
            }

            // Verificar se o usuário já é membro
            val existingMember = groupsCollection.document(groupId)
                .collection("members")
                .document(invitedUserId)
                .get()
                .await()

            if (existingMember.exists()) {
                val status = existingMember.getString("status")
                if (status == GroupMemberStatus.ACTIVE.name) {
                    return Result.failure(Exception("Este jogador já é membro do grupo"))
                }
            }

            // Verificar se já existe convite pendente
            // P1 #12: Adicionar .limit() para evitar fetchar convites excessivos
            val existingInvite = invitesCollection
                .whereEqualTo("group_id", groupId)
                .whereEqualTo("invited_user_id", invitedUserId)
                .whereEqualTo("status", InviteStatus.PENDING.name)
                .limit(1)
                .get()
                .await()

            if (!existingInvite.isEmpty) {
                return Result.failure(Exception("Já existe um convite pendente para este jogador"))
            }

            // Dados do grupo (documento já lido acima)
            val groupName = groupDoc.getString("name") ?: ""
            val groupPhoto = groupDoc.getString("photo_url")

            // Nome do convidado: vem de quem chamou (a busca de jogadores já traz o nome). As regras
            // de `users` negam a leitura do perfil alheio que tenha e-mail gravado, então ler
            // `users/{convidado}` aqui derrubava o convite com PERMISSION_DENIED. Sem o nome, tenta
            // a leitura e segue sem ele se for negada. O e-mail do convidado não é copiado.
            val nomeDoConvidado = invitedUserName?.takeIf { it.isNotBlank() }
                ?: readInvitedUserName(invitedUserId)

            // Buscar dados do remetente
            val currentUserDoc = usersCollection.document(currentUserId).get().await()
            val currentUser = currentUserDoc.toObjectTolerant(User::class.java) ?: User(id = currentUserId, name = currentUserDoc.getString("name") ?: "")
            val currentUserName = currentUser.getDisplayName()

            // Criar convite. Os campos vão escritos um a um, no mesmo formato do web: as regras
            // exigem `created_at`, `updated_at` e `expires_at` como data. Gravar o modelo com
            // `@ServerTimestamp` não serve aqui: no emulador o `created_at` saiu sem data.
            val inviteRef = invitesCollection.document()
            val firestoreInvite = FirestoreGroupInvite(
                id = inviteRef.id,
                groupId = groupId,
                groupName = groupName,
                groupPhoto = groupPhoto,
                invitedUserId = invitedUserId,
                invitedUserName = nomeDoConvidado,
                invitedById = currentUserId,
                invitedByName = currentUserName,
                status = InviteStatus.PENDING.name,
                createdAt = Date(),
                expiresAt = FirestoreGroupInvite.calculateExpirationDate()
            )

            inviteRef.set(
                mapOf(
                    "group_id" to firestoreInvite.groupId,
                    "group_name" to firestoreInvite.groupName,
                    "group_photo" to firestoreInvite.groupPhoto,
                    "invited_user_id" to firestoreInvite.invitedUserId,
                    "invited_user_name" to firestoreInvite.invitedUserName,
                    "invited_by_id" to firestoreInvite.invitedById,
                    "invited_by_name" to firestoreInvite.invitedByName,
                    "status" to firestoreInvite.status,
                    "expires_at" to firestoreInvite.expiresAt,
                    "created_at" to FieldValue.serverTimestamp(),
                    "updated_at" to FieldValue.serverTimestamp()
                )
            ).await()

            Result.success(firestoreInvite.toKmpGroupInvite())
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao enviar convite para grupo", e)
            Result.failure(e)
        }
    }

    override suspend fun getMyPendingInvites(): Result<List<GroupInvite>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // P1 #12: Adicionar .limit() - máximo 50 convites pendentes por usuário
            val snapshot = invitesCollection
                .whereEqualTo("invited_user_id", userId)
                .whereEqualTo("status", InviteStatus.PENDING.name)
                .limit(50)
                .get()
                .await()

            val invites = snapshot.toObjectsTolerant(FirestoreGroupInvite::class.java).toKmpGroupInvites()
                .filter { it.hasExpired().not() }

            Result.success(invites)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar convites pendentes", e)
            Result.failure(e)
        }
    }

    /**
     * Flow do uid atual do auth — emite cada mudança (sign-in/sign-out).
     * FIX #584/M12: necessário pra trocar listener quando user troca.
     */
    private fun authUidFlow(): Flow<String?> = callbackFlow {
        // Emit initial uid
        trySend(auth.currentUser?.uid)
        val listener = AuthStateListener { firebaseAuth ->
            trySend(firebaseAuth.currentUser?.uid)
        }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    @kotlinx.coroutines.ExperimentalCoroutinesApi
    override fun getMyPendingInvitesFlow(): Flow<List<GroupInvite>> {
        // FIX #584/M12: era `val userId = auth.currentUser?.uid` capturado UMA VEZ
        // no início do flow → após sign-out + sign-in com outra conta, flow
        // continuava emitindo invites do user anterior.
        // Agora: flatMapLatest sobre authUidFlow → cada mudança de uid cancela
        // listener anterior e cria novo pra novo uid.
        return authUidFlow().flatMapLatest { userId ->
            if (userId == null) {
                flowOf(emptyList())
            } else {
                callbackFlow {
                    // P1 #12: Adicionar .limit() para real-time listener
                    val listener = invitesCollection
                        .whereEqualTo("invited_user_id", userId)
                        .whereEqualTo("status", InviteStatus.PENDING.name)
                        .limit(50)
                        .addSnapshotListener { snapshot, e ->
                            if (e != null) {
                                close(e)
                                return@addSnapshotListener
                            }

                            if (snapshot != null) {
                                val invites = snapshot.toObjectsTolerant(FirestoreGroupInvite::class.java).toKmpGroupInvites()
                                    .filter { it.hasExpired().not() }
                                    .sortedByDescending { it.createdAt }
                                trySend(invites)
                            } else {
                                trySend(emptyList())
                            }
                        }
                    awaitClose { listener.remove() }
                }
            }
        }
    }

    @Suppress("unused")
    private fun legacyGetMyPendingInvitesFlow(): Flow<List<GroupInvite>> = callbackFlow {
        val userId = auth.currentUser?.uid
        if (userId == null) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        // P1 #12: Adicionar .limit() para real-time listener
        val listener = invitesCollection
            .whereEqualTo("invited_user_id", userId)
            .whereEqualTo("status", InviteStatus.PENDING.name)
            .limit(50)
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    close(e)
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val invites = snapshot.toObjectsTolerant(FirestoreGroupInvite::class.java).toKmpGroupInvites()
                        .filter { it.hasExpired().not() }
                        .sortedByDescending { it.createdAt }
                    trySend(invites)
                } else {
                    trySend(emptyList())
                }
            }

        awaitClose { listener.remove() }
    }

    override suspend fun getGroupPendingInvites(groupId: String): Result<List<GroupInvite>> {
        return try {
            // P1 #12: Adicionar .limit() - máximo 100 convites pendentes por grupo
            val snapshot = invitesCollection
                .whereEqualTo("group_id", groupId)
                .whereEqualTo("status", InviteStatus.PENDING.name)
                .limit(100)
                .get()
                .await()

            val invites = snapshot.toObjectsTolerant(FirestoreGroupInvite::class.java).toKmpGroupInvites()
                .filter { it.hasExpired().not() }

            Result.success(invites)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar convites pendentes do grupo", e)
            Result.failure(e)
        }
    }

    override suspend fun acceptInvite(inviteId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val inviteDoc = invitesCollection.document(inviteId).get().await()
            if (!inviteDoc.exists()) {
                return Result.failure(Exception("Convite não encontrado"))
            }

            val invite = inviteDoc.toObjectTolerant(FirestoreGroupInvite::class.java)?.toKmpGroupInvite()
                ?: return Result.failure(Exception("Erro ao carregar convite"))

            if (invite.invitedUserId != userId) {
                return Result.failure(Exception("Este convite não é para você"))
            }

            if (!invite.canRespond()) {
                return Result.failure(Exception("Convite expirado ou já respondido"))
            }

            invitesCollection.document(inviteId).update(mapOf(
                "status" to InviteStatus.ACCEPTED.name,
                "updated_at" to FieldValue.serverTimestamp()
            )).await()

            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao aceitar convite", e)
            Result.failure(e)
        }
    }

    override suspend fun declineInvite(inviteId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val inviteDoc = invitesCollection.document(inviteId).get().await()
            if (!inviteDoc.exists()) {
                return Result.failure(Exception("Convite não encontrado"))
            }

            val invite = inviteDoc.toObjectTolerant(FirestoreGroupInvite::class.java)?.toKmpGroupInvite()
                ?: return Result.failure(Exception("Erro ao carregar convite"))

            if (invite.invitedUserId != userId) {
                return Result.failure(Exception("Este convite não é para você"))
            }

            if (!invite.canRespond()) {
                return Result.failure(Exception("Convite expirado ou já respondido"))
            }

            invitesCollection.document(inviteId).update(mapOf(
                "status" to InviteStatus.DECLINED.name,
                "updated_at" to FieldValue.serverTimestamp()
            )).await()

            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao recusar convite", e)
            Result.failure(e)
        }
    }

    override suspend fun cancelInvite(inviteId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val inviteDoc = invitesCollection.document(inviteId).get().await()
            if (!inviteDoc.exists()) {
                return Result.failure(Exception("Convite não encontrado"))
            }

            val invite = inviteDoc.toObjectTolerant(FirestoreGroupInvite::class.java)?.toKmpGroupInvite()
                ?: return Result.failure(Exception("Erro ao carregar convite"))

            // Verificar se é admin do grupo
            val memberDoc = groupsCollection.document(invite.groupId)
                .collection("members")
                .document(userId)
                .get()
                .await()

            if (!memberDoc.exists()) {
                return Result.failure(Exception("Você não é membro deste grupo"))
            }

            val member = memberDoc.toObjectTolerant(GroupMember::class.java)
            if (member?.isAdmin() != true) {
                return Result.failure(Exception("Sem permissão para cancelar convite"))
            }

            // Cancelar convite
            invitesCollection.document(inviteId).update(mapOf(
                "status" to InviteStatus.CANCELLED.name,
                "updated_at" to FieldValue.serverTimestamp()
            )).await()

            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao cancelar convite", e)
            Result.failure(e)
        }
    }

    override suspend fun getInviteById(inviteId: String): Result<GroupInvite> {
        return try {
            val doc = invitesCollection.document(inviteId).get().await()

            if (doc.exists()) {
                val invite = doc.toObjectTolerant(FirestoreGroupInvite::class.java)?.toKmpGroupInvite()
                    ?: return Result.failure(Exception("Erro ao converter convite"))
                Result.success(invite)
            } else {
                Result.failure(Exception("Convite não encontrado"))
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar convite por ID", e)
            Result.failure(e)
        }
    }

    override suspend fun countPendingInvites(): Result<Int> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // P1 #12: Adicionar .limit() para evitar leitura excessiva de contagem
            val snapshot = invitesCollection
                .whereEqualTo("invited_user_id", userId)
                .whereEqualTo("status", InviteStatus.PENDING.name)
                .limit(50)
                .get()
                .await()

            val nowMillis = System.currentTimeMillis()
            val count = snapshot.documents.count { doc ->
                doc.expiresAtMillis()?.let { it > nowMillis } == true
            }

            Result.success(count)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao contar convites pendentes", e)
            Result.failure(e)
        }
    }
}
