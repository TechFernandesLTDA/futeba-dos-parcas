package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.GameTemplate

/**
 * Interface de repositorio de templates de jogo.
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 */
interface GameTemplateRepository {
    /**
     * Salva um template de jogo para o usuario.
     * @return Result com o ID do template salvo.
     */
    suspend fun saveTemplate(template: GameTemplate): Result<String>

    /**
     * Busca todos os templates de um usuario.
     * @return Result com a lista de templates do usuario.
     */
    suspend fun getUserTemplates(userId: String): Result<List<GameTemplate>>

    /**
     * Deleta um template de jogo.
     * @return Result indicando sucesso ou falha.
     */
    suspend fun deleteTemplate(userId: String, templateId: String): Result<Unit>
}
