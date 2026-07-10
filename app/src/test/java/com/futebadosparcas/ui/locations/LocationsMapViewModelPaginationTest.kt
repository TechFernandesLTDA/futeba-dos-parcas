package com.futebadosparcas.ui.locations

import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.model.PaginatedResult
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.LocationAnalytics
import com.futebadosparcas.util.RealtimeTelemetry
import com.futebadosparcas.util.RealtimeTelemetryRandom
import com.futebadosparcas.util.RealtimeTelemetrySample
import com.futebadosparcas.util.RealtimeTelemetrySink
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@OptIn(ExperimentalCoroutinesApi::class)
@ExtendWith(InstantTaskExecutorExtension::class)
@DisplayName("LocationsMapViewModel pagination")
class LocationsMapViewModelPaginationTest {
    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: LocationRepository
    private lateinit var analytics: LocationAnalytics

    @BeforeEach
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
        analytics = mockk(relaxed = true)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("cursor percorre 1001 locais em 21 paginas sem duplicar")
    fun cursorTraversesThousandAndOneLocations() = runTest(dispatcher) {
        val telemetrySamples = mutableListOf<RealtimeTelemetrySample>()
        val realtimeTelemetry = RealtimeTelemetry(
            release = "1.36.6",
            random = RealtimeTelemetryRandom { 0.0 },
            sink = RealtimeTelemetrySink { sample -> telemetrySamples += sample }
        )
        coEvery { repository.getLocationsPaginated(any(), any(), any()) } answers {
            val start = secondArg<String?>()?.toInt() ?: 0
            val end = (start + 50).coerceAtMost(1_001)
            Result.success(
                PaginatedResult(
                    items = (start until end).map(::location),
                    cursor = end.takeIf { it < 1_001 }?.toString(),
                    hasMore = end < 1_001
                )
            )
        }

        val viewModel = LocationsMapViewModel(repository, analytics, realtimeTelemetry)
        advanceUntilIdle()
        repeat(30) {
            val state = viewModel.uiState.value as? LocationsMapUiState.Success
            if (state?.hasMore != true) return@repeat
            viewModel.loadMore()
            advanceUntilIdle()
        }

        val state = viewModel.uiState.value as LocationsMapUiState.Success
        assertEquals(1_001, state.locations.size)
        assertEquals(1_001, state.locations.map { it.id }.distinct().size)
        assertFalse(state.hasMore)
        assertEquals("bootstrap", telemetrySamples.first().phase)
        assertEquals(20, telemetrySamples.count { it.phase == "apply" })
        assertEquals(setOf("locations_map"), telemetrySamples.map { it.flow }.toSet())
        coVerify(exactly = 21) { repository.getLocationsPaginated(any(), any(), any()) }
    }

    private fun location(index: Int) = Location(
        id = "location-$index",
        name = "Local ${index.toString().padStart(4, '0')}",
        latitude = -25.0 + index * 0.00001,
        longitude = -49.0
    )
}
