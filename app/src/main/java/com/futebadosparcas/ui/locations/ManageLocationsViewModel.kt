package com.futebadosparcas.ui.locations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.data.repository.LocationRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ManageLocationsViewModel @Inject constructor(
    private val locationRepository: LocationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ManageLocationsUiState>(ManageLocationsUiState.Loading)
    val uiState: StateFlow<ManageLocationsUiState> = _uiState.asStateFlow()

    init {
        loadAllLocations()
    }

    fun loadAllLocations() {
        viewModelScope.launch {
            _uiState.value = ManageLocationsUiState.Loading
            
            // Buscar todos os locais (sem filtro de owner)
            val locationsResult = locationRepository.getAllLocations()
            
            locationsResult.fold(
                onSuccess = { locations ->
                    // Para cada local, buscar suas quadras
                    val locationsWithFields = mutableListOf<LocationWithFieldsData>()
                    
                    for (location in locations) {
                        val fieldsResult = locationRepository.getFieldsByLocation(location.id)
                        val fields = fieldsResult.getOrNull() ?: emptyList()
                        locationsWithFields.add(LocationWithFieldsData(location, fields))
                    }
                    
                    _uiState.value = ManageLocationsUiState.Success(locationsWithFields)
                },
                onFailure = { error ->
                    _uiState.value = ManageLocationsUiState.Error(
                        error.message ?: "Erro ao carregar locais"
                    )
                }
            )
        }
    }

    fun deleteLocation(locationId: String) {
        viewModelScope.launch {
            _uiState.value = ManageLocationsUiState.Loading
            
            // Primeiro deletar todas as quadras do local
            val fieldsResult = locationRepository.getFieldsByLocation(locationId)
            fieldsResult.getOrNull()?.forEach { field ->
                locationRepository.deleteField(field.id)
            }
            
            // Depois deletar o local
            val result = locationRepository.deleteLocation(locationId)
            when {
                result.isSuccess -> {
                    loadAllLocations()
                }
                result.isFailure -> {
                    val error = result.exceptionOrNull()
                    _uiState.value = ManageLocationsUiState.Error(
                        error?.message ?: "Erro ao deletar local"
                    )
                }
            }
        }
    }

    fun deleteField(fieldId: String) {
        viewModelScope.launch {
            val result = locationRepository.deleteField(fieldId)
            when {
                result.isSuccess -> {
                    loadAllLocations()
                }
                result.isFailure -> {
                    val error = result.exceptionOrNull()
                    _uiState.value = ManageLocationsUiState.Error(
                        error?.message ?: "Erro ao deletar quadra"
                    )
                }
            }
        }
    }
}

sealed class ManageLocationsUiState {
    object Loading : ManageLocationsUiState()
    data class Success(val locations: List<LocationWithFieldsData>) : ManageLocationsUiState()
    data class Error(val message: String) : ManageLocationsUiState()
}

data class LocationWithFieldsData(
    val location: Location,
    val fields: List<Field>
)
