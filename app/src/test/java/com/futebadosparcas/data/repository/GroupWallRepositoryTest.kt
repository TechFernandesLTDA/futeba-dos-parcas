package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GroupWallPost
import com.google.common.truth.Truth.assertThat
import java.util.Date
import org.junit.jupiter.api.Test

class GroupWallRepositoryTest {

    @Test
    fun mergeRecentAndPinnedPosts_includesOldPinnedPostsWithoutDuplicates() {
        val oldPinned = post(
            id = "old-pinned",
            pinned = true,
            createdAt = Date(1_000),
            pinnedAt = Date(4_000)
        )
        val recentPinned = post(
            id = "recent-pinned",
            pinned = true,
            createdAt = Date(3_000),
            pinnedAt = Date(3_500)
        )
        val recentRegular = post(
            id = "recent-regular",
            pinned = false,
            createdAt = Date(2_500)
        )

        val merged = mergeRecentAndPinnedPosts(
            recentPosts = listOf(recentPinned, recentRegular),
            pinnedPosts = listOf(oldPinned, recentPinned)
        )

        assertThat(merged.map { it.id }).containsExactly(
            "old-pinned",
            "recent-pinned",
            "recent-regular"
        ).inOrder()
    }

    @Test
    fun mergeRecentAndPinnedPosts_filtersDeletedDuplicates() {
        val deletedPinned = post(
            id = "deleted-pinned",
            pinned = true,
            createdAt = Date(2_000),
            pinnedAt = Date(3_000),
            deletedAt = Date(5_000)
        )
        val activePinned = post(
            id = "active-pinned",
            pinned = true,
            createdAt = Date(1_500),
            pinnedAt = Date(2_500)
        )
        val activeRegular = post(
            id = "active-regular",
            pinned = false,
            createdAt = Date(1_000)
        )

        val merged = mergeRecentAndPinnedPosts(
            recentPosts = listOf(activePinned, activeRegular, deletedPinned),
            pinnedPosts = listOf(deletedPinned, activePinned)
        )

        assertThat(merged.map { it.id }).containsExactly(
            "active-pinned",
            "active-regular"
        ).inOrder()
    }

    @Test
    fun mergeWallPostTimeline_ordersNewestFirstAndPrefersRealtimeDuplicate() {
        val oldVersion = post(
            id = "duplicate",
            pinned = false,
            createdAt = Date(2_000),
            text = "antigo"
        )
        val realtimeVersion = oldVersion.copy(text = "atualizado")
        val newest = post(
            id = "newest",
            pinned = false,
            createdAt = Date(3_000)
        )
        val oldest = post(
            id = "oldest",
            pinned = false,
            createdAt = Date(1_000)
        )

        val merged = mergeWallPostTimeline(
            recentPosts = listOf(realtimeVersion, newest),
            olderPosts = listOf(oldest, oldVersion)
        )

        assertThat(merged.map { it.id }).containsExactly(
            "newest",
            "duplicate",
            "oldest"
        ).inOrder()
        assertThat(merged.first { it.id == "duplicate" }.text).isEqualTo("atualizado")
    }

    @Test
    fun mergeWallPostTimeline_keepsPendingServerTimestampAtTop() {
        val pending = post(
            id = "pending",
            pinned = false,
            createdAt = null
        )
        val acknowledged = post(
            id = "acknowledged",
            pinned = false,
            createdAt = Date(3_000)
        )

        val merged = mergeWallPostTimeline(
            recentPosts = listOf(pending, acknowledged)
        )

        assertThat(merged.map { it.id }).containsExactly("pending", "acknowledged").inOrder()
    }

    private fun post(
        id: String,
        pinned: Boolean,
        createdAt: Date?,
        pinnedAt: Date? = null,
        deletedAt: Date? = null,
        text: String = "texto"
    ) = GroupWallPost(
        id = id,
        groupId = "group-1",
        authorId = "user-1",
        authorName = "Jogador",
        text = text,
        pinned = pinned,
        pinnedAt = pinnedAt,
        createdAt = createdAt,
        deletedAt = deletedAt
    )
}
