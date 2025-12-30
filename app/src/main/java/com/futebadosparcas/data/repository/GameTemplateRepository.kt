package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GameTemplate
import kotlinx.coroutines.flow.Flow

interface GameTemplateRepository {
    suspend fun saveTemplate(template: GameTemplate): Result<String>
    suspend fun getUserTemplates(userId: String): Result<List<GameTemplate>>
    suspend fun deleteTemplate(userId: String, templateId: String): Result<Unit>
}
