package com.futebadosparcas.ui.groups

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class GroupWallPaginationTest {

    @Test
    fun `dispara prefetch quando usuario se aproxima do fim`() {
        assertFalse(shouldLoadMoreWallPosts(lastVisibleItemIndex = 13, totalItems = 20))
        assertTrue(shouldLoadMoreWallPosts(lastVisibleItemIndex = 15, totalItems = 20))
        assertTrue(shouldLoadMoreWallPosts(lastVisibleItemIndex = 19, totalItems = 20))
    }

    @Test
    fun `nao pagina lista sem itens visiveis`() {
        assertFalse(shouldLoadMoreWallPosts(lastVisibleItemIndex = -1, totalItems = 0))
    }

    @Test
    fun `estado atualizado controla paginacao sem reiniciar observador`() {
        assertTrue(
            shouldRequestMoreWallPosts(
                hasMore = true,
                loadingMore = false,
                hasLoadMoreError = false,
                postsEmpty = true,
                lastVisibleItemIndex = -1,
                totalItems = 0
            )
        )
        assertFalse(
            shouldRequestMoreWallPosts(
                hasMore = true,
                loadingMore = true,
                hasLoadMoreError = false,
                postsEmpty = false,
                lastVisibleItemIndex = 19,
                totalItems = 20
            )
        )
        assertFalse(
            shouldRequestMoreWallPosts(
                hasMore = true,
                loadingMore = false,
                hasLoadMoreError = true,
                postsEmpty = false,
                lastVisibleItemIndex = 19,
                totalItems = 20
            )
        )
    }
}
