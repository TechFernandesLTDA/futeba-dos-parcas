package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.data.model.UserGroup
import com.futebadosparcas.data.repository.GroupRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Use Case para obter grupos do usuário
 */
class GetGroupsUseCase constructor(
    private val groupRepository: GroupRepository
) {
    /**
     * Obtém grupos em tempo real
     */
    fun getGroupsFlow(): Flow<List<UserGroup>> {
        return groupRepository.getMyGroupsFlow()
    }

    /**
     * Obtém grupos com filtro de busca
     */
    fun getGroupsFlow(searchQuery: String): Flow<List<UserGroup>> {
        return groupRepository.getMyGroupsFlow().map { groups ->
            if (searchQuery.isBlank()) {
                groups
            } else {
                val query = searchQuery.trim().lowercase()
                groups.filter { group ->
                    group.groupName.lowercase().contains(query)
                }
            }
        }
    }

    /**
     * Obtém grupos válidos para criação de jogos
     */
    suspend fun getValidGroupsForGame(): Result<List<UserGroup>> {
        return groupRepository.getValidGroupsForGame()
    }

    /**
     * Verifica se usuário pode criar jogos
     */
    suspend fun canCreateGames(): Result<Boolean> {
        return groupRepository.canCreateGames()
    }
}
