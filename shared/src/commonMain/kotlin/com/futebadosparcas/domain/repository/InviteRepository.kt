package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.GroupInvite
import kotlinx.coroutines.flow.Flow

/**
 * Interface de repositorio de convites de grupo.
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 */
interface InviteRepository {
    /**
     * Cria um novo convite para um usuario entrar em um grupo.
     *
     * @param groupId ID do grupo
     * @param invitedUserId ID do usuario a ser convidado
     * @return Result<GroupInvite> com o convite criado ou erro
     */
    suspend fun createInvite(groupId: String, invitedUserId: String): Result<GroupInvite>

    /**
     * Aceita um convite de grupo.
     *
     * @param inviteId ID do convite
     * @return Result<Unit> indicando sucesso ou falha
     */
    suspend fun acceptInvite(inviteId: String): Result<Unit>

    /**
     * Recusa um convite de grupo.
     *
     * @param inviteId ID do convite
     * @return Result<Unit> indicando sucesso ou falha
     */
    suspend fun declineInvite(inviteId: String): Result<Unit>

    /**
     * Cancela um convite de grupo (por admin).
     *
     * @param inviteId ID do convite
     * @return Result<Unit> indicando sucesso ou falha
     */
    suspend fun cancelInvite(inviteId: String): Result<Unit>

    /**
     * Busca um convite por ID.
     *
     * @param inviteId ID do convite
     * @return Result<GroupInvite> com o convite encontrado ou erro
     */
    suspend fun getInviteById(inviteId: String): Result<GroupInvite>

    /**
     * Conta convites pendentes do usuario atual.
     *
     * @return Result<Int> com o numero de convites pendentes
     */
    suspend fun countPendingInvites(): Result<Int>

    /**
     * Busca convites pendentes do usuario atual.
     *
     * @return Result<List<GroupInvite>> com a lista de convites pendentes
     */
    suspend fun getMyPendingInvites(): Result<List<GroupInvite>>

    /**
     * Observa convites pendentes do usuario em tempo real.
     *
     * @return Flow que emite a lista de convites pendentes atualizada
     */
    fun getMyPendingInvitesFlow(): Flow<List<GroupInvite>>

    /**
     * Busca convites pendentes de um grupo especifico.
     *
     * @param groupId ID do grupo
     * @return Result<List<GroupInvite>> com a lista de convites pendentes do grupo
     */
    suspend fun getGroupPendingInvites(groupId: String): Result<List<GroupInvite>>
}
