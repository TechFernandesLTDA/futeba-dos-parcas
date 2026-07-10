package com.futebadosparcas.ui.map

import com.futebadosparcas.util.RealtimeTelemetry
import com.futebadosparcas.util.RealtimeTelemetryClock
import com.futebadosparcas.util.RealtimeTelemetryRandom
import com.futebadosparcas.util.RealtimeTelemetrySample
import com.futebadosparcas.util.RealtimeTelemetrySink
import com.google.firebase.firestore.CollectionReference
import com.google.firebase.firestore.EventListener
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QuerySnapshot
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@DisplayName("PublicGamesMapViewModel realtime telemetry")
class PublicGamesMapViewModelTelemetryTest {

    @Test
    @DisplayName("listener registra bootstrap erro e reconexao sem IDs")
    fun listenerRecordsBootstrapErrorAndReconnect() {
        val firestore = mockk<FirebaseFirestore>()
        val collection = mockk<CollectionReference>()
        val publicQuery = mockk<Query>()
        val statusQuery = mockk<Query>()
        val orderedQuery = mockk<Query>()
        val limitedQuery = mockk<Query>()
        val registration = mockk<ListenerRegistration>(relaxed = true)
        val listener = slot<EventListener<QuerySnapshot>>()
        every { firestore.collection(any()) } returns collection
        every { collection.whereEqualTo("is_public", true) } returns publicQuery
        every {
            publicQuery.whereIn("status", listOf("SCHEDULED", "CONFIRMED"))
        } returns statusQuery
        every { statusQuery.orderBy(any<FieldPath>()) } returns orderedQuery
        every { orderedQuery.limit(PublicGamesMapViewModel.PAGE_SIZE) } returns limitedQuery
        every { limitedQuery.addSnapshotListener(capture(listener)) } returns registration

        val clock = MutableClock()
        val samples = mutableListOf<RealtimeTelemetrySample>()
        val telemetry = RealtimeTelemetry(
            release = "1.36.6",
            random = RealtimeTelemetryRandom { 0.0 },
            clock = clock,
            sink = RealtimeTelemetrySink { sample -> samples += sample }
        )
        PublicGamesMapViewModel(firestore, telemetry)

        val emptySnapshot = mockk<QuerySnapshot>()
        every { emptySnapshot.documents } returns emptyList()
        clock.advance(30L)
        listener.captured.onEvent(emptySnapshot, null)

        val firestoreError = mockk<FirebaseFirestoreException>()
        every { firestoreError.message } returns "detalhe privado nao enviado"
        clock.advance(10L)
        listener.captured.onEvent(null, firestoreError)
        clock.advance(15L)
        listener.captured.onEvent(emptySnapshot, null)

        assertEquals(listOf("bootstrap", "error", "reconnect"), samples.map { it.phase })
        assertEquals(listOf(30L, 10L, 15L), samples.map { it.duration })
        assertEquals(setOf("public_games_map"), samples.map { it.flow }.toSet())
    }

    private class MutableClock : RealtimeTelemetryClock {
        private var now = 0L

        override fun nowMillis(): Long = now

        fun advance(duration: Long) {
            now += duration
        }
    }
}
