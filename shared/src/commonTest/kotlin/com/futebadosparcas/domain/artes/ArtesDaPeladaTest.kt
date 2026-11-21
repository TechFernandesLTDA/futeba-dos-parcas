package com.futebadosparcas.domain.artes

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Testes das artes da pelada (spec FEAT_2026-11-21_ARTES_DA_PELADA): dados gerados e
 * matemática da animação, que o Android e o iOS usam do mesmo jeito.
 */
class ArtesDaPeladaTest {

    private fun perto(esperado: Float, atual: Float, margem: Float = 0.01f) =
        assertTrue(abs(esperado - atual) <= margem, "esperado $esperado, veio $atual")

    @Test
    fun todaArte_temNosEProporcaoPositiva() {
        ArteId.entries.forEach { id ->
            val arte = ArtesDaPelada.arte(id)
            assertEquals(id, arte.id)
            assertTrue(arte.nos.isNotEmpty(), "$id sem nós")
            assertTrue(arte.largura > 0f && arte.altura > 0f, "$id sem tamanho")
        }
    }

    @Test
    fun paletas_cobremTodosOsPapeis() {
        PapelCor.entries.forEach { papel ->
            assertTrue(ArtesDaPelada.paletaClara.containsKey(papel), "claro sem $papel")
            assertTrue(ArtesDaPelada.paletaEscura.containsKey(papel), "escuro sem $papel")
        }
    }

    @Test
    fun todoPictograma_temTracos() {
        PictogramaId.entries.forEach { id ->
            assertTrue(ArtesDaPelada.pictograma(id).tracos.isNotEmpty(), "$id sem traços")
        }
    }

    @Test
    fun campo_ehAnimadoEApito_ehParado() {
        assertTrue(ArtesDaPelada.arte(ArteId.CAMPO).animada)
        assertTrue(!ArtesDaPelada.arte(ArteId.APITO).animada)
    }

    @Test
    fun curvaLinear_devolveOProprioTempo() {
        val linear = CurvaTempo(0f, 0f, 1f, 1f)
        listOf(0f, 0.25f, 0.5f, 0.9f, 1f).forEach { perto(it, linear.aplicar(it)) }
    }

    @Test
    fun curvaEaseInOut_ehSimetricaEMonotona() {
        val curva = CurvaTempo(0.42f, 0f, 0.58f, 1f)
        perto(0.5f, curva.aplicar(0.5f))
        perto(1f - curva.aplicar(0.2f), curva.aplicar(0.8f))
        var anterior = 0f
        for (i in 1..20) {
            val y = curva.aplicar(i / 20f)
            assertTrue(y >= anterior, "curva desceu em ${i / 20f}")
            anterior = y
        }
    }

    @Test
    fun rolar_vaiEVoltaEmCicloAlternado() {
        val rolar = AnimacaoArte.ROLAR.espec()
        assertTrue(rolar.alternar)
        val inicio = rolar.estado(0L)
        val meio = rolar.estado(rolar.duracaoMs.toLong())
        val volta = rolar.estado(rolar.duracaoMs * 2L)
        perto(0f, inicio.dx)
        perto(-38f, meio.dx)
        perto(-240f, meio.graus)
        perto(0f, volta.dx)
        // Simetria do vai e volta
        perto(rolar.estado(600L).dx, rolar.estado(rolar.duracaoMs * 2L - 600L).dx)
    }

    @Test
    fun cair_passaPelosQuadrosChave() {
        val cair = AnimacaoArte.CAIR.espec()
        perto(0f, cair.estado(0L).alfa)
        perto(1f, cair.estado((cair.duracaoMs * 0.6f).toLong()).alfa)
        perto(0f, cair.estado(cair.duracaoMs.toLong() - 1L).alfa, margem = 0.05f)
    }

    @Test
    fun tempoNegativo_naoQuebra() {
        AnimacaoArte.entries.forEach { animacao ->
            val estado = animacao.espec().estado(-1234L)
            assertTrue(estado.escala > 0f)
        }
    }
}
