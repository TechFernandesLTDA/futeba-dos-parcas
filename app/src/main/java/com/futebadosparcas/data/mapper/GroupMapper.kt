package com.futebadosparcas.data.mapper

import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.GroupMemberStatus
import com.futebadosparcas.data.model.GroupStatus
import com.futebadosparcas.data.model.UserGroup
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import java.util.Date

/**
 * Mapper para converter documentos Firestore em objetos de domínio
 */
object GroupMapper {

    /**
     * Converte DocumentSnapshot em Group
     */
    fun DocumentSnapshot.toGroup(): Group? {
        return try {
            Group(
                id = id,
                name = getString("name") ?: "",
                description = getString("description") ?: "",
                photoUrl = getString("photo_url"),
                ownerId = getString("owner_id") ?: "",
                ownerName = getString("owner_name") ?: "",
                memberCount = getLong("member_count")?.toInt() ?: 0,
                status = getString("status") ?: GroupStatus.ACTIVE.name,
                createdAt = getDate("created_at"),
                updatedAt = getDate("updated_at")
            )
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Converte DocumentSnapshot em GroupMember
     */
    fun DocumentSnapshot.toGroupMember(): GroupMember? {
        return try {
            GroupMember(
                id = id,
                userId = getString("user_id") ?: "",
                userName = getString("user_name") ?: "",
                userPhoto = getString("user_photo"),
                role = getString("role") ?: GroupMemberRole.MEMBER.name,
                status = getString("status") ?: GroupMemberStatus.ACTIVE.name,
                joinedAt = getDate("joined_at"),
                invitedBy = getString("invited_by"),
                nickname = getString("nickname")
            )
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Converte DocumentSnapshot em UserGroup
     */
    fun DocumentSnapshot.toUserGroup(): UserGroup? {
        return try {
            UserGroup(
                id = id,
                groupId = getString("group_id") ?: id,
                groupName = getString("group_name") ?: "",
                groupPhoto = getString("group_photo"),
                role = getString("role") ?: GroupMemberRole.MEMBER.name,
                memberCount = getLong("member_count")?.toInt() ?: 0,
                joinedAt = getDate("joined_at")
            )
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Converte Group em Map para Firestore
     */
    fun Group.toFirestoreMap(): Map<String, Any?> {
        return mapOf(
            "name" to name,
            "description" to description,
            "photo_url" to photoUrl,
            "owner_id" to ownerId,
            "owner_name" to ownerName,
            "member_count" to memberCount,
            "status" to status,
            "created_at" to (createdAt ?: Date()),
            "updated_at" to FieldValue.serverTimestamp()
        )
    }

    /**
     * Converte GroupMember em Map para Firestore
     */
    fun GroupMember.toFirestoreMap(): Map<String, Any?> {
        return mapOf(
            "user_id" to userId,
            "user_name" to userName,
            "user_photo" to userPhoto,
            "role" to role,
            "status" to status,
            "joined_at" to (joinedAt ?: Date()),
            "invited_by" to invitedBy,
            "nickname" to nickname
        )
    }

    /**
     * Converte UserGroup em Map para Firestore
     */
    fun UserGroup.toFirestoreMap(): Map<String, Any?> {
        return mapOf(
            "group_id" to groupId,
            "group_name" to groupName,
            "group_photo" to groupPhoto,
            "role" to role,
            "member_count" to memberCount,
            "joined_at" to (joinedAt ?: Date())
        )
    }
}
