package com.futebadosparcas.ui.locations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.toAndroidLocation
import com.futebadosparcas.util.toAndroidField
import com.futebadosparcas.util.toAndroidFields
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class FieldOwnerDashboardViewModel(
    private val locationRepository: LocationRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    companion object {
        private const val TAG = "FieldOwnerDashboardVM"
    }

    private val _uiState = MutableStateFlow<FieldOwnerDashboardUiState>(FieldOwnerDashboardUiState.Loading)
    val uiState: StateFlow<FieldOwnerDashboardUiState> = _uiState

    private var loadJob: Job? = null

    fun loadLocations() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.value = FieldOwnerDashboardUiState.Loading

            val userId = userRepository.getCurrentUserId()
            if (userId == null) {
                _uiState.value = FieldOwnerDashboardUiState.Error("Usuário não autenticado")
                return@launch
            }

            locationRepository.getLocationsByOwner(userId).fold(
                onSuccess = { kmpLocations ->
                    _uiState.value = FieldOwnerDashboardUiState.Success(kmpLocations)
                },
                onFailure = { error ->
                    _uiState.value = FieldOwnerDashboardUiState.Error(error.message ?: "Erro ao carregar locais")
                }
            )
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }
}

sealed class FieldOwnerDashboardUiState {
    object Loading : FieldOwnerDashboardUiState()
    data class Success(val locations: List<Location>) : FieldOwnerDashboardUiState()
    data class Error(val message: String) : FieldOwnerDashboardUiState()
}
