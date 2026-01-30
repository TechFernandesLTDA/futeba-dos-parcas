package com.futebadosparcas.domain.util

import com.futebadosparcas.domain.model.Field

/**
 * Utilitario para calcular dados denormalizados de Location baseado em Fields.
 *
 * Os campos denormalizados (fieldCount, primaryFieldType, hasActiveFields)
 * sao armazenados no documento Location para evitar queries adicionais
 * na listagem de locais.
 */
object LocationDenormalizer {

    /**
     * Calcula os dados denormalizados a partir de uma lista de Fields.
     *
     * @param fields Lista de campos do local
     * @return Map com os campos denormalizados para update no Firestore
     */
    fun calculateFieldStats(fields: List<Field>): Map<String, Any?> {
        val activeFields = fields.filter { it.isActive }

        val fieldCount = activeFields.size

        // Encontra o tipo mais comum entre os campos ativos
        val primaryFieldType = activeFields
            .groupBy { it.type }
            .maxByOrNull { it.value.size }
            ?.key

        val hasActiveFields = activeFields.isNotEmpty()

        return mapOf(
            "field_count" to fieldCount,
            "primary_field_type" to primaryFieldType,
            "has_active_fields" to hasActiveFields
        )
    }

    /**
     * Calcula os dados denormalizados para quando um novo campo e criado.
     *
     * @param existingFields Lista de campos existentes
     * @param newField Novo campo sendo criado
     * @return Map com os campos denormalizados para update no Firestore
     */
    fun calculateStatsForFieldCreate(
        existingFields: List<Field>,
        newField: Field
    ): Map<String, Any?> {
        val allFields = existingFields + newField
        return calculateFieldStats(allFields)
    }

    /**
     * Calcula os dados denormalizados para quando um campo e deletado (soft delete).
     *
     * @param existingFields Lista de campos existentes (incluindo o campo a ser deletado)
     * @param deletedFieldId ID do campo sendo deletado
     * @return Map com os campos denormalizados para update no Firestore
     */
    fun calculateStatsForFieldDelete(
        existingFields: List<Field>,
        deletedFieldId: String
    ): Map<String, Any?> {
        // Remove o campo deletado e marca como inativo
        val remainingFields = existingFields.map { field ->
            if (field.id == deletedFieldId) {
                // Simula soft delete
                Field(
                    id = field.id,
                    locationId = field.locationId,
                    name = field.name,
                    type = field.type,
                    description = field.description,
                    photoUrl = field.photoUrl,
                    isActive = false,
                    hourlyPrice = field.hourlyPrice,
                    photos = field.photos,
                    managers = field.managers,
                    surface = field.surface,
                    isCovered = field.isCovered,
                    dimensions = field.dimensions
                )
            } else {
                field
            }
        }
        return calculateFieldStats(remainingFields)
    }

    /**
     * Calcula os dados denormalizados para quando um campo e atualizado.
     *
     * @param existingFields Lista de campos existentes
     * @param updatedField Campo atualizado
     * @return Map com os campos denormalizados para update no Firestore
     */
    fun calculateStatsForFieldUpdate(
        existingFields: List<Field>,
        updatedField: Field
    ): Map<String, Any?> {
        val updatedFields = existingFields.map { field ->
            if (field.id == updatedField.id) updatedField else field
        }
        return calculateFieldStats(updatedFields)
    }
}
