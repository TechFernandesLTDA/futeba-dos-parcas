package com.futebadosparcas.ui.locations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
<<<<<<< HEAD
import com.futebadosparcas.data.model.Field
=======
import com.futebadosparcas.domain.model.Field
>>>>>>> f3237fc2328fe3c708bd99fb005154a8d51298a3
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import com.futebadosparcas.data.seeding.LocationsSeed
import com.futebadosparcas.util.toAndroidLocation
import com.futebadosparcas.util.toAndroidField
import com.futebadosparcas.util.toAndroidFields
import com.futebadosparcas.util.toAndroidLocationReview
import com.futebadosparcas.util.toAndroidLocationReviews
import com.futebadosparcas.util.toAndroidCashboxEntry
import com.futebadosparcas.util.toAndroidCashboxEntries
import com.futebadosparcas.util.toAndroidGroupInvites

class ManageLocationsViewModel(
    private val locationRepository: LocationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ManageLocationsUiState>(ManageLocationsUiState.Loading)
    val uiState: StateFlow<ManageLocationsUiState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")

    private var allLocations: List<LocationWithFieldsData> = emptyList()

    // Job tracking para cancelamento e controle de ciclo de vida
    private var loadJob: Job? = null
    private var deleteJob: Job? = null

    companion object {
        private const val TAG = "ManageLocationsVM"
    }

    init {
        loadAllLocations()
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        filterLocations()
    }
    
    fun seedDatabase() {
        viewModelScope.launch {
            _uiState.value = ManageLocationsUiState.Loading
            
            val result = locationRepository.migrateLocations(LocationsSeed.data)
            
            if (result.isSuccess) {
                // Reload to show new data
                loadAllLocations()
            } else {
                 _uiState.value = ManageLocationsUiState.Error(
                    result.exceptionOrNull()?.message ?: "Erro na migração"
                )
            }
        }
    }

    fun removeDuplicates() {
        viewModelScope.launch {
            _uiState.value = ManageLocationsUiState.Loading
            val result = locationRepository.deduplicateLocations()
            if (result.isSuccess) {
                // Could verify count here but for now just reload
                loadAllLocations()
            } else {
                _uiState.value = ManageLocationsUiState.Error(
                    result.exceptionOrNull()?.message ?: "Erro na deduplicação"
                )
            }
        }
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
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.value = ManageLocationsUiState.Loading

            try {
                // Buscar todos os locais (sem filtro de owner)
                val locationsResult = locationRepository.getAllLocations()

                locationsResult.fold(
                    onSuccess = { kmpLocations ->
                        // Paralelizar a busca de quadras para ganho de performance (resolve N+1)
                        val locationsWithFields = kmpLocations.map { kmpLocation ->
                            async {
                                val fieldsResult = locationRepository.getFieldsByLocation(kmpLocation.id)
                                val fields = fieldsResult.getOrNull() ?: emptyList()
                                LocationWithFieldsData(kmpLocation, fields)
                            }
                        }.awaitAll()

                        allLocations = locationsWithFields
                        filterLocations()
                    },
                    onFailure = { error ->
                        AppLogger.e(TAG, "Erro ao carregar locais", error)
                        _uiState.value = ManageLocationsUiState.Error(
                            error.message ?: "Erro ao carregar locais"
                        )
                    }
                )
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro inesperado ao carregar locais", e)
                _uiState.value = ManageLocationsUiState.Error(
                    e.message ?: "Erro inesperado"
                )
            }
        }
    }

    fun deleteLocation(locationId: String) {
        deleteJob?.cancel()
        deleteJob = viewModelScope.launch {
            _uiState.value = ManageLocationsUiState.Loading
            
            // Primeiro deletar todas as quadras do local
            val fieldsResult = locationRepository.getFieldsByLocation(locationId)
            fieldsResult.getOrNull()?.forEach { kmpField ->
                locationRepository.deleteField(kmpField.id)
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

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
        deleteJob?.cancel()
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
