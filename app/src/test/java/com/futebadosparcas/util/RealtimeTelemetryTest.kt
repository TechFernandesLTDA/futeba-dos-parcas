package com.futebadosparcas.util

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@DisplayName("RealtimeTelemetry")
class RealtimeTelemetryTest {

    @Test
    @DisplayName("sampling e estavel e nunca ultrapassa cinco por cento")
    fun samplingIsStableAndCapped() {
        val acceptedRandom = CountingRandom(0.049)
        val acceptedSamples = mutableListOf<RealtimeTelemetrySample>()
        val accepted = telemetry(
            random = acceptedRandom,
            sampleRate = 1.0,
            samples = acceptedSamples
        )
        val tracker = accepted.tracker(RealtimeTelemetryFlow.SOCIAL_FEED)
        tracker.recordApply()
        tracker.recordApply()

        val rejectedRandom = CountingRandom(0.05)
        val rejectedSamples = mutableListOf<RealtimeTelemetrySample>()
        val rejected = telemetry(
            random = rejectedRandom,
            sampleRate = RealtimeTelemetry.MAX_SAMPLE_RATE,
            samples = rejectedSamples
        )
        rejected.tracker(RealtimeTelemetryFlow.SOCIAL_FEED).recordApply()

        assertEquals(1, acceptedRandom.calls)
        assertEquals(2, acceptedSamples.size)
        assertEquals(1, rejectedRandom.calls)
        assertTrue(rejectedSamples.isEmpty())
    }

    @Test
    @DisplayName("schema e fechado e nao admite campos de PII")
    fun payloadSchemaIsClosedAndPiiFree() {
        val clock = MutableClock(1_000L)
        val samples = mutableListOf<RealtimeTelemetrySample>()
        val tracker = telemetry(clock = clock, samples = samples)
            .tracker(RealtimeTelemetryFlow.PUBLIC_GAMES_MAP)

        clock.advance(75L)
        tracker.recordApply()

        val payload = samples.single().toPayload()
        assertEquals(
            setOf("platform", "flow", "phase", "duration", "release"),
            payload.keys
        )
        assertEquals("android", payload["platform"])
        assertEquals("public_games_map", payload["flow"])
        assertEquals("bootstrap", payload["phase"])
        assertEquals(75L, payload["duration"])
        assertTrue(
            payload.keys.intersect(
                setOf("uid", "user_id", "id", "name", "path", "message", "error")
            ).isEmpty()
        )
    }

    @Test
    @DisplayName("fases medem bootstrap apply erro e reconexao com duracao limitada")
    fun trackerMeasuresAllAllowedPhases() {
        val clock = MutableClock(10_000L)
        val samples = mutableListOf<RealtimeTelemetrySample>()
        val tracker = telemetry(clock = clock, samples = samples)
            .tracker(RealtimeTelemetryFlow.LOCATIONS_MAP)

        clock.advance(50L)
        tracker.recordApply()
        tracker.startApply()
        clock.advance(20L)
        tracker.recordApply()
        tracker.startApply()
        clock.advance(RealtimeTelemetry.MAX_DURATION_MILLIS + 1L)
        tracker.recordError()
        tracker.startReconnect()
        clock.advance(30L)
        tracker.recordApply()

        assertEquals(
            listOf("bootstrap", "apply", "error", "reconnect"),
            samples.map { it.phase }
        )
        assertEquals(
            listOf(50L, 20L, RealtimeTelemetry.MAX_DURATION_MILLIS, 30L),
            samples.map { it.duration }
        )
    }

    @Test
    @DisplayName("contrato cobre as quatro superficies Android sem identificadores")
    fun contractCoversFourAndroidSurfaces() {
        val samples = mutableListOf<RealtimeTelemetrySample>()
        val telemetry = telemetry(samples = samples)

        listOf(
            RealtimeTelemetryFlow.SOCIAL_FEED,
            RealtimeTelemetryFlow.PUBLIC_GAMES_MAP,
            RealtimeTelemetryFlow.LOCATIONS_MAP,
            RealtimeTelemetryFlow.LIVE_GAME
        ).forEach { flow -> telemetry.tracker(flow).recordApply() }

        assertEquals(
            listOf("social_feed", "public_games_map", "locations_map", "live_game"),
            samples.map { it.flow }
        )
        assertTrue(samples.all { it.toPayload().size == 5 })
    }

    @Test
    @DisplayName("release fora do contrato e rejeitada localmente")
    fun invalidReleaseIsRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            RealtimeTelemetry(
                release = "release com espaco",
                random = RealtimeTelemetryRandom { 0.0 },
                sink = RealtimeTelemetrySink { }
            )
        }
    }

    private fun telemetry(
        clock: MutableClock = MutableClock(0L),
        random: RealtimeTelemetryRandom = RealtimeTelemetryRandom { 0.0 },
        sampleRate: Double = RealtimeTelemetry.MAX_SAMPLE_RATE,
        samples: MutableList<RealtimeTelemetrySample>
    ) = RealtimeTelemetry(
        release = "1.36.6",
        sampleRate = sampleRate,
        random = random,
        clock = clock,
        sink = RealtimeTelemetrySink { sample -> samples += sample }
    )

    private class MutableClock(private var value: Long) : RealtimeTelemetryClock {
        override fun nowMillis(): Long = value

        fun advance(duration: Long) {
            value += duration
        }
    }

    private class CountingRandom(private val value: Double) : RealtimeTelemetryRandom {
        var calls: Int = 0
            private set

        override fun nextDouble(): Double {
            calls += 1
            return value
        }
    }
}
