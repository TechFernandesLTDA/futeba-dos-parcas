package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.GamificationSettings

/**
 * Interface de repositorio de configuracoes do app.
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 */
interface SettingsRepository {
    /**
     * Busca configuracoes de gamificacao do Firestore.
     */
    suspend fun getGamificationSettings(): Result<GamificationSettings>

    /**
     * Atualiza configuracoes de gamificacao no Firestore.
     */
    suspend fun updateGamificationSettings(settings: GamificationSettings): Result<Unit>
}
