package com.futebadosparcas.ui.account

import com.futebadosparcas.platform.firebase.CallableException
import com.futebadosparcas.platform.firebase.CallableGroup
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Separação dos dois `failed-precondition` da exclusão de conta (#4440). */
class DeleteAccountClassifyTest {

    private fun failedPrecondition(reason: String?, groups: List<CallableGroup> = emptyList()) =
        CallableException(CallableException.FAILED_PRECONDITION, "x", reason = reason, groups = groups)

    @Test
    fun classify_requiresRecentLogin_asksReauth() {
        val state = DeleteAccountViewModel.classify(
            failedPrecondition(CallableException.REASON_REQUIRES_RECENT_LOGIN)
        )
        assertEquals(DeleteAccountError.RECENT_LOGIN_REQUIRED, state.reason)
        assertTrue(state.blockingGroups.isEmpty())
    }

    @Test
    fun classify_soleOwnerGroups_carriesGroupsAndDoesNotAskReauth() {
        val groups = listOf(CallableGroup("g1", "Pelada de Quarta"))
        val state = DeleteAccountViewModel.classify(
            failedPrecondition(CallableException.REASON_SOLE_OWNER_GROUPS, groups)
        )
        assertEquals(DeleteAccountError.SOLE_OWNER_GROUPS, state.reason)
        assertEquals(groups, state.blockingGroups)
    }

    @Test
    fun classify_failedPreconditionWithoutReason_keepsReauthBehavior() {
        assertEquals(
            DeleteAccountError.RECENT_LOGIN_REQUIRED,
            DeleteAccountViewModel.classify(failedPrecondition(null)).reason
        )
    }

    @Test
    fun classify_failedPreconditionUnknownReason_isGeneric() {
        assertEquals(
            DeleteAccountError.GENERIC,
            DeleteAccountViewModel.classify(failedPrecondition("outro-motivo")).reason
        )
    }

    @Test
    fun classify_otherCodes() {
        fun code(c: String) = DeleteAccountViewModel.classify(CallableException(c, null)).reason
        assertEquals(DeleteAccountError.RECENT_LOGIN_REQUIRED, code(CallableException.UNAUTHENTICATED))
        assertEquals(DeleteAccountError.BACKEND_UNAVAILABLE, code(CallableException.NOT_FOUND))
        assertEquals(DeleteAccountError.GENERIC, code(CallableException.UNAVAILABLE))
        assertEquals(DeleteAccountError.GENERIC, DeleteAccountViewModel.classify(RuntimeException("x")).reason)
    }
}
