package com.futebadosparcas.ui.locations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.LocationAnalytics
import com.futebadosparcas.util.LocationSources
import com.futebadosparcas.util.toAndroidLocations
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class LocationsMapViewModel(
    private val locationRepository: LocationRepository,
    private val locationAnalytics: LocationAnalytics
) : ViewModel() {

    private val _uiState = MutableStateFlow<LocationsMapUiState>(LocationsMapUiState.Loading)
    val uiState: StateFlow<LocationsMapUiState> = _uiState.asStateFlow()

    // Armazena a fonte de navegação para rastreamento
    private var navigationSource: String = LocationSources.MENU

    init {
        loadLocations()
    }

    /**
     * Define a fonte de navegação para rastreamento de analytics.
     * Deve ser chamado antes de loadLocations quando aplicável.
     */
    fun setNavigationSource(source: String) {
        navigationSource = source
    }

    fun loadLocations() {
        viewModelScope.launch {
            _uiState.value = LocationsMapUiState.Loading
            locationRepository.getAllLocations().fold(
                onSuccess = { kmpLocations ->
                    val androidLocations = kmpLocations.toAndroidLocations()
                    _uiState.value = if (androidLocations.isEmpty()) {
                        LocationsMapUiState.Empty
                    } else {
                        // Rastreia visualização do mapa com contagem de locais
                        locationAnalytics.trackMapViewed(
                            locationCount = androidLocations.size,
                            source = navigationSource
                        )
                        LocationsMapUiState.Success(androidLocations)
                    }
                },
                onFailure = { error ->
                    AppLogger.e("LocationsMapVM", "Error loading locations", error)
                    _uiState.value = LocationsMapUiState.Error(
                        error.message ?: "Erro ao carregar locais"
                    )
                }
            )
        }
    }
}

sealed class LocationsMapUiState {
    object Loading : LocationsMapUiState()
    data class Success(val locations: List<Location>) : LocationsMapUiState()
    object Empty : LocationsMapUiState()
    data class Error(val message: String) : LocationsMapUiState()
}
