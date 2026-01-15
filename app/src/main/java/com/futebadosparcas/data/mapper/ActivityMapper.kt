package com.futebadosparcas.data.mapper

import com.futebadosparcas.data.model.Activity as AndroidActivity
import com.futebadosparcas.data.model.ActivityType as AndroidActivityType
import com.futebadosparcas.data.model.ActivityVisibility as AndroidActivityVisibility
import com.futebadosparcas.domain.model.Activity
import com.futebadosparcas.domain.model.ActivityType
import com.futebadosparcas.domain.model.ActivityVisibility

/**
 * Mapper para converter entre modelos do shared module e modelos Android de Activity.
 */
object ActivityMapper {

    /**
     * Converte Activity do shared module para Android model.
     */
    fun toAndroidActivity(activity: Activity): AndroidActivity {
        return AndroidActivity(
            id = activity.id,
            userId = activity.userId,
            userName = activity.userName,
            userPhoto = activity.userPhoto,
            type = activity.type.name,
            title = activity.title,
            description = activity.description,
            referenceId = activity.referenceId,
            referenceType = activity.referenceType,
            metadata = activity.metadata,
            createdAt = activity.createdAt?.let { java.util.Date(it) },
            visibility = toAndroidActivityVisibility(activity.visibility).name
        )
    }

    /**
     * Converte lista de Activity do shared module para Android models.
     */
    fun toAndroidActivities(activities: List<Activity>): List<AndroidActivity> {
        return activities.map { toAndroidActivity(it) }
    }

    /**
     * Converte Activity do Android model para shared module.
     */
    fun toDomainActivity(androidActivity: AndroidActivity): Activity {
        return Activity(
            id = androidActivity.id,
            userId = androidActivity.userId,
            userName = androidActivity.userName,
            userPhoto = androidActivity.userPhoto,
            type = toDomainActivityType(androidActivity.type),
            title = androidActivity.title,
            description = androidActivity.description,
            referenceId = androidActivity.referenceId,
            referenceType = androidActivity.referenceType,
            metadata = convertMetadataToStringMap(androidActivity.metadata),
            createdAt = androidActivity.createdAt?.time,
            visibility = toDomainActivityVisibility(
                AndroidActivityVisibility.valueOf(androidActivity.visibility)
            )
        )
    }

    /**
     * Converte lista de Activity do Android model para shared module.
     */
    fun toDomainActivities(androidActivities: List<AndroidActivity>): List<Activity> {
        return androidActivities.map { toDomainActivity(it) }
    }

    /**
     * Converte ActivityType do shared module para Android model.
     */
    fun toAndroidActivityType(type: ActivityType): AndroidActivityType {
        return AndroidActivityType.entries.find { it.name == type.name }
            ?: AndroidActivityType.GAME_FINISHED
    }

    /**
     * Converte ActivityType do Android model para shared module.
     */
    fun toDomainActivityType(type: String): ActivityType {
        return ActivityType.entries.find { it.name == type }
            ?: ActivityType.GAME_FINISHED
    }

    /**
     * Converte ActivityVisibility do shared module para Android model.
     */
    fun toAndroidActivityVisibility(visibility: ActivityVisibility): AndroidActivityVisibility {
        return AndroidActivityVisibility.entries.find { it.name == visibility.name }
            ?: AndroidActivityVisibility.PUBLIC
    }

    /**
     * Converte ActivityVisibility do Android model para shared module.
     */
    fun toDomainActivityVisibility(visibility: AndroidActivityVisibility): ActivityVisibility {
        return ActivityVisibility.entries.find { it.name == visibility.name }
            ?: ActivityVisibility.PUBLIC
    }

    /**
     * Converte metadata de Map<String, Any> para Map<String, String>.
     * Firestore pode retornar Any, mas o shared model usa String.
     */
    private fun convertMetadataToStringMap(metadata: Map<String, Any>): Map<String, String> {
        return metadata.mapValues { entry ->
            when (entry.value) {
                is String -> entry.value as String
                is Number -> entry.value.toString()
                is Boolean -> entry.value.toString()
                else -> entry.value.toString()
            }
        }
    }
}
