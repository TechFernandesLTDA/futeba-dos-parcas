package com.futebadosparcas.domain.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Testes compartilhados para os modelos Group, GroupMember e GroupMemberRole.
 * Executam em Android (JVM) e iOS (Native).
 */
class GroupTest {

    // ---- GroupMemberRole ----

    @Test
    fun groupMemberRole_owner_displayNameNaoEstaVazio() {
        assertTrue(GroupMemberRole.OWNER.displayName.isNotBlank())
    }

    @Test
    fun groupMemberRole_admin_displayNameNaoEstaVazio() {
        assertTrue(GroupMemberRole.ADMIN.displayName.isNotBlank())
    }

    @Test
    fun groupMemberRole_member_displayNameNaoEstaVazio() {
        assertTrue(GroupMemberRole.MEMBER.displayName.isNotBlank())
    }

    // ---- GroupMember.getRoleEnum ----

    @Test
    fun groupMember_getRoleEnum_owner_retornaOwner() {
        val member = GroupMember(userId = "u1", role = GroupMemberRole.OWNER.name)
        assertEquals(GroupMemberRole.OWNER, member.getRoleEnum())
    }

    @Test
    fun groupMember_getRoleEnum_admin_retornaAdmin() {
        val member = GroupMember(userId = "u1", role = GroupMemberRole.ADMIN.name)
        assertEquals(GroupMemberRole.ADMIN, member.getRoleEnum())
    }

    @Test
    fun groupMember_getRoleEnum_member_retornaMember() {
        val member = GroupMember(userId = "u1", role = GroupMemberRole.MEMBER.name)
        assertEquals(GroupMemberRole.MEMBER, member.getRoleEnum())
    }

    @Test
    fun groupMember_getRoleEnum_invalido_fallbackParaMember() {
        // Role corrompido -> fallback seguro para MEMBER
        val member = GroupMember(userId = "u1", role = "ROLE_INVALIDO")
        assertEquals(GroupMemberRole.MEMBER, member.getRoleEnum())
    }

    // ---- GroupMember.isOwner / isAdmin ----

    @Test
    fun groupMember_isOwner_roleOwner_retornaTrue() {
        val member = GroupMember(userId = "u1", role = GroupMemberRole.OWNER.name)
        assertTrue(member.isOwner())
    }

    @Test
    fun groupMember_isOwner_roleAdmin_retornaFalse() {
        // Admin nao e owner
        val member = GroupMember(userId = "u1", role = GroupMemberRole.ADMIN.name)
        assertFalse(member.isOwner())
    }

    @Test
    fun groupMember_isOwner_roleMember_retornaFalse() {
        val member = GroupMember(userId = "u1", role = GroupMemberRole.MEMBER.name)
        assertFalse(member.isOwner())
    }

    @Test
    fun groupMember_isAdmin_roleAdmin_retornaTrue() {
        val member = GroupMember(userId = "u1", role = GroupMemberRole.ADMIN.name)
        assertTrue(member.isAdmin())
    }

    @Test
    fun groupMember_isAdmin_roleOwner_retornaTrue() {
        // Owner tambem e considerado admin no grupo
        val member = GroupMember(userId = "u1", role = GroupMemberRole.OWNER.name)
        assertTrue(member.isAdmin())
    }

    @Test
    fun groupMember_isAdmin_roleMember_retornaFalse() {
        val member = GroupMember(userId = "u1", role = GroupMemberRole.MEMBER.name)
        assertFalse(member.isAdmin())
    }

    // ---- GroupMember.getDisplayName ----

    @Test
    fun groupMember_getDisplayName_semNickname_retornaUserName() {
        val member = GroupMember(userId = "u1", userName = "Carlos", nickname = null)
        assertEquals("Carlos", member.getDisplayName())
    }

    @Test
    fun groupMember_getDisplayName_comNickname_retornaNickname() {
        val member = GroupMember(userId = "u1", userName = "Carlos", nickname = "Carlao")
        assertEquals("Carlao", member.getDisplayName())
    }

    @Test
    fun groupMember_getDisplayName_nicknameEmBranco_retornaUserName() {
        val member = GroupMember(userId = "u1", userName = "Carlos", nickname = "")
        assertEquals("Carlos", member.getDisplayName())
    }

    // ---- Group.isOwner ----

    @Test
    fun group_isOwner_ownerIdCorreto_retornaTrue() {
        val group = Group(id = "g1", ownerId = "user-123")
        assertTrue(group.isOwner("user-123"))
    }

    @Test
    fun group_isOwner_outraId_retornaFalse() {
        val group = Group(id = "g1", ownerId = "user-123")
        assertFalse(group.isOwner("user-456"))
    }

    // ---- Group.hasInviteCode ----

    @Test
    fun group_hasInviteCode_comCodigo_retornaTrue() {
        val group = Group(id = "g1", inviteCode = "ABC123")
        assertTrue(group.hasInviteCode())
    }

    @Test
    fun group_hasInviteCode_semCodigo_retornaFalse() {
        val group = Group(id = "g1", inviteCode = null)
        assertFalse(group.hasInviteCode())
    }

    @Test
    fun group_hasInviteCode_codigoEmBranco_retornaFalse() {
        val group = Group(id = "g1", inviteCode = "")
        assertFalse(group.hasInviteCode())
    }
}
