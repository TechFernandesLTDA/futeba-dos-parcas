package com.futebadosparcas.ui.groups

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class WallPostCardTest {

    @Test
    fun `MP4 vindo do Web usa player de video`() {
        assertEquals(
            WallMediaKind.VIDEO,
            resolveWallMediaKind("video/mp4", "https://cdn.example/mural/video.mp4")
        )
    }

    @Test
    fun `URL MP4 legada sem media type tambem usa player de video`() {
        assertEquals(
            WallMediaKind.VIDEO,
            resolveWallMediaKind(null, "https://cdn.example/mural/video.mp4?token=abc")
        )
    }

    @Test
    fun `imagem e media desconhecida nao entram no player errado`() {
        assertEquals(
            WallMediaKind.IMAGE,
            resolveWallMediaKind("image/webp", "https://cdn.example/mural/foto.webp")
        )
        assertEquals(
            WallMediaKind.UNSUPPORTED,
            resolveWallMediaKind("application/pdf", "https://cdn.example/mural/anexo.pdf")
        )
    }
}
