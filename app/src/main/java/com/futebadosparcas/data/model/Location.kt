package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import com.google.firebase.firestore.Exclude
import java.util.Date

/**
 * Representa um local/estabelecimento onde jogos podem ser realizados.
 * Ex: "Ginásio de Esportes Apollo"
 */
data class Location(
    @DocumentId
    val id: String = "",
    val name: String = "",
    val address: String = "", // Mantido como texto completo/legado ou calculado
    
    // Endereço Estruturado
    val cep: String = "",
    val street: String = "", // Logradouro
    val number: String = "",
    val complement: String = "",
    val district: String = "", // Bairro (substitui ou complementa neighborhood?) -> User asked for 'bairro' and model has 'neighborhood'. I'll use neighborhood, but maybe rename or keep consistent.
    val city: String = "",
    val state: String = "", // UF
    val country: String = "Brasil",
    
    // Localização detalhada
    val neighborhood: String = "", // Bairro (ex: "Portão", "Boa Vista")
    val region: String = "", // Região da cidade (ex: "Sul", "Centro")
    val latitude: Double? = null,
    val longitude: Double? = null,
    @get:PropertyName("place_id")
    @set:PropertyName("place_id")
    var placeId: String? = null,
    
    // Proprietário e Gerentes
    @get:PropertyName("owner_id")
    @set:PropertyName("owner_id")
    var ownerId: String = "",
    @get:PropertyName("managers")
    @set:PropertyName("managers")
    var managers: List<String> = emptyList(), // Lista de IDs de usuarios gerentes do local
    @get:PropertyName("is_verified")
    @set:PropertyName("is_verified")
    var isVerified: Boolean = false,
    @get:PropertyName("is_active")
    @set:PropertyName("is_active")
    var isActive: Boolean = true,
    
    // Avaliação
    val rating: Double = 0.0,
    @get:PropertyName("rating_count")
    @set:PropertyName("rating_count")
    var ratingCount: Int = 0,
    
    // Descrição e mídia
    val description: String = "",
    @get:PropertyName("photo_url")
    @set:PropertyName("photo_url")
    var photoUrl: String? = null,
    
    // Infraestrutura (amenidades)
    val amenities: List<String> = emptyList(), // ["estacionamento", "vestiario", "churrasqueira", "bar", "restaurante"]
    
    // Contato
    val phone: String? = null,
    val website: String? = null,
    val instagram: String? = null,

    // Horário de funcionamento
    @get:PropertyName("opening_time")
    @set:PropertyName("opening_time")
    var openingTime: String = "08:00",
    @get:PropertyName("closing_time")
    @set:PropertyName("closing_time")
    var closingTime: String = "23:00",
    @get:PropertyName("operating_days")
    @set:PropertyName("operating_days")
    var operatingDays: List<Int> = listOf(1, 2, 3, 4, 5, 6, 7),
    @get:PropertyName("min_game_duration_minutes")
    @set:PropertyName("min_game_duration_minutes")
    var minGameDurationMinutes: Int = 60,

    // Auditoria
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null,
    @ServerTimestamp
    @get:PropertyName("updated_at")
    @set:PropertyName("updated_at")
    var updatedAt: Date? = null
) {
    constructor() : this(id = "")

    /**
     * Retorna endereco formatado completo
     */
    @Exclude
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
    @Exclude
    fun isOwner(userId: String): Boolean = ownerId == userId

    /**
     * Verifica se um usuario eh gerente do local
     */
    @Exclude
    fun isManager(userId: String): Boolean = managers.contains(userId)

    /**
     * Verifica se um usuario tem permissao para gerenciar o local (dono ou gerente)
     */
    @Exclude
    fun canManage(userId: String): Boolean = isOwner(userId) || isManager(userId)
}

/**
 * Representa uma quadra/campo dentro de um local.
 * Ex: "Quadra 1 - Futsal" ou "Campo 2 - Society"
 */
data class Field(
    @DocumentId
    val id: String = "",
    @get:PropertyName("location_id")
    @set:PropertyName("location_id")
    var locationId: String = "",
    val name: String = "", // Ex: "Quadra 1", "Campo 2"
    val type: String = "SOCIETY", // SOCIETY, FUTSAL, CAMPO
    val description: String? = null,
    @get:PropertyName("photo_url")
    @set:PropertyName("photo_url")
    var photoUrl: String? = null,
    @get:PropertyName("is_active")
    @set:PropertyName("is_active")
    var isActive: Boolean = true,
    @get:PropertyName("hourly_price")
    @set:PropertyName("hourly_price")
    var hourlyPrice: Double = 0.0,
    @get:PropertyName("photos")
    @set:PropertyName("photos")
    var photos: List<String> = emptyList(),

    // Permissões
    @get:PropertyName("managers")
    @set:PropertyName("managers")
    var managers: List<String> = emptyList(), // Lista de IDs de usuários gerentes
    
    // Detalhes da quadra
    val surface: String? = null, // Grama Sintética, Natural, Taco...
    @get:PropertyName("is_covered")
    @set:PropertyName("is_covered")
    var isCovered: Boolean = false,
    val dimensions: String? = null // "30x15m"
) {
    constructor() : this(id = "")

    @Exclude
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

    @Exclude
    fun getDisplayName(): String {
        return "$name (${getTypeEnum().displayName})"
    }
}

/**
 * Tipos de quadra/campo disponíveis
 */
enum class FieldType(val displayName: String) {
    SOCIETY("Society"),
    FUTSAL("Futsal"),
    CAMPO("Campo"),
    AREIA("Areia"),
    OUTROS("Outros");

    // Helper para dropdown
    override fun toString(): String {
        return displayName
    }
}

/**
 * Classe auxiliar para agrupar um local com suas quadras
 */
data class LocationWithFields(
    val location: Location,
    val fields: List<Field>
) {
    /**
     * Agrupa os campos por tipo
     */
    @Exclude
    fun getFieldsByType(): Map<FieldType, List<Field>> {
        return fields.groupBy { it.getTypeEnum() }
    }
}
