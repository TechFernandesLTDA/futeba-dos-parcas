package com.futebadosparcas.util

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.QueryDocumentSnapshot
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Data Converter
 *
 * Provides utilities for converting between different data formats and types.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var dataConverter: DataConverter
 *
 * // Convert Firestore Timestamp to Date
 * val date = dataConverter.timestampToDate(timestamp)
 *
 * // Convert Date to formatted string
 * val formatted = dataConverter.formatDate(date, "dd/MM/yyyy HH:mm")
 *
 * // Parse Firestore document safely
 * val user = dataConverter.parseDocument<User>(document)
 * ```
 */
@Singleton
class DataConverter @Inject constructor() {

    /**
     * Convert Firestore Timestamp to Date
     */
    fun timestampToDate(timestamp: Timestamp?): Date? {
        return timestamp?.toDate()
    }

    /**
     * Convert Date to Firestore Timestamp
     */
    fun dateToTimestamp(date: Date?): Timestamp? {
        return date?.let { Timestamp(it) }
    }

    /**
     * Convert Long (millis) to Date
     */
    fun millisToDate(millis: Long?): Date? {
        return millis?.let { Date(it) }
    }

    /**
     * Convert Date to Long (millis)
     */
    fun dateToMillis(date: Date?): Long? {
        return date?.time
    }

    /**
     * Format Date to String
     */
    fun formatDate(date: Date?, pattern: String = "dd/MM/yyyy HH:mm"): String {
        if (date == null) return ""
        return try {
            SimpleDateFormat(pattern, Locale("pt", "BR")).format(date)
        } catch (e: Exception) {
            ""
        }
    }

    /**
     * Parse String to Date
     */
    fun parseDate(dateString: String?, pattern: String = "dd/MM/yyyy HH:mm"): Date? {
        if (dateString.isNullOrBlank()) return null
        return try {
            SimpleDateFormat(pattern, Locale("pt", "BR")).parse(dateString)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Format timestamp to relative time (e.g., "há 2 horas")
     */
    fun formatRelativeTime(timestamp: Timestamp?): String {
        val date = timestampToDate(timestamp) ?: return ""
        return formatRelativeTime(date)
    }

    /**
     * Format date to relative time (e.g., "há 2 horas")
     */
    fun formatRelativeTime(date: Date): String {
        val now = System.currentTimeMillis()
        val diff = now - date.time

        return when {
            diff < MINUTE_MILLIS -> "agora"
            diff < 2 * MINUTE_MILLIS -> "há 1 minuto"
            diff < HOUR_MILLIS -> "há ${diff / MINUTE_MILLIS} minutos"
            diff < 2 * HOUR_MILLIS -> "há 1 hora"
            diff < DAY_MILLIS -> "há ${diff / HOUR_MILLIS} horas"
            diff < 2 * DAY_MILLIS -> "ontem"
            diff < WEEK_MILLIS -> "há ${diff / DAY_MILLIS} dias"
            diff < 2 * WEEK_MILLIS -> "há 1 semana"
            diff < MONTH_MILLIS -> "há ${diff / WEEK_MILLIS} semanas"
            diff < 2 * MONTH_MILLIS -> "há 1 mês"
            diff < YEAR_MILLIS -> "há ${diff / MONTH_MILLIS} meses"
            diff < 2 * YEAR_MILLIS -> "há 1 ano"
            else -> "há ${diff / YEAR_MILLIS} anos"
        }
    }

    /**
     * Parse Firestore document to object
     */
    inline fun <reified T : Any> parseDocument(document: DocumentSnapshot?): T? {
        if (document == null || !document.exists()) return null
        return try {
            document.toObject(T::class.java)
        } catch (e: Exception) {
            android.util.Log.e("DataConverter", "Error parsing document to ${T::class.java.simpleName}", e)
            null
        }
    }

    /**
     * Parse Firestore query document to object
     */
    inline fun <reified T : Any> parseQueryDocument(document: QueryDocumentSnapshot): T? {
        return try {
            document.toObject(T::class.java)
        } catch (e: Exception) {
            android.util.Log.e("DataConverter", "Error parsing query document to ${T::class.java.simpleName}", e)
            null
        }
    }

    /**
     * Parse list of Firestore documents to objects
     */
    inline fun <reified T : Any> parseDocuments(documents: List<DocumentSnapshot>): List<T> {
        return documents.mapNotNull { parseDocument<T>(it) }
    }

    /**
     * Parse list of Firestore query documents to objects
     */
    inline fun <reified T : Any> parseQueryDocuments(documents: List<QueryDocumentSnapshot>): List<T> {
        return documents.mapNotNull { parseQueryDocument<T>(it) }
    }

    /**
     * Convert map to object
     */
    inline fun <reified T : Any> mapToObject(map: Map<String, Any?>): T? {
        return try {
            // This is a simplified version - in production, use a library like Gson or Moshi
            val constructor = T::class.java.getDeclaredConstructor()
            constructor.isAccessible = true
            val instance = constructor.newInstance()

            T::class.java.declaredFields.forEach { field ->
                field.isAccessible = true
                val value = map[field.name]
                if (value != null) {
                    field.set(instance, value)
                }
            }

            instance
        } catch (e: Exception) {
            android.util.Log.e("DataConverter", "Error converting map to ${T::class.java.simpleName}", e)
            null
        }
    }

    /**
     * Convert object to map
     */
    fun <T : Any> objectToMap(obj: T): Map<String, Any?> {
        return try {
            obj.javaClass.declaredFields.associate { field ->
                field.isAccessible = true
                field.name to field.get(obj)
            }
        } catch (e: Exception) {
            android.util.Log.e("DataConverter", "Error converting object to map", e)
            emptyMap()
        }
    }

    /**
     * Convert nullable Boolean to "Sim"/"Não"
     */
    fun booleanToYesNo(value: Boolean?): String {
        return if (value == true) "Sim" else "Não"
    }

    /**
     * Convert nullable Int to String with default
     */
    fun intToString(value: Int?, default: String = "0"): String {
        return value?.toString() ?: default
    }

    /**
     * Convert nullable Double to formatted string
     */
    fun doubleToString(value: Double?, decimalPlaces: Int = 1, default: String = "0.0"): String {
        return value?.let { String.format("%.${decimalPlaces}f", it) } ?: default
    }

    /**
     * Convert String to Int safely
     */
    fun stringToInt(value: String?, default: Int = 0): Int {
        return value?.toIntOrNull() ?: default
    }

    /**
     * Convert String to Double safely
     */
    fun stringToDouble(value: String?, default: Double = 0.0): Double {
        return value?.toDoubleOrNull() ?: default
    }

    /**
     * Convert String to Boolean
     */
    fun stringToBoolean(value: String?): Boolean {
        return value?.lowercase() in listOf("true", "sim", "yes", "1")
    }

    companion object {
        private const val SECOND_MILLIS = 1000L
        private const val MINUTE_MILLIS = 60 * SECOND_MILLIS
        private const val HOUR_MILLIS = 60 * MINUTE_MILLIS
        private const val DAY_MILLIS = 24 * HOUR_MILLIS
        private const val WEEK_MILLIS = 7 * DAY_MILLIS
        private const val MONTH_MILLIS = 30 * DAY_MILLIS
        private const val YEAR_MILLIS = 365 * DAY_MILLIS
    }
}
