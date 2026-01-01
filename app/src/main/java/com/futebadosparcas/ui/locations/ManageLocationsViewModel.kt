package com.futebadosparcas.ui.locations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.data.repository.LocationRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ManageLocationsViewModel @Inject constructor(
    private val locationRepository: LocationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ManageLocationsUiState>(ManageLocationsUiState.Loading)
    val uiState: StateFlow<ManageLocationsUiState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    
    private var allLocations: List<LocationWithFieldsData> = emptyList()

    init {
        loadAllLocations()
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        filterLocations()
    }

    private fun filterLocations() {
        val query = _searchQuery.value
        if (query.isBlank()) {
            _uiState.value = ManageLocationsUiState.Success(allLocations)
            return
        }

        val filtered = allLocations.filter { data ->
            data.location.name.contains(query, ignoreCase = true) ||
            data.location.address.contains(query, ignoreCase = true) ||
            data.fields.any { it.name.contains(query, ignoreCase = true) }
        }
        _uiState.value = ManageLocationsUiState.Success(filtered)
    }

    fun loadAllLocations() {
        viewModelScope.launch {
            _uiState.value = ManageLocationsUiState.Loading
            
            // Buscar todos os locais (sem filtro de owner)
            val locationsResult = locationRepository.getAllLocations()
            
            locationsResult.fold(
                onSuccess = { locations ->
                    // Paralelizar a busca de quadras para ganho de performance (resolve N+1)
                    val locationsWithFields = locations.map { location ->
                        async {
                            val fieldsResult = locationRepository.getFieldsByLocation(location.id)
                            val fields = fieldsResult.getOrNull() ?: emptyList()
                            LocationWithFieldsData(location, fields)
                        }
                    }.awaitAll()
                    
                    allLocations = locationsWithFields
                    filterLocations()
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
