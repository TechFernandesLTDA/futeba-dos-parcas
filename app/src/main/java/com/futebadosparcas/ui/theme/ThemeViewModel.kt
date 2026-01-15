package com.futebadosparcas.ui.theme

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ThemeMode
import com.futebadosparcas.domain.repository.ThemeRepository
import com.futebadosparcas.util.PreferencesManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ThemeViewModel @Inject constructor(
    private val themeRepository: ThemeRepository,
    private val preferencesManager: PreferencesManager
) : ViewModel() {

    val themeConfig: StateFlow<AppThemeConfig> = themeRepository.themeConfig
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = AppThemeConfig()
        )

    fun setPrimaryColor(color: Int) {
        viewModelScope.launch {
            themeRepository.setPrimaryColor(color)
        }
    }

    fun setSecondaryColor(color: Int) {
        viewModelScope.launch {
            themeRepository.setSecondaryColor(color)
        }
    }

    fun setThemeMode(mode: ThemeMode) {
        viewModelScope.launch {
            themeRepository.setThemeMode(mode)
            // Apply to XML Views (AppCompatDelegate)
            val themeString = when(mode) {
                ThemeMode.LIGHT -> "light"
                ThemeMode.DARK -> "dark"
                ThemeMode.SYSTEM -> "system"
            }
            com.futebadosparcas.util.ThemeHelper.applyTheme(themeString)
            preferencesManager.setThemePreference(themeString)
        }
    }

    fun resetTheme() {
        viewModelScope.launch {
            themeRepository.resetThemeConfig()
            com.futebadosparcas.util.ThemeHelper.applyTheme("light")
            preferencesManager.setThemePreference("light")
        }
    }
}
