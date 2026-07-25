package com.futebadosparcas.domain.markdown

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

/**
 * Teste de contrato do parser de marcação das notas de versão (#3898).
 *
 * Os seis primeiros casos são portados **caso a caso** de
 * `web/src/utils/markdownLite.test.ts`. As duas implementações
 * (TypeScript na web, Kotlin aqui) precisam concordar: se um lado mudar de
 * comportamento sem o outro, o usuário volta a ver asteriscos literais em uma
 * das plataformas — que é exatamente como o #3876 nasceu e o #3898 reincidiu.
 *
 * Ao mexer neste arquivo, mexa também no par da web (e vice-versa).
 */
class MarkdownLiteTest {

    @Test
    fun parseMarkdownLite_stringVazia_retornaListaVazia() {
        assertEquals(emptyList(), parseMarkdownLite(""))
    }

    @Test
    fun parseMarkdownLite_semMarcacao_retornaSegmentoUnicoNaoNegrito() {
        assertEquals(
            listOf(MarkdownSpan("texto simples", bold = false)),
            parseMarkdownLite("texto simples"),
        )
    }

    @Test
    fun parseMarkdownLite_negritoNoInicio_separaOsDoisSegmentos() {
        assertEquals(
            listOf(
                MarkdownSpan("Carona mais discreta", bold = true),
                MarkdownSpan(": o painel agora fica atrás de um ícone.", bold = false),
            ),
            parseMarkdownLite(
                "**Carona mais discreta**: o painel agora fica atrás de um ícone.",
            ),
        )
    }

    @Test
    fun parseMarkdownLite_multiplosTrechos_alternaNegritoETextoSimples() {
        assertEquals(
            listOf(
                MarkdownSpan("a", bold = true),
                MarkdownSpan(" meio ", bold = false),
                MarkdownSpan("b", bold = true),
                MarkdownSpan(" fim", bold = false),
            ),
            parseMarkdownLite("**a** meio **b** fim"),
        )
    }

    @Test
    fun parseMarkdownLite_qualquerEntrada_naoDeixaAsteriscoLiteralNosSegmentos() {
        val segments = parseMarkdownLite("**Gestor confirma jogadores**: organizadores...")
        val joined = segments.joinToString(separator = "") { it.text }
        assertFalse(joined.contains("**"), "sobrou marcação literal em: $joined")
    }

    @Test
    fun parseMarkdownLite_negritoNaoFechado_tratadoComoTextoPuro() {
        assertEquals(
            listOf(MarkdownSpan("texto **sem fechamento", bold = false)),
            parseMarkdownLite("texto **sem fechamento"),
        )
    }

    /**
     * Caso real: única nota do `app/src/main/assets/release-notes.json` com
     * marcação hoje (v1.34.0) — a que aparece com asteriscos literais na tela
     * "Novidades" antes deste fix.
     */
    @Test
    fun parseMarkdownLite_headlineRealV1340_renderizaSemAsteriscos() {
        val headline =
            "**Rede social da pelada**: chat por jogo e mural de provocações " +
                "do grupo chegam ao app Android."

        val segments = parseMarkdownLite(headline)

        assertEquals(
            listOf(
                MarkdownSpan("Rede social da pelada", bold = true),
                MarkdownSpan(
                    ": chat por jogo e mural de provocações do grupo chegam ao app Android.",
                    bold = false,
                ),
            ),
            segments,
        )
    }
}
