package com.futebadosparcas.ui.components.accessibility

import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.unit.dp

/**
 * Largura da borda do indicador de foco.
 */
private val FOCUS_BORDER_WIDTH = 2.dp

/**
 * Modificador que adiciona indicador visual de foco para acessibilidade.
 *
 * Quando o elemento recebe foco (via teclado, D-pad, TalkBack),
 * uma borda de 2dp com a cor primária do tema é exibida ao redor do elemento.
 *
 * Segue as diretrizes WCAG para indicadores de foco visíveis,
 * garantindo que usuários que navegam por teclado ou tecnologias
 * assistivas possam identificar o elemento focado.
 *
 * Uso:
 * ```kotlin
 * Card(
 *     modifier = Modifier
 *         .focusIndicator()
 *         .clickable { ... }
 * ) { ... }
 *
 * // Com shape customizado
 * Button(
 *     modifier = Modifier.focusIndicator(
 *         shape = MaterialTheme.shapes.medium
 *     ),
 *     onClick = { ... }
 * ) { ... }
 * ```
 *
 * @param shape Forma da borda de foco (padrão: retângulo arredondado médio)
 */
fun Modifier.focusIndicator(
    shape: androidx.compose.ui.graphics.Shape? = null
): Modifier = composed {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    val focusShape = shape ?: MaterialTheme.shapes.medium
    val focusColor = MaterialTheme.colorScheme.primary

    this
        .focusable(interactionSource = interactionSource)
        .then(
            if (isFocused) {
                Modifier.border(
                    width = FOCUS_BORDER_WIDTH,
                    color = focusColor,
                    shape = focusShape
                )
            } else {
                Modifier
            }
        )
}

/**
 * Modificador que garante touch target mínimo de 48dp.
 *
 * Aplica padding mínimo para garantir que o elemento tenha pelo menos
 * 48x48dp de área interativa, conforme diretrizes de acessibilidade.
 *
 * Uso:
 * ```kotlin
 * IconButton(
 *     onClick = { ... },
 *     modifier = Modifier.minimumTouchTarget()
 * ) {
 *     Icon(Icons.Default.Settings, contentDescription = "Configurações")
 * }
 * ```
 */
fun Modifier.minimumTouchTarget(): Modifier =
    this.then(
        Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
    )
