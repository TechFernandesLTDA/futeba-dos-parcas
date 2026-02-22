package com.futebadosparcas.util

import com.futebadosparcas.domain.model.FieldType
import com.futebadosparcas.domain.model.Field
import com.futebadosparcas.domain.repository.LocationRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Helper para popular locais com quadras de exemplo
 */
class LocationSeeder constructor(
    private val locationRepository: LocationRepository
) {
    
    /**
     * Adiciona quadras de exemplo para todos os locais que não têm quadras
     */
    suspend fun seedFieldsForAllLocations(scope: CoroutineScope) {
        scope.launch {
            // Buscar todos os locais
            locationRepository.getAllLocations().onSuccess { locations ->
                locations.forEach { location ->
                    // Verificar se já tem quadras
                    locationRepository.getFieldsByLocation(location.id).onSuccess { fields ->
                        if (fields.isEmpty()) {
                            // Adicionar quadras de exemplo
                            seedFieldsForLocation(location.id, location.name)
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Adiciona quadras de exemplo para um local específico
     */
    private suspend fun seedFieldsForLocation(locationId: String, locationName: String) {
        // Determinar tipo de quadras baseado no nome do local
        val fieldTypes = when {
            locationName.contains("Society", ignoreCase = true) -> listOf(FieldType.SOCIETY)
            locationName.contains("Futsal", ignoreCase = true) -> listOf(FieldType.FUTSAL)
            locationName.contains("Arena", ignoreCase = true) -> listOf(FieldType.SOCIETY, FieldType.FUTSAL)
            locationName.contains("Ginásio", ignoreCase = true) -> listOf(FieldType.FUTSAL)
            locationName.contains("Campo", ignoreCase = true) -> listOf(FieldType.CAMPO)
            else -> listOf(FieldType.SOCIETY) // Padrão
        }
        
        // Criar 2-4 quadras
        val numberOfFields = (2..4).random()
        
        fieldTypes.forEachIndexed { typeIndex, fieldType ->
            val fieldsOfType = if (fieldTypes.size == 1) numberOfFields else 2
            
            repeat(fieldsOfType) { index ->
                val fieldNumber = if (fieldTypes.size == 1) index + 1 else (typeIndex * 2) + index + 1
                
                val field = Field(
                    locationId = locationId,
                    name = "Quadra ${fieldType.displayName} $fieldNumber",
                    type = fieldType.name,
                    description = "Quadra de ${fieldType.displayName} com excelente infraestrutura",
                    hourlyPrice = when (fieldType) {
                        FieldType.FUTSAL -> 120.0
                        FieldType.SOCIETY -> 180.0
                        FieldType.CAMPO -> 250.0
                        else -> 150.0
                    },
                    isActive = true,
                    surface = when (fieldType) {
                        FieldType.FUTSAL -> "Taco"
                        FieldType.SOCIETY -> "Grama Sintética"
                        FieldType.CAMPO -> "Grama Natural"
                        else -> "Grama Sintética"
                    },
                    isCovered = fieldType == FieldType.FUTSAL,
                    dimensions = when (fieldType) {
                        FieldType.FUTSAL -> "40x20m"
                        FieldType.SOCIETY -> "50x30m"
                        FieldType.CAMPO -> "100x70m"
                        else -> "50x30m"
                    }
                )
                
                locationRepository.createField(field)
            }
        }
    }
}
