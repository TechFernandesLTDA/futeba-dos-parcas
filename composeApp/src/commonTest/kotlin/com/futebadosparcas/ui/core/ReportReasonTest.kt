package com.futebadosparcas.ui.core

import kotlin.test.Test
import kotlin.test.assertEquals

class ReportReasonTest {

    /** Os códigos precisam bater com a lista de `reason` e `target_type` em firestore.rules (abuse_reports). */
    @Test
    fun codigosBatemComAsRegrasDoFirestore() {
        assertEquals(
            setOf("inappropriate_content", "abusive_language", "spam", "harassment", "other"),
            ReportReason.entries.map { it.code }.toSet()
        )
        assertEquals(
            setOf("player", "group"),
            ReportTargetType.entries.map { it.code }.toSet()
        )
    }

    @Test
    fun denunciaRepetidaNaoChamaOServidorNemViraErro() = kotlinx.coroutines.test.runTest {
        val store = mutableMapOf<String, Boolean>()
        val log = ReportLog({ store[it] ?: false }, { k, v -> store[k] = v })
        var calls = 0

        assertEquals(ReportOutcome.SENT, log.submitOnce("u1", "player", "p9") { calls++; true })
        assertEquals(ReportOutcome.ALREADY_REPORTED, log.submitOnce("u1", "player", "p9") { calls++; true })
        assertEquals(1, calls)
        // Outro alvo e outro usuário ainda enviam.
        assertEquals(ReportOutcome.SENT, log.submitOnce("u1", "group", "p9") { calls++; true })
        assertEquals(ReportOutcome.SENT, log.submitOnce("u2", "player", "p9") { calls++; true })
        assertEquals(3, calls)
    }

    @Test
    fun falhaDeVerdadeNaoGuardaEPermiteTentarDeNovo() = kotlinx.coroutines.test.runTest {
        val store = mutableMapOf<String, Boolean>()
        val log = ReportLog({ store[it] ?: false }, { k, v -> store[k] = v })

        assertEquals(ReportOutcome.FAILED, log.submitOnce("u1", "player", "p9") { false })
        assertEquals(ReportOutcome.SENT, log.submitOnce("u1", "player", "p9") { true })
    }
}
