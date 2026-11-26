package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.GroupInvite
import com.futebadosparcas.domain.model.InviteStatus
import com.futebadosparcas.domain.model.calculateGroupInviteExpirationDate
import com.futebadosparcas.domain.repository.InviteRepository
import com.futebadosparcas.platform.firebase.toGroupInviteOrNull
import com.futebadosparcas.platform.firebase.tryGet
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.FirebaseAuth
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.FieldValue
import dev.gitlive.firebase.firestore.FirebaseFirestore
import dev.gitlive.firebase.firestore.Timestamp
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map

/**
 * Implementação KMP (Android + iOS) do InviteRepository.
 *
 * Porte fiel do [com.futebadosparcas.data.InviteRepositoryImpl] do app
 * Android (#4595 item 5) para o GitLive SDK: o documento de `group_invites`
 * é gravado campo a campo em snake_case (as regras exigem `created_at`,
 * `updated_at` e `expires_at` como datas) e lido pelo mapper tolerante
 * [toGroupInviteOrNull].
 *
 * Só o dono do grupo convida (`owner_id` do grupo — é o que as regras de
 * `group_invites` aceitam), como no Android e no web.
 */
class InviteRepositoryImpl(
    private val firestore: FirebaseFirestore = Firebase.firestore,
    private val auth: FirebaseAuth = Firebase.auth
) : InviteRepository {

    companion object {
        private const val TAG = "InviteRepository"
    }

    private val groupsCollection = firestore.collection("groups")
    private val invitesCollection = firestore.collection("group_invites")
    private val usersCollection = firestore.collection("users")

    /** Nome do perfil do convidado, ou vazio quando as regras negam a leitura do perfil alheio. */
    private suspend fun readInvitedUserName(invitedUserId: String): String = try {
        val doc = usersCollection.document(invitedUserId).get()
        doc.tryGet<String>("nickname")?.takeIf { it.isNotBlank() }
            ?: doc.tryGet<String>("name").orEmpty()
    } catch (e: Exception) {
        println("InviteRepository: perfil do convidado não lido; segue sem nome: ${e.message}")
        ""
    }

    override suspend fun createInvite(
        groupId: String,
        invitedUserId: String,
        invitedUserName: String?
    ): Result<GroupInvite> {
        return try {
            val currentUserId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Só o dono do grupo convida (regra de `group_invites` + paridade Android/web).
            val groupDoc = groupsCollection.document(groupId).get()
            if (!groupDoc.exists) {
                return Result.failure(Exception("Grupo não encontrado"))
            }
            if (groupDoc.tryGet<String>("owner_id") != currentUserId) {
                return Result.failure(Exception("Só o dono do grupo pode enviar convites"))
            }

            // Verificar se o usuário já é membro
            val existingMember = groupsCollection.document(groupId)
                .collection("members")
                .document(invitedUserId)
                .get()
            if (existingMember.exists) {
                val status = existingMember.tryGet<String>("status")
                if (status == "ACTIVE") {
                    return Result.failure(Exception("Este jogador já é membro do grupo"))
                }
            }

            // Verificar se já existe convite pendente
            val existingInvite = invitesCollection
                .where { "group_id" equalTo groupId }
                .where { "invited_user_id" equalTo invitedUserId }
                .where { "status" equalTo InviteStatus.PENDING.name }
                .limit(1)
                .get()
            if (existingInvite.documents.isNotEmpty()) {
                return Result.failure(Exception("Já existe um convite pendente para este jogador"))
            }

            val groupName = groupDoc.tryGet<String>("name") ?: ""
            val groupPhoto = groupDoc.tryGet<String>("photo_url")

            // Nome do convidado: vem de quem chamou (a busca já traz); sem ele, tenta ler
            // `users/{convidado}` e segue sem se for negada. O e-mail não é copiado.
            val nomeDoConvidado = invitedUserName?.takeIf { it.isNotBlank() }
                ?: readInvitedUserName(invitedUserId)

            // Buscar dados do remetente
            val currentUserDoc = usersCollection.document(currentUserId).get()
            val currentUserName = currentUserDoc.tryGet<String>("nickname")?.takeIf { it.isNotBlank() }
                ?: currentUserDoc.tryGet<String>("name").orEmpty()

            val inviteRef = invitesCollection.document
            val expiresAtMillis = calculateGroupInviteExpirationDate()
            val invite = GroupInvite(
                id = inviteRef.id,
                groupId = groupId,
                groupName = groupName,
                groupPhoto = groupPhoto,
                invitedUserId = invitedUserId,
                invitedUserName = nomeDoConvidado,
                invitedById = currentUserId,
                invitedByName = currentUserName,
                status = InviteStatus.PENDING.name,
                expiresAt = expiresAtMillis
            )

            inviteRef.set(
                mapOf(
                    "group_id" to invite.groupId,
                    "group_name" to invite.groupName,
                    "group_photo" to invite.groupPhoto,
                    "invited_user_id" to invite.invitedUserId,
                    "invited_user_name" to invite.invitedUserName,
                    "invited_by_id" to invite.invitedById,
                    "invited_by_name" to invite.invitedByName,
                    "status" to invite.status,
                    "expires_at" to Timestamp(expiresAtMillis / 1000, ((expiresAtMillis % 1000) * 1_000_000).toInt()),
                    "created_at" to FieldValue.serverTimestamp,
                    "updated_at" to FieldValue.serverTimestamp
                )
            )

            Result.success(invite)
        } catch (e: Exception) {
            println("InviteRepository: erro ao enviar convite: ${e.message}")
            Result.failure(e)
        }
    }

    override suspend fun getMyPendingInvites(): Result<List<GroupInvite>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = invitesCollection
                .where { "invited_user_id" equalTo userId }
                .where { "status" equalTo InviteStatus.PENDING.name }
                .limit(50)
                .get()

            Result.success(
                snapshot.documents.mapNotNull { it.toGroupInviteOrNull() }
                    .filter { !it.hasExpired() }
            )
        } catch (e: Exception) {
            println("InviteRepository: erro ao buscar convites pendentes: ${e.message}")
            Result.failure(e)
        }
    }

    override fun getMyPendingInvitesFlow(): Flow<List<GroupInvite>> {
        // #584/M12 (paridade Android): o uid é lido dentro do fluxo; sem usuário, lista vazia.
        return flow {
            val userId = auth.currentUser?.uid
            if (userId == null) {
                emit(emptyList())
                return@flow
            }
            val snapshotFlow = invitesCollection
                .where { "invited_user_id" equalTo userId }
                .where { "status" equalTo InviteStatus.PENDING.name }
                .limit(50)
                .snapshots()
            snapshotFlow
                .map { snapshot ->
                    snapshot.documents.mapNotNull { it.toGroupInviteOrNull() }
                        .filter { !it.hasExpired() }
                        .sortedByDescending { it.createdAt ?: 0L }
                }
                .collect { emit(it) }
        }.catch { e ->
            println("InviteRepository: erro ao observar convites: ${e.message}")
            emit(emptyList())
        }
    }

    override suspend fun getGroupPendingInvites(groupId: String): Result<List<GroupInvite>> {
        return try {
            val snapshot = invitesCollection
                .where { "group_id" equalTo groupId }
                .where { "status" equalTo InviteStatus.PENDING.name }
                .limit(100)
                .get()

            Result.success(
                snapshot.documents.mapNotNull { it.toGroupInviteOrNull() }
                    .filter { !it.hasExpired() }
            )
        } catch (e: Exception) {
            println("InviteRepository: erro ao buscar convites do grupo: ${e.message}")
            Result.failure(e)
        }
    }

    override suspend fun acceptInvite(inviteId: String): Result<Unit> =
        respondInvite(inviteId, InviteStatus.ACCEPTED.name)

    override suspend fun declineInvite(inviteId: String): Result<Unit> =
        respondInvite(inviteId, InviteStatus.DECLINED.name)

    private suspend fun respondInvite(inviteId: String, newStatus: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val inviteDoc = invitesCollection.document(inviteId).get()
            if (!inviteDoc.exists) {
                return Result.failure(Exception("Convite não encontrado"))
            }
            val invite = inviteDoc.toGroupInviteOrNull()
                ?: return Result.failure(Exception("Erro ao carregar convite"))
            if (invite.invitedUserId != userId) {
                return Result.failure(Exception("Este convite não é para você"))
            }
            if (!invite.canRespond()) {
                return Result.failure(Exception("Convite expirado ou já respondido"))
            }

            invitesCollection.document(inviteId).update(
                mapOf(
                    "status" to newStatus,
                    "updated_at" to FieldValue.serverTimestamp
                )
            )
            Result.success(Unit)
        } catch (e: Exception) {
            println("InviteRepository: erro ao responder convite: ${e.message}")
            Result.failure(e)
        }
    }

    override suspend fun cancelInvite(inviteId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val inviteDoc = invitesCollection.document(inviteId).get()
            if (!inviteDoc.exists) {
                return Result.failure(Exception("Convite não encontrado"))
            }
            val invite = inviteDoc.toGroupInviteOrNull()
                ?: return Result.failure(Exception("Erro ao carregar convite"))

            // Verificar se é admin do grupo (roles de membros).
            val memberDoc = groupsCollection.document(invite.groupId)
                .collection("members")
                .document(userId)
                .get()
            if (!memberDoc.exists) {
                return Result.failure(Exception("Você não é membro deste grupo"))
            }
            val role = memberDoc.tryGet<String>("role") ?: ""
            if (role != "ADMIN" && role != "OWNER") {
                return Result.failure(Exception("Sem permissão para cancelar convite"))
            }

            invitesCollection.document(inviteId).update(
                mapOf(
                    "status" to InviteStatus.CANCELLED.name,
                    "updated_at" to FieldValue.serverTimestamp
                )
            )
            Result.success(Unit)
        } catch (e: Exception) {
            println("InviteRepository: erro ao cancelar convite: ${e.message}")
            Result.failure(e)
        }
    }

    override suspend fun getInviteById(inviteId: String): Result<GroupInvite> {
        return try {
            val doc = invitesCollection.document(inviteId).get()
            val invite = if (doc.exists) doc.toGroupInviteOrNull() else null
            if (invite != null) {
                Result.success(invite)
            } else {
                Result.failure(
                    Exception(if (doc.exists) "Erro ao converter convite" else "Convite não encontrado")
                )
            }
        } catch (e: Exception) {
            println("InviteRepository: erro ao buscar convite por ID: ${e.message}")
            Result.failure(e)
        }
    }

    override suspend fun countPendingInvites(): Result<Int> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = invitesCollection
                .where { "invited_user_id" equalTo userId }
                .where { "status" equalTo InviteStatus.PENDING.name }
                .limit(50)
                .get()

            val nowMillis = kotlinx.datetime.Clock.System.now().toEpochMilliseconds()
            Result.success(
                snapshot.documents.count { doc ->
                    (doc.toGroupInviteOrNull()?.expiresAt ?: 0L) > nowMillis
                }
            )
        } catch (e: Exception) {
            println("InviteRepository: erro ao contar convites: ${e.message}")
            Result.failure(e)
        }
    }
}
