package com.futebadosparcas.util

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.domain.repository.LocationRepository
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Utilitário para exportar dados de locais para backup.
 *
 * Suporta exportação em formato JSON e CSV.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var locationExporter: LocationExporter
 *
 * // Exportar locais específicos para JSON
 * val result = locationExporter.exportToJson(listOf("loc1", "loc2"))
 *
 * // Exportar todos os locais de um proprietário para JSON
 * val result = locationExporter.exportAll("ownerId")
 *
 * // Exportar para CSV
 * val result = locationExporter.exportToCsv(listOf("loc1", "loc2"))
 * ```
 */
@Singleton
class LocationExporter @Inject constructor(
    @ApplicationContext private val context: Context,
    private val locationRepository: LocationRepository
) {
    companion object {
        private const val TAG = "LocationExporter"
        private const val EXPORT_VERSION = "1.0"
        private const val FILE_PROVIDER_AUTHORITY = "com.futebadosparcas.fileprovider"
    }

    private val gson: Gson = GsonBuilder()
        .setPrettyPrinting()
        .serializeNulls()
        .create()

    /**
     * Exporta locais específicos para formato JSON.
     *
     * @param locationIds Lista de IDs dos locais a exportar
     * @return Result com a URI do arquivo exportado ou erro
     */
    suspend fun exportToJson(locationIds: List<String>): Result<Uri> {
        return try {
            AppLogger.d(TAG) { "Iniciando exportação JSON de ${locationIds.size} locais" }

            val locationsData = fetchLocationsWithFields(locationIds)
            if (locationsData.isEmpty()) {
                return Result.failure(IllegalStateException("Nenhum local encontrado para exportar"))
            }

            val exportData = LocationExport(
                exportDate = System.currentTimeMillis(),
                exportVersion = EXPORT_VERSION,
                locations = locationsData
            )

            val jsonString = gson.toJson(exportData)
            val file = createExportFile("json")
            file.writeText(jsonString)

            val uri = FileProvider.getUriForFile(context, FILE_PROVIDER_AUTHORITY, file)
            AppLogger.d(TAG) { "Exportação JSON concluída: ${file.absolutePath}" }

            Result.success(uri)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao exportar para JSON", e)
            Result.failure(e)
        }
    }

    /**
     * Exporta locais específicos para formato CSV.
     *
     * @param locationIds Lista de IDs dos locais a exportar
     * @return Result com a URI do arquivo exportado ou erro
     */
    suspend fun exportToCsv(locationIds: List<String>): Result<Uri> {
        return try {
            AppLogger.d(TAG) { "Iniciando exportação CSV de ${locationIds.size} locais" }

            val locationsData = fetchLocationsWithFields(locationIds)
            if (locationsData.isEmpty()) {
                return Result.failure(IllegalStateException("Nenhum local encontrado para exportar"))
            }

            val csvContent = buildCsvContent(locationsData)
            val file = createExportFile("csv")
            file.writeText(csvContent)

            val uri = FileProvider.getUriForFile(context, FILE_PROVIDER_AUTHORITY, file)
            AppLogger.d(TAG) { "Exportação CSV concluída: ${file.absolutePath}" }

            Result.success(uri)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao exportar para CSV", e)
            Result.failure(e)
        }
    }

    /**
     * Exporta todos os locais de um proprietário para formato JSON.
     *
     * @param ownerId ID do proprietário dos locais
     * @return Result com a URI do arquivo exportado ou erro
     */
    suspend fun exportAll(ownerId: String): Result<Uri> {
        return try {
            AppLogger.d(TAG) { "Iniciando exportação de todos os locais do proprietário: $ownerId" }

            val locationsResult = locationRepository.getLocationsByOwner(ownerId)
            if (locationsResult.isFailure) {
                return Result.failure(
                    locationsResult.exceptionOrNull()
                        ?: IllegalStateException("Erro ao buscar locais")
                )
            }

            val locations = locationsResult.getOrNull() ?: emptyList()
            if (locations.isEmpty()) {
                return Result.failure(IllegalStateException("Nenhum local encontrado para este proprietário"))
            }

            val locationIds = locations.map { it.id }
            exportToJson(locationIds)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao exportar todos os locais", e)
            Result.failure(e)
        }
    }

    /**
     * Busca locais com seus campos para exportação.
     */
    private suspend fun fetchLocationsWithFields(locationIds: List<String>): List<LocationExportData> {
        val result = mutableListOf<LocationExportData>()

        for (locationId in locationIds) {
            try {
                val locationResult = locationRepository.getLocationById(locationId)
                if (locationResult.isFailure) {
                    AppLogger.w(TAG) { "Local não encontrado: $locationId" }
                    continue
                }

                val kmpLocation = locationResult.getOrNull() ?: continue
                val location = kmpLocation.toAndroidLocation()

                val fieldsResult = locationRepository.getFieldsByLocation(locationId)
                val fields = fieldsResult.getOrNull()?.map { it.toAndroidField() } ?: emptyList()

                // Coleta URLs de fotos
                val photoUrls = mutableListOf<String>()
                location.photoUrl?.let { photoUrls.add(it) }
                fields.forEach { field ->
                    field.photoUrl?.let { photoUrls.add(it) }
                    photoUrls.addAll(field.photos)
                }

                result.add(
                    LocationExportData(
                        location = LocationData.fromLocation(location),
                        fields = fields.map { FieldData.fromField(it) },
                        photoUrls = photoUrls.distinct()
                    )
                )
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao buscar local $locationId", e)
            }
        }

        return result
    }

    /**
     * Constrói o conteúdo CSV a partir dos dados exportados.
     */
    private fun buildCsvContent(locationsData: List<LocationExportData>): String {
        val sb = StringBuilder()

        // Header - Informações de exportação
        sb.appendLine("# Exportação de Locais - Futeba dos Parças")
        sb.appendLine("# Data: ${formatDate(System.currentTimeMillis())}")
        sb.appendLine("# Versão: $EXPORT_VERSION")
        sb.appendLine()

        // Header da tabela de locais
        sb.appendLine("# LOCAIS")
        sb.appendLine(CSV_LOCATION_HEADER)

        // Dados dos locais
        for (data in locationsData) {
            val loc = data.location
            sb.appendLine(
                listOf(
                    escapeCsv(loc.id),
                    escapeCsv(loc.name),
                    escapeCsv(loc.address),
                    escapeCsv(loc.cep),
                    escapeCsv(loc.street),
                    escapeCsv(loc.number),
                    escapeCsv(loc.complement),
                    escapeCsv(loc.neighborhood),
                    escapeCsv(loc.city),
                    escapeCsv(loc.state),
                    escapeCsv(loc.region),
                    loc.latitude?.toString() ?: "",
                    loc.longitude?.toString() ?: "",
                    escapeCsv(loc.phone ?: ""),
                    escapeCsv(loc.instagram ?: ""),
                    escapeCsv(loc.website ?: ""),
                    escapeCsv(loc.description),
                    escapeCsv(loc.amenities.joinToString(";")),
                    loc.openingTime,
                    loc.closingTime,
                    loc.operatingDays.joinToString(";"),
                    loc.minGameDurationMinutes.toString(),
                    loc.isActive.toString(),
                    loc.isVerified.toString(),
                    loc.rating.toString(),
                    loc.ratingCount.toString(),
                    escapeCsv(loc.ownerId)
                ).joinToString(",")
            )
        }

        sb.appendLine()

        // Header da tabela de campos
        sb.appendLine("# CAMPOS")
        sb.appendLine(CSV_FIELD_HEADER)

        // Dados dos campos
        for (data in locationsData) {
            for (field in data.fields) {
                sb.appendLine(
                    listOf(
                        escapeCsv(field.id),
                        escapeCsv(field.locationId),
                        escapeCsv(field.name),
                        escapeCsv(field.type),
                        escapeCsv(field.description ?: ""),
                        escapeCsv(field.surface ?: ""),
                        field.isCovered.toString(),
                        escapeCsv(field.dimensions ?: ""),
                        field.hourlyPrice.toString(),
                        field.isActive.toString(),
                        escapeCsv(field.photos.joinToString(";"))
                    ).joinToString(",")
                )
            }
        }

        return sb.toString()
    }

    /**
     * Cria o arquivo de exportação com timestamp no nome.
     */
    private fun createExportFile(extension: String): File {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val fileName = "locations_export_$timestamp.$extension"
        val exportDir = File(context.cacheDir, "exports")
        if (!exportDir.exists()) {
            exportDir.mkdirs()
        }
        return File(exportDir, fileName)
    }

    /**
     * Formata data para exibição.
     */
    private fun formatDate(timestamp: Long): String {
        return SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.forLanguageTag("pt-BR")).format(Date(timestamp))
    }

    /**
     * Escapa valores para CSV (aspas e vírgulas).
     */
    private fun escapeCsv(value: String): String {
        return if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            "\"${value.replace("\"", "\"\"")}\""
        } else {
            value
        }
    }

}

// CSV Headers
private const val CSV_LOCATION_HEADER =
    "id,name,address,cep,street,number,complement,neighborhood,city,state,region," +
    "latitude,longitude,phone,instagram,website,description,amenities,opening_time," +
    "closing_time,operating_days,min_game_duration,is_active,is_verified,rating,rating_count,owner_id"

private const val CSV_FIELD_HEADER =
    "id,location_id,name,type,description,surface,is_covered,dimensions,hourly_price,is_active,photos"

// ========== Data Classes para Serialização ==========

/**
 * Estrutura principal de exportação.
 */
data class LocationExport(
    val exportDate: Long,
    val exportVersion: String = "1.0",
    val locations: List<LocationExportData>
)

/**
 * Dados de um local exportado com seus campos e fotos.
 */
data class LocationExportData(
    val location: LocationData,
    val fields: List<FieldData>,
    val photoUrls: List<String>
)

/**
 * Dados de um local para serialização.
 * Versão serializável do modelo Location.
 */
data class LocationData(
    val id: String,
    val name: String,
    val address: String,
    val cep: String,
    val street: String,
    val number: String,
    val complement: String,
    val district: String,
    val city: String,
    val state: String,
    val country: String,
    val neighborhood: String,
    val region: String,
    val latitude: Double?,
    val longitude: Double?,
    val placeId: String?,
    val ownerId: String,
    val managers: List<String>,
    val isVerified: Boolean,
    val isActive: Boolean,
    val rating: Double,
    val ratingCount: Int,
    val description: String,
    val photoUrl: String?,
    val amenities: List<String>,
    val phone: String?,
    val website: String?,
    val instagram: String?,
    val openingTime: String,
    val closingTime: String,
    val operatingDays: List<Int>,
    val minGameDurationMinutes: Int,
    val createdAt: Long?,
    val updatedAt: Long?
) {
    companion object {
        fun fromLocation(location: Location): LocationData {
            return LocationData(
                id = location.id,
                name = location.name,
                address = location.address,
                cep = location.cep,
                street = location.street,
                number = location.number,
                complement = location.complement,
                district = location.district,
                city = location.city,
                state = location.state,
                country = location.country,
                neighborhood = location.neighborhood,
                region = location.region,
                latitude = location.latitude,
                longitude = location.longitude,
                placeId = location.placeId,
                ownerId = location.ownerId,
                managers = location.managers,
                isVerified = location.isVerified,
                isActive = location.isActive,
                rating = location.rating,
                ratingCount = location.ratingCount,
                description = location.description,
                photoUrl = location.photoUrl,
                amenities = location.amenities,
                phone = location.phone,
                website = location.website,
                instagram = location.instagram,
                openingTime = location.openingTime,
                closingTime = location.closingTime,
                operatingDays = location.operatingDays,
                minGameDurationMinutes = location.minGameDurationMinutes,
                createdAt = location.createdAt?.time,
                updatedAt = location.updatedAt?.time
            )
        }
    }
}

/**
 * Dados de um campo para serialização.
 * Versão serializável do modelo Field.
 */
data class FieldData(
    val id: String,
    val locationId: String,
    val name: String,
    val type: String,
    val description: String?,
    val photoUrl: String?,
    val isActive: Boolean,
    val hourlyPrice: Double,
    val photos: List<String>,
    val managers: List<String>,
    val surface: String?,
    val isCovered: Boolean,
    val dimensions: String?
) {
    companion object {
        fun fromField(field: Field): FieldData {
            return FieldData(
                id = field.id,
                locationId = field.locationId,
                name = field.name,
                type = field.type,
                description = field.description,
                photoUrl = field.photoUrl,
                isActive = field.isActive,
                hourlyPrice = field.hourlyPrice,
                photos = field.photos,
                managers = field.managers,
                surface = field.surface,
                isCovered = field.isCovered,
                dimensions = field.dimensions
            )
        }
    }
}
