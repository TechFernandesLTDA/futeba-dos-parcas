package com.futebadosparcas.ui.locations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.toAndroidLocations
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class FieldOwnerDashboardViewModel @Inject constructor(
    private val locationRepository: LocationRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<FieldOwnerDashboardUiState>(FieldOwnerDashboardUiState.Loading)
    val uiState: StateFlow<FieldOwnerDashboardUiState> = _uiState

    fun loadLocations() {
        viewModelScope.launch {
            _uiState.value = FieldOwnerDashboardUiState.Loading

            val userId = userRepository.getCurrentUserId()
            if (userId == null) {
                _uiState.value = FieldOwnerDashboardUiState.Error("Usuário não autenticado")
                return@launch
            }

            locationRepository.getLocationsByOwner(userId).fold(
                onSuccess = { kmpLocations ->
                    _uiState.value = FieldOwnerDashboardUiState.Success(kmpLocations.toAndroidLocations())
                },
                onFailure = { error ->
                    _uiState.value = FieldOwnerDashboardUiState.Error(error.message ?: "Erro ao carregar locais")
                }
            )
        }
    }
}

sealed class FieldOwnerDashboardUiState {
    object Loading : FieldOwnerDashboardUiState()
    data class Success(val locations: List<Location>) : FieldOwnerDashboardUiState()
    data class Error(val message: String) : FieldOwnerDashboardUiState()
}
