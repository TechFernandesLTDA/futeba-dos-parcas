package com.futebadosparcas.ui.components.input

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation

/**
 * VisualTransformation para formatação automática de CEP brasileiro.
 *
 * Formata a entrada do usuário em tempo real no padrão XXXXX-XXX.
 * O valor real (sem formatação) é mantido no state, apenas a
 * visualização é transformada.
 *
 * Uso:
 * ```kotlin
 * var cep by remember { mutableStateOf("") }
 *
 * OutlinedTextField(
 *     value = cep,
 *     onValueChange = { newValue ->
 *         // Filtra apenas dígitos e limita a 8 caracteres
 *         cep = newValue.filter { it.isDigit() }.take(8)
 *     },
 *     visualTransformation = CepVisualTransformation(),
 *     keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
 * )
 * ```
 */
class CepVisualTransformation : VisualTransformation {

    override fun filter(text: AnnotatedString): TransformedText {
        val digitsOnly = text.text.filter { it.isDigit() }.take(8)
        val formattedText = formatCep(digitsOnly)

        return TransformedText(
            text = AnnotatedString(formattedText),
            offsetMapping = CepOffsetMapping(digitsOnly.length)
        )
    }

    /**
     * Formata o CEP inserindo hífen após o 5º dígito.
     * "12345678" -> "12345-678"
     */
    private fun formatCep(digits: String): String {
        return buildString {
            digits.forEachIndexed { index, char ->
                if (index == 5) append('-')
                append(char)
            }
        }
    }

    /**
     * Mapeamento de offset para manter o cursor na posição correta
     * durante a edição do CEP formatado.
     */
    private class CepOffsetMapping(private val originalLength: Int) : OffsetMapping {

        /**
         * Converte offset do texto original (sem hífen) para o transformado (com hífen).
         */
        override fun originalToTransformed(offset: Int): Int {
            // Se o offset está após a posição 5 (onde o hífen é inserido),
            // adiciona 1 para compensar o hífen
            return when {
                offset <= 5 -> offset
                else -> offset + 1
            }.coerceAtMost(getTransformedLength())
        }

        /**
         * Converte offset do texto transformado (com hífen) para o original (sem hífen).
         */
        override fun transformedToOriginal(offset: Int): Int {
            // Se o offset está após a posição 5 (onde o hífen está),
            // subtrai 1 para compensar o hífen
            return when {
                offset <= 5 -> offset
                else -> offset - 1
            }.coerceIn(0, originalLength)
        }

        /**
         * Calcula o tamanho do texto transformado (com hífen se aplicável).
         */
        private fun getTransformedLength(): Int {
            return if (originalLength > 5) originalLength + 1 else originalLength
        }
    }

    companion object {
        /**
         * Instância singleton para reutilização.
         * VisualTransformation é stateless, então pode ser compartilhada.
         */
        val Instance = CepVisualTransformation()
    }
}
