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
