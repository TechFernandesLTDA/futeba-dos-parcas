package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase

/**
 * Use Case para o usuário entrar em um grupo
 *
 * Permite que um usuário se torne membro de um grupo existente.
 * Valida se o usuário já não é membro e se o grupo existe.
 *
 * Fluxo:
 * 1. Valida o ID do grupo
 * 2. Verifica se o grupo existe
 * 3. Verifica se o usuário já é membro
 * 4. Se válido, retorna os dados do grupo confirmando a entrada
 *
 * Uso:
 * ```kotlin
 * val result = joinGroupUseCase(JoinGroupParams(
 *     groupId = "group123"
 * ))
 *
 * result.fold(
 *     onSuccess = { group -> /* usuário entrou no grupo */ },
 *     onFailure = { error -> /* lidar com erro */ }
 * )
 * ```
 */
class JoinGroupUseCase constructor(
    private val groupRepository: GroupRepository
) : SuspendUseCase<JoinGroupParams, Group>() {

    override suspend fun execute(params: JoinGroupParams): Group {
        // Validar que o ID do grupo não está vazio
        require(params.groupId.isNotBlank()) {
            "ID do grupo é obrigatório"
        }

        // Verificar se o grupo existe
        val groupResult = groupRepository.getGroupById(params.groupId)
        if (groupResult.isFailure) {
            throw groupResult.exceptionOrNull() ?: Exception("Grupo não encontrado")
        }

        val group = groupResult.getOrNull()
            ?: throw Exception("Falha ao recuperar dados do grupo")

        // Verificar se o usuário já é membro do grupo
        val isMemberResult = groupRepository.isMemberOfGroup(params.groupId)
        if (isMemberResult.isFailure) {
            throw isMemberResult.exceptionOrNull()
                ?: Exception("Erro ao verificar participação no grupo")
        }

        val isAlreadyMember = isMemberResult.getOrDefault(false)
        if (isAlreadyMember) {
            throw JoinGroupException("Você já é membro deste grupo")
        }

        // Retornar o grupo validado
        // Nota: A adição efetiva do usuário ao grupo é feita através da aceitação
        // de um convite (InviteToGroupUseCase) ou em Cloud Functions
        return group
    }
}

/**
 * Parâmetros para entrar em um grupo
 */
data class JoinGroupParams(
    val groupId: String
)

/**
 * Exceção específica para operações de entrada em grupo
 */
class JoinGroupException(message: String) : Exception(message)
