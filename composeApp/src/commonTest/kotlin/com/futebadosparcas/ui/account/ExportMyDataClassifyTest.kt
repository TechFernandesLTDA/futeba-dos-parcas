package com.futebadosparcas.ui.account

import com.futebadosparcas.platform.firebase.CallableException
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals

/** Classificação dos erros e formato de nome da exportação LGPD (#4483). */
class ExportMyDataClassifyTest {

    @Test
    fun fileName_matchesWebAndAndroidFormat() {
        val date = LocalDate(2026, 5, 29)
        assertEquals(
            "futeba-dos-parcas-meus-dados-2026-05-29.json",
            exportMyDataFileName(date)
        )
    }

    @Test
    fun classify_resourceExhaustedWithoutReason_isRateLimited() {
        val state = ExportMyDataViewModel.classify(
            CallableException(CallableException.RESOURCE_EXHAUSTED, "rate limit")
        )
        assertEquals(ExportMyDataError.RATE_LIMITED, state.reason)
    }

    @Test
    fun classify_resourceExhaustedWithExportTooLargeReason_isTooLarge() {
        val state = ExportMyDataViewModel.classify(
            CallableException(
                CallableException.RESOURCE_EXHAUSTED,
                "too large",
                reason = CallableException.REASON_EXPORT_TOO_LARGE
            )
        )
        assertEquals(ExportMyDataError.TOO_LARGE, state.reason)
    }

    @Test
    fun classify_otherCallableCode_isGeneric() {
        val state = ExportMyDataViewModel.classify(
            CallableException(CallableException.UNAVAILABLE, "unavailable")
        )
        assertEquals(ExportMyDataError.GENERIC, state.reason)
    }

    @Test
    fun classify_nonCallableException_isGeneric() {
        val state = ExportMyDataViewModel.classify(IllegalStateException("boom"))
        assertEquals(ExportMyDataError.GENERIC, state.reason)
    }
}
