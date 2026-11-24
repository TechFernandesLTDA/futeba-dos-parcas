package com.futebadosparcas.widget

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import java.util.Date

class ProximoJogoWidgetTest {

    private val agora = Date(1_000_000L)

    @Test
    fun blocos_maisDeDezIds_percorreTodosSemRepetir() {
        val ids = (1..23).map { "jogo-$it" } + listOf("jogo-1", "")

        val blocos = ProximoJogoWidget.blocos(ids)

        assertEquals(listOf(10, 10, 3), blocos.map { it.size })
        assertEquals(23, blocos.flatten().toSet().size)
    }

    @Test
    fun escolherProximo_ignoraPassadosESemData_escolheOMaisProximo() {
        val jogos = listOf(
            "passado" to Date(500_000L),
            "longe" to Date(9_000_000L),
            "sem-data" to null,
            "perto" to Date(2_000_000L)
        )

        val escolhido = ProximoJogoWidget.escolherProximo(jogos, agora) { it.second }

        assertEquals("perto", escolhido?.first)
    }

    @Test
    fun escolherProximo_soJogosPassados_devolveNulo() {
        val jogos = listOf("passado" to Date(500_000L))

        assertNull(ProximoJogoWidget.escolherProximo(jogos, agora) { it.second })
    }

    @Test
    fun escolherProximo_jogoNaHoraExata_contaComoProximo() {
        val jogos = listOf("agora" to Date(agora.time))

        assertEquals("agora", ProximoJogoWidget.escolherProximo(jogos, agora) { it.second }?.first)
    }
}
