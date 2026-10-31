package com.futebadosparcas.platform.firebase

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Mapeamento de `HttpsError.details` da callable `deleteAccount` (#4440). */
class CallableExceptionTest {

    @Test
    fun reasonFromDetails_requiresRecentLogin_returnsReason() {
        val details = mapOf("reason" to "requires-recent-login")
        assertEquals(CallableException.REASON_REQUIRES_RECENT_LOGIN, CallableException.reasonFromDetails(details))
        assertTrue(CallableException.groupsFromDetails(details).isEmpty())
    }

    @Test
    fun reasonAndGroupsFromDetails_soleOwner_returnsReasonAndGroups() {
        val details = mapOf(
            "reason" to "sole-owner-groups",
            "groups" to listOf(
                mapOf("id" to "g1", "name" to "Pelada de Quarta"),
                mapOf("id" to "g2", "name" to "Sexta FC")
            )
        )
        assertEquals(CallableException.REASON_SOLE_OWNER_GROUPS, CallableException.reasonFromDetails(details))
        assertEquals(
            listOf(CallableGroup("g1", "Pelada de Quarta"), CallableGroup("g2", "Sexta FC")),
            CallableException.groupsFromDetails(details)
        )
    }

    @Test
    fun groupsFromDetails_malformedItems_areIgnoredAndMissingNameIsEmpty() {
        val details = mapOf(
            "groups" to listOf(
                mapOf("id" to "g1"),
                mapOf("name" to "sem id"),
                "texto",
                mapOf("id" to 7, "name" to "id numérico")
            )
        )
        assertEquals(listOf(CallableGroup("g1", "")), CallableException.groupsFromDetails(details))
    }

    @Test
    fun detailsNullOrWrongShape_returnsNullReasonAndNoGroups() {
        listOf<Any?>(null, "texto", 42, emptyMap<String, Any>(), mapOf("reason" to 1, "groups" to "x")).forEach {
            assertNull(CallableException.reasonFromDetails(it))
            assertTrue(CallableException.groupsFromDetails(it).isEmpty())
        }
    }
}
