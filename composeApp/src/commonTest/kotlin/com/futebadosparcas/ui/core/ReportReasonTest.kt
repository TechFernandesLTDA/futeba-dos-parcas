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
}
