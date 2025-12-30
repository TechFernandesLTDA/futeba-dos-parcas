package com.futebadosparcas.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.GamificationSettings
import com.futebadosparcas.data.repository.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class SettingsUiState {
    object Loading : SettingsUiState()
    data class Success(val settings: GamificationSettings) : SettingsUiState()
    data class Error(val message: String) : SettingsUiState()
    object Saved : SettingsUiState()
}

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val repository: SettingsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)
    val uiState = _uiState.asStateFlow()

    init {
        loadSettings()
    }

    fun loadSettings() {
        viewModelScope.launch {
            _uiState.value = SettingsUiState.Loading
            repository.getGamificationSettings()
                .onSuccess { _uiState.value = SettingsUiState.Success(it) }
                .onFailure { _uiState.value = SettingsUiState.Error(it.message ?: "Erro desconhecido") }
        }
    }

    fun saveSettings(settings: GamificationSettings) {
        viewModelScope.launch {
            _uiState.value = SettingsUiState.Loading
            repository.updateGamificationSettings(settings)
                .onSuccess { _uiState.value = SettingsUiState.Saved }
                .onFailure { _uiState.value = SettingsUiState.Error(it.message ?: "Erro ao salvar") }
        }
    }

    fun resetState() {
        if (_uiState.value is SettingsUiState.Saved) {
            loadSettings()
        }
    }
}
