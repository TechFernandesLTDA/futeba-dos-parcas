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
}
