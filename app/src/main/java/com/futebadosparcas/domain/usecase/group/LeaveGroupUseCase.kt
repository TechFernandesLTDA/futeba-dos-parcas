package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.usecase.CompletableUseCase
import javax.inject.Inject

/**
 * Use Case para sair de um grupo voluntariamente
 *
 * Permite que um membro ativo saia de um grupo.
 * Validações:
 * - O usuário não pode ser o dono do grupo (transferir propriedade primeiro)
 * - O usuário deve ser membro ativo do grupo
 *
 * Fluxo:
 * 1. Valida o ID do grupo
 * 2. Verifica o papel do usuário no grupo
 * 3. Impede saída se o usuário é dono
 * 4. Remove o usuário do grupo
 * 5. Atualiza contagem de membros
 *
 * Uso:
 * ```kotlin
 * val result = leaveGroupUseCase(LeaveGroupParams(groupId = "group123"))
 *
 * result.fold(
 *     onSuccess = { /* saiu do grupo com sucesso */ },
 *     onFailure = { error -> /* lidar com erro */ }
 * )
 * ```
 */
class LeaveGroupUseCase @Inject constructor(
    private val groupRepository: GroupRepository
) : CompletableUseCase<LeaveGroupParams>() {

    override suspend fun execute(params: LeaveGroupParams) {
        // Validar que o ID do grupo não está vazio
        require(params.groupId.isNotBlank()) {
            "ID do grupo é obrigatório"
        }

        // Verificar se o usuário é owner
        val roleResult = groupRepository.getMyRoleInGroup(params.groupId)

        if (roleResult.isFailure) {
            throw roleResult.exceptionOrNull() ?: Exception("Erro ao verificar permissão")
        }

        val role = roleResult.getOrNull()

        // Owner não pode sair sem transferir propriedade
        if (role == GroupMemberRole.OWNER) {
            throw LeaveGroupException(
                "O dono não pode sair do grupo. Transfira a propriedade primeiro."
            )
        }

        // Verificar se é membro ativo
        if (role == null) {
            throw LeaveGroupException("Você não é membro deste grupo")
        }

        // Sair do grupo
        val leaveResult = groupRepository.leaveGroup(params.groupId)
        if (leaveResult.isFailure) {
            throw leaveResult.exceptionOrNull() ?: Exception("Erro ao sair do grupo")
        }
    }
}

/**
 * Parâmetros para sair de um grupo
 */
data class LeaveGroupParams(
    val groupId: String
)

/**
 * Exceção específica para operações de saída de grupo
 */
class LeaveGroupException(message: String) : Exception(message)
