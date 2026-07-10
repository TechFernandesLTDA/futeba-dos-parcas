package com.futebadosparcas.ui.locations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.model.LocationSortField
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.ui.map.MapViewport
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.LocationAnalytics
import com.futebadosparcas.util.LocationSources
import com.futebadosparcas.util.RealtimeTelemetry
import com.futebadosparcas.util.RealtimeTelemetryFlow
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

internal fun mergeLocations(
    preferred: List<Location>,
    additional: List<Location>
): List<Location> = (preferred + additional)
    .distinctBy { it.id }
    .sortedWith(compareBy<Location> { it.name.lowercase() }.thenBy { it.id })

internal fun filterLocationsForViewport(
    locations: List<Location>,
    viewport: MapViewport?
): List<Location> = viewport?.let { bounds ->
    locations.filter { location ->
        val latitude = location.latitude
        val longitude = location.longitude
        latitude != null && longitude != null && bounds.contains(latitude, longitude)
    }
} ?: locations

class LocationsMapViewModel(
    private val locationRepository: LocationRepository,
    private val locationAnalytics: LocationAnalytics,
    private val realtimeTelemetry: RealtimeTelemetry = RealtimeTelemetry.disabled()
) : ViewModel() {

    private val _uiState = MutableStateFlow<LocationsMapUiState>(LocationsMapUiState.Loading)
    val uiState: StateFlow<LocationsMapUiState> = _uiState.asStateFlow()

    private var navigationSource: String = LocationSources.MENU
    private var loadJob: Job? = null
    private var loadMoreJob: Job? = null
    private var loadedLocations = emptyList<Location>()
    private var cursor: String? = null
    private var hasMore = false
    private var viewport: MapViewport? = null
    private val realtimeTracker = realtimeTelemetry.tracker(RealtimeTelemetryFlow.LOCATIONS_MAP)

    init {
        loadLocations()
    }

    fun setNavigationSource(source: String) {
        navigationSource = source
    }

    /** Primeira pagina limitada; substitui o getAllLocations() com teto de 500. */
    fun loadLocations() {
        when (_uiState.value) {
            is LocationsMapUiState.Error -> realtimeTracker.startReconnect()
            LocationsMapUiState.Loading -> Unit
            else -> realtimeTracker.startApply()
        }
        loadJob?.cancel()
        loadMoreJob?.cancel()
        loadedLocations = emptyList()
        cursor = null
        hasMore = false
        _uiState.value = LocationsMapUiState.Loading

        loadJob = viewModelScope.launch {
            locationRepository.getLocationsPaginated(
                pageSize = PAGE_SIZE,
                cursor = null,
                sortBy = LocationSortField.NAME
            ).fold(
                onSuccess = { page ->
                    realtimeTracker.recordApply()
                    loadedLocations = mergeLocations(emptyList(), page.items)
                    cursor = page.cursor
                    hasMore = page.hasMore
                    if (loadedLocations.isNotEmpty()) {
                        locationAnalytics.trackMapViewed(
                            locationCount = loadedLocations.size,
                            source = navigationSource
                        )
                    }
                    render()
                },
                onFailure = { error ->
                    realtimeTracker.recordError()
                    AppLogger.e(TAG, "Error loading locations", error)
                    _uiState.value = LocationsMapUiState.Error(
                        error.message ?: "Erro ao carregar locais"
                    )
                }
            )
        }
    }

    fun loadMore() {
        val pageCursor = cursor ?: return
        if (!hasMore || loadMoreJob?.isActive == true) return
        realtimeTracker.startApply()
        render(isLoadingMore = true)
        loadMoreJob = viewModelScope.launch {
            locationRepository.getLocationsPaginated(
                pageSize = PAGE_SIZE,
                cursor = pageCursor,
                sortBy = LocationSortField.NAME
            ).fold(
                onSuccess = { page ->
                    realtimeTracker.recordApply()
                    loadedLocations = mergeLocations(loadedLocations, page.items)
                    cursor = page.cursor
                    hasMore = page.hasMore
                    render()
                },
                onFailure = { error ->
                    realtimeTracker.recordError()
                    AppLogger.e(TAG, "Error loading more locations", error)
                    _uiState.value = LocationsMapUiState.Success(
                        locations = filterLocationsForViewport(loadedLocations, viewport),
                        hasMore = hasMore,
                        loadMoreError = error.message
                    )
                }
            )
        }
    }

    /** Filtragem client-side para pan/zoom; o cursor segue valido entre movimentos. */
    fun updateViewport(bounds: MapViewport?) {
        viewport = bounds
        render()
    }

    private fun render(isLoadingMore: Boolean = false) {
        _uiState.value = if (loadedLocations.isEmpty()) {
            LocationsMapUiState.Empty
        } else {
            LocationsMapUiState.Success(
                locations = filterLocationsForViewport(loadedLocations, viewport),
                hasMore = hasMore,
                isLoadingMore = isLoadingMore
            )
        }
    }

    companion object {
        private const val TAG = "LocationsMapVM"
        internal const val PAGE_SIZE = 50
    }
}

sealed class LocationsMapUiState {
    data object Loading : LocationsMapUiState()
    data class Success(
        val locations: List<Location>,
        val hasMore: Boolean = false,
        val isLoadingMore: Boolean = false,
        val loadMoreError: String? = null
    ) : LocationsMapUiState()
    data object Empty : LocationsMapUiState()
    data class Error(val message: String) : LocationsMapUiState()
}
