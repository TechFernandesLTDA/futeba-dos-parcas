package com.futebadosparcas.ui.players

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.NearbyPlayer
import com.futebadosparcas.data.repository.NearbyPlayersRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class NearbyPlayersUiState {
    data object Idle : NearbyPlayersUiState()
    data object Loading : NearbyPlayersUiState()
    data object Empty : NearbyPlayersUiState()
    data class Success(val players: List<NearbyPlayer>) : NearbyPlayersUiState()
    data class Error(val message: String) : NearbyPlayersUiState()
}

class NearbyPlayersViewModel(
    private val repository: NearbyPlayersRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow<NearbyPlayersUiState>(NearbyPlayersUiState.Idle)
    val uiState: StateFlow<NearbyPlayersUiState> = _uiState.asStateFlow()

    private val _sharingEnabled = MutableStateFlow(false)
    val sharingEnabled: StateFlow<Boolean> = _sharingEnabled.asStateFlow()

    private val _sharingLoading = MutableStateFlow(false)
    val sharingLoading: StateFlow<Boolean> = _sharingLoading.asStateFlow()

    private val _radiusKm = MutableStateFlow(5)
    val radiusKm: StateFlow<Int> = _radiusKm.asStateFlow()

    private val _socialFilter = MutableStateFlow("all")
    val socialFilter: StateFlow<String> = _socialFilter.asStateFlow()

    init {
        refreshSharingState()
    }

    fun setRadius(radiusKm: Int) {
        _radiusKm.value = radiusKm
    }

    fun setSocialFilter(filter: String) {
        _socialFilter.value = filter
    }

    fun refreshSharingState() {
        viewModelScope.launch {
            repository.loadSharingState()
                .onSuccess { _sharingEnabled.value = it.enabled }
        }
    }

    fun enableSharing(lat: Double, lng: Double, onDone: (Boolean) -> Unit) {
        viewModelScope.launch {
            _sharingLoading.value = true
            repository.enableSharing(lat, lng)
                .onSuccess {
                    _sharingEnabled.value = true
                    search(lat, lng)
                    onDone(true)
                }
                .onFailure { onDone(false) }
            _sharingLoading.value = false
        }
    }

    fun disableSharing(onDone: (Boolean) -> Unit) {
        viewModelScope.launch {
            _sharingLoading.value = true
            repository.disableSharing()
                .onSuccess {
                    _sharingEnabled.value = false
                    onDone(true)
                }
                .onFailure { onDone(false) }
            _sharingLoading.value = false
        }
    }

    fun search(lat: Double, lng: Double) {
        viewModelScope.launch {
            _uiState.value = NearbyPlayersUiState.Loading
            repository.discover(lat, lng, _radiusKm.value, _socialFilter.value)
                .onSuccess { players ->
                    _uiState.value = if (players.isEmpty()) {
                        NearbyPlayersUiState.Empty
                    } else {
                        NearbyPlayersUiState.Success(players)
                    }
                }
                .onFailure { error ->
                    _uiState.value = NearbyPlayersUiState.Error(
                        error.message ?: "Erro ao buscar jogadores próximos"
                    )
                }
        }
    }
}
