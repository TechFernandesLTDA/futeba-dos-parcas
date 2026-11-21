package com.futebadosparcas.ui.components.artes

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Leaderboard
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.ui.graphics.vector.PathParser
import com.futebadosparcas.domain.artes.ArteId
import com.futebadosparcas.domain.artes.ArtesDaPelada
import com.futebadosparcas.domain.artes.CaminhoArte
import com.futebadosparcas.domain.artes.GrupoArte
import com.futebadosparcas.domain.artes.NoArte
import com.futebadosparcas.domain.artes.PictogramaId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

/** Artes da pelada no Android (spec FEAT_2026-11-21_ARTES_DA_PELADA). */
class ArtesDosEstadosTest {

    @Test
    @DisplayName("ícones dos estados vazios viram a arte certa")
    fun arteDoIcone_mapeiaIconesConhecidos() {
        assertEquals(ArteId.PRANCHETA_VAZIA, arteDoIcone(Icons.Default.Inbox))
        assertEquals(ArteId.COLETES_VARAL, arteDoIcone(Icons.Default.Groups))
        assertEquals(ArteId.PODIO, arteDoIcone(Icons.Default.Leaderboard))
        assertEquals(ArteId.MEDALHA, arteDoIcone(Icons.Default.EmojiEvents))
        assertEquals(ArteId.APITO, arteDoIcone(Icons.Default.NotificationsNone))
        assertEquals(ArteId.LUPA, arteDoIcone(Icons.Default.SearchOff))
        assertEquals(ArteId.BOLA_NA_TRAVE, arteDoIcone(Icons.Default.WifiOff))
    }

    @Test
    @DisplayName("ícone sem arte no catálogo continua como ícone")
    fun arteDoIcone_semArte_devolveNull() {
        assertNull(arteDoIcone(Icons.Default.ChatBubbleOutline))
    }

    @Test
    @DisplayName("todo caminho das artes é lido pelo PathParser do Compose")
    fun caminhosDasArtes_saoValidos() {
        fun caminhos(nos: List<NoArte>): List<String> = nos.flatMap { no ->
            when (no) {
                is CaminhoArte -> listOf(no.d)
                is GrupoArte -> caminhos(no.filhos)
            }
        }
        ArteId.entries.forEach { id ->
            caminhos(ArtesDaPelada.arte(id).nos).forEach { d ->
                assertTrue(PathParser().parsePathString(d).toNodes().isNotEmpty(), "$id: caminho vazio")
            }
        }
    }

    @Test
    @DisplayName("todo pictograma vira ImageVector na grade 24")
    fun pictogramas_viramImageVector() {
        PictogramaId.entries.forEach { id ->
            val vetor = pictogramaVetor(id)
            assertEquals(24f, vetor.viewportWidth)
            assertEquals(ArtesDaPelada.pictograma(id).tracos.size, vetor.root.size)
        }
    }
}
