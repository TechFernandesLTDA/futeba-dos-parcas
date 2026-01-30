package com.futebadosparcas.data.mapper

import com.futebadosparcas.data.model.Activity as AndroidActivity
import com.futebadosparcas.data.model.ActivityType as AndroidActivityType
import com.futebadosparcas.data.model.ActivityVisibility as AndroidActivityVisibility
import com.futebadosparcas.domain.model.Activity
import com.futebadosparcas.domain.model.ActivityType
import com.futebadosparcas.domain.model.ActivityVisibility

/**
 * #007 - Extension function mappers for Activity models
 * Kotlin idiomatic approach to convert between domain and data models
 */

// ============================================
// Domain -> Android (Data) conversions
// ============================================

/**
 * Converts Activity from domain to Android data model
 * Usage: activity.toAndroidModel()
 */
fun Activity.toAndroidModel(): AndroidActivity {
    return AndroidActivity(
        id = this.id,
        userId = this.userId,
        userName = this.userName,
        userPhoto = this.userPhoto,
        type = this.type.name,
        title = this.title,
        description = this.description,
        referenceId = this.referenceId,
        referenceType = this.referenceType,
        metadata = this.metadata,
        createdAt = this.createdAt?.let { java.util.Date(it) },
        visibility = this.visibility.toAndroidModel().name
    )
}

/**
 * Converts list of Activity from domain to Android data models
 * Usage: activities.toAndroidModels()
 */
fun List<Activity>.toAndroidModels(): List<AndroidActivity> {
    return this.map { it.toAndroidModel() }
}

/**
 * Converts ActivityType from domain to Android data model
 */
fun ActivityType.toAndroidModel(): AndroidActivityType {
    return AndroidActivityType.entries.find { it.name == this.name }
        ?: AndroidActivityType.GAME_FINISHED
}

/**
 * Converts ActivityVisibility from domain to Android data model
 */
fun ActivityVisibility.toAndroidModel(): AndroidActivityVisibility {
    return AndroidActivityVisibility.entries.find { it.name == this.name }
        ?: AndroidActivityVisibility.PUBLIC
}

// ============================================
// Android (Data) -> Domain conversions
// ============================================

/**
 * Converts AndroidActivity to domain Activity model
 * Usage: androidActivity.toDomain()
 */
fun AndroidActivity.toDomain(): Activity {
    return Activity(
        id = this.id,
        userId = this.userId,
        userName = this.userName,
        userPhoto = this.userPhoto,
        type = this.type.toDomainActivityType(),
        title = this.title,
        description = this.description,
        referenceId = this.referenceId,
        referenceType = this.referenceType,
        metadata = this.metadata.convertMetadataToStringMap(),
        createdAt = this.createdAt?.time,
        visibility = AndroidActivityVisibility.valueOf(this.visibility).toDomain()
    )
}

/**
 * Converts list of AndroidActivity to domain Activity models
 * Usage: androidActivities.toDomain()
 */
fun List<AndroidActivity>.toDomain(): List<Activity> {
    return this.map { it.toDomain() }
}

/**
 * Converts string type to domain ActivityType
 */
fun String.toDomainActivityType(): ActivityType {
    return ActivityType.entries.find { it.name == this }
        ?: ActivityType.GAME_FINISHED
}

/**
 * Converts AndroidActivityVisibility to domain ActivityVisibility
 */
fun AndroidActivityVisibility.toDomain(): ActivityVisibility {
    return ActivityVisibility.entries.find { it.name == this.name }
        ?: ActivityVisibility.PUBLIC
}

// ============================================
// Helpers
// ============================================

/**
 * Converts metadata from Map<String, Any> to Map<String, String>
 * Firestore may return Any, but shared model uses String
 */
private fun Map<String, Any>.convertMetadataToStringMap(): Map<String, String> {
    return this.mapValues { entry ->
        when (entry.value) {
            is String -> entry.value as String
            is Number -> entry.value.toString()
            is Boolean -> entry.value.toString()
            else -> entry.value.toString()
        }
    }
}

// ============================================
// Deprecated - Use extension functions instead
// ============================================

@Deprecated(
    message = "Use extension functions instead: activity.toAndroidModel()",
    replaceWith = ReplaceWith("activity.toAndroidModel()"),
    level = DeprecationLevel.WARNING
)
object ActivityMapper {
    @Deprecated("Use extension function", ReplaceWith("activity.toAndroidModel()"))
    fun toAndroidActivity(activity: Activity) = activity.toAndroidModel()

    @Deprecated("Use extension function", ReplaceWith("activities.toAndroidModels()"))
    fun toAndroidActivities(activities: List<Activity>) = activities.toAndroidModels()

    @Deprecated("Use extension function", ReplaceWith("androidActivity.toDomain()"))
    fun toDomainActivity(androidActivity: AndroidActivity) = androidActivity.toDomain()

    @Deprecated("Use extension function", ReplaceWith("androidActivities.toDomain()"))
    fun toDomainActivities(androidActivities: List<AndroidActivity>) = androidActivities.toDomain()
}
