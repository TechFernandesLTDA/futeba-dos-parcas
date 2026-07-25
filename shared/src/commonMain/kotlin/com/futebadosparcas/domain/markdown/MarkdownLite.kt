package com.futebadosparcas.domain.markdown

/**
 * Parser "lite" de Markdown — suporta apenas `**negrito**`.
 *
 * As notas de versão (`release-notes.json`) são escritas em Markdown por hábito
 * de quem redige. Até o #3876 nenhum renderizador fazia parse e o usuário via os
 * asteriscos literais na tela; o #3888 corrigiu só a web e o #3898 trouxe o
 * mesmo comportamento para Android e iOS.
 *
 * Deliberadamente não usamos uma lib de Markdown completa: o conteúdo é curto,
 * vem de fonte controlada (`scripts/release-notes.js`) e só precisa de ênfase em
 * negrito. Uma lib seria dependência nova nos três targets do KMP.
 *
 * Porte direto de `web/src/utils/markdownLite.ts` — as duas implementações são
 * mantidas em paridade pelo par de testes espelhados
 * (`MarkdownLiteTest.kt` <-> `web/src/utils/markdownLite.test.ts`).
 *
 * Fica em `:shared/commonMain` porque `:shared` não tem dependência de Compose:
 * a conversão para `AnnotatedString` mora em cada módulo de UI (`:app` e
 * `:composeApp`), que consomem este mesmo parser.
 */

/**
 * Um trecho de texto já classificado quanto à ênfase.
 *
 * @property text conteúdo sem os delimitadores de marcação.
 * @property bold `true` quando o trecho estava entre `**`.
 */
data class MarkdownSpan(
    val text: String,
    val bold: Boolean,
)

/** Casa o menor trecho possível entre pares de `**`. */
private val BOLD_PATTERN = Regex("""\*\*(.+?)\*\*""")

/**
 * Quebra [text] em segmentos de texto simples e negrito.
 *
 * `**foo** bar **baz**` vira
 * `[("foo", true), (" bar ", false), ("baz", true)]`.
 *
 * Marcação não fechada (`texto **sem fim`) é devolvida como texto puro, sem
 * lançar — é a mesma tolerância da versão web.
 *
 * @return lista vazia quando [text] é vazio.
 */
fun parseMarkdownLite(text: String): List<MarkdownSpan> {
    if (text.isEmpty()) return emptyList()

    val segments = mutableListOf<MarkdownSpan>()
    var lastIndex = 0

    // findAll não guarda estado entre chamadas — a versão JS precisa resetar
    // `lastIndex` porque o regex global é compartilhado no módulo.
    for (match in BOLD_PATTERN.findAll(text)) {
        if (match.range.first > lastIndex) {
            segments.add(MarkdownSpan(text.substring(lastIndex, match.range.first), bold = false))
        }
        segments.add(MarkdownSpan(match.groupValues[1], bold = true))
        lastIndex = match.range.last + 1
    }

    if (lastIndex < text.length) {
        segments.add(MarkdownSpan(text.substring(lastIndex), bold = false))
    }

    return segments
}
