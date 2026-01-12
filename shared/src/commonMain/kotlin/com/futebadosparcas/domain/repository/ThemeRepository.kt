package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.ThemeMode
import kotlinx.coroutines.flow.Flow

/**
 * Repositorio de configuracao de tema do aplicativo.
 *
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 *
 * O Android usa DataStore para persistencia local.
 * O iOS pode usar UserDefaults ou outra solucao nativa.
 */
interface ThemeRepository {
    /**
     * Flow que emite a configuracao atual do tema.
     */
    val themeConfig: Flow<AppThemeConfig>

    /**
     * Atualiza a configuracao completa do tema.
     */
    suspend fun updateThemeConfig(config: AppThemeConfig)

    /**
     * Define a cor primaria do tema.
     * @param color Cor em formato ARGB (Int)
     */
    suspend fun setPrimaryColor(color: Int)

    /**
     * Define a cor secundaria do tema.
     * @param color Cor em formato ARGB (Int)
     */
    suspend fun setSecondaryColor(color: Int)

    /**
     * Define o modo de tema (Light/Dark/System).
     */
    suspend fun setThemeMode(mode: ThemeMode)

    /**
     * Define o nivel de contraste.
     */
    suspend fun setContrastLevel(level: ContrastLevel)

    /**
     * Reseta a configuracao do tema para os valores padrao.
     */
    suspend fun resetThemeConfig()
}
