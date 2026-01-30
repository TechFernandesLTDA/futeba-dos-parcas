package com.futebadosparcas.util

import android.os.Bundle
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.ktx.analytics
import com.google.firebase.ktx.Firebase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Location Analytics Helper
 *
 * Rastreamento de eventos de analytics para o funil de descoberta de locais.
 * Fornece tracking type-safe com nomenclatura padronizada para Firebase Analytics.
 *
 * Eventos rastreados:
 * - Visualização do mapa de locais
 * - Abertura de detalhes do local
 * - Visualização de quadras
 * - Reserva de quadras
 * - Buscas realizadas
 * - Filtros aplicados
 * - Criação/edição de locais
 *
 * Uso:
 * ```kotlin
 * @Inject lateinit var locationAnalytics: LocationAnalytics
 *
 * locationAnalytics.trackMapViewed(locationCount = 10, source = "home")
 * locationAnalytics.trackLocationDetailOpened(locationId = "abc123", source = "map")
 * ```
 */
@Singleton
class LocationAnalytics @Inject constructor() {

    private val analytics: FirebaseAnalytics = Firebase.analytics

    // ============================================
    // Map & Discovery Events
    // ============================================

    /**
     * Rastreia quando o mapa de locais é visualizado.
     *
     * @param locationCount Número de locais exibidos no mapa
     * @param source Origem da navegação (home, menu, deeplink)
     */
    fun trackMapViewed(locationCount: Int, source: String) {
        analytics.logEvent(LocationEvents.MAP_VIEWED, Bundle().apply {
            putInt(LocationParams.LOCATION_COUNT, locationCount)
            putString(LocationParams.SOURCE, source)
        })
    }

    /**
     * Rastreia quando os detalhes de um local são abertos.
     *
     * @param locationId ID do local
     * @param source Origem da navegação (map, list, search, deeplink)
     */
    fun trackLocationDetailOpened(locationId: String, source: String) {
        analytics.logEvent(LocationEvents.DETAIL_OPENED, Bundle().apply {
            putString(LocationParams.LOCATION_ID, locationId)
            putString(LocationParams.SOURCE, source)
        })
    }

    // ============================================
    // Field Events
    // ============================================

    /**
     * Rastreia quando uma quadra é visualizada.
     *
     * @param fieldId ID da quadra
     * @param locationId ID do local
     */
    fun trackFieldViewed(fieldId: String, locationId: String) {
        analytics.logEvent(LocationEvents.FIELD_VIEWED, Bundle().apply {
            putString(LocationParams.FIELD_ID, fieldId)
            putString(LocationParams.LOCATION_ID, locationId)
        })
    }

    /**
     * Rastreia quando uma quadra é reservada.
     *
     * @param fieldId ID da quadra
     * @param locationId ID do local
     * @param price Preço da reserva
     */
    fun trackFieldBooked(fieldId: String, locationId: String, price: Double) {
        analytics.logEvent(LocationEvents.FIELD_BOOKED, Bundle().apply {
            putString(LocationParams.FIELD_ID, fieldId)
            putString(LocationParams.LOCATION_ID, locationId)
            putDouble(LocationParams.PRICE, price)
        })
    }

    // ============================================
    // Search & Filter Events
    // ============================================

    /**
     * Rastreia quando uma busca de locais é realizada.
     *
     * @param query Termo de busca
     * @param resultCount Número de resultados encontrados
     */
    fun trackLocationSearch(query: String, resultCount: Int) {
        analytics.logEvent(LocationEvents.SEARCH_PERFORMED, Bundle().apply {
            putString(LocationParams.SEARCH_QUERY, query)
            putInt(LocationParams.RESULT_COUNT, resultCount)
        })
    }

    /**
     * Rastreia quando um filtro é aplicado.
     *
     * @param filterType Tipo de filtro (region, amenity, price, field_type)
     * @param filterValue Valor do filtro aplicado
     */
    fun trackFilterApplied(filterType: String, filterValue: String) {
        analytics.logEvent(LocationEvents.FILTER_APPLIED, Bundle().apply {
            putString(LocationParams.FILTER_TYPE, filterType)
            putString(LocationParams.FILTER_VALUE, filterValue)
        })
    }

    // ============================================
    // CRUD Events
    // ============================================

