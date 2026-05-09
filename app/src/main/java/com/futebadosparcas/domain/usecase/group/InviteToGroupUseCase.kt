package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.domain.model.GroupInvite
import com.futebadosparcas.domain.model.calculateGroupInviteExpirationDate
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase

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
    private val groupRepository: GroupRepository
) : SuspendUseCase<InviteToGroupParams, GroupInvite>() {

    override suspend fun execute(params: InviteToGroupParams): GroupInvite {
        require(params.groupId.isNotBlank()) {
            "ID do grupo é obrigatório"
        }
        require(params.invitedUserEmail.isNotBlank()) {
            "Email do usuário convidado é obrigatório"
        }

        val currentUserId = groupRepository.getCurrentUserId()
            ?: throw InviteToGroupException("Usuário não autenticado")

        val invitedUserResult = groupRepository.findUserByEmail(params.invitedUserEmail)
        val invitedUser = invitedUserResult.getOrNull()
            ?: throw InviteToGroupException("Usuário com este email não encontrado")

        val invitedUserId = invitedUser["uid"] as? String
            ?: throw InviteToGroupException("Erro ao recuperar ID do usuário")

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

        val isMemberResult = groupRepository.isUserMemberOfGroup(params.groupId, invitedUserId)
        if (isMemberResult.isSuccess && isMemberResult.getOrDefault(false)) {
            throw InviteToGroupException("Este usuário já é membro do grupo")
        }

        val existingInviteResult = groupRepository.hasPendingGroupInvite(
            params.groupId,
            invitedUserId
        )
        if (existingInviteResult.isSuccess && existingInviteResult.getOrDefault(false)) {
            throw InviteToGroupException("Já existe um convite pendente para este usuário")
        }

        val groupResult = groupRepository.getGroupById(params.groupId)
        if (groupResult.isFailure) {
            throw groupResult.exceptionOrNull() ?: Exception("Grupo não encontrado")
        }

        val group = groupResult.getOrNull()
            ?: throw InviteToGroupException("Erro ao recuperar dados do grupo")

        val senderNameResult = groupRepository.getCurrentUserName()
        val senderName = senderNameResult.getOrDefault("Usuário")

        val groupName = group.name
        val groupPhoto = group.photoUrl

        val expirationDate = calculateGroupInviteExpirationDate()

        val invite = GroupInvite(
            id = "",
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

        val result = groupRepository.createGroupInvite(invite)
        return result.getOrElse {
            throw InviteToGroupException(it.message ?: "Erro ao criar convite")
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
