package com.futebadosparcas.data.firestore

import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.GroupMemberStatus
import com.futebadosparcas.data.model.GroupStatus
import com.futebadosparcas.domain.model.GameTemplate
import com.futebadosparcas.domain.model.GamificationSettings
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import java.util.Date

/**
 * #4645: documentos que o Android grava campo a campo, em snake_case.
 *
 * Os modelos de `shared/domain/model` só têm `@SerialName`, que o mapper do SDK
 * Android ignora: `set(modelo)` gravava `ownerId`, `createdAt` e afins, e as regras,
 * o web e as functions leem `owner_id`, `created_at`. Aqui cada escritor monta o
 * mapa com os nomes que os leitores usam. O teste `AndroidEscritoresFirestoreTest`
 * confere as chaves, e `firestore-rules-tests/src/android-snake-case-4645.test.ts`
 * grava os mesmos documentos contra as regras reais.
 */
object AndroidEscritoresFirestore {

    // Mesmo nome de reserva que o web grava quando a conta não tem nome (AuthContext).
    // A regra de users exige nome com pelo menos 2 caracteres.
    private const val NOME_DE_RESERVA = "Usuário"

    /**
     * `groups/{id}` de um grupo novo. Mesmas chaves do web (`useGroups.createGroup`).
     * `member_count` começa em 0: o `onMemberWritten` conta o dono criado no mesmo lote.
     */
    fun novoGrupo(
        name: String,
        description: String,
        ownerId: String,
        ownerName: String,
        defaultGender: String?
    ): Map<String, Any?> = buildMap {
        put("name", name)
        put("description", description)
        put("photo_url", null)
        put("type", "PRIVATE")
        put("is_public", false)
        put("owner_id", ownerId)
        put("owner_name", ownerName)
        put("member_count", 0)
        put("status", GroupStatus.ACTIVE.name)
        put("created_at", FieldValue.serverTimestamp())
        put("updated_at", FieldValue.serverTimestamp())
        // Categoria padrão dos jogos só quando escolhida, como no web.
        if (defaultGender != null) put("default_gender", defaultGender)
    }

    /** `groups/{id}/members/{uid}` do dono, gravado junto com o grupo. */
    fun membroDono(userId: String, userName: String, userPhoto: String?): Map<String, Any?> = mapOf(
        "user_id" to userId,
        "user_name" to userName,
        "user_photo" to userPhoto,
        "role" to GroupMemberRole.OWNER.name,
        "status" to GroupMemberStatus.ACTIVE.name,
        "joined_at" to FieldValue.serverTimestamp()
    )

    /** `users/{uid}/groups/{id}`: espelho do grupo novo no perfil do dono. */
    fun espelhoDoDono(groupId: String, groupName: String): Map<String, Any?> = mapOf(
        "group_id" to groupId,
        "group_name" to groupName,
        "group_photo" to null,
        "role" to GroupMemberRole.OWNER.name,
        "member_count" to 1,
        "group_status" to GroupStatus.ACTIVE.name,
        "joined_at" to FieldValue.serverTimestamp()
    )

    /**
     * `users/{uid}` de reserva, quando a conta entra e o perfil não existe.
     *
     * Subconjunto do que o web grava no cadastro. Os quatro ratings precisam estar no
     * documento (a regra os lê direto). Não leva XP, nível, telefone nem status: a
     * regra recusa esses campos no create. A regra também exige `invited_by_code`,
     * que o Android ainda não pede; sem ele a gravação segue negada (ver #4645).
     */
    fun perfilNovo(email: String, name: String, photoUrl: String?): Map<String, Any?> = mapOf(
        "email" to email,
        "name" to (name.trim().takeIf { it.length >= 2 } ?: NOME_DE_RESERVA),
        "nickname" to "",
        "photo_url" to photoUrl,
        "role" to "PLAYER",
        "striker_rating" to 0,
        "mid_rating" to 0,
        "defender_rating" to 0,
        "gk_rating" to 0,
        "preferred_position" to null,
        "preferred_field_types" to emptyList<String>(),
        "is_searchable" to true,
        "created_at" to FieldValue.serverTimestamp(),
        "updated_at" to FieldValue.serverTimestamp()
    )

    /** `users/{uid}/game_templates/{id}`, com os nomes de `@SerialName` do modelo. */
    fun modeloDeJogo(template: GameTemplate): Map<String, Any?> = mapOf(
        "user_id" to template.userId,
        "template_name" to template.templateName,
        "location_name" to template.locationName,
        "location_address" to template.locationAddress,
        "location_id" to template.locationId,
        "field_name" to template.fieldName,
        "field_id" to template.fieldId,
        "game_time" to template.gameTime,
        "game_end_time" to template.gameEndTime,
        "max_players" to template.maxPlayers,
        "daily_price" to template.dailyPrice,
        "recurrence" to template.recurrence,
        "created_at" to FieldValue.serverTimestamp()
    )

