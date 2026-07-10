package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GroupWallPost
import java.util.Date
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@DisplayName("Social feed pagination and scale")
class SocialFeedPaginationTest {

    @Test
    @DisplayName("100 grupos e 1000 posts retornam primeira pagina global ordenada")
    fun hundredGroupsAndThousandPostsSelectGlobalPage() {
        val candidates = (0 until 1_000).map { index -> candidate(index) }

        val page = selectSocialFeedPage(candidates, limit = 30)

        assertEquals(30, page.posts.size)
        assertEquals((999 downTo 970).map { "p$it" }, page.posts.map { it.post.id })
        assertTrue(page.posts.map { it.post.id }.distinct().size == 30)
        assertTrue(page.consumedByChunk.size <= 10)
    }

    @Test
    @DisplayName("ocultos sao consumidos pelo cursor sem reduzir a pagina visivel")
    fun hiddenCandidatesAdvanceCursorAndDoNotLeak() {
        val hidden = (1_000 until 1_005).map { candidate(it, visible = false) }
        val visible = (0 until 40).map { candidate(it) }

        val page = selectSocialFeedPage(hidden + visible, limit = 30)

        assertEquals(30, page.posts.size)
        assertFalse(page.posts.any { it.post.id in hidden.map { item -> item.feedPost!!.post.id } })
        assertTrue(page.consumedByChunk.isNotEmpty())
    }

    @Test
    @DisplayName("dois clientes e reconexao recebem o mesmo topo sem duplicatas")
    fun twoClientsAndReconnectStayDeduplicated() {
        val initial = (0 until 60).map { candidate(it) }
        val realtimeInsert = candidate(2_000)

        val clientA = selectSocialFeedPage(initial + realtimeInsert, 30).posts
        val clientB = selectSocialFeedPage(initial + realtimeInsert, 30).posts
        val afterReconnect = selectSocialFeedPage(
            initial + realtimeInsert + realtimeInsert,
            30
        ).posts

        assertEquals(clientA.map { it.post.id }, clientB.map { it.post.id })
        assertEquals(clientA.map { it.post.id }, afterReconnect.map { it.post.id })
        assertEquals(30, afterReconnect.map { it.post.id }.distinct().size)
    }

    private fun candidate(index: Int, visible: Boolean = true): SocialFeedCandidate {
        val groupIndex = index % 100
        val post = GroupWallPost(
            id = "p$index",
            groupId = "g$groupIndex",
            createdAt = Date(index.toLong())
        )
        return SocialFeedCandidate(
            chunkKey = "chunk-${groupIndex / 10}",
            feedPost = SocialFeedPost(post, "Grupo $groupIndex"),
            visible = visible
        )
    }
}
