package com.futebadosparcas.ui.map

import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.ui.locations.filterLocationsForViewport
import com.futebadosparcas.ui.locations.mergeLocations
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@DisplayName("Map pagination scale")
class MapPaginationScaleTest {

    @Test
    @DisplayName("1000 jogos chegam em cinco paginas com dedupe de reconexao")
    fun thousandGamesRemainReachableWithoutHardCap() {
        var loaded = emptyList<MapGameMarker>()
        (0 until 1_000).chunked(200).forEach { indexes ->
            loaded = mergeGameMarkers(loaded, indexes.map(::marker))
        }
        loaded = mergeGameMarkers(listOf(marker(0)), loaded)

        assertEquals(1_000, loaded.size)
        assertEquals(1_000, loaded.map { it.gameId }.distinct().size)
    }

    @Test
    @DisplayName("pan e zoom filtram viewport normal e antimeridiano")
    fun viewportSupportsPanZoomAndAntimeridian() {
        val games = listOf(
            marker(1, latitude = -25.42, longitude = -49.27),
            marker(2, latitude = -23.55, longitude = -46.63),
            marker(3, latitude = 0.0, longitude = 179.5),
            marker(4, latitude = 0.0, longitude = -179.5)
        )

        val curitiba = filterGameMarkersForViewport(
            games,
            MapViewport(north = -25.0, south = -26.0, east = -49.0, west = -50.0)
        )
        val antimeridian = filterGameMarkersForViewport(
            games,
            MapViewport(north = 1.0, south = -1.0, east = -170.0, west = 170.0)
        )

        assertEquals(listOf("game-1"), curitiba.map { it.gameId })
        assertEquals(setOf("game-3", "game-4"), antimeridian.map { it.gameId }.toSet())
    }

    @Test
    @DisplayName("1001 locais permanecem alcancaveis em paginas de 50")
    fun thousandAndOneLocationsRemainReachable() {
        var loaded = emptyList<Location>()
        (0 until 1_001).chunked(50).forEach { indexes ->
            loaded = mergeLocations(loaded, indexes.map(::location))
        }
        loaded = mergeLocations(listOf(location(0)), loaded)

        assertEquals(1_001, loaded.size)
        assertEquals(1_001, loaded.map { it.id }.distinct().size)
        assertTrue(
            filterLocationsForViewport(
                loaded,
                MapViewport(north = -24.99, south = -25.01, east = -48.99, west = -49.01)
            ).isNotEmpty()
        )
    }

    private fun marker(
        index: Int,
        latitude: Double = -25.0 + index * 0.0001,
        longitude: Double = -49.0
    ) = MapGameMarker(
        gameId = "game-$index",
        title = "Jogo $index",
        locationName = "Local $index",
        latitude = latitude,
        longitude = longitude,
        dateTime = "2026-07-10 20:00",
        confirmedPlayers = 10,
        maxPlayers = 14,
        price = 20.0,
        gameType = "Society",
        hasVacancies = true
    )

    private fun location(index: Int) = Location(
        id = "location-$index",
        name = "Local ${index.toString().padStart(4, '0')}",
        latitude = -25.0 + index * 0.00001,
        longitude = -49.0
    )
}
