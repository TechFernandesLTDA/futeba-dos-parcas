package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.AppThemeConfig
import com.futebadosparcas.data.model.ContrastLevel
import com.futebadosparcas.data.model.ThemeMode
import kotlinx.coroutines.flow.Flow

interface ThemeRepository {
    val themeConfig: Flow<AppThemeConfig>
    suspend fun updateThemeConfig(config: AppThemeConfig)
    suspend fun setPrimaryColor(color: Int)
    suspend fun setSecondaryColor(color: Int)
    suspend fun setThemeMode(mode: ThemeMode)
    suspend fun setContrastLevel(level: ContrastLevel)
    suspend fun resetThemeConfig()
}
