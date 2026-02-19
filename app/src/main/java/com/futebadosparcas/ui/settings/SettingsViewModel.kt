package com.futebadosparcas.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.GamificationSettings
import com.futebadosparcas.domain.repository.SettingsRepository
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class SettingsUiState {
    object Loading : SettingsUiState()
    data class Success(val settings: GamificationSettings) : SettingsUiState()
    data class Error(val message: String) : SettingsUiState()
    object Saved : SettingsUiState()
}

class SettingsViewModel(
    private val repository: SettingsRepository
) : ViewModel() {

    companion object {
        private const val TAG = "SettingsViewModel"
    }

    private val _uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    // Job tracking para cancelamento adequado
    private var loadJob: Job? = null
    private var saveJob: Job? = null

    init {
        loadSettings()
    }

    fun loadSettings() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.value = SettingsUiState.Loading
            try {
                repository.getGamificationSettings()
                    .onSuccess { _uiState.value = SettingsUiState.Success(it) }
                    .onFailure {
                        AppLogger.e(TAG, "Erro ao carregar configurações", it)
                        _uiState.value = SettingsUiState.Error(it.message ?: "Erro desconhecido")
                    }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro inesperado ao carregar configurações", e)
                _uiState.value = SettingsUiState.Error(e.message ?: "Erro inesperado")
            }
        }
    }

    fun saveSettings(settings: GamificationSettings) {
        saveJob?.cancel()
        saveJob = viewModelScope.launch {
            _uiState.value = SettingsUiState.Loading
            try {
                repository.updateGamificationSettings(settings)
                    .onSuccess { _uiState.value = SettingsUiState.Saved }
                    .onFailure {
                        AppLogger.e(TAG, "Erro ao salvar configurações", it)
                        _uiState.value = SettingsUiState.Error(it.message ?: "Erro ao salvar")
                    }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro inesperado ao salvar configurações", e)
                _uiState.value = SettingsUiState.Error(e.message ?: "Erro inesperado")
            }
        }
    }

    fun resetState() {
        if (_uiState.value is SettingsUiState.Saved) {
            loadSettings()
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
        saveJob?.cancel()
    }
}
