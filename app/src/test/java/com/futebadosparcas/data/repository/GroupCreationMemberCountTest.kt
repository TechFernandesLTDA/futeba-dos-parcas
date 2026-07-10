package com.futebadosparcas.data.repository

import kotlin.test.assertEquals
import org.junit.jupiter.api.Test

class GroupCreationMemberCountTest {
    @Test
    fun `owner creation starts principal at zero and mirror at one`() {
        val group = buildPendingOwnerGroup(
            groupId = "group-1",
            name = "Pelada",
            description = "Grupo de teste",
            ownerId = "owner-1",
            ownerName = "Owner",
            defaultGender = null
        )
        val mirror = buildOwnerGroupMirror(
            groupId = "group-1",
            groupName = "Pelada"
        )

        assertEquals(0, group.membersCount)
        assertEquals(1, mirror.memberCount)
        assertEquals(1, group.membersCount + 1)
    }
}
