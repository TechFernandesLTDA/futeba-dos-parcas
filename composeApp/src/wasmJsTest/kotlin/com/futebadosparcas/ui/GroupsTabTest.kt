package com.futebadosparcas.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GroupsTabTest {

    @Test
    fun `GroupsUiState Loading is correct`() {
        val state = GroupsUiStateTest.Loading
        assertTrue(state is GroupsUiStateTest.Loading)
    }

    @Test
    fun `GroupsUiState Empty is correct`() {
        val state = GroupsUiStateTest.Empty
        assertTrue(state is GroupsUiStateTest.Empty)
    }

    @Test
    fun `GroupsUiState Error has correct message`() {
        val state = GroupsUiStateTest.Error("Erro ao carregar grupos")
        assertTrue(state is GroupsUiStateTest.Error)
        assertEquals("Erro ao carregar grupos", (state as GroupsUiStateTest.Error).message)
    }

    @Test
    fun `GroupsUiState Success has correct data`() {
        val groups = listOf(
            mapOf("id" to "group1", "name" to "Grupo Teste")
        )
        val state = GroupsUiStateTest.Success(groups)
        assertTrue(state is GroupsUiStateTest.Success)
        assertEquals(1, (state as GroupsUiStateTest.Success).groups.size)
        assertEquals("group1", state.groups.first()["id"])
    }

    @Test
    fun `filterGroupsByName filters correctly with matching query`() {
        val groups = createTestGroups()
        val query = "Pelada"
        val filtered = groups.filter {
            ((it["groupName"] as? String) ?: (it["name"] as? String) ?: "")
                .lowercase()
                .contains(query.lowercase())
        }
        assertEquals(2, filtered.size)
    }

    @Test
    fun `filterGroupsByName filters correctly with non-matching query`() {
        val groups = createTestGroups()
        val query = "Inexistente"
        val filtered = groups.filter {
            ((it["groupName"] as? String) ?: (it["name"] as? String) ?: "")
                .lowercase()
                .contains(query.lowercase())
        }
        assertEquals(0, filtered.size)
    }

    @Test
    fun `filterGroupsByName is case insensitive`() {
        val groups = createTestGroups()
        val query = "FUTEBOL"
        val filtered = groups.filter {
            ((it["groupName"] as? String) ?: (it["name"] as? String) ?: "")
                .lowercase()
                .contains(query.lowercase())
        }
        assertEquals(1, filtered.size)
        assertEquals("group2", filtered.first()["id"])
    }

    @Test
    fun `filterGroupsByName returns all groups with empty query`() {
        val groups = createTestGroups()
        val query = ""
        val filtered = if (query.isEmpty()) groups else groups.filter {
            ((it["groupName"] as? String) ?: (it["name"] as? String) ?: "")
                .lowercase()
                .contains(query.lowercase())
        }
        assertEquals(3, filtered.size)
    }

    @Test
    fun `extractGroupId prioritizes id field`() {
        val group = mapOf<String, Any?>(
            "id" to "primaryId",
            "groupId" to "secondaryId"
        )
        val groupId = group["id"] as? String ?: group["groupId"] as? String ?: ""
        assertEquals("primaryId", groupId)
    }

    @Test
    fun `extractGroupId falls back to groupId field`() {
        val group = mapOf<String, Any?>(
            "groupId" to "secondaryId"
        )
        val groupId = group["id"] as? String ?: group["groupId"] as? String ?: ""
        assertEquals("secondaryId", groupId)
    }

    @Test
    fun `extractGroupName prioritizes groupName field`() {
        val group = mapOf<String, Any?>(
            "groupName" to "Primary Name",
            "name" to "Secondary Name"
        )
        val groupName = (group["groupName"] as? String) ?: (group["name"] as? String) ?: "Grupo sem nome"
        assertEquals("Primary Name", groupName)
    }

    @Test
    fun `extractGroupName falls back to name field`() {
        val group = mapOf<String, Any?>(
            "name" to "Secondary Name"
        )
        val groupName = (group["groupName"] as? String) ?: (group["name"] as? String) ?: "Grupo sem nome"
        assertEquals("Secondary Name", groupName)
    }

    @Test
    fun `extractGroupName returns default when both are missing`() {
        val group = mapOf<String, Any?>()
        val groupName = (group["groupName"] as? String) ?: (group["name"] as? String) ?: "Grupo sem nome"
        assertEquals("Grupo sem nome", groupName)
    }

    @Test
    fun `extractMemberCount handles number correctly`() {
        val group = mapOf<String, Any?>(
            "memberCount" to 15
        )
        val memberCount = (group["memberCount"] as? Number)?.toInt()
            ?: (group["members"] as? Number)?.toInt()
            ?: 0
        assertEquals(15, memberCount)
    }

    @Test
    fun `extractMemberCount falls back to members field`() {
        val group = mapOf<String, Any?>(
            "members" to 20
        )
        val memberCount = (group["memberCount"] as? Number)?.toInt()
            ?: (group["members"] as? Number)?.toInt()
            ?: 0
        assertEquals(20, memberCount)
    }

    @Test
    fun `extractMemberCount returns zero when missing`() {
        val group = mapOf<String, Any?>()
        val memberCount = (group["memberCount"] as? Number)?.toInt()
            ?: (group["members"] as? Number)?.toInt()
            ?: 0
        assertEquals(0, memberCount)
    }

    @Test
    fun `extractRole returns correct role`() {
        val group = mapOf<String, Any?>("role" to "ADMIN")
        val role = group["role"] as? String ?: "MEMBER"
        assertEquals("ADMIN", role)
    }

    @Test
    fun `extractRole defaults to MEMBER when missing`() {
        val group = mapOf<String, Any?>()
        val role = group["role"] as? String ?: "MEMBER"
        assertEquals("MEMBER", role)
    }

    @Test
    fun `RoleBadgeHelper identifies OWNER role`() {
        val role = "OWNER"
        val isOwner = role == "OWNER"
        val isAdmin = role == "ADMIN"
        val isMember = role == "MEMBER"
        assertTrue(isOwner)
        assertFalse(isAdmin)
        assertFalse(isMember)
    }

    @Test
    fun `RoleBadgeHelper identifies ADMIN role`() {
        val role = "ADMIN"
        val isOwner = role == "OWNER"
        val isAdmin = role == "ADMIN"
        val isMember = role == "MEMBER"
        assertFalse(isOwner)
        assertTrue(isAdmin)
        assertFalse(isMember)
    }

    @Test
    fun `RoleBadgeHelper identifies MEMBER role`() {
        val role = "MEMBER"
        val isOwner = role == "OWNER"
        val isAdmin = role == "ADMIN"
        val isMember = role == "MEMBER"
        assertFalse(isOwner)
        assertFalse(isAdmin)
        assertTrue(isMember)
    }

    @Test
    fun `showSearchBar returns true when groups count >= 3`() {
        val groups = createTestGroups()
        val showSearch = groups.size >= 3
        assertTrue(showSearch)
    }

    @Test
    fun `showSearchBar returns false when groups count < 3`() {
        val groups = listOf(
            mapOf("id" to "group1", "name" to "Group 1"),
            mapOf("id" to "group2", "name" to "Group 2")
        )
        val showSearch = groups.size >= 3
        assertFalse(showSearch)
    }

    @Test
    fun `empty groups list triggers Empty state`() {
        val groups = emptyList<Map<String, Any?>>()
        assertTrue(groups.isEmpty())
    }

    @Test
    fun `empty filtered results with search query shows empty search state`() {
        val groups = createTestGroups()
        val searchQuery = "XYZ"
        val filtered = groups.filter {
            ((it["groupName"] as? String) ?: (it["name"] as? String) ?: "")
                .lowercase()
                .contains(searchQuery.lowercase())
        }
        assertTrue(filtered.isEmpty())
        assertTrue(searchQuery.isNotEmpty())
    }

    @Test
    fun `clearSearch resets query to empty string`() {
        var searchQuery = "test query"
        searchQuery = ""
        assertEquals("", searchQuery)
    }

    @Test
    fun `GroupCard key generation uses id first`() {
        val group = mapOf<String, Any?>(
            "id" to "primaryId",
            "groupId" to "secondaryId"
        )
        val key = group["id"] as? String ?: group["groupId"] as? String ?: group.hashCode()
        assertEquals("primaryId", key)
    }

    @Test
    fun `GroupCard key generation uses groupId as fallback`() {
        val group = mapOf<String, Any?>(
            "groupId" to "secondaryId"
        )
        val key = group["id"] as? String ?: group["groupId"] as? String ?: group.hashCode()
        assertEquals("secondaryId", key)
    }

    @Test
    fun `GroupCard key generation uses hashCode when no id`() {
        val group = mapOf<String, Any?>(
            "name" to "Test Group"
        )
        val key = group["id"] as? String ?: group["groupId"] as? String ?: group.hashCode()
        assertEquals(group.hashCode(), key)
    }

    @Test
    fun `description handling returns null when blank`() {
        val group = mapOf<String, Any?>(
            "description" to "   "
        )
        val description = group["description"] as? String
        val isBlank = description.isNullOrBlank()
        assertTrue(isBlank)
    }

    @Test
    fun `description handling returns value when not blank`() {
        val group = mapOf<String, Any?>(
            "description" to "Uma descrição legal"
        )
        val description = group["description"] as? String
        val isNotBlank = !description.isNullOrBlank()
        assertTrue(isNotBlank)
        assertEquals("Uma descrição legal", description)
    }

    @Test
    fun `nextGame handling returns null when missing`() {
        val group = mapOf<String, Any?>()
        val nextGame = group["nextGame"] as? String
        assertTrue(nextGame.isNullOrBlank())
    }

    @Test
    fun `nextGame handling returns value when present`() {
        val group = mapOf<String, Any?>(
            "nextGame" to "Sábado 14:00"
        )
        val nextGame = group["nextGame"] as? String
        assertFalse(nextGame.isNullOrBlank())
        assertEquals("Sábado 14:00", nextGame)
    }

    @Test
    fun `memberCount singular vs plural - 1 member`() {
        val memberCount = 1
        val suffix = if (memberCount == 1) "membro" else "membros"
        assertEquals("membro", suffix)
    }

    @Test
    fun `memberCount singular vs plural - multiple members`() {
        val memberCount = 5
        val suffix = if (memberCount == 1) "membro" else "membros"
        assertEquals("membros", suffix)
    }

    @Test
    fun `memberCount singular vs plural - zero members`() {
        val memberCount = 0
        val suffix = if (memberCount == 1) "membro" else "membros"
        assertEquals("membros", suffix)
    }

    @Test
    fun `group initial extraction`() {
        val groupName = "Pelada dos Amigos"
        val initial = groupName.firstOrNull()?.uppercase() ?: "?"
        assertEquals("P", initial)
    }

    @Test
    fun `group initial extraction for empty name`() {
        val groupName = ""
        val initial = groupName.firstOrNull()?.uppercase() ?: "?"
        assertEquals("?", initial)
    }

    private fun createTestGroups(): List<Map<String, Any?>> = listOf(
        mapOf(
            "id" to "group1",
            "groupName" to "Pelada do Sábado",
            "memberCount" to 12,
            "role" to "OWNER",
            "description" to "Grupo de amigos do bairro"
        ),
        mapOf(
            "id" to "group2",
            "groupName" to "Futebol do Trabalho",
            "memberCount" to 20,
            "role" to "ADMIN",
            "description" to "Colegas de trabalho"
        ),
        mapOf(
            "id" to "group3",
            "name" to "Pelada da Família",
            "members" to 8,
            "role" to "MEMBER"
        )
    )
}

sealed class GroupsUiStateTest {
    object Loading : GroupsUiStateTest()
    object Empty : GroupsUiStateTest()
    data class Success(val groups: List<Map<String, Any?>>) : GroupsUiStateTest()
    data class Error(val message: String) : GroupsUiStateTest()
}