    /**
     * Rastreia quando um novo local é criado.
     *
     * @param locationId ID do local criado
     */
    fun trackLocationCreated(locationId: String) {
        analytics.logEvent(LocationEvents.LOCATION_CREATED, Bundle().apply {
            putString(LocationParams.LOCATION_ID, locationId)
        })
    }

    /**
     * Rastreia quando um local é editado.
     *
     * @param locationId ID do local editado
     * @param fieldsChanged Lista de campos que foram alterados
     */
    fun trackLocationEdited(locationId: String, fieldsChanged: List<String>) {
        analytics.logEvent(LocationEvents.LOCATION_EDITED, Bundle().apply {
            putString(LocationParams.LOCATION_ID, locationId)
            putString(LocationParams.FIELDS_CHANGED, fieldsChanged.joinToString(","))
            putInt(LocationParams.FIELDS_CHANGED_COUNT, fieldsChanged.size)
        })
    }

    /**
     * Rastreia quando uma quadra é criada.
     *
     * @param fieldId ID da quadra criada
     * @param locationId ID do local onde a quadra foi criada
     */
    fun trackFieldCreated(fieldId: String, locationId: String) {
        analytics.logEvent(LocationEvents.FIELD_CREATED, Bundle().apply {
            putString(LocationParams.FIELD_ID, fieldId)
            putString(LocationParams.LOCATION_ID, locationId)
        })
    }

    /**
     * Rastreia quando uma quadra é editada.
     *
     * @param fieldId ID da quadra editada
     * @param locationId ID do local
     */
    fun trackFieldEdited(fieldId: String, locationId: String) {
        analytics.logEvent(LocationEvents.FIELD_EDITED, Bundle().apply {
            putString(LocationParams.FIELD_ID, fieldId)
            putString(LocationParams.LOCATION_ID, locationId)
        })
    }

    /**
     * Rastreia quando um local é deletado.
     *
     * @param locationId ID do local deletado
     */
    fun trackLocationDeleted(locationId: String) {
        analytics.logEvent(LocationEvents.LOCATION_DELETED, Bundle().apply {
            putString(LocationParams.LOCATION_ID, locationId)
        })
    }

    /**
     * Rastreia quando uma quadra é deletada.
     *
     * @param fieldId ID da quadra deletada
     * @param locationId ID do local
     */
    fun trackFieldDeleted(fieldId: String, locationId: String) {
        analytics.logEvent(LocationEvents.FIELD_DELETED, Bundle().apply {
            putString(LocationParams.FIELD_ID, fieldId)
            putString(LocationParams.LOCATION_ID, locationId)
        })
    }
}

/**
 * Constantes de eventos de analytics para locais.
 * Nomenclatura segue padrão snake_case para compatibilidade com Firebase.
 */
object LocationEvents {
    const val MAP_VIEWED = "location_map_viewed"
    const val DETAIL_OPENED = "location_detail_opened"
    const val FIELD_VIEWED = "location_field_viewed"
    const val FIELD_BOOKED = "location_field_booked"
    const val SEARCH_PERFORMED = "location_search"
    const val FILTER_APPLIED = "location_filter"
    const val LOCATION_CREATED = "location_created"
    const val LOCATION_EDITED = "location_edited"
    const val LOCATION_DELETED = "location_deleted"
    const val FIELD_CREATED = "location_field_created"
    const val FIELD_EDITED = "location_field_edited"
    const val FIELD_DELETED = "location_field_deleted"
}

/**
 * Constantes de parâmetros de analytics para locais.
 * Nomenclatura segue padrão snake_case para compatibilidade com Firebase.
 */
object LocationParams {
    const val LOCATION_ID = "location_id"
    const val FIELD_ID = "field_id"
    const val SOURCE = "source"
    const val LOCATION_COUNT = "location_count"
    const val RESULT_COUNT = "result_count"
    const val PRICE = "price"
    const val SEARCH_QUERY = "search_query"
    const val FILTER_TYPE = "filter_type"
    const val FILTER_VALUE = "filter_value"
    const val FIELDS_CHANGED = "fields_changed"
    const val FIELDS_CHANGED_COUNT = "fields_changed_count"
}

/**
 * Constantes de fontes de navegação para analytics.
 * Usado no parâmetro source dos eventos.
 */
object LocationSources {
    const val MAP = "map"
    const val LIST = "list"
    const val SEARCH = "search"
    const val DEEPLINK = "deeplink"
    const val HOME = "home"
    const val MENU = "menu"
    const val MANAGE = "manage"
}
