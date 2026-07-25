package com.futebadosparcas.ui.whatsnew

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import com.futebadosparcas.domain.markdown.parseMarkdownLite

/**
 * Conversão do parser de marcação das notas de versão para [AnnotatedString].
 *
 * Espelho de `:app/.../ui/whatsnew/MarkdownLiteText.kt` para iOS/CMP. O parser
 * fica em `:shared/commonMain`, que não tem dependência de Compose; a conversão
 * precisa existir uma vez por módulo de UI porque `:app` não depende de
 * `:composeApp` (nem o contrário), então as duas cópias nunca coexistem no
 * mesmo classpath.
 *
 * Issue #3898 — antes disso as notas apareciam com os asteriscos literais.
 */

/**
 * Converte [text] com marcação `**negrito**` em [AnnotatedString].
 *
 * O resultado é memorizado por [text] para não reparsear a cada recomposição.
 * Texto sem marcação passa intacto.
 */
@Composable
internal fun rememberMarkdownLite(text: String): AnnotatedString = remember(text) {
    buildAnnotatedString {
        parseMarkdownLite(text).forEach { span ->
            if (span.bold) {
                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(span.text) }
            } else {
                append(span.text)
            }
        }
    }
}
