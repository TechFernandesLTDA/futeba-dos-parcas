package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.domain.model.GroupInvite
<<<<<<< HEAD
=======
import com.futebadosparcas.domain.model.calculateGroupInviteExpirationDate
>>>>>>> f3237fc2328fe3c708bd99fb005154a8d51298a3
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import kotlinx.coroutines.tasks.await

/**
 * Use Case para enviar convite de entrada em grupo
 *
 * Permite que um admin/owner envie convites a outros usuários para entrar em um grupo.
 * Validações:
 * - O usuário que envia deve ser admin ou owner do grupo
 * - O usuário convidado não pode ser membro ativo do grupo
 * - Não pode convidar o mesmo usuário duas vezes (convite pendente)
 *
 * Fluxo:
 * 1. Valida IDs e email do usuário convidado
 * 2. Verifica permissão do remetente (admin/owner)
 * 3. Verifica se o usuário convidado já é membro
 * 4. Verifica se já existe convite pendente
 * 5. Cria novo convite com expiração em 48h
 * 6. Cria notificação para o usuário convidado
 *
 * Uso:
 * ```kotlin
 * val result = inviteToGroupUseCase(InviteToGroupParams(
 *     groupId = "group123",
 *     invitedUserEmail = "usuario@email.com"
 * ))
 *
 * result.fold(
 *     onSuccess = { invite -> /* convite enviado */ },
 *     onFailure = { error -> /* lidar com erro */ }
 * )
 * ```
 */
class InviteToGroupUseCase constructor(
    private val groupRepository: GroupRepository,
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) : SuspendUseCase<InviteToGroupParams, GroupInvite>() {

    override suspend fun execute(params: InviteToGroupParams): GroupInvite {
        // Validar que os IDs e email não estão vazios
        require(params.groupId.isNotBlank()) {
            "ID do grupo é obrigatório"
        }
        require(params.invitedUserEmail.isNotBlank()) {
            "Email do usuário convidado é obrigatório"
        }

        val currentUserId = auth.currentUser?.uid
            ?: throw InviteToGroupException("Usuário não autenticado")

        // Buscar usuário convidado pelo email
        val invitedUserResult = findUserByEmail(params.invitedUserEmail)
        val invitedUser = invitedUserResult.getOrNull()
            ?: throw InviteToGroupException("Usuário com este email não encontrado")

        val invitedUserId = invitedUser["uid"] as? String
            ?: throw InviteToGroupException("Erro ao recuperar ID do usuário")

        // Verificar se o usuário que convida é admin ou owner
        val roleResult = groupRepository.getMyRoleInGroup(params.groupId)
        if (roleResult.isFailure) {
            throw roleResult.exceptionOrNull() ?: Exception("Erro ao verificar permissão")
        }

        val senderRole = roleResult.getOrNull()
        if (senderRole != GroupMemberRole.ADMIN && senderRole != GroupMemberRole.OWNER) {
            throw InviteToGroupException(
                "Apenas administradores e o dono podem convidar membros"
            )
        }

        // Verificar se o usuário convidado já é membro ativo do grupo
        val isMemberResult = checkUserMembership(params.groupId, invitedUserId)
        if (isMemberResult) {
            throw InviteToGroupException("Este usuário já é membro do grupo")
        }

        // Verificar se já existe convite pendente
        val existingInviteResult = checkExistingPendingInvite(
            params.groupId,
            invitedUserId
        )
        if (existingInviteResult) {
            throw InviteToGroupException("Já existe um convite pendente para este usuário")
        }

        // Buscar dados do grupo
        val groupResult = groupRepository.getGroupById(params.groupId)
        if (groupResult.isFailure) {
            throw groupResult.exceptionOrNull() ?: Exception("Grupo não encontrado")
        }

        val group = groupResult.getOrNull()
            ?: throw InviteToGroupException("Erro ao recuperar dados do grupo")

        // Buscar dados do usuário que está enviando
        val senderUserDoc = firestore.collection("users").document(currentUserId).get().await()
        val senderName = senderUserDoc.getString("name") ?: "Usuário"

        // Buscar dados do grupo para exibição
        val groupName = group.name
        val groupPhoto = group.photoUrl

        // Criar convite
        val expirationDate = calculateGroupInviteExpirationDate()

        val invite = GroupInvite(
            id = "", // Será gerado pelo Firestore
            groupId = params.groupId,
            groupName = groupName,
            groupPhoto = groupPhoto,
            invitedUserId = invitedUserId,
            invitedUserName = invitedUser["name"] as? String ?: "",
            invitedUserEmail = params.invitedUserEmail,
            invitedById = currentUserId,
            invitedByName = senderName,
            expiresAt = expirationDate
        )

        // Salvar convite no Firestore
        val inviteRef = firestore.collection("group_invites").document()
        val inviteWithId = invite.copy(id = inviteRef.id)

        firestore.runTransaction { transaction ->
            transaction.set(inviteRef, inviteWithId)

            // Atualizar contagem de convites pendentes do usuário
            val userRef = firestore.collection("users").document(invitedUserId)
            transaction.update(userRef, "pending_invites_count", FieldValue.increment(1))
        }.await()

        return inviteWithId
    }

    /**
     * Busca um usuário pelo email no Firestore
     */
    private suspend fun findUserByEmail(email: String): Result<Map<String, Any>> {
        return try {
            val snapshot = firestore.collection("users")
                .whereEqualTo("email", email)
                .limit(1)
                .get()
                .await()

            if (snapshot.isEmpty) {
                Result.failure(Exception("Usuário não encontrado"))
            } else {
                val doc = snapshot.documents.first()
                val userData = doc.data ?: emptyMap()
                val userDataWithId = userData.toMutableMap()
                userDataWithId["uid"] = doc.id
                Result.success(userDataWithId)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Verifica se um usuário é membro ativo de um grupo
     */
    private suspend fun checkUserMembership(groupId: String, userId: String): Boolean {
        return try {
            val memberDoc = firestore.collection("groups")
                .document(groupId)
                .collection("members")
                .document(userId)
                .get()
                .await()

            if (memberDoc.exists()) {
                val status = memberDoc.getString("status")
                status == "ACTIVE"
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Verifica se já existe um convite pendente do mesmo grupo para o usuário
     */
    private suspend fun checkExistingPendingInvite(
        groupId: String,
        invitedUserId: String
    ): Boolean {
        return try {
            val snapshot = firestore.collection("group_invites")
                .whereEqualTo("group_id", groupId)
                .whereEqualTo("invited_user_id", invitedUserId)
                .whereEqualTo("status", "PENDING")
                .limit(1)
                .get()
                .await()

            snapshot.size() > 0
        } catch (e: Exception) {
            false
        }
    }
}

/**
 * Parâmetros para enviar convite a um grupo
 */
data class InviteToGroupParams(
    val groupId: String,
    val invitedUserEmail: String
)

/**
 * Exceção específica para operações de convite de grupo
 */
class InviteToGroupException(message: String) : Exception(message)
