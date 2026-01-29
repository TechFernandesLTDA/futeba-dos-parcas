package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Representa um grupo de jogadores
 * Coleção: groups
 */
@IgnoreExtraProperties
data class Group(
    @DocumentId
    var id: String = "",

    val name: String = "",

    val description: String = "",

    @get:PropertyName("owner_id")
    @set:PropertyName("owner_id")
    var ownerId: String = "",

    @get:PropertyName("owner_name")
    @set:PropertyName("owner_name")
    var ownerName: String = "",

    @get:PropertyName("photo_url")
    @set:PropertyName("photo_url")
    var photoUrl: String? = null,

    @get:PropertyName("member_count")
    @set:PropertyName("member_count")
    var memberCount: Int = 0,

    val status: String = GroupStatus.ACTIVE.name,

    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null,

    @get:PropertyName("updated_at")
    @set:PropertyName("updated_at")
    var updatedAt: Date? = null,

    // Última atividade do grupo (#11 - Validação Firebase)
    @get:PropertyName("last_activity_at")
    @set:PropertyName("last_activity_at")
    var lastActivityAt: Date? = null,

    @get:PropertyName("is_public")
    @set:PropertyName("is_public")
    var isPublic: Boolean = false,

    // === GAME OWNER FEATURES (Issues #64, #68) ===

    // Lista de jogadores bloqueados (Issue #64)
    @get:PropertyName("blocked_players")
    @set:PropertyName("blocked_players")
    var blockedPlayers: List<BlockedPlayer> = emptyList(),

    // Regras do grupo visíveis para todos (Issue #68)
    @get:PropertyName("rules")
    @set:PropertyName("rules")
    var rules: String = "",

    // Configurações de votação MVP (Issues #51-60)
    @get:PropertyName("voting_settings")
    @set:PropertyName("voting_settings")
    var votingSettings: VotingSettings? = null
) {
    constructor() : this(id = "")

    @Exclude
    fun getVotingSettingsOrDefault(): VotingSettings {
        return votingSettings ?: VotingSettings()
    }

    @Exclude
    fun getStatusEnum(): GroupStatus = try {
        GroupStatus.valueOf(status)
    } catch (e: Exception) {
        GroupStatus.ACTIVE
    }

    @Exclude
    fun isActive(): Boolean = getStatusEnum() == GroupStatus.ACTIVE

    @Exclude
    fun isArchived(): Boolean = getStatusEnum() == GroupStatus.ARCHIVED

    /**
     * Verifica se um jogador está bloqueado (Issue #64).
     */
    @Exclude
    fun isPlayerBlocked(userId: String): Boolean =
        blockedPlayers.any { it.userId == userId }

    /**
     * Retorna o motivo do bloqueio de um jogador (Issue #64).
     */
    @Exclude
    fun getBlockReason(userId: String): String? =
        blockedPlayers.find { it.userId == userId }?.reason
}

/**
 * Representa um jogador bloqueado do grupo (Issue #64).
 */
@IgnoreExtraProperties
data class BlockedPlayer(
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",

    @get:PropertyName("user_name")
    @set:PropertyName("user_name")
    var userName: String = "",

    @get:PropertyName("reason")
    @set:PropertyName("reason")
    var reason: String = "",

    @get:PropertyName("blocked_by")
    @set:PropertyName("blocked_by")
    var blockedBy: String = "",

    @get:PropertyName("blocked_at")
    @set:PropertyName("blocked_at")
    var blockedAt: Date? = null
) {
    constructor() : this(userId = "")
}

/**
 * Status do grupo
 */
enum class GroupStatus {
    ACTIVE,     // Grupo ativo
    ARCHIVED,   // Grupo arquivado (não pode criar jogos)
    DELETED     // Grupo deletado (soft delete)
}

/**
 * Representa um membro do grupo
 * Subcoleção: groups/{groupId}/members
 */
