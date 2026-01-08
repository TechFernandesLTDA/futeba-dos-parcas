package com.futebadosparcas.ui.locations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.data.repository.LocationRepository
import com.futebadosparcas.util.AppLogger
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LocationsMapViewModel @Inject constructor(
    private val locationRepository: LocationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<LocationsMapUiState>(LocationsMapUiState.Loading)
    val uiState: StateFlow<LocationsMapUiState> = _uiState.asStateFlow()

    init {
        loadLocations()
    }

    fun loadLocations() {
        viewModelScope.launch {
            _uiState.value = LocationsMapUiState.Loading
            locationRepository.getAllLocations().fold(
                onSuccess = { locations ->
                    _uiState.value = if (locations.isEmpty()) {
                        LocationsMapUiState.Empty
                    } else {
                        LocationsMapUiState.Success(locations)
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
