package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.DocumentSnapshot
import dev.gitlive.firebase.firestore.FieldPath
import dev.gitlive.firebase.firestore.FieldValue
import dev.gitlive.firebase.firestore.Query
import dev.gitlive.firebase.firestore.Timestamp
import kotlinx.datetime.Instant

// ========== PRIVATE HELPERS ==========

internal fun instantFromTimestamp(timestamp: Timestamp): Instant {
    return Instant.fromEpochSeconds(timestamp.seconds, timestamp.nanoseconds.toLong())
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.safeLong(field: String): Long? {
    val value = getScalar(field)
    return when (value) {
        is Number -> value.toLong()
        is Timestamp -> value.seconds * 1000L + value.nanoseconds / 1_000_000
        is String -> value.toLongOrNull()
        else -> null
    }
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.safeInt(field: String): Int? = safeLong(field)?.toInt()

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toUserOrNull(): User? {
    if (!exists) return null
    return User(
        id = id, email = tryGet<String>("email") ?: "", name = tryGet<String>("name") ?: "",
        phone = tryGet<String>("phone"), nickname = tryGet<String>("nickname"),
        photoUrl = tryGet<String>("photo_url") ?: tryGet<String>("photoUrl"),
        fcmToken = tryGet<String>("fcm_token") ?: tryGet<String>("fcmToken"),
        isSearchable = tryGet<Boolean>("is_searchable") ?: tryGet<Boolean>("isSearchable") ?: true,
        isProfilePublic = tryGet<Boolean>("is_profile_public") ?: tryGet<Boolean>("isProfilePublic") ?: true,
        role = tryGet<String>("role") ?: UserRole.PLAYER.name,
        createdAt = safeLong("created_at") ?: safeLong("createdAt"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt"),
        strikerRating = tryGet<Double>("striker_rating") ?: tryGet<Double>("strikerRating") ?: 0.0,
        midRating = tryGet<Double>("mid_rating") ?: tryGet<Double>("midRating") ?: 0.0,
        defenderRating = tryGet<Double>("defender_rating") ?: tryGet<Double>("defenderRating") ?: 0.0,
        gkRating = tryGet<Double>("gk_rating") ?: tryGet<Double>("gkRating") ?: 0.0,
        strikerRatingSet = tryGet<Boolean>("striker_rating_set") ?: tryGet<Boolean>("strikerRatingSet") ?: false,
        midRatingSet = tryGet<Boolean>("mid_rating_set") ?: tryGet<Boolean>("midRatingSet") ?: false,
        defenderRatingSet = tryGet<Boolean>("defender_rating_set") ?: tryGet<Boolean>("defenderRatingSet") ?: false,
        gkRatingSet = tryGet<Boolean>("gk_rating_set") ?: tryGet<Boolean>("gkRatingSet") ?: false,
        preferredPosition = tryGet<String>("preferred_position") ?: tryGet<String>("preferredPosition"),
        preferredFieldTypes = ((getStringList("preferred_field_types") ?: getStringList("preferredFieldTypes")))?.mapNotNull { item ->
            (item as? String)?.let { name -> try { FieldType.valueOf(name) } catch (e: Exception) { null } }
        } ?: emptyList(),
        favoriteTeam = tryGet<String>("favorite_team") ?: tryGet<String>("favoriteTeam"),
        birthDate = safeLong("birth_date") ?: safeLong("birthDate"),
        gender = tryGet<String>("gender"), heightCm = safeInt("height_cm") ?: safeInt("heightCm"),
        weightKg = safeInt("weight_kg") ?: safeInt("weightKg"),
        dominantFoot = tryGet<String>("dominant_foot") ?: tryGet<String>("dominantFoot"),
        primaryPosition = tryGet<String>("primary_position") ?: tryGet<String>("primaryPosition"),
        secondaryPosition = tryGet<String>("secondary_position") ?: tryGet<String>("secondaryPosition"),
        playStyle = tryGet<String>("play_style") ?: tryGet<String>("playStyle"),
        experienceYears = safeInt("experience_years") ?: safeInt("experienceYears"),
        level = safeInt("level") ?: 1,
        experiencePoints = safeLong("experience_points") ?: safeLong("experiencePoints") ?: 0L,
        milestonesAchieved = ((getStringList("milestones_achieved") ?: getStringList("milestonesAchieved")))?.mapNotNull { it as? String } ?: emptyList(),
        autoStrikerRating = tryGet<Double>("auto_striker_rating") ?: 0.0, autoMidRating = tryGet<Double>("auto_mid_rating") ?: 0.0,
        autoDefenderRating = tryGet<Double>("auto_defender_rating") ?: 0.0, autoGkRating = tryGet<Double>("auto_gk_rating") ?: 0.0,
        autoRatingSamples = safeInt("auto_rating_samples") ?: 0
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGameOrNull(): Game? {
    if (!exists) return null
    return Game(
        id = id, scheduleId = tryGet<String>("schedule_id") ?: tryGet<String>("scheduleId") ?: "",
        date = tryGet<String>("date") ?: "", time = tryGet<String>("time") ?: "",
        endTime = tryGet<String>("end_time") ?: tryGet<String>("endTime") ?: "",
        status = tryGet<String>("status") ?: GameStatus.SCHEDULED.name,
        maxPlayers = safeInt("max_players") ?: safeInt("maxPlayers") ?: 14,
        maxGoalkeepers = safeInt("max_goalkeepers") ?: safeInt("maxGoalkeepers") ?: 3,
        playersCount = safeInt("players_count") ?: safeInt("playersCount") ?: 0,
        goalkeepersCount = safeInt("goalkeepers_count") ?: safeInt("goalkeepersCount") ?: 0,
        dailyPrice = tryGet<Double>("daily_price") ?: tryGet<Double>("dailyPrice") ?: 0.0,
        totalCost = tryGet<Double>("total_cost") ?: tryGet<Double>("totalCost") ?: 0.0,
        pixKey = tryGet<String>("pix_key") ?: tryGet<String>("pixKey") ?: "",
        numberOfTeams = safeInt("number_of_teams") ?: safeInt("numberOfTeams") ?: 2,
        ownerId = tryGet<String>("owner_id") ?: tryGet<String>("ownerId") ?: "",
        ownerName = tryGet<String>("owner_name") ?: tryGet<String>("ownerName") ?: "",
        locationId = tryGet<String>("location_id") ?: tryGet<String>("locationId") ?: "",
        fieldId = tryGet<String>("field_id") ?: tryGet<String>("fieldId") ?: "",
        locationName = tryGet<String>("location_name") ?: tryGet<String>("locationName") ?: "",
        locationAddress = tryGet<String>("location_address") ?: tryGet<String>("locationAddress") ?: "",
        locationLat = tryGet<Double>("location_lat") ?: tryGet<Double>("locationLat"),
        locationLng = tryGet<Double>("location_lng") ?: tryGet<Double>("locationLng"),
        fieldName = tryGet<String>("field_name") ?: tryGet<String>("fieldName") ?: "",
        gameType = tryGet<String>("game_type") ?: tryGet<String>("gameType") ?: "Society",
        // Genero/categoria do jogo (Fase 4b) — sem este campo o read KMP/iOS
        // perdia o gender (caia em MIXED). Literal "MIXED" = GameGender.MIXED.name.
        gender = tryGet<String>("gender") ?: "MIXED",
        recurrence = tryGet<String>("recurrence") ?: "none",
        recurrenceIndex = safeInt("recurrence_index") ?: safeInt("recurrenceIndex"),
        recurrenceCount = safeInt("recurrence_count") ?: safeInt("recurrenceCount"),
        recurrenceEndDate = tryGet<String>("recurrence_end_date") ?: tryGet<String>("recurrenceEndDate"),
        visibility = tryGet<String>("visibility") ?: GameVisibility.GROUP_ONLY.name,
        createdAt = safeLong("created_at") ?: safeLong("createdAt"),
        xpProcessed = tryGet<Boolean>("xp_processed") ?: tryGet<Boolean>("xpProcessed") ?: false,
        xpProcessing = tryGet<Boolean>("xp_processing") ?: tryGet<Boolean>("xpProcessing") ?: false,
        xpRewardStatus = tryGet<String>("xp_reward_status") ?: tryGet<String>("xpRewardStatus"),
        xpRewardHeldAt = safeLong("xp_reward_held_at") ?: safeLong("xpRewardHeldAt"),
        xpRewardHoldReasons = ((getStringList("xp_reward_hold_reasons")
            ?: getStringList("xpRewardHoldReasons")))?.mapNotNull { it as? String } ?: emptyList(),
        xpRewardReviewDecision = tryGet<String>("xp_reward_review_decision") ?: tryGet<String>("xpRewardReviewDecision"),
        xpRewardReviewedAt = safeLong("xp_reward_reviewed_at") ?: safeLong("xpRewardReviewedAt"),
        xpRewardReviewedBy = tryGet<String>("xp_reward_reviewed_by") ?: tryGet<String>("xpRewardReviewedBy"),
        xpRewardReviewReason = tryGet<String>("xp_reward_review_reason") ?: tryGet<String>("xpRewardReviewReason"),
        xpRewardReviewPreviousStatus = tryGet<String>("xp_reward_review_previous_status") ?: tryGet<String>("xpRewardReviewPreviousStatus"),
        xpRewardReviewNewStatus = tryGet<String>("xp_reward_review_new_status") ?: tryGet<String>("xpRewardReviewNewStatus"),
        validationStatus = tryGet<String>("validation_status") ?: tryGet<String>("validationStatus"),
        validationScore = safeInt("validation_score") ?: safeInt("validationScore"),
        validationVersion = safeInt("validation_version") ?: safeInt("validationVersion"),
        validationUpdatedAt = safeLong("validation_updated_at") ?: safeLong("validationUpdatedAt"),
        validationMode = tryGet<String>("validation_mode") ?: tryGet<String>("validationMode"),
        validationReasons = ((getStringList("validation_reasons")
            ?: getStringList("validationReasons")))?.mapNotNull { it as? String } ?: emptyList(),
        mvpId = tryGet<String>("mvp_id") ?: tryGet<String>("mvpId"),
        bestGkId = tryGet<String>("best_gk_id") ?: tryGet<String>("bestGkId"),
        worstPlayerId = tryGet<String>("worst_player_id") ?: tryGet<String>("worstPlayerId"),
        mvpVotes = safeInt("mvp_votes") ?: safeInt("mvpVotes") ?: 0,
        mvpTotalVotes = safeInt("mvp_total_votes") ?: safeInt("mvpTotalVotes") ?: 0,
        bestGkVotes = safeInt("best_gk_votes") ?: safeInt("bestGkVotes") ?: 0,
        bestGkTotalVotes = safeInt("best_gk_total_votes") ?: safeInt("bestGkTotalVotes") ?: 0,
        worstPlayerVotes = safeInt("worst_player_votes") ?: safeInt("worstPlayerVotes") ?: 0,
        worstPlayerTotalVotes = safeInt("worst_player_total_votes") ?: safeInt("worstPlayerTotalVotes") ?: 0,
        votingStatus = tryGet<String>("voting_status") ?: tryGet<String>("votingStatus"),
        votingConcluded = tryGet<Boolean>("voting_concluded") ?: tryGet<Boolean>("votingConcluded") ?: false,
        votingConcludedAt = safeLong("voting_concluded_at") ?: safeLong("votingConcludedAt"),
        votingSubmittedCount = safeInt("voting_submitted_count") ?: safeInt("votingSubmittedCount") ?: 0,
        voteResultReactions = (getLooseMap("vote_result_reactions")
            ?: getLooseMap("voteResultReactions"))
            ?.mapNotNull { (emoji, users) ->
                val key = emoji as? String ?: return@mapNotNull null
                key to (users as? List<*>)?.filterIsInstance<String>().orEmpty()
            }
            ?.toMap()
            .orEmpty(),
        winnerTeam = tryGet<String>("winner_team") ?: tryGet<String>("winnerTeam"),
        team1Score = safeInt("team1_score") ?: safeInt("team1Score") ?: 0,
        team2Score = safeInt("team2_score") ?: safeInt("team2Score") ?: 0,
        team1Name = tryGet<String>("team1_name") ?: tryGet<String>("team1Name") ?: "Time 1",
        team2Name = tryGet<String>("team2_name") ?: tryGet<String>("team2Name") ?: "Time 2",
        groupId = tryGet<String>("group_id") ?: tryGet<String>("groupId"),
        groupName = tryGet<String>("group_name") ?: tryGet<String>("groupName")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGameConfirmationOrNull(): GameConfirmation? {
    if (!exists) return null
    return GameConfirmation(
        id = id, gameId = tryGet<String>("game_id") ?: tryGet<String>("gameId") ?: "",
        userId = tryGet<String>("user_id") ?: tryGet<String>("userId") ?: "",
        userName = tryGet<String>("user_name") ?: tryGet<String>("userName") ?: "",
        userPhoto = tryGet<String>("user_photo") ?: tryGet<String>("userPhoto"),
        position = tryGet<String>("position") ?: "FIELD",
        teamId = tryGet<String>("team_id") ?: tryGet<String>("teamId"),
        status = tryGet<String>("status") ?: ConfirmationStatus.CONFIRMED.name,
        paymentStatus = tryGet<String>("payment_status") ?: tryGet<String>("paymentStatus") ?: PaymentStatus.PENDING.name,
        isCasualPlayer = tryGet<Boolean>("is_casual_player") ?: tryGet<Boolean>("isCasualPlayer") ?: false,
        goals = safeInt("goals") ?: 0, assists = safeInt("assists") ?: 0, saves = safeInt("saves") ?: 0,
        yellowCards = safeInt("yellow_cards") ?: safeInt("yellowCards") ?: 0,
        redCards = safeInt("red_cards") ?: safeInt("redCards") ?: 0,
        nickname = tryGet<String>("nickname"), xpEarned = safeInt("xp_earned") ?: safeInt("xpEarned") ?: 0,
        isMvp = tryGet<Boolean>("is_mvp") ?: tryGet<Boolean>("isMvp") ?: false,
        isBestGk = tryGet<Boolean>("is_best_gk") ?: tryGet<Boolean>("isBestGk") ?: false,
        isWorstPlayer = tryGet<Boolean>("is_worst_player") ?: tryGet<Boolean>("isWorstPlayer") ?: false,
        confirmedAt = safeLong("confirmed_at") ?: safeLong("confirmedAt"),
        partialPayment = tryGet<Double>("partial_payment") ?: tryGet<Double>("partialPayment") ?: 0.0,
        expectedPayment = tryGet<Double>("expected_payment") ?: tryGet<Double>("expectedPayment") ?: 0.0,
        expectedPaymentCents = safeLong("expected_payment_cents") ?: safeLong("expectedPaymentCents") ?: 0,
        wasPresent = tryGet<Boolean>("was_present") ?: tryGet<Boolean>("wasPresent") ?: false
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toStatisticsOrNull(): Statistics? {
    if (!exists) return null
    // Suporta tanto os nomes snake_case (escritor Android legado) quanto os nomes
    // camelCase gravados pelas Cloud Functions (`functions/src/index.ts`, `mvp-voting.ts`).
    return Statistics(
        id = id, userId = tryGet<String>("user_id") ?: tryGet<String>("userId") ?: id,
        totalGames = safeInt("total_games") ?: safeInt("totalGames") ?: 0,
        totalGoals = safeInt("total_goals") ?: safeInt("totalGoals") ?: 0,
        totalAssists = safeInt("total_assists") ?: safeInt("totalAssists") ?: 0,
        totalSaves = safeInt("total_saves") ?: safeInt("totalSaves") ?: 0,
        totalWins = safeInt("total_wins") ?: safeInt("totalWins") ?: safeInt("gamesWon") ?: 0,
        totalDraws = safeInt("total_draws") ?: safeInt("totalDraws") ?: safeInt("gamesDraw") ?: 0,
        totalLosses = safeInt("total_losses") ?: safeInt("totalLosses") ?: safeInt("gamesLost") ?: 0,
        mvpCount = safeInt("mvp_count") ?: safeInt("mvpCount") ?: safeInt("bestPlayerCount") ?: 0,
        bestGkCount = safeInt("best_gk_count") ?: safeInt("bestGkCount") ?: 0,
        worstPlayerCount = safeInt("worst_player_count") ?: safeInt("worstPlayerCount") ?: 0,
        currentStreak = safeInt("current_streak") ?: safeInt("currentStreak") ?: safeInt("currentMvpStreak") ?: 0,
        bestStreak = safeInt("best_streak") ?: safeInt("bestStreak") ?: safeInt("bestMvpStreak") ?: 0,
        yellowCards = safeInt("yellow_cards") ?: safeInt("yellowCards") ?: safeInt("totalYellowCards") ?: 0,
        redCards = safeInt("red_cards") ?: safeInt("redCards") ?: safeInt("totalRedCards") ?: 0,
        lastGameDate = safeLong("last_game_date") ?: safeLong("lastGameDate"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toUserGroupOrNull(): UserGroup? {
    if (!exists) return null
    return UserGroup(
        id = id, userId = tryGet<String>("user_id") ?: tryGet<String>("userId") ?: "",
        groupId = tryGet<String>("group_id") ?: tryGet<String>("groupId") ?: "",
        groupName = tryGet<String>("group_name") ?: tryGet<String>("groupName") ?: "",
        groupPhoto = tryGet<String>("group_photo") ?: tryGet<String>("groupPhoto"),
        role = tryGet<String>("role") ?: GroupMemberRole.MEMBER.name,
        joinedAt = safeLong("joined_at") ?: safeLong("joinedAt")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toTeamOrNull(): Team? {
    if (!exists) return null
    return Team(
        id = id, gameId = tryGet<String>("game_id") ?: tryGet<String>("gameId") ?: "",
        name = tryGet<String>("name") ?: "", color = tryGet<String>("color") ?: "",
        playerIds = (getStringList("player_ids") ?: getStringList("playerIds"))?.filterIsInstance<String>() ?: emptyList(),
        score = safeInt("score") ?: 0
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toXpLogOrNull(): XpLog? {
    if (!exists) return null
    return XpLog(
        id = id, userId = tryGet<String>("user_id") ?: tryGet<String>("userId") ?: "",
        gameId = tryGet<String>("game_id") ?: tryGet<String>("gameId") ?: "",
        xpEarned = safeLong("xp_earned") ?: safeLong("xpEarned") ?: 0L,
        xpBefore = safeLong("xp_before") ?: safeLong("xpBefore") ?: 0L,
        xpAfter = safeLong("xp_after") ?: safeLong("xpAfter") ?: 0L,
        levelBefore = safeInt("level_before") ?: safeInt("levelBefore") ?: 1,
        levelAfter = safeInt("level_after") ?: safeInt("levelAfter") ?: 1,
        xpParticipation = safeInt("xp_participation") ?: 0, xpGoals = safeInt("xp_goals") ?: 0,
        xpAssists = safeInt("xp_assists") ?: 0, xpSaves = safeInt("xp_saves") ?: 0,
        xpResult = safeInt("xp_result") ?: 0, xpMvp = safeInt("xp_mvp") ?: 0,
        xpMilestones = safeInt("xp_milestones") ?: 0, xpStreak = safeInt("xp_streak") ?: 0,
        xpTopScorer = safeInt("xp_top_scorer") ?: 0,
        xpHatTrick = safeInt("xp_hat_trick") ?: 0,
        xpFirstGoal = safeInt("xp_first_goal") ?: 0,
        xpGoalkeeperGoal = safeInt("xp_goalkeeper_goal") ?: 0,
        xpFairPlay = safeInt("xp_fair_play") ?: 0,
        xpComeback = safeInt("xp_comeback") ?: 0,
        xpFirstGameMonth =
            safeInt("xp_first_game_month")
                ?: safeInt("xp_first_game_of_month")
                ?: 0,
        xpMonthlyStreak = safeInt("xp_monthly_streak") ?: 0,
        xpRecorder =
            safeInt("xp_recorder")
                ?: safeInt("xp_event_recorder")
                ?: 0,
        xpEarlyConfirmation = safeInt("xp_early_confirmation") ?: 0,
        xpOnTimeCheckin = safeInt("xp_on_time_checkin") ?: 0,
        xpLastMinuteSaver = safeInt("xp_last_minute_saver") ?: 0,
        xpWaitlistPromoted = safeInt("xp_waitlist_promoted") ?: 0,
        goals = safeInt("goals") ?: 0, assists = safeInt("assists") ?: 0, saves = safeInt("saves") ?: 0,
        wasMvp = tryGet<Boolean>("was_mvp") ?: tryGet<Boolean>("wasMvp") ?: false,
        gameResult = tryGet<String>("game_result") ?: tryGet<String>("gameResult") ?: "",
        milestonesUnlocked = (getStringList("milestones_unlocked") ?: getStringList("milestonesUnlocked"))?.filterIsInstance<String>() ?: emptyList(),
        createdAt = safeLong("created_at") ?: safeLong("createdAt")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGameEventOrNull(): GameEvent? {
    if (!exists) return null
    return GameEvent(
        id = id, gameId = tryGet<String>("game_id") ?: tryGet<String>("gameId") ?: "",
        eventType = tryGet<String>("event_type") ?: tryGet<String>("eventType") ?: GameEventType.GOAL.name,
        playerId = tryGet<String>("player_id") ?: tryGet<String>("playerId") ?: "",
        playerName = tryGet<String>("player_name") ?: tryGet<String>("playerName") ?: "",
        teamId = tryGet<String>("team_id") ?: tryGet<String>("teamId") ?: "",
        assistedById = tryGet<String>("assisted_by_id") ?: tryGet<String>("assistedById"),
        assistedByName = tryGet<String>("assisted_by_name") ?: tryGet<String>("assistedByName"),
        minute = safeInt("minute") ?: 0, createdBy = tryGet<String>("created_by") ?: tryGet<String>("createdBy") ?: "",
        createdAt = safeLong("created_at") ?: safeLong("createdAt")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toLiveScoreOrNull(): LiveScore? {
    if (!exists) return null
    val team1Id = tryGet<String>("team1_id") ?: tryGet<String>("team1Id") ?: ""
    val team1Score = safeInt("team1_score") ?: safeInt("team1Score") ?: 0
    val team2Id = tryGet<String>("team2_id") ?: tryGet<String>("team2Id") ?: ""
    val team2Score = safeInt("team2_score") ?: safeInt("team2Score") ?: 0
    return LiveScore(
        id = id, gameId = tryGet<String>("game_id") ?: tryGet<String>("gameId") ?: "",
        // #3942: mapa canônico scores (2-4 times) com fallback legado team1/team2.
        scores = readScoresMap(team1Id, team1Score, team2Id, team2Score),
        team1Id = team1Id,
        team1Score = team1Score,
        team2Id = team2Id,
        team2Score = team2Score,
        startedAt = safeLong("started_at") ?: safeLong("startedAt"),
        finishedAt = safeLong("finished_at") ?: safeLong("finishedAt")
    )
}

/**
 * Lê o mapa canônico de placares `scores: {<teamId>: n}` de um doc de
 * live_scores. Espelha `readScoresMap` do backend (functions): quando o
 * campo `scores` está ausente ou vazio (docs legados gravados antes de
 * #3942), reconstrói o mapa a partir de team1/team2 — garantindo
 * migração sem perda de dados e suporte a jogos LIVE já em andamento no
 * momento do deploy. Valores inválidos/negativos são normalizados para 0.
 */
internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.readScoresMap(
    team1Id: String,
    team1Score: Int,
    team2Id: String,
    team2Score: Int,
): Map<String, Int> {
    val rawScores = getLooseMap("scores")
    if (rawScores != null && rawScores.isNotEmpty()) {
        val canonical = buildMap {
            rawScores.forEach { (key, value) ->
                val teamId = key as? String
                if (!teamId.isNullOrEmpty()) {
                    val numeric = when (value) {
                        is Number -> value.toInt()
                        is String -> value.toIntOrNull()
                        else -> null
                    }
                    if (numeric != null) put(teamId, maxOf(0, numeric))
                }
            }
        }
        if (canonical.isNotEmpty()) return canonical
    }
    // Fallback legado: reconstitui o mapa a partir de team1/team2.
    val legacy = buildMap {
        if (team1Id.isNotEmpty()) put(team1Id, team1Score)
        if (team2Id.isNotEmpty()) put(team2Id, team2Score)
    }
    return legacy
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGroupOrNull(): Group? {
    if (!exists) return null
    return Group(
        id = id, name = tryGet<String>("name") ?: "", description = tryGet<String>("description") ?: "",
        photoUrl = tryGet<String>("photo_url") ?: tryGet<String>("photoUrl"),
        ownerId = tryGet<String>("owner_id") ?: tryGet<String>("ownerId") ?: "",
        ownerName = tryGet<String>("owner_name") ?: tryGet<String>("ownerName") ?: "",
        membersCount = safeInt("members_count") ?: safeInt("membersCount") ?: 0,
        gamesCount = safeInt("games_count") ?: safeInt("gamesCount") ?: 0,
        isPublic = tryGet<Boolean>("is_public") ?: tryGet<Boolean>("isPublic") ?: false,
        inviteCode = tryGet<String>("invite_code") ?: tryGet<String>("inviteCode"),
        pixKey = tryGet<String>("pix_key") ?: tryGet<String>("pixKey"),
        defaultLocationId = tryGet<String>("default_location_id") ?: tryGet<String>("defaultLocationId"),
        defaultLocationName = tryGet<String>("default_location_name") ?: tryGet<String>("defaultLocationName"),
        defaultDayOfWeek = safeInt("default_day_of_week") ?: safeInt("defaultDayOfWeek"),
        defaultTime = tryGet<String>("default_time") ?: tryGet<String>("defaultTime"),
        defaultMaxPlayers = safeInt("default_max_players") ?: safeInt("defaultMaxPlayers") ?: 14,
        defaultPrice = tryGet<Double>("default_price") ?: tryGet<Double>("defaultPrice") ?: 0.0,
        // Genero padrao do grupo (Fase 4b) — sem este campo a pre-selecao do
        // gender na criacao de jogo caia sempre em MIXED.
        defaultGender = tryGet<String>("default_gender") ?: tryGet<String>("defaultGender"),
        createdAt = safeLong("created_at") ?: safeLong("createdAt"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGroupMemberOrNull(): GroupMember? {
    if (!exists) return null
    val userId = tryGet<String>("user_id") ?: tryGet<String>("userId") ?: id
    val groupIdFromPath = reference.parent.parent?.id ?: ""
    return GroupMember(
        id = id, groupId = tryGet<String>("group_id") ?: tryGet<String>("groupId") ?: groupIdFromPath,
        userId = userId, userName = tryGet<String>("user_name") ?: tryGet<String>("userName") ?: "",
        userPhoto = tryGet<String>("user_photo") ?: tryGet<String>("userPhoto"),
        role = tryGet<String>("role") ?: GroupMemberRole.MEMBER.name,
        nickname = tryGet<String>("nickname"),
        joinedAt = safeLong("joined_at") ?: safeLong("joinedAt"),
        gamesPlayed = safeInt("games_played") ?: safeInt("gamesPlayed") ?: 0,
        goals = safeInt("goals") ?: 0, assists = safeInt("assists") ?: 0
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toPaymentOrNull(): Payment? {
    if (!exists) return null
    val typeStr = tryGet<String>("type") ?: PaymentType.DAILY.name
    val statusStr = tryGet<String>("status") ?: PaymentStatus.PENDING.name
    val methodStr = tryGet<String>("payment_method")
    return Payment(
        id = id, userId = tryGet<String>("user_id") ?: "", gameId = tryGet<String>("game_id"),
        scheduleId = tryGet<String>("schedule_id"),
        type = try { PaymentType.valueOf(typeStr) } catch (e: Exception) { PaymentType.DAILY },
        amount = tryGet<Double>("amount") ?: 0.0,
        status = try { PaymentStatus.valueOf(statusStr) } catch (e: Exception) { PaymentStatus.PENDING },
        paymentMethod = methodStr?.let { try { PaymentMethod.valueOf(it) } catch (e: Exception) { null } },
        dueDate = tryGet<String>("due_date") ?: "", paidAt = safeLong("paid_at"),
        pixKey = tryGet<String>("pix_key"), pixQrcode = tryGet<String>("pix_qrcode"),
        pixTxid = tryGet<String>("pix_txid"), receiptUrl = tryGet<String>("receipt_url"),
        notes = tryGet<String>("notes"), createdAt = safeLong("created_at")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toRankingStatisticsOrNull(): Statistics? {
    if (!exists) return null
    return Statistics(
        id = id, userId = tryGet<String>("user_id") ?: tryGet<String>("userId") ?: "",
        totalGames = tryGet<Long>("totalGames")?.toInt() ?: tryGet<Long>("total_games")?.toInt() ?: 0,
        totalGoals = tryGet<Long>("totalGoals")?.toInt() ?: tryGet<Long>("total_goals")?.toInt() ?: 0,
        totalAssists = tryGet<Long>("totalAssists")?.toInt() ?: tryGet<Long>("total_assists")?.toInt() ?: 0,
        totalSaves = tryGet<Long>("totalSaves")?.toInt() ?: tryGet<Long>("total_saves")?.toInt() ?: 0,
        totalWins = tryGet<Long>("totalWins")?.toInt() ?: tryGet<Long>("total_wins")?.toInt() ?: 0,
        totalDraws = tryGet<Long>("totalDraws")?.toInt() ?: tryGet<Long>("total_draws")?.toInt() ?: 0,
        totalLosses = tryGet<Long>("totalLosses")?.toInt() ?: tryGet<Long>("total_losses")?.toInt() ?: 0,
        mvpCount = tryGet<Long>("mvpCount")?.toInt() ?: tryGet<Long>("mvp_count")?.toInt() ?: 0,
        bestGkCount = tryGet<Long>("bestGkCount")?.toInt() ?: tryGet<Long>("best_gk_count")?.toInt() ?: 0,
        worstPlayerCount = tryGet<Long>("worstPlayerCount")?.toInt() ?: tryGet<Long>("worst_player_count")?.toInt() ?: 0,
        currentStreak = tryGet<Long>("currentStreak")?.toInt() ?: tryGet<Long>("current_streak")?.toInt() ?: 0,
        bestStreak = tryGet<Long>("bestStreak")?.toInt() ?: tryGet<Long>("best_streak")?.toInt() ?: 0,
        yellowCards = tryGet<Long>("yellowCards")?.toInt() ?: tryGet<Long>("yellow_cards")?.toInt() ?: 0,
        redCards = tryGet<Long>("redCards")?.toInt() ?: tryGet<Long>("red_cards")?.toInt() ?: 0,
        lastGameDate = safeLong("last_game_date") ?: safeLong("lastGameDate"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toUserStreakOrNull(): UserStreak? {
    if (!exists) return null
    return UserStreak(
        id = id, userId = tryGet<String>("user_id") ?: "", scheduleId = tryGet<String>("schedule_id"),
        currentStreak = tryGet<Long>("current_streak")?.toInt() ?: 0,
        longestStreak = tryGet<Long>("longest_streak")?.toInt() ?: 0,
        lastGameDate = tryGet<String>("last_game_date"), streakStartedAt = tryGet<String>("streak_started_at")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toBadgeDefinitionOrNull(): BadgeDefinition? {
    if (!exists) return null
    val categoryStr = tryGet<String>("category") ?: "PERFORMANCE"
    val rarityStr = tryGet<String>("rarity") ?: "COMMON"
    return BadgeDefinition(
        id = id, name = tryGet<String>("name") ?: "", description = tryGet<String>("description") ?: "",
        emoji = tryGet<String>("emoji") ?: "",
        category = try { BadgeCategory.valueOf(categoryStr) } catch (e: Exception) { BadgeCategory.PERFORMANCE },
        rarity = try { BadgeRarity.valueOf(rarityStr) } catch (e: Exception) { BadgeRarity.COMMON },
        requiredValue = tryGet<Long>("required_value")?.toInt() ?: 1,
        isHidden = tryGet<Boolean>("is_hidden") ?: false
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toUserBadgeOrNull(): UserBadge? {
    if (!exists) return null
    return UserBadge(
        id = id, userId = tryGet<String>("user_id") ?: "", badgeId = tryGet<String>("badge_id") ?: "",
        unlockedAt = safeLong("unlocked_at") ?: 0,
        unlockCount = tryGet<Long>("unlock_count")?.toInt() ?: tryGet<Long>("count")?.toInt() ?: 1
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toSeasonOrNull(): Season? {
    if (!exists) return null
    return Season(
        id = id, name = tryGet<String>("name") ?: "", description = tryGet<String>("description") ?: "",
        startDate = safeLong("start_date") ?: 0, endDate = safeLong("end_date") ?: 0,
        isActive = tryGet<Boolean>("is_active") ?: tryGet<Boolean>("isActive") ?: false,
        createdAt = safeLong("created_at"), closedAt = safeLong("closed_at"),
        totalParticipants = tryGet<Long>("total_participants")?.toInt() ?: 0,
        totalGames = tryGet<Long>("total_games")?.toInt() ?: 0
    )
}

/**
 * Normaliza o filtro de gênero para a chave do sub-mapa `by_gender` (Fase 4b).
 * null/ausente/inválido = null (combinado, campos planos). MALE/FEMALE/MIXED
 * = segmentado. Tolerante a case (mesma semântica de GameGender.fromString,
 * mas SEM colapsar inválido em MIXED — aqui inválido vira combinado).
 */
internal fun normalizeSeasonGenderKey(raw: String?): String? {
    val up = raw?.trim()?.uppercase() ?: return null
    return if (up == "MALE" || up == "FEMALE" || up == "MIXED") up else null
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toSeasonParticipationOrNull(
    genderKey: String? = null
): SeasonParticipation? {
    if (!exists) return null

    // Fase 4b: quando segmentado, as stats vêm do sub-mapa by_gender.{G}.
    // Valores aninhados chegam como Any? (GitLive não garante Long) → ler como
    // Number. Campos fora do sub-mapa (division/rating/saves/streaks/xp)
    // permanecem GLOBAIS, espelhando web e functions.
    val seg: Map<*, *>? = if (genderKey != null) {
        (getLooseMap("by_gender"))?.get(genderKey) as? Map<*, *>
    } else null
    // Quando o sub-mapa existe, ele é AUTORITATIVO (chave ausente = 0), para
    // nunca vazar o valor combinado plano dentro da visão segmentada. Sem
    // sub-mapa (combinado, ou doc legado sem by_gender) usa o fallback plano.
    fun stat(key: String, flat: () -> Int): Int =
        if (seg != null) (seg[key] as? Number)?.toInt() ?: 0 else flat()

    return SeasonParticipation(
        id = id, seasonId = tryGet<String>("season_id") ?: "", userId = tryGet<String>("user_id") ?: "",
        division = tryGet<String>("division") ?: LeagueDivision.BRONZE.name,
        leagueRating = tryGet<Long>("league_rating")?.toInt() ?: 1000,
        points = stat("points") { tryGet<Long>("points")?.toInt() ?: 0 },
        gamesPlayed = stat("games_played") { tryGet<Long>("games_played")?.toInt() ?: 0 },
        wins = stat("wins") { tryGet<Long>("wins")?.toInt() ?: 0 },
        draws = stat("draws") { tryGet<Long>("draws")?.toInt() ?: 0 },
        losses = stat("losses") { tryGet<Long>("losses")?.toInt() ?: 0 },
        goals = stat("goals_scored") { tryGet<Long>("goals")?.toInt() ?: tryGet<Long>("goals_scored")?.toInt() ?: 0 },
        assists = stat("assists") { tryGet<Long>("assists")?.toInt() ?: 0 },
        saves = tryGet<Long>("saves")?.toInt() ?: 0,
        mvpCount = stat("mvp_count") { tryGet<Long>("mvp_count")?.toInt() ?: 0 },
        bestGkCount = tryGet<Long>("best_gk_count")?.toInt() ?: 0,
        worstPlayerCount = tryGet<Long>("worst_player_count")?.toInt() ?: 0,
        currentStreak = tryGet<Long>("current_streak")?.toInt() ?: 0,
        bestStreak = tryGet<Long>("best_streak")?.toInt() ?: 0,
        xpEarned = tryGet<Long>("xp_earned") ?: 0L,
        createdAt = safeLong("created_at"), updatedAt = safeLong("updated_at")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toWeeklyChallengeOrNull(): WeeklyChallenge? {
    if (!exists) return null
    val typeStr = tryGet<String>("type") ?: "score_goals"
    return WeeklyChallenge(
        id = id, name = tryGet<String>("name") ?: "", description = tryGet<String>("description") ?: "",
        type = try { ChallengeType.valueOf(typeStr) } catch (e: Exception) { ChallengeType.SCORE_GOALS },
        targetValue = tryGet<Long>("target_value")?.toInt() ?: 0,
        xpReward = tryGet<Long>("xp_reward") ?: 100L,
        startDate = tryGet<String>("start_date") ?: "", endDate = tryGet<String>("end_date") ?: "",
        isActive = tryGet<Boolean>("is_active") ?: true, scheduleId = tryGet<String>("schedule_id")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toUserChallengeProgressOrNull(): UserChallengeProgress? {
    if (!exists) return null
    return UserChallengeProgress(
        id = id, userId = tryGet<String>("user_id") ?: "", challengeId = tryGet<String>("challenge_id") ?: "",
        currentProgress = tryGet<Long>("current_progress")?.toInt() ?: 0,
        isCompleted = tryGet<Boolean>("is_completed") ?: false, completedAt = safeLong("completed_at")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toAppNotificationOrNull(): AppNotification? {
    if (!exists) return null
    val typeStr = tryGet<String>("type") ?: NotificationType.GENERAL.name
    val actionTypeStr = tryGet<String>("action_type")
    return AppNotification(
        id = id, userId = tryGet<String>("user_id") ?: "",
        type = NotificationType.fromString(typeStr), title = tryGet<String>("title") ?: "",
        message = tryGet<String>("message") ?: "", senderId = tryGet<String>("sender_id"),
        senderName = tryGet<String>("sender_name"), senderPhoto = tryGet<String>("sender_photo"),
        referenceId = tryGet<String>("reference_id"), referenceType = tryGet<String>("reference_type"),
        actionType = NotificationAction.fromString(actionTypeStr),
        read = tryGet<Boolean>("read") ?: false, readAt = safeLong("read_at"),
        createdAt = safeLong("created_at"), expiresAt = safeLong("expires_at")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toActivityOrNull(): Activity? {
    if (!exists) return null
    return Activity(
        id = id, userId = tryGet<String>("user_id") ?: "", userName = tryGet<String>("user_name") ?: "",
        userPhoto = tryGet<String>("user_photo"), type = ActivityType.fromString(tryGet<String>("type")),
        title = tryGet<String>("title") ?: "", description = tryGet<String>("description") ?: "",
        referenceId = tryGet<String>("reference_id"), referenceType = tryGet<String>("reference_type"),
        metadata = (getLooseMap("metadata") as? Map<String, String>) ?: emptyMap(),
        createdAt = safeLong("created_at"), visibility = ActivityVisibility.fromString(tryGet<String>("visibility"))
    )
}

internal fun activityToMap(activity: Activity): Map<String, Any?> {
    return mapOf(
        "user_id" to activity.userId, "user_name" to activity.userName, "user_photo" to activity.userPhoto,
        "type" to activity.type, "title" to activity.title, "description" to activity.description,
        "reference_id" to activity.referenceId, "reference_type" to activity.referenceType,
        "metadata" to activity.metadata, "created_at" to FieldValue.serverTimestamp,
        "visibility" to activity.visibility
    )
}

