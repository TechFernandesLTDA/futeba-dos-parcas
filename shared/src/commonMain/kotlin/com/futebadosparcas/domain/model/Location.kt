package com.futebadosparcas.domain.model

import kotlinx.serialization.Serializable

/**
 * Representa um local/estabelecimento onde jogos podem ser realizados.
 * Ex: "Ginásio de Esportes Apollo"
 */
@Serializable
data class Location(
    val id: String = "",
    val name: String = "",
    val address: String = "", // Mantido como texto completo/legado ou calculado

    // Endereço Estruturado
    val cep: String = "",
    val street: String = "", // Logradouro
    val number: String = "",
    val complement: String = "",
    val district: String = "", // Bairro
    val city: String = "",
    val state: String = "", // UF
    val country: String = "Brasil",

    // Localização detalhada
    val neighborhood: String = "", // Bairro (ex: "Portão", "Boa Vista")
    val region: String = "", // Região da cidade (ex: "Sul", "Centro")
    val latitude: Double? = null,
    val longitude: Double? = null,
    val placeId: String? = null,

    // Proprietário e Gerentes
    val ownerId: String = "",
    val managers: List<String> = emptyList(), // Lista de IDs de usuários gerentes do local
    val isVerified: Boolean = false,
    val isActive: Boolean = true,

    // Avaliação
    val rating: Double = 0.0,
    val ratingCount: Int = 0,

    // Descrição e mídia
    val description: String = "",
    val photoUrl: String? = null,

    // Infraestrutura (amenidades)
    val amenities: List<String> = emptyList(), // ["estacionamento", "vestiario", "churrasqueira", "bar", "restaurante"]

    // Contato
    val phone: String? = null,
    val website: String? = null,
    val instagram: String? = null,

    // Horário de funcionamento
    val openingTime: String = "08:00",
    val closingTime: String = "23:00",
    val operatingDays: List<Int> = listOf(1, 2, 3, 4, 5, 6, 7),
    val minGameDurationMinutes: Int = 60,

    // Auditoria
    val createdAt: Long? = null,
    val updatedAt: Long? = null
) {
    /**
     * Retorna endereco formatado completo
     */
    fun getFullAddress(): String {
        return if (city.isNotEmpty() && state.isNotEmpty()) {
            "$address - $city, $state"
        } else {
            address
        }
    }

    /**
     * Verifica se um usuario eh o dono do local
     */
    fun isOwner(userId: String): Boolean = ownerId == userId

    /**
     * Verifica se um usuario eh gerente do local
     */
    fun isManager(userId: String): Boolean = managers.contains(userId)

    /**
     * Verifica se um usuario tem permissao para gerenciar o local (dono ou gerente)
     */
    fun canManage(userId: String): Boolean = isOwner(userId) || isManager(userId)
}

/**
 * Representa uma quadra/campo dentro de um local.
 * Ex: "Quadra 1 - Futsal" ou "Campo 2 - Society"
 */
@Serializable
data class Field(
    val id: String = "",
    val locationId: String = "",
    val name: String = "", // Ex: "Quadra 1", "Campo 2"
    val type: String = "SOCIETY", // SOCIETY, FUTSAL, CAMPO
    val description: String? = null,
    val photoUrl: String? = null,
    val isActive: Boolean = true,
    val hourlyPrice: Double = 0.0,
    val photos: List<String> = emptyList(),

    // Permissões
    val managers: List<String> = emptyList(), // Lista de IDs de usuários gerentes

    // Detalhes da quadra
    val surface: String? = null, // Grama Sintética, Natural, Taco...
    val isCovered: Boolean = false,
    val dimensions: String? = null // "30x15m"
) {
    fun getTypeEnum(): FieldType = try {
        FieldType.valueOf(type) // Try exact match first
    } catch (e: Exception) {
        // Try simple name matching if uppercase fails
        try {
            FieldType.entries.firstOrNull { it.name.equals(type, ignoreCase = true) } ?: FieldType.SOCIETY
        } catch (e2: Exception) {
            FieldType.SOCIETY
        }
    }

    fun getDisplayName(): String {
        return "$name (${getTypeEnum().displayName})"
    }
}

/**
 * Classe auxiliar para agrupar um local com suas quadras
 */
@Serializable
data class LocationWithFields(
    val location: Location,
    val fields: List<Field>
) {
    /**
     * Agrupa os campos por tipo
     */
    fun getFieldsByType(): Map<FieldType, List<Field>> {
        return fields.groupBy { it.getTypeEnum() }
    }
}

/**
 * Avaliação de um local
 */
@Serializable
data class LocationReview(
    val id: String = "",
    val locationId: String = "",
    val userId: String = "",
    val userName: String = "",
    val userPhotoUrl: String? = null,
    val rating: Float = 0f,
    val comment: String = "",
    val createdAt: Long? = null
)

/**
 * Dados para migração/criação de locais
 */
@Serializable
data class LocationMigrationData(
    val nameKey: String,
    val cep: String,
    val street: String,
    val number: String,
    val complement: String = "",
    val neighborhood: String,
    val city: String,
    val state: String,
    val region: String = "",
    val country: String = "Brasil",

    // Additional Info
    val phone: String? = null,
    val whatsapp: String? = null, // To prioritize
    val instagram: String? = null,
    val description: String? = null,
    val amenities: List<String> = emptyList(),
    val openingTime: String? = null, // "HH:mm"
    val closingTime: String? = null, // "HH:mm"
    val modalities: List<String> = emptyList(), // For default fields creation
    val numFieldsEstimation: Int = 1
)