@IgnoreExtraProperties
data class GroupMember(
    @DocumentId
    var id: String = "", // Mesmo que userId para lookup rápido

    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",

    @get:PropertyName("user_name")
    @set:PropertyName("user_name")
    var userName: String = "",

    @get:PropertyName("user_photo")
    @set:PropertyName("user_photo")
    var userPhoto: String? = null,

    val role: String = GroupMemberRole.MEMBER.name,

    val status: String = GroupMemberStatus.ACTIVE.name,

    @ServerTimestamp
    @get:PropertyName("joined_at")
    @set:PropertyName("joined_at")
    var joinedAt: Date? = null,

    @get:PropertyName("invited_by")
    @set:PropertyName("invited_by")
    var invitedBy: String? = null,

    @get:PropertyName("nickname")
    @set:PropertyName("nickname")
    var nickname: String? = null
) {
    constructor() : this(id = "")

    @Exclude
    fun getDisplayName(): String {
        return nickname?.takeIf { it.isNotBlank() } ?: userName
    }

    @Exclude
    fun getRoleEnum(): GroupMemberRole = try {
        GroupMemberRole.valueOf(role)
    } catch (e: Exception) {
        GroupMemberRole.MEMBER
    }

    @Exclude
    fun getStatusEnum(): GroupMemberStatus = try {
        GroupMemberStatus.valueOf(status)
    } catch (e: Exception) {
        GroupMemberStatus.ACTIVE
    }

    @Exclude
    fun isOwner(): Boolean = getRoleEnum() == GroupMemberRole.OWNER

    @Exclude
    fun isAdmin(): Boolean = getRoleEnum() == GroupMemberRole.ADMIN || isOwner()

    @Exclude
    fun isActive(): Boolean = getStatusEnum() == GroupMemberStatus.ACTIVE

    @Exclude
    fun canInvite(): Boolean = isAdmin() && isActive()

    @Exclude
    fun canRemoveMembers(): Boolean = isAdmin() && isActive()

    @Exclude
    fun canCreateGames(): Boolean = isAdmin() && isActive()

    @Exclude
    fun canEditGroup(): Boolean = isAdmin() && isActive()
}

/**
 * Papel do membro no grupo
 */
enum class GroupMemberRole(val displayName: String, val description: String) {
    OWNER(
        displayName = "Dono",
        description = "Criador do grupo - controle total"
    ),
    ADMIN(
        displayName = "Administrador",
        description = "Pode convidar, remover membros e criar jogos"
    ),
    MEMBER(
        displayName = "Membro",
        description = "Pode confirmar presença em jogos"
    );

    companion object {
        fun fromString(value: String?): GroupMemberRole {
            return entries.find { it.name == value } ?: MEMBER
        }
    }
}

/**
 * Status do membro no grupo
 */
enum class GroupMemberStatus {
    ACTIVE,     // Membro ativo
    INACTIVE,   // Saiu voluntariamente
    REMOVED,    // Removido por admin/owner
    BLOCKED     // Bloqueado de participar
}

/**
 * Referência do grupo para o usuário (denormalizado)
 * Subcoleção: users/{userId}/groups
 */
@IgnoreExtraProperties
data class UserGroup(
    @DocumentId
    var id: String = "", // groupId

    @get:PropertyName("group_id")
    @set:PropertyName("group_id")
    var groupId: String = "",

    @get:PropertyName("group_name")
    @set:PropertyName("group_name")
    var groupName: String = "",

    @get:PropertyName("group_photo")
    @set:PropertyName("group_photo")
    var groupPhoto: String? = null,

    val role: String = GroupMemberRole.MEMBER.name,

    @get:PropertyName("member_count")
    @set:PropertyName("member_count")
    var memberCount: Int = 0,

    @ServerTimestamp
    @get:PropertyName("joined_at")
    @set:PropertyName("joined_at")
    var joinedAt: Date? = null
) {
    constructor() : this(id = "")

    @Exclude
    fun getRoleEnum(): GroupMemberRole = try {
        GroupMemberRole.valueOf(role)
    } catch (e: Exception) {
        GroupMemberRole.MEMBER
    }

    @Exclude
    fun isOwner(): Boolean = getRoleEnum() == GroupMemberRole.OWNER

    @Exclude
    fun isAdmin(): Boolean = getRoleEnum() == GroupMemberRole.ADMIN || isOwner()

    /**
     * Verifica se o grupo é válido para criar jogos (>= 2 membros)
     */
    @Exclude
    fun isValidForGame(): Boolean = memberCount >= 2
}
