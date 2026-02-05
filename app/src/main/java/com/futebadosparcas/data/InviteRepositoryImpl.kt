package com.futebadosparcas.data

import com.futebadosparcas.data.model.*
import com.futebadosparcas.domain.model.GroupInvite as KmpGroupInvite
import com.futebadosparcas.domain.model.InviteStatus as KmpInviteStatus
import com.futebadosparcas.domain.repository.InviteRepository
import com.futebadosparcas.util.toKmpGroupInvite
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.util.Date
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implementacao Android do InviteRepository.
 * Usa Firebase Firestore para gerenciar convites de grupo.
 */
@Singleton
class InviteRepositoryImpl @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) : InviteRepository {

    private val groupsCollection = firestore.collection("groups")
    private val invitesCollection = firestore.collection("group_invites")
    private val usersCollection = firestore.collection("users")
    private val notificationsCollection = firestore.collection("notifications")

    override suspend fun createInvite(groupId: String, invitedUserId: String): Result<KmpGroupInvite> {
        return try {
            val currentUserId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se pode convidar (é admin do grupo)
            val memberDoc = groupsCollection.document(groupId)
                .collection("members")
                .document(currentUserId)
                .get()
                .await()

            if (!memberDoc.exists()) {
                return Result.failure(Exception("Você não é membro deste grupo"))
            }

            val member = memberDoc.toObject(GroupMember::class.java)
            if (member?.canInvite() != true) {
                return Result.failure(Exception("Você não tem permissão para convidar"))
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
            val existingInvite = invitesCollection
                .whereEqualTo("group_id", groupId)
                .whereEqualTo("invited_user_id", invitedUserId)
                .whereEqualTo("status", InviteStatus.PENDING.name)
                .get()
                .await()

            if (!existingInvite.isEmpty) {
                return Result.failure(Exception("Já existe um convite pendente para este jogador"))
            }

            // Buscar dados do grupo
            val groupDoc = groupsCollection.document(groupId).get().await()
            val groupName = groupDoc.getString("name") ?: ""
            val groupPhoto = groupDoc.getString("photo_url")

            // Buscar dados do convidado
            val invitedUserDoc = usersCollection.document(invitedUserId).get().await()
            val invitedUser = invitedUserDoc.toObject(User::class.java) ?: User(id = invitedUserId, name = invitedUserDoc.getString("name") ?: "")
            val invitedUserName = invitedUser.getDisplayName()
            val invitedUserEmail = invitedUser.email

            // Buscar dados do remetente
            val currentUserDoc = usersCollection.document(currentUserId).get().await()
            val currentUser = currentUserDoc.toObject(User::class.java) ?: User(id = currentUserId, name = currentUserDoc.getString("name") ?: "")
            val currentUserName = currentUser.getDisplayName()

            // Criar convite
            val inviteRef = invitesCollection.document()
            val androidInvite = GroupInvite(
                id = inviteRef.id,
                groupId = groupId,
                groupName = groupName,
                groupPhoto = groupPhoto,
                invitedUserId = invitedUserId,
                invitedUserName = invitedUserName,
                invitedUserEmail = invitedUserEmail,
                invitedById = currentUserId,
                invitedByName = currentUserName,
                status = InviteStatus.PENDING.name,
                expiresAt = GroupInvite.calculateExpirationDate()
            )

            // Criar notificação
            val notificationRef = notificationsCollection.document()
            val notification = AppNotification(
                id = notificationRef.id,
                userId = invitedUserId,
                type = NotificationType.GROUP_INVITE.name,
                title = "Convite para grupo",
                message = "$currentUserName convidou você para o grupo $groupName",
                senderId = currentUserId,
                senderName = currentUserName,
                senderPhoto = currentUser.photoUrl,
                referenceId = inviteRef.id,
                referenceType = "invite",
                actionType = NotificationAction.ACCEPT_DECLINE.name,
                createdAtRaw = Date(),
                expiresAtRaw = androidInvite.expiresAt
            )

            // Salvar convite e notificação em transação
            firestore.runTransaction { transaction ->
                transaction.set(inviteRef, androidInvite)
                transaction.set(notificationRef, notification)
            }.await()

            Result.success(androidInvite.toKmpGroupInvite())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getMyPendingInvites(): Result<List<KmpGroupInvite>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val now = Date()
            // PERF P1 #12: Adicionado .limit(50) para evitar leitura ilimitada
            val snapshot = invitesCollection
                .whereEqualTo("invited_user_id", userId)
                .whereEqualTo("status", InviteStatus.PENDING.name)
                .limit(50) // Limita a 50 convites pendentes
                .get()
                .await()

            val invites = snapshot.toObjects(GroupInvite::class.java)
                .filter { it.expiresAt?.after(now) == true }
                .map { it.toKmpGroupInvite() }

            Result.success(invites)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getMyPendingInvitesFlow(): Flow<List<KmpGroupInvite>> = callbackFlow {
        val userId = auth.currentUser?.uid
        if (userId == null) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        // PERF P1 #12: Adicionado .limit(50) para evitar leitura ilimitada em real-time
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
                    val now = Date()
                    val invites = snapshot.toObjects(GroupInvite::class.java)
                        .filter { it.expiresAt?.after(now) == true }
                        .sortedByDescending { it.createdAt }
                        .map { it.toKmpGroupInvite() }
                    trySend(invites)
                } else {
                    trySend(emptyList())
                }
            }

        awaitClose { listener.remove() }
    }

    override suspend fun getGroupPendingInvites(groupId: String): Result<List<KmpGroupInvite>> {
        return try {
            val now = Date()
            val snapshot = invitesCollection
                .whereEqualTo("group_id", groupId)
                .whereEqualTo("status", InviteStatus.PENDING.name)
                .get()
                .await()

            val invites = snapshot.toObjects(GroupInvite::class.java)
                .filter { it.expiresAt?.after(now) == true }
                .map { it.toKmpGroupInvite() }

            Result.success(invites)
        } catch (e: Exception) {
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

            val invite = inviteDoc.toObject(GroupInvite::class.java)
                ?: return Result.failure(Exception("Erro ao carregar convite"))

            if (invite.invitedUserId != userId) {
                return Result.failure(Exception("Este convite não é para você"))
            }

            if (!invite.canRespond()) {
                return Result.failure(Exception("Convite expirado ou já respondido"))
            }

            // Buscar dados do usuário
            val userDoc = usersCollection.document(userId).get().await()
            val user = userDoc.toObject(User::class.java) ?: User(id = userId, name = userDoc.getString("name") ?: "")
            val userNameDisplay = user.getDisplayName()

            // Buscar contagem atual de membros
            val groupDoc = groupsCollection.document(invite.groupId).get().await()
            val currentMemberCount = groupDoc.getLong("member_count")?.toInt() ?: 0
            val newMemberCount = currentMemberCount + 1

            // Executar transação
            firestore.runTransaction { transaction ->
                // 1. Atualizar status do convite
                val inviteRef = invitesCollection.document(inviteId)
                transaction.update(inviteRef, mapOf(
                    "status" to InviteStatus.ACCEPTED.name,
                    "responded_at" to FieldValue.serverTimestamp()
                ))

                // 2. Adicionar como membro do grupo
                val memberRef = groupsCollection.document(invite.groupId)
                    .collection("members").document(userId)

                val member = GroupMember(
                    id = userId,
                    userId = userId,
                    userName = user.name, // Mantem nome original
                    nickname = user.nickname, // Adiciona apelido
                    userPhoto = user.photoUrl,
                    role = GroupMemberRole.MEMBER.name,
                    status = GroupMemberStatus.ACTIVE.name,
                    invitedBy = invite.invitedById
                )
                transaction.set(memberRef, member)

                // 3. Atualizar member_count no grupo principal
                val groupRef = groupsCollection.document(invite.groupId)
                transaction.update(groupRef, "member_count", newMemberCount)

                // 4. Adicionar referência no usuário que está entrando
                val userGroupRef = usersCollection.document(userId)
                    .collection("groups").document(invite.groupId)
                val userGroup = UserGroup(
                    id = invite.groupId,
                    groupId = invite.groupId,
                    groupName = invite.groupName,
                    groupPhoto = invite.groupPhoto,
                    role = GroupMemberRole.MEMBER.name,
                    memberCount = newMemberCount
                )
                transaction.set(userGroupRef, userGroup)

                // 5. Criar notificação para quem convidou
                val notificationRef = notificationsCollection.document()
                val notification = AppNotification(
                    id = notificationRef.id,
                    userId = invite.invitedById,
                    type = NotificationType.GROUP_INVITE_ACCEPTED.name,
                    title = "Convite aceito",
                    message = "$userNameDisplay aceitou o convite para o grupo ${invite.groupName}",
                    senderId = userId,
                    senderName = userNameDisplay,
                    referenceId = invite.groupId,
                    referenceType = "group",
                    actionType = NotificationAction.VIEW_DETAILS.name,
                    createdAtRaw = Date()
                )
                transaction.set(notificationRef, notification)
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
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

            val invite = inviteDoc.toObject(GroupInvite::class.java)
                ?: return Result.failure(Exception("Erro ao carregar convite"))

            if (invite.invitedUserId != userId) {
                return Result.failure(Exception("Este convite não é para você"))
            }

            if (!invite.canRespond()) {
                return Result.failure(Exception("Convite expirado ou já respondido"))
            }

            // Buscar dados do usuário
            val userDoc = usersCollection.document(userId).get().await()
            val user = userDoc.toObject(User::class.java) ?: User(id = userId, name = userDoc.getString("name") ?: "")
            val userNameDisplay = user.getDisplayName()

            // Executar transação
            firestore.runTransaction { transaction ->
                // 1. Atualizar status do convite
                val inviteRef = invitesCollection.document(inviteId)
                transaction.update(inviteRef, mapOf(
                    "status" to InviteStatus.DECLINED.name,
                    "responded_at" to FieldValue.serverTimestamp()
                ))

                // 2. Criar notificação para quem convidou
                val notificationRef = notificationsCollection.document()
                val notification = AppNotification(
                    id = notificationRef.id,
                    userId = invite.invitedById,
                    type = NotificationType.GROUP_INVITE_DECLINED.name,
                    title = "Convite recusado",
                    message = "$userNameDisplay recusou o convite para o grupo ${invite.groupName}",
                    senderId = userId,
                    senderName = userNameDisplay,
                    referenceId = invite.groupId,
                    referenceType = "group",
                    actionType = NotificationAction.NONE.name,
                    createdAtRaw = Date()
                )
                transaction.set(notificationRef, notification)
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
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

            val invite = inviteDoc.toObject(GroupInvite::class.java)
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

            val member = memberDoc.toObject(GroupMember::class.java)
            if (member?.isAdmin() != true) {
                return Result.failure(Exception("Sem permissão para cancelar convite"))
            }

            // Cancelar convite
            invitesCollection.document(inviteId).update(mapOf(
                "status" to InviteStatus.CANCELLED.name,
                "responded_at" to FieldValue.serverTimestamp()
            )).await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getInviteById(inviteId: String): Result<KmpGroupInvite> {
        return try {
            val doc = invitesCollection.document(inviteId).get().await()

            if (doc.exists()) {
                val invite = doc.toObject(GroupInvite::class.java)
                    ?: return Result.failure(Exception("Erro ao converter convite"))
                Result.success(invite.toKmpGroupInvite())
            } else {
                Result.failure(Exception("Convite não encontrado"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun countPendingInvites(): Result<Int> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val now = Date()

            val snapshot = invitesCollection
                .whereEqualTo("invited_user_id", userId)
                .whereEqualTo("status", InviteStatus.PENDING.name)
                .get()
                .await()

            val count = snapshot.documents.count { doc ->
                val expiresAt = doc.getDate("expires_at")
                expiresAt?.after(now) == true
            }

            Result.success(count)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