    /** Lê um modelo de jogo em snake_case. Documento antigo em camelCase também é lido. */
    fun lerModeloDeJogo(id: String, dados: Map<String, Any?>): GameTemplate {
        val padrao = GameTemplate()
        return GameTemplate(
            id = id,
            userId = dados.texto("user_id", "userId") ?: padrao.userId,
            templateName = dados.texto("template_name", "templateName") ?: padrao.templateName,
            locationName = dados.texto("location_name", "locationName") ?: padrao.locationName,
            locationAddress = dados.texto("location_address", "locationAddress") ?: padrao.locationAddress,
            locationId = dados.texto("location_id", "locationId") ?: padrao.locationId,
            fieldName = dados.texto("field_name", "fieldName") ?: padrao.fieldName,
            fieldId = dados.texto("field_id", "fieldId") ?: padrao.fieldId,
            gameTime = dados.texto("game_time", "gameTime") ?: padrao.gameTime,
            gameEndTime = dados.texto("game_end_time", "gameEndTime") ?: padrao.gameEndTime,
            maxPlayers = dados.numero("max_players", "maxPlayers")?.toInt() ?: padrao.maxPlayers,
            dailyPrice = dados.numero("daily_price", "dailyPrice")?.toDouble() ?: padrao.dailyPrice,
            recurrence = dados.texto("recurrence", "recurrence") ?: padrao.recurrence,
            createdAt = dados.valor("created_at", "createdAt").emMillis()
        )
    }

    /**
     * `app_settings/gamification`, com os nomes que as functions leem
     * (`normalizeGamificationSettings`). Em camelCase, a edição do admin não valia no XP.
     */
    fun configuracoesGamificacao(settings: GamificationSettings): Map<String, Any?> = mapOf(
        "xp_presence" to settings.xpPresence,
        "xp_per_goal" to settings.xpPerGoal,
        "xp_per_assist" to settings.xpPerAssist,
        "xp_per_save" to settings.xpPerSave,
        "xp_clean_sheet" to settings.xpCleanSheet,
        "xp_win" to settings.xpWin,
        "xp_draw" to settings.xpDraw,
        "xp_mvp" to settings.xpMvp,
        "xp_streak_3" to settings.xpStreak3,
        "xp_streak_5" to settings.xpStreak5,
        "xp_streak_7" to settings.xpStreak7,
        "xp_streak_10" to settings.xpStreak10,
        "xp_worst_player_penalty" to settings.xpWorstPlayerPenalty,
        "updated_at" to FieldValue.serverTimestamp(),
        "updated_by" to settings.updatedBy
    )

    /** Lê `app_settings/gamification` em snake_case, com o camelCase antigo como reserva. */
    fun lerConfiguracoesGamificacao(dados: Map<String, Any?>): GamificationSettings {
        val p = GamificationSettings()
        fun inteiro(snake: String, camel: String, padrao: Int) = dados.numero(snake, camel)?.toInt() ?: padrao
        return GamificationSettings(
            xpPresence = inteiro("xp_presence", "xpPresence", p.xpPresence),
            xpPerGoal = inteiro("xp_per_goal", "xpPerGoal", p.xpPerGoal),
            xpPerAssist = inteiro("xp_per_assist", "xpPerAssist", p.xpPerAssist),
            xpPerSave = inteiro("xp_per_save", "xpPerSave", p.xpPerSave),
            xpCleanSheet = inteiro("xp_clean_sheet", "xpCleanSheet", p.xpCleanSheet),
            xpWin = inteiro("xp_win", "xpWin", p.xpWin),
            xpDraw = inteiro("xp_draw", "xpDraw", p.xpDraw),
            xpMvp = inteiro("xp_mvp", "xpMvp", p.xpMvp),
            xpStreak3 = inteiro("xp_streak_3", "xpStreak3", p.xpStreak3),
            xpStreak5 = inteiro("xp_streak_5", "xpStreak5", p.xpStreak5),
            xpStreak7 = inteiro("xp_streak_7", "xpStreak7", p.xpStreak7),
            xpStreak10 = inteiro("xp_streak_10", "xpStreak10", p.xpStreak10),
            xpWorstPlayerPenalty = inteiro("xp_worst_player_penalty", "xpWorstPlayerPenalty", p.xpWorstPlayerPenalty),
            updatedAt = dados.valor("updated_at", "updatedAt").emMillis() ?: p.updatedAt,
            updatedBy = dados.texto("updated_by", "updatedBy") ?: p.updatedBy
        )
    }

    // O nome em snake_case vale quando existe; o camelCase cobre documento gravado antes do #4645.
    private fun Map<String, Any?>.valor(snake: String, camel: String): Any? =
        if (containsKey(snake)) this[snake] else this[camel]

    private fun Map<String, Any?>.texto(snake: String, camel: String): String? = valor(snake, camel) as? String

    private fun Map<String, Any?>.numero(snake: String, camel: String): Number? = valor(snake, camel) as? Number

    private fun Any?.emMillis(): Long? = when (this) {
        is Timestamp -> toDate().time
        is Date -> time
        is Number -> toLong()
        else -> null
    }
}
