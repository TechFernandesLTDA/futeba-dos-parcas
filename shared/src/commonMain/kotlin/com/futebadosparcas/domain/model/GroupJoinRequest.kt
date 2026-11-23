package com.futebadosparcas.domain.model

/**
 * Solicitação de entrada em grupo público (issue #517 Phase 2).
 *
 * Coleção: groups/{groupId}/join_requests/{userId}
 *
 * Fluxo:
 * - Requester chama createJoinRequest() em grupo público (status=PENDING)
 * - Owner/admin chama approveJoinRequest() ou rejectJoinRequest()
 *   (transição PENDING → APPROVED/REJECTED)
 * - Cloud Function `onJoinRequestApproved` cria member automaticamente
 *
 * Cross-platform: usado em Android, iOS e Web. Timestamps em epoch ms
 * para evitar dependências de java.util.Date / NSDate.
 */
data class GroupJoinRequest(
    val id: String = "",
    val userId: String = "",
    val userName: String = "",
    val userPhoto: String? = null,
    val status: GroupJoinRequestStatus = GroupJoinRequestStatus.PENDING,
    val requestedAt: Long? = null,
    val respondedAt: Long? = null,
    val respondedBy: String? = null,
)

enum class GroupJoinRequestStatus {
    PENDING,
    APPROVED,
    REJECTED;

    companion object {
        fun fromString(value: String?): GroupJoinRequestStatus =
            entries.find { it.name == value } ?: PENDING
    }
}

/**
 * Pedido de entrada recusado pelo vínculo da pessoa com o grupo: o organizador
 * removeu, bloqueou ou baniu (#4629 item 22). A regra de create recusa esses casos.
 */
class GroupJoinRequestNotAllowedException :
    Exception("O organizador encerrou sua participação neste grupo")

/** O que gravar ao pedir para entrar num grupo público (#4629 item 22). */
enum class JoinRequestWritePlan {
    /** Sem pedido anterior: cria o pedido PENDING. */
    CREATE,

    /**
     * Pedido antigo recusado, ou aprovado com vínculo INACTIVE (a pessoa saiu depois): apaga e cria
     * de novo, porque a regra não deixa o dono do pedido atualizar o documento.
     */
    REPLACE,

    /** Já existe um pedido PENDING: nada a gravar. */
    ALREADY_PENDING,

    /**
     * Pedido aprovado e o vínculo ainda não existe: o `onJoinRequestApproved` está
     * criando o membro. Nada a gravar; apagar agora desfaria a aprovação.
     */
    APPROVAL_IN_PROGRESS,

    /** Vínculo REMOVED, BLOCKED ou BANNED: a regra recusa o pedido. */
    NOT_ALLOWED,
}

private val NO_REQUEST_MEMBER_STATUSES = setOf("REMOVED", "BLOCKED", "BANNED")

/**
 * Decide a escrita do pedido de entrada.
 *
 * @param memberStatus status do próprio vínculo em `groups/{gid}/members/{uid}`,
 *   ou null se o documento não existe
 * @param existingRequestStatus status do pedido em `join_requests/{uid}`, ou null
 */
fun planJoinRequestWrite(memberStatus: String?, existingRequestStatus: String?): JoinRequestWritePlan =
    when {
        memberStatus in NO_REQUEST_MEMBER_STATUSES -> JoinRequestWritePlan.NOT_ALLOWED
        existingRequestStatus == null -> JoinRequestWritePlan.CREATE
        existingRequestStatus == GroupJoinRequestStatus.PENDING.name -> JoinRequestWritePlan.ALREADY_PENDING
        existingRequestStatus == GroupJoinRequestStatus.APPROVED.name && memberStatus == null ->
            JoinRequestWritePlan.APPROVAL_IN_PROGRESS
        else -> JoinRequestWritePlan.REPLACE
    }
