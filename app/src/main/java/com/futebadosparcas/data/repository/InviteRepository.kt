package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.Date
import javax.inject.Inject
import javax.inject.Singleton

interface InviteRepository {
    suspend fun createInvite(groupId: String, invitedUserId: String): Result<GroupInvite>
    suspend fun acceptInvite(inviteId: String): Result<Unit>
    suspend fun declineInvite(inviteId: String): Result<Unit>
    suspend fun cancelInvite(inviteId: String): Result<Unit>
    suspend fun getInviteById(inviteId: String): Result<GroupInvite>
    suspend fun countPendingInvites(): Result<Int>
    suspend fun getMyPendingInvites(): Result<List<GroupInvite>>
    fun getMyPendingInvitesFlow(): Flow<List<GroupInvite>>
    suspend fun getGroupPendingInvites(groupId: String): Result<List<GroupInvite>>
}

@Singleton
class InviteRepositoryImpl @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) : InviteRepository {

    private val groupsCollection = firestore.collection("groups")
    private val invitesCollection = firestore.collection("group_invites")
    private val usersCollection = firestore.collection("users")
    private val notificationsCollection = firestore.collection("notifications")

    override suspend fun createInvite(groupId: String, invitedUserId: String): Result<GroupInvite> {
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
            val invite = GroupInvite(
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
                expiresAt = invite.expiresAt
            )

            // Salvar convite e notificação em transação
            firestore.runTransaction { transaction ->
                transaction.set(inviteRef, invite)
                transaction.set(notificationRef, notification)
            }.await()

            Result.success(invite)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getMyPendingInvites(): Result<List<GroupInvite>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val now = Date()
            val snapshot = invitesCollection
                .whereEqualTo("invited_user_id", userId)
                .whereEqualTo("status", InviteStatus.PENDING.name)
                .get()
                .await()

            val invites = snapshot.toObjects(GroupInvite::class.java)
                .filter { it.expiresAt?.after(now) == true }

            Result.success(invites)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getMyPendingInvitesFlow(): Flow<List<GroupInvite>> = callbackFlow {
        val userId = auth.currentUser?.uid
        if (userId == null) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val listener = invitesCollection
            .whereEqualTo("invited_user_id", userId)
            .whereEqualTo("status", InviteStatus.PENDING.name)
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
                    trySend(invites)
                } else {
                    trySend(emptyList())
                }
            }

        awaitClose { listener.remove() }
    }

    override suspend fun getGroupPendingInvites(groupId: String): Result<List<GroupInvite>> {
        return try {
            val now = Date()
            val snapshot = invitesCollection
                .whereEqualTo("group_id", groupId)
                .whereEqualTo("status", InviteStatus.PENDING.name)
                .get()
                .await()

            val invites = snapshot.toObjects(GroupInvite::class.java)
                .filter { it.expiresAt?.after(now) == true }

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
                    actionType = NotificationAction.VIEW_DETAILS.name
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
                    actionType = NotificationAction.NONE.name
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

    override suspend fun getInviteById(inviteId: String): Result<GroupInvite> {
        return try {
            val doc = invitesCollection.document(inviteId).get().await()

            if (doc.exists()) {
                val invite = doc.toObject(GroupInvite::class.java)
                    ?: return Result.failure(Exception("Erro ao converter convite"))
                Result.success(invite)
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

