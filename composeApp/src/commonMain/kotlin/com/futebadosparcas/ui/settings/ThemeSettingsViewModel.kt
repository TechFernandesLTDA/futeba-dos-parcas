package com.futebadosparcas.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.ThemeMode
import com.futebadosparcas.domain.repository.ThemeRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

/**
 * Estados da tela de tema do composeApp (#4097).
 *
 * Não há estado `Empty`: o repositório sempre resolve uma configuração (default
 * SYSTEM quando nada foi persistido).
 */
sealed interface ThemeSettingsUiState {
    /** Aguardando a primeira emissão do repositório. */
    data object Loading : ThemeSettingsUiState

    /** Falha ao observar a preferência — exibe mensagem + retry. `message` null usa o texto padrão. */
    data class Error(val message: String?) : ThemeSettingsUiState

    /** Configuração atual carregada. */
    data class Success(val config: AppThemeConfig) : ThemeSettingsUiState
}

/**
 * ViewModel da tela de tema compartilhada (iOS via Compose-MP) — paridade com
 * `app/.../ui/theme/ThemeViewModel.kt` do Android.
 *
 * Escopo: modo (Claro/Escuro/Sistema) e nível de contraste. Cores customizadas e
 * Material You ficam fora — o `DynamicThemeEngine` do composeApp só consome
 * `mode` + `contrastLevel` + seeds canônicas.
 */
class ThemeSettingsViewModel(
    private val themeRepository: ThemeRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ThemeSettingsUiState>(ThemeSettingsUiState.Loading)
    val uiState: StateFlow<ThemeSettingsUiState> = _uiState.asStateFlow()

    private var observeJob: Job? = null

    init {
        observeTheme()
    }

    /** (Re)inicia a observação da preferência — usado no retry após erro. */
    fun observeTheme() {
        observeJob?.cancel()
        observeJob = viewModelScope.launch {
            _uiState.value = ThemeSettingsUiState.Loading
            themeRepository.themeConfig
                .catch { error ->
                    _uiState.value = ThemeSettingsUiState.Error(error.message)
                }
                .collect { config ->
                    _uiState.value = ThemeSettingsUiState.Success(config)
                }
        }
    }

    fun setThemeMode(mode: ThemeMode) {
        viewModelScope.launch {
            themeRepository.setThemeMode(mode)
        }
    }

    fun setHighContrast(enabled: Boolean) {
        viewModelScope.launch {
            themeRepository.setContrastLevel(if (enabled) ContrastLevel.HIGH else ContrastLevel.NORMAL)
        }
    }

    fun resetTheme() {
        viewModelScope.launch {
            themeRepository.resetThemeConfig()
        }
    }

    override fun onCleared() {
        super.onCleared()
        observeJob?.cancel()
    }
}
