package com.futebadosparcas.bateria

import com.google.common.truth.Truth.assertWithMessage

/**
 * Defeitos conhecidos que a bateria do Android encontrou.
 *
 * Cada item aponta para a issue. [falhaEsperada] passa enquanto o defeito
 * existir e fica VERMELHO quando ele for corrigido: aí é só tirar o
 * `falhaEsperada` e apagar a entrada daqui. Mesmo contrato do `test.fail` da
 * bateria web (`web/e2e-bateria/pendencias.ts`).
 */
object PendenciasBateria {
    private const val ISSUES = "https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues"

    const val DETALHE_DO_JOGO_SEM_ID =
        "$ISSUES/4576 detalhe do jogo vem com id vazio quando o documento não tem o campo id"

    fun falhaEsperada(pendencia: String, bloco: () -> Unit) {
        val falhou = runCatching(bloco).exceptionOrNull() is AssertionError
        assertWithMessage("Pendência corrigida, tire o falhaEsperada: $pendencia").that(falhou).isTrue()
    }
}
