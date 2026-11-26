package com.futebadosparcas.ui.validation

import android.content.Context
import com.futebadosparcas.R
import com.futebadosparcas.domain.validation.ValidationResult

/**
 * Resolve [ValidationResult.Invalid] em texto para exibição (#4596).
 *
 * O domínio preenche `messageKey` (template em `strings.xml`, pt/en/es) e
 * `messageArgs`; sem chave ou com chave desconhecida, cai para a `message`
 * em PT (logs e Invalid construídos em `data/model`).
 */
object ValidationMessages {

    private val KEY_TO_RES_ID: Map<String, Int> = mapOf(
        "validation_model.cep_required" to R.string.validation_model_cep_required,
        "validation_model.cep_invalid" to R.string.validation_model_cep_invalid,
        "validation_model.email_required" to R.string.validation_model_email_required,
        "validation_model.email_invalid" to R.string.validation_model_email_invalid,
        "validation_model.name_required" to R.string.validation_model_name_required,
        "validation_model.name_min_length" to R.string.validation_model_name_min_length,
        "validation_model.name_max_length" to R.string.validation_model_name_max_length,
        "validation_model.name_invalid" to R.string.validation_model_name_invalid,
        "validation_model.field_required" to R.string.validation_model_field_required,
        "validation_model.field_min_length" to R.string.validation_model_field_min_length,
        "validation_model.field_max_length" to R.string.validation_model_field_max_length,
        "validation_model.rating_range" to R.string.validation_model_rating_range,
        "validation_model.league_rating_range" to R.string.validation_model_league_rating_range,
        "validation_model.level_range" to R.string.validation_model_level_range,
        "validation_model.amount_greater_than_zero" to R.string.validation_model_amount_greater_than_zero,
        "validation_model.non_negative" to R.string.validation_model_non_negative,
        "validation_model.goals_negative" to R.string.validation_model_goals_negative,
        "validation_model.goals_max" to R.string.validation_model_goals_max,
        "validation_model.assists_negative" to R.string.validation_model_assists_negative,
        "validation_model.assists_max" to R.string.validation_model_assists_max,
        "validation_model.saves_negative" to R.string.validation_model_saves_negative,
        "validation_model.saves_max" to R.string.validation_model_saves_max,
        "validation_model.xp_negative" to R.string.validation_model_xp_negative,
        "validation_model.xp_max" to R.string.validation_model_xp_max,
        "validation_model.timestamp_order" to R.string.validation_model_timestamp_order,
        "validation_model.players_min" to R.string.validation_model_players_min,
        "validation_model.players_max" to R.string.validation_model_players_max,
        "validation_model.teams_balance" to R.string.validation_model_teams_balance,
        "validation_model.teams_minimum" to R.string.validation_model_teams_minimum,
        "validation_model.duration_min" to R.string.validation_model_duration_min,
        "validation_model.duration_max" to R.string.validation_model_duration_max,
        "validation_model.game_date_required" to R.string.validation_model_game_date_required,
        "validation_model.game_date_future" to R.string.validation_model_game_date_future,
        "validation_model.payment_min" to R.string.validation_model_payment_min,
        "validation_model.payment_max" to R.string.validation_model_payment_max,
        "validation_model.group_min" to R.string.validation_model_group_min,
        "validation_model.group_max" to R.string.validation_model_group_max,
        "validation_model.coords_required" to R.string.validation_model_coords_required,
        "validation_model.latitude_range" to R.string.validation_model_latitude_range,
        "validation_model.longitude_range" to R.string.validation_model_longitude_range,
        "validation_model.score_negative" to R.string.validation_model_score_negative,
        "validation_model.score_max" to R.string.validation_model_score_max,
        "validation_model.teams_count_min" to R.string.validation_model_teams_count_min,
        "validation_model.teams_count_max" to R.string.validation_model_teams_count_max,
        "validation_model.streak_negative" to R.string.validation_model_streak_negative,
        "validation_model.streak_max" to R.string.validation_model_streak_max,
        "validation_model.url_max" to R.string.validation_model_url_max,
        "validation_model.url_scheme" to R.string.validation_model_url_scheme,
        "validation_model.phone_required" to R.string.validation_model_phone_required,
        "validation_model.phone_invalid" to R.string.validation_model_phone_invalid,
        "validation_model.field_range" to R.string.validation_model_field_range,
        "validation_model.field_invalid_format" to R.string.validation_model_field_invalid_format,
        "validation_model.enum_invalid" to R.string.validation_model_enum_invalid,
        "validation_model.logical_inconsistency" to R.string.validation_model_logical_inconsistency,
        "validation_model.field_count_negative" to R.string.validation_model_field_count_negative,
        "validation_model.operating_days_range" to R.string.validation_model_operating_days_range,
        "validation_model.owner_required" to R.string.validation_model_owner_required,
    )

    /** Texto exibível do erro; PT (a `message`) quando sem chave conhecida. */
    fun resolve(context: Context, error: ValidationResult.Invalid): String {
        val resId = KEY_TO_RES_ID[error.messageKey] ?: return error.message
        val template = context.getString(resId)
        if (error.messageArgs.isEmpty()) return template
        val args = error.messageArgs.map { it?.toString() ?: "" }
        return try {
            String.format(java.util.Locale.getDefault(), template, *args.toTypedArray())
        } catch (_: Exception) {
            template
        }
    }
}
