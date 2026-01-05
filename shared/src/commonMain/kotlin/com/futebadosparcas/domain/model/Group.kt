package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Role de membro em um grupo.
 */
@Serializable
enum class GroupMemberRole(val displayName: String) {
    @SerialName("OWNER")
    OWNER("Dono"),

    @SerialName("ADMIN")
    ADMIN("Administrador"),

    @SerialName("MEMBER")
    MEMBER("Membro")
}

/**
 * Grupo de jogadores.
 */
@Serializable
data class Group(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("owner_id") val ownerId: String = "",
    @SerialName("owner_name") val ownerName: String = "",
    @SerialName("members_count") val membersCount: Int = 0,
    @SerialName("games_count") val gamesCount: Int = 0,
    @SerialName("is_public") val isPublic: Boolean = false,
    @SerialName("invite_code") val inviteCode: String? = null,
    @SerialName("pix_key") val pixKey: String? = null,
    @SerialName("default_location_id") val defaultLocationId: String? = null,
    @SerialName("default_location_name") val defaultLocationName: String? = null,
    @SerialName("default_day_of_week") val defaultDayOfWeek: Int? = null,
    @SerialName("default_time") val defaultTime: String? = null,
    @SerialName("default_max_players") val defaultMaxPlayers: Int = 14,
    @SerialName("default_price") val defaultPrice: Double = 0.0,
    @SerialName("created_at") val createdAt: Long? = null,
    @SerialName("updated_at") val updatedAt: Long? = null
)

/**
 * Membro de um grupo.
 */
@Serializable
data class GroupMember(
    val id: String = "",
    @SerialName("group_id") val groupId: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("user_name") val userName: String = "",
    @SerialName("user_photo") val userPhoto: String? = null,
    val role: String = GroupMemberRole.MEMBER.name,
    val nickname: String? = null,
    @SerialName("joined_at") val joinedAt: Long? = null,
    @SerialName("games_played") val gamesPlayed: Int = 0,
    val goals: Int = 0,
    val assists: Int = 0
) {
    fun getRoleEnum(): GroupMemberRole = try {
        GroupMemberRole.valueOf(role)
    } catch (e: Exception) {
        GroupMemberRole.MEMBER
    }

    fun getDisplayName(): String = nickname?.takeIf { it.isNotBlank() } ?: userName

    fun isOwner(): Boolean = getRoleEnum() == GroupMemberRole.OWNER
    fun isAdmin(): Boolean = getRoleEnum() == GroupMemberRole.ADMIN || isOwner()
}

/**
 * Relacao usuario-grupo (para queries rapidas).
 */
@Serializable
data class UserGroup(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("group_id") val groupId: String = "",
    @SerialName("group_name") val groupName: String = "",
    @SerialName("group_photo") val groupPhoto: String? = null,
    val role: String = GroupMemberRole.MEMBER.name,
    @SerialName("joined_at") val joinedAt: Long? = null
)
