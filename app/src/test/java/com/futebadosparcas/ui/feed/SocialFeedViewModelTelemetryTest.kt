package com.futebadosparcas.ui.feed

import com.futebadosparcas.data.repository.SocialFeedRepository
import com.futebadosparcas.data.repository.SocialFeedResult
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.RealtimeTelemetry
import com.futebadosparcas.util.RealtimeTelemetryClock
import com.futebadosparcas.util.RealtimeTelemetryRandom
import com.futebadosparcas.util.RealtimeTelemetrySample
import com.futebadosparcas.util.RealtimeTelemetrySink
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@OptIn(ExperimentalCoroutinesApi::class)
@ExtendWith(InstantTaskExecutorExtension::class)
@DisplayName("SocialFeedViewModel realtime telemetry")
class SocialFeedViewModelTelemetryTest {
    private val dispatcher = StandardTestDispatcher()

    @BeforeEach
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("registra bootstrap erro e reconexao sem dados do usuario")
    fun recordsBootstrapErrorAndReconnect() = runTest(dispatcher) {
        val repository = mockk<SocialFeedRepository>()
        val pages = MutableSharedFlow<Result<SocialFeedResult>>()
        every { repository.observeFirstPage() } returns pages
        val clock = MutableClock()
        val samples = mutableListOf<RealtimeTelemetrySample>()
        val telemetry = RealtimeTelemetry(
            release = "1.36.6",
            random = RealtimeTelemetryRandom { 0.0 },
            clock = clock,
            sink = RealtimeTelemetrySink { sample -> samples += sample }
        )

        val viewModel = SocialFeedViewModel(repository, telemetry)
        advanceUntilIdle()
        clock.advance(40L)
        pages.emit(Result.success(SocialFeedResult(emptyList(), hasGroups = false)))
        advanceUntilIdle()
        clock.advance(10L)
        pages.emit(Result.failure(IllegalStateException("detalhe privado nao enviado")))
        advanceUntilIdle()

        viewModel.load()
        advanceUntilIdle()
        clock.advance(25L)
        pages.emit(Result.success(SocialFeedResult(emptyList(), hasGroups = false)))
        advanceUntilIdle()

        assertEquals(listOf("bootstrap", "error", "reconnect"), samples.map { it.phase })
        assertEquals(listOf(40L, 10L, 25L), samples.map { it.duration })
        assertEquals(setOf("social_feed"), samples.map { it.flow }.toSet())
        assertEquals(
            setOf("platform", "flow", "phase", "duration", "release"),
            samples.flatMap { it.toPayload().keys }.toSet()
        )
    }

    private class MutableClock : RealtimeTelemetryClock {
        private var now = 0L

        override fun nowMillis(): Long = now

        fun advance(duration: Long) {
            now += duration
        }
    }
}
