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
    val value = get<Any?>(field)
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
        id = id, email = get<String?>("email") ?: "", name = get<String?>("name") ?: "",
        phone = get<String?>("phone"), nickname = get<String?>("nickname"),
        photoUrl = get<String?>("photo_url") ?: get<String?>("photoUrl"),
        fcmToken = get<String?>("fcm_token") ?: get<String?>("fcmToken"),
        isSearchable = get<Boolean?>("is_searchable") ?: get<Boolean?>("isSearchable") ?: true,
        isProfilePublic = get<Boolean?>("is_profile_public") ?: get<Boolean?>("isProfilePublic") ?: true,
        role = get<String?>("role") ?: UserRole.PLAYER.name,
        createdAt = safeLong("created_at") ?: safeLong("createdAt"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt"),
        strikerRating = get<Double?>("striker_rating") ?: get<Double?>("strikerRating") ?: 0.0,
        midRating = get<Double?>("mid_rating") ?: get<Double?>("midRating") ?: 0.0,
        defenderRating = get<Double?>("defender_rating") ?: get<Double?>("defenderRating") ?: 0.0,
        gkRating = get<Double?>("gk_rating") ?: get<Double?>("gkRating") ?: 0.0,
        strikerRatingSet = get<Boolean?>("striker_rating_set") ?: get<Boolean?>("strikerRatingSet") ?: false,
        midRatingSet = get<Boolean?>("mid_rating_set") ?: get<Boolean?>("midRatingSet") ?: false,
        defenderRatingSet = get<Boolean?>("defender_rating_set") ?: get<Boolean?>("defenderRatingSet") ?: false,
        gkRatingSet = get<Boolean?>("gk_rating_set") ?: get<Boolean?>("gkRatingSet") ?: false,
        preferredPosition = get<String?>("preferred_position") ?: get<String?>("preferredPosition"),
        preferredFieldTypes = ((get<List<*>?>("preferred_field_types") ?: get<List<*>?>("preferredFieldTypes")))?.mapNotNull { item ->
            (item as? String)?.let { name -> try { FieldType.valueOf(name) } catch (e: Exception) { null } }
        } ?: emptyList(),
        favoriteTeam = get<String?>("favorite_team") ?: get<String?>("favoriteTeam"),
        birthDate = safeLong("birth_date") ?: safeLong("birthDate"),
        gender = get<String?>("gender"), heightCm = safeInt("height_cm") ?: safeInt("heightCm"),
        weightKg = safeInt("weight_kg") ?: safeInt("weightKg"),
        dominantFoot = get<String?>("dominant_foot") ?: get<String?>("dominantFoot"),
        primaryPosition = get<String?>("primary_position") ?: get<String?>("primaryPosition"),
        secondaryPosition = get<String?>("secondary_position") ?: get<String?>("secondaryPosition"),
        playStyle = get<String?>("play_style") ?: get<String?>("playStyle"),
        experienceYears = safeInt("experience_years") ?: safeInt("experienceYears"),
        level = safeInt("level") ?: 1,
        experiencePoints = safeLong("experience_points") ?: safeLong("experiencePoints") ?: 0L,
        milestonesAchieved = ((get<List<*>?>("milestones_achieved") ?: get<List<*>?>("milestonesAchieved")))?.mapNotNull { it as? String } ?: emptyList(),
        autoStrikerRating = get<Double?>("auto_striker_rating") ?: 0.0, autoMidRating = get<Double?>("auto_mid_rating") ?: 0.0,
        autoDefenderRating = get<Double?>("auto_defender_rating") ?: 0.0, autoGkRating = get<Double?>("auto_gk_rating") ?: 0.0,
        autoRatingSamples = safeInt("auto_rating_samples") ?: 0
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGameOrNull(): Game? {
    if (!exists) return null
    return Game(
        id = id, scheduleId = get<String?>("schedule_id") ?: get<String?>("scheduleId") ?: "",
        date = get<String?>("date") ?: "", time = get<String?>("time") ?: "",
        endTime = get<String?>("end_time") ?: get<String?>("endTime") ?: "",
        status = get<String?>("status") ?: GameStatus.SCHEDULED.name,
        maxPlayers = safeInt("max_players") ?: safeInt("maxPlayers") ?: 14,
        maxGoalkeepers = safeInt("max_goalkeepers") ?: safeInt("maxGoalkeepers") ?: 3,
        playersCount = safeInt("players_count") ?: safeInt("playersCount") ?: 0,
        goalkeepersCount = safeInt("goalkeepers_count") ?: safeInt("goalkeepersCount") ?: 0,
        dailyPrice = get<Double?>("daily_price") ?: get<Double?>("dailyPrice") ?: 0.0,
        totalCost = get<Double?>("total_cost") ?: get<Double?>("totalCost") ?: 0.0,
        pixKey = get<String?>("pix_key") ?: get<String?>("pixKey") ?: "",
        numberOfTeams = safeInt("number_of_teams") ?: safeInt("numberOfTeams") ?: 2,
        ownerId = get<String?>("owner_id") ?: get<String?>("ownerId") ?: "",
        ownerName = get<String?>("owner_name") ?: get<String?>("ownerName") ?: "",
        locationId = get<String?>("location_id") ?: get<String?>("locationId") ?: "",
        fieldId = get<String?>("field_id") ?: get<String?>("fieldId") ?: "",
        locationName = get<String?>("location_name") ?: get<String?>("locationName") ?: "",
        locationAddress = get<String?>("location_address") ?: get<String?>("locationAddress") ?: "",
        locationLat = get<Double?>("location_lat") ?: get<Double?>("locationLat"),
        locationLng = get<Double?>("location_lng") ?: get<Double?>("locationLng"),
        fieldName = get<String?>("field_name") ?: get<String?>("fieldName") ?: "",
        gameType = get<String?>("game_type") ?: get<String?>("gameType") ?: "Society",
        // Genero/categoria do jogo (Fase 4b) — sem este campo o read KMP/iOS
        // perdia o gender (caia em MIXED). Literal "MIXED" = GameGender.MIXED.name.
        gender = get<String?>("gender") ?: "MIXED",
        recurrence = get<String?>("recurrence") ?: "none",
        recurrenceIndex = safeInt("recurrence_index") ?: safeInt("recurrenceIndex"),
        recurrenceCount = safeInt("recurrence_count") ?: safeInt("recurrenceCount"),
        recurrenceEndDate = get<String?>("recurrence_end_date") ?: get<String?>("recurrenceEndDate"),
        visibility = get<String?>("visibility") ?: GameVisibility.GROUP_ONLY.name,
        createdAt = safeLong("created_at") ?: safeLong("createdAt"),
        xpProcessed = get<Boolean?>("xp_processed") ?: get<Boolean?>("xpProcessed") ?: false,
        xpProcessing = get<Boolean?>("xp_processing") ?: get<Boolean?>("xpProcessing") ?: false,
        xpRewardStatus = get<String?>("xp_reward_status") ?: get<String?>("xpRewardStatus"),
        xpRewardHeldAt = safeLong("xp_reward_held_at") ?: safeLong("xpRewardHeldAt"),
        xpRewardHoldReasons = ((get<List<*>?>("xp_reward_hold_reasons")
            ?: get<List<*>?>("xpRewardHoldReasons")))?.mapNotNull { it as? String } ?: emptyList(),
        xpRewardReviewDecision = get<String?>("xp_reward_review_decision") ?: get<String?>("xpRewardReviewDecision"),
        xpRewardReviewedAt = safeLong("xp_reward_reviewed_at") ?: safeLong("xpRewardReviewedAt"),
        xpRewardReviewedBy = get<String?>("xp_reward_reviewed_by") ?: get<String?>("xpRewardReviewedBy"),
        xpRewardReviewReason = get<String?>("xp_reward_review_reason") ?: get<String?>("xpRewardReviewReason"),
        xpRewardReviewPreviousStatus = get<String?>("xp_reward_review_previous_status") ?: get<String?>("xpRewardReviewPreviousStatus"),
        xpRewardReviewNewStatus = get<String?>("xp_reward_review_new_status") ?: get<String?>("xpRewardReviewNewStatus"),
        validationStatus = get<String?>("validation_status") ?: get<String?>("validationStatus"),
        validationScore = safeInt("validation_score") ?: safeInt("validationScore"),
        validationVersion = safeInt("validation_version") ?: safeInt("validationVersion"),
        validationUpdatedAt = safeLong("validation_updated_at") ?: safeLong("validationUpdatedAt"),
        validationMode = get<String?>("validation_mode") ?: get<String?>("validationMode"),
        validationReasons = ((get<List<*>?>("validation_reasons")
            ?: get<List<*>?>("validationReasons")))?.mapNotNull { it as? String } ?: emptyList(),
        mvpId = get<String?>("mvp_id") ?: get<String?>("mvpId"),
        bestGkId = get<String?>("best_gk_id") ?: get<String?>("bestGkId"),
        worstPlayerId = get<String?>("worst_player_id") ?: get<String?>("worstPlayerId"),
        mvpVotes = safeInt("mvp_votes") ?: safeInt("mvpVotes") ?: 0,
        mvpTotalVotes = safeInt("mvp_total_votes") ?: safeInt("mvpTotalVotes") ?: 0,
        bestGkVotes = safeInt("best_gk_votes") ?: safeInt("bestGkVotes") ?: 0,
        bestGkTotalVotes = safeInt("best_gk_total_votes") ?: safeInt("bestGkTotalVotes") ?: 0,
        worstPlayerVotes = safeInt("worst_player_votes") ?: safeInt("worstPlayerVotes") ?: 0,
        worstPlayerTotalVotes = safeInt("worst_player_total_votes") ?: safeInt("worstPlayerTotalVotes") ?: 0,
        votingStatus = get<String?>("voting_status") ?: get<String?>("votingStatus"),
        votingConcluded = get<Boolean?>("voting_concluded") ?: get<Boolean?>("votingConcluded") ?: false,
        votingConcludedAt = safeLong("voting_concluded_at") ?: safeLong("votingConcludedAt"),
        votingSubmittedCount = safeInt("voting_submitted_count") ?: safeInt("votingSubmittedCount") ?: 0,
        voteResultReactions = (get<Map<*, *>?>("vote_result_reactions")
            ?: get<Map<*, *>?>("voteResultReactions"))
            ?.mapNotNull { (emoji, users) ->
                val key = emoji as? String ?: return@mapNotNull null
                key to (users as? List<*>)?.filterIsInstance<String>().orEmpty()
            }
            ?.toMap()
            .orEmpty(),
        winnerTeam = get<String?>("winner_team") ?: get<String?>("winnerTeam"),
        team1Score = safeInt("team1_score") ?: safeInt("team1Score") ?: 0,
        team2Score = safeInt("team2_score") ?: safeInt("team2Score") ?: 0,
        team1Name = get<String?>("team1_name") ?: get<String?>("team1Name") ?: "Time 1",
        team2Name = get<String?>("team2_name") ?: get<String?>("team2Name") ?: "Time 2",
        groupId = get<String?>("group_id") ?: get<String?>("groupId"),
        groupName = get<String?>("group_name") ?: get<String?>("groupName")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGameConfirmationOrNull(): GameConfirmation? {
    if (!exists) return null
    return GameConfirmation(
        id = id, gameId = get<String?>("game_id") ?: get<String?>("gameId") ?: "",
        userId = get<String?>("user_id") ?: get<String?>("userId") ?: "",
        userName = get<String?>("user_name") ?: get<String?>("userName") ?: "",
        userPhoto = get<String?>("user_photo") ?: get<String?>("userPhoto"),
        position = get<String?>("position") ?: "FIELD",
        teamId = get<String?>("team_id") ?: get<String?>("teamId"),
        status = get<String?>("status") ?: ConfirmationStatus.CONFIRMED.name,
        paymentStatus = get<String?>("payment_status") ?: get<String?>("paymentStatus") ?: PaymentStatus.PENDING.name,
        isCasualPlayer = get<Boolean?>("is_casual_player") ?: get<Boolean?>("isCasualPlayer") ?: false,
        goals = safeInt("goals") ?: 0, assists = safeInt("assists") ?: 0, saves = safeInt("saves") ?: 0,
        yellowCards = safeInt("yellow_cards") ?: safeInt("yellowCards") ?: 0,
        redCards = safeInt("red_cards") ?: safeInt("redCards") ?: 0,
        nickname = get<String?>("nickname"), xpEarned = safeInt("xp_earned") ?: safeInt("xpEarned") ?: 0,
        isMvp = get<Boolean?>("is_mvp") ?: get<Boolean?>("isMvp") ?: false,
        isBestGk = get<Boolean?>("is_best_gk") ?: get<Boolean?>("isBestGk") ?: false,
        isWorstPlayer = get<Boolean?>("is_worst_player") ?: get<Boolean?>("isWorstPlayer") ?: false,
        confirmedAt = safeLong("confirmed_at") ?: safeLong("confirmedAt"),
        partialPayment = get<Double?>("partial_payment") ?: get<Double?>("partialPayment") ?: 0.0,
        expectedPayment = get<Double?>("expected_payment") ?: get<Double?>("expectedPayment") ?: 0.0,
        expectedPaymentCents = safeLong("expected_payment_cents") ?: safeLong("expectedPaymentCents") ?: 0,
        wasPresent = get<Boolean?>("was_present") ?: get<Boolean?>("wasPresent") ?: false
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toStatisticsOrNull(): Statistics? {
    if (!exists) return null
    // Suporta tanto os nomes snake_case (escritor Android legado) quanto os nomes
    // camelCase gravados pelas Cloud Functions (`functions/src/index.ts`, `mvp-voting.ts`).
    return Statistics(
        id = id, userId = get<String?>("user_id") ?: get<String?>("userId") ?: id,
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
        id = id, userId = get<String?>("user_id") ?: get<String?>("userId") ?: "",
        groupId = get<String?>("group_id") ?: get<String?>("groupId") ?: "",
        groupName = get<String?>("group_name") ?: get<String?>("groupName") ?: "",
        groupPhoto = get<String?>("group_photo") ?: get<String?>("groupPhoto"),
        role = get<String?>("role") ?: GroupMemberRole.MEMBER.name,
        joinedAt = safeLong("joined_at") ?: safeLong("joinedAt")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toTeamOrNull(): Team? {
    if (!exists) return null
    return Team(
        id = id, gameId = get<String?>("game_id") ?: get<String?>("gameId") ?: "",
        name = get<String?>("name") ?: "", color = get<String?>("color") ?: "",
        playerIds = (get<List<*>?>("player_ids") ?: get<List<*>?>("playerIds"))?.filterIsInstance<String>() ?: emptyList(),
        score = safeInt("score") ?: 0
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toXpLogOrNull(): XpLog? {
    if (!exists) return null
    return XpLog(
        id = id, userId = get<String?>("user_id") ?: get<String?>("userId") ?: "",
        gameId = get<String?>("game_id") ?: get<String?>("gameId") ?: "",
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
        wasMvp = get<Boolean?>("was_mvp") ?: get<Boolean?>("wasMvp") ?: false,
        gameResult = get<String?>("game_result") ?: get<String?>("gameResult") ?: "",
        milestonesUnlocked = (get<List<*>?>("milestones_unlocked") ?: get<List<*>?>("milestonesUnlocked"))?.filterIsInstance<String>() ?: emptyList(),
        createdAt = safeLong("created_at") ?: safeLong("createdAt")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGameEventOrNull(): GameEvent? {
    if (!exists) return null
    return GameEvent(
        id = id, gameId = get<String?>("game_id") ?: get<String?>("gameId") ?: "",
        eventType = get<String?>("event_type") ?: get<String?>("eventType") ?: GameEventType.GOAL.name,
        playerId = get<String?>("player_id") ?: get<String?>("playerId") ?: "",
        playerName = get<String?>("player_name") ?: get<String?>("playerName") ?: "",
        teamId = get<String?>("team_id") ?: get<String?>("teamId") ?: "",
        assistedById = get<String?>("assisted_by_id") ?: get<String?>("assistedById"),
        assistedByName = get<String?>("assisted_by_name") ?: get<String?>("assistedByName"),
        minute = safeInt("minute") ?: 0, createdBy = get<String?>("created_by") ?: get<String?>("createdBy") ?: "",
        createdAt = safeLong("created_at") ?: safeLong("createdAt")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toLiveScoreOrNull(): LiveScore? {
    if (!exists) return null
    val team1Id = get<String?>("team1_id") ?: get<String?>("team1Id") ?: ""
    val team1Score = safeInt("team1_score") ?: safeInt("team1Score") ?: 0
    val team2Id = get<String?>("team2_id") ?: get<String?>("team2Id") ?: ""
    val team2Score = safeInt("team2_score") ?: safeInt("team2Score") ?: 0
    return LiveScore(
        id = id, gameId = get<String?>("game_id") ?: get<String?>("gameId") ?: "",
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
    val rawScores = get<Map<*, *>?>("scores")
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
        id = id, name = get<String?>("name") ?: "", description = get<String?>("description") ?: "",
        photoUrl = get<String?>("photo_url") ?: get<String?>("photoUrl"),
        ownerId = get<String?>("owner_id") ?: get<String?>("ownerId") ?: "",
        ownerName = get<String?>("owner_name") ?: get<String?>("ownerName") ?: "",
        membersCount = safeInt("members_count") ?: safeInt("membersCount") ?: 0,
        gamesCount = safeInt("games_count") ?: safeInt("gamesCount") ?: 0,
        isPublic = get<Boolean?>("is_public") ?: get<Boolean?>("isPublic") ?: false,
        inviteCode = get<String?>("invite_code") ?: get<String?>("inviteCode"),
        pixKey = get<String?>("pix_key") ?: get<String?>("pixKey"),
        defaultLocationId = get<String?>("default_location_id") ?: get<String?>("defaultLocationId"),
        defaultLocationName = get<String?>("default_location_name") ?: get<String?>("defaultLocationName"),
        defaultDayOfWeek = safeInt("default_day_of_week") ?: safeInt("defaultDayOfWeek"),
        defaultTime = get<String?>("default_time") ?: get<String?>("defaultTime"),
        defaultMaxPlayers = safeInt("default_max_players") ?: safeInt("defaultMaxPlayers") ?: 14,
        defaultPrice = get<Double?>("default_price") ?: get<Double?>("defaultPrice") ?: 0.0,
        // Genero padrao do grupo (Fase 4b) — sem este campo a pre-selecao do
        // gender na criacao de jogo caia sempre em MIXED.
        defaultGender = get<String?>("default_gender") ?: get<String?>("defaultGender"),
        createdAt = safeLong("created_at") ?: safeLong("createdAt"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGroupMemberOrNull(): GroupMember? {
    if (!exists) return null
    val userId = get<String?>("user_id") ?: get<String?>("userId") ?: id
    val groupIdFromPath = reference.parent.parent?.id ?: ""
    return GroupMember(
        id = id, groupId = get<String?>("group_id") ?: get<String?>("groupId") ?: groupIdFromPath,
        userId = userId, userName = get<String?>("user_name") ?: get<String?>("userName") ?: "",
        userPhoto = get<String?>("user_photo") ?: get<String?>("userPhoto"),
        role = get<String?>("role") ?: GroupMemberRole.MEMBER.name,
        nickname = get<String?>("nickname"),
        joinedAt = safeLong("joined_at") ?: safeLong("joinedAt"),
        gamesPlayed = safeInt("games_played") ?: safeInt("gamesPlayed") ?: 0,
        goals = safeInt("goals") ?: 0, assists = safeInt("assists") ?: 0
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toPaymentOrNull(): Payment? {
    if (!exists) return null
    val typeStr = get<String?>("type") ?: PaymentType.DAILY.name
    val statusStr = get<String?>("status") ?: PaymentStatus.PENDING.name
    val methodStr = get<String?>("payment_method")
    return Payment(
        id = id, userId = get<String?>("user_id") ?: "", gameId = get<String?>("game_id"),
        scheduleId = get<String?>("schedule_id"),
        type = try { PaymentType.valueOf(typeStr) } catch (e: Exception) { PaymentType.DAILY },
        amount = get<Double?>("amount") ?: 0.0,
        status = try { PaymentStatus.valueOf(statusStr) } catch (e: Exception) { PaymentStatus.PENDING },
        paymentMethod = methodStr?.let { try { PaymentMethod.valueOf(it) } catch (e: Exception) { null } },
        dueDate = get<String?>("due_date") ?: "", paidAt = safeLong("paid_at"),
        pixKey = get<String?>("pix_key"), pixQrcode = get<String?>("pix_qrcode"),
        pixTxid = get<String?>("pix_txid"), receiptUrl = get<String?>("receipt_url"),
        notes = get<String?>("notes"), createdAt = safeLong("created_at")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toRankingStatisticsOrNull(): Statistics? {
    if (!exists) return null
    return Statistics(
        id = id, userId = get<String?>("user_id") ?: get<String?>("userId") ?: "",
        totalGames = get<Long?>("totalGames")?.toInt() ?: get<Long?>("total_games")?.toInt() ?: 0,
        totalGoals = get<Long?>("totalGoals")?.toInt() ?: get<Long?>("total_goals")?.toInt() ?: 0,
        totalAssists = get<Long?>("totalAssists")?.toInt() ?: get<Long?>("total_assists")?.toInt() ?: 0,
        totalSaves = get<Long?>("totalSaves")?.toInt() ?: get<Long?>("total_saves")?.toInt() ?: 0,
        totalWins = get<Long?>("totalWins")?.toInt() ?: get<Long?>("total_wins")?.toInt() ?: 0,
        totalDraws = get<Long?>("totalDraws")?.toInt() ?: get<Long?>("total_draws")?.toInt() ?: 0,
        totalLosses = get<Long?>("totalLosses")?.toInt() ?: get<Long?>("total_losses")?.toInt() ?: 0,
        mvpCount = get<Long?>("mvpCount")?.toInt() ?: get<Long?>("mvp_count")?.toInt() ?: 0,
        bestGkCount = get<Long?>("bestGkCount")?.toInt() ?: get<Long?>("best_gk_count")?.toInt() ?: 0,
        worstPlayerCount = get<Long?>("worstPlayerCount")?.toInt() ?: get<Long?>("worst_player_count")?.toInt() ?: 0,
        currentStreak = get<Long?>("currentStreak")?.toInt() ?: get<Long?>("current_streak")?.toInt() ?: 0,
        bestStreak = get<Long?>("bestStreak")?.toInt() ?: get<Long?>("best_streak")?.toInt() ?: 0,
        yellowCards = get<Long?>("yellowCards")?.toInt() ?: get<Long?>("yellow_cards")?.toInt() ?: 0,
        redCards = get<Long?>("redCards")?.toInt() ?: get<Long?>("red_cards")?.toInt() ?: 0,
        lastGameDate = safeLong("last_game_date") ?: safeLong("lastGameDate"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toUserStreakOrNull(): UserStreak? {
    if (!exists) return null
    return UserStreak(
        id = id, userId = get<String?>("user_id") ?: "", scheduleId = get<String?>("schedule_id"),
        currentStreak = get<Long?>("current_streak")?.toInt() ?: 0,
        longestStreak = get<Long?>("longest_streak")?.toInt() ?: 0,
        lastGameDate = get<String?>("last_game_date"), streakStartedAt = get<String?>("streak_started_at")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toBadgeDefinitionOrNull(): BadgeDefinition? {
    if (!exists) return null
    val categoryStr = get<String?>("category") ?: "PERFORMANCE"
    val rarityStr = get<String?>("rarity") ?: "COMMON"
    return BadgeDefinition(
        id = id, name = get<String?>("name") ?: "", description = get<String?>("description") ?: "",
        emoji = get<String?>("emoji") ?: "",
        category = try { BadgeCategory.valueOf(categoryStr) } catch (e: Exception) { BadgeCategory.PERFORMANCE },
        rarity = try { BadgeRarity.valueOf(rarityStr) } catch (e: Exception) { BadgeRarity.COMMON },
        requiredValue = get<Long?>("required_value")?.toInt() ?: 1,
        isHidden = get<Boolean?>("is_hidden") ?: false
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toUserBadgeOrNull(): UserBadge? {
    if (!exists) return null
    return UserBadge(
        id = id, userId = get<String?>("user_id") ?: "", badgeId = get<String?>("badge_id") ?: "",
        unlockedAt = safeLong("unlocked_at") ?: 0,
        unlockCount = get<Long?>("unlock_count")?.toInt() ?: get<Long?>("count")?.toInt() ?: 1
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toSeasonOrNull(): Season? {
    if (!exists) return null
    return Season(
        id = id, name = get<String?>("name") ?: "", description = get<String?>("description") ?: "",
        startDate = safeLong("start_date") ?: 0, endDate = safeLong("end_date") ?: 0,
        isActive = get<Boolean?>("is_active") ?: get<Boolean?>("isActive") ?: false,
        createdAt = safeLong("created_at"), closedAt = safeLong("closed_at"),
        totalParticipants = get<Long?>("total_participants")?.toInt() ?: 0,
        totalGames = get<Long?>("total_games")?.toInt() ?: 0
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
        (get<Map<*, *>?>("by_gender"))?.get(genderKey) as? Map<*, *>
    } else null
    // Quando o sub-mapa existe, ele é AUTORITATIVO (chave ausente = 0), para
    // nunca vazar o valor combinado plano dentro da visão segmentada. Sem
    // sub-mapa (combinado, ou doc legado sem by_gender) usa o fallback plano.
    fun stat(key: String, flat: () -> Int): Int =
        if (seg != null) (seg[key] as? Number)?.toInt() ?: 0 else flat()

    return SeasonParticipation(
        id = id, seasonId = get<String?>("season_id") ?: "", userId = get<String?>("user_id") ?: "",
        division = get<String?>("division") ?: LeagueDivision.BRONZE.name,
        leagueRating = get<Long?>("league_rating")?.toInt() ?: 1000,
        points = stat("points") { get<Long?>("points")?.toInt() ?: 0 },
        gamesPlayed = stat("games_played") { get<Long?>("games_played")?.toInt() ?: 0 },
        wins = stat("wins") { get<Long?>("wins")?.toInt() ?: 0 },
        draws = stat("draws") { get<Long?>("draws")?.toInt() ?: 0 },
        losses = stat("losses") { get<Long?>("losses")?.toInt() ?: 0 },
        goals = stat("goals_scored") { get<Long?>("goals")?.toInt() ?: get<Long?>("goals_scored")?.toInt() ?: 0 },
        assists = stat("assists") { get<Long?>("assists")?.toInt() ?: 0 },
        saves = get<Long?>("saves")?.toInt() ?: 0,
        mvpCount = stat("mvp_count") { get<Long?>("mvp_count")?.toInt() ?: 0 },
        bestGkCount = get<Long?>("best_gk_count")?.toInt() ?: 0,
        worstPlayerCount = get<Long?>("worst_player_count")?.toInt() ?: 0,
        currentStreak = get<Long?>("current_streak")?.toInt() ?: 0,
        bestStreak = get<Long?>("best_streak")?.toInt() ?: 0,
        xpEarned = get<Long?>("xp_earned") ?: 0L,
        createdAt = safeLong("created_at"), updatedAt = safeLong("updated_at")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toWeeklyChallengeOrNull(): WeeklyChallenge? {
    if (!exists) return null
    val typeStr = get<String?>("type") ?: "score_goals"
    return WeeklyChallenge(
        id = id, name = get<String?>("name") ?: "", description = get<String?>("description") ?: "",
        type = try { ChallengeType.valueOf(typeStr) } catch (e: Exception) { ChallengeType.SCORE_GOALS },
        targetValue = get<Long?>("target_value")?.toInt() ?: 0,
        xpReward = get<Long?>("xp_reward") ?: 100L,
        startDate = get<String?>("start_date") ?: "", endDate = get<String?>("end_date") ?: "",
        isActive = get<Boolean?>("is_active") ?: true, scheduleId = get<String?>("schedule_id")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toUserChallengeProgressOrNull(): UserChallengeProgress? {
    if (!exists) return null
    return UserChallengeProgress(
        id = id, userId = get<String?>("user_id") ?: "", challengeId = get<String?>("challenge_id") ?: "",
        currentProgress = get<Long?>("current_progress")?.toInt() ?: 0,
        isCompleted = get<Boolean?>("is_completed") ?: false, completedAt = safeLong("completed_at")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toAppNotificationOrNull(): AppNotification? {
    if (!exists) return null
    val typeStr = get<String?>("type") ?: NotificationType.GENERAL.name
    val actionTypeStr = get<String?>("action_type")
    return AppNotification(
        id = id, userId = get<String?>("user_id") ?: "",
        type = NotificationType.fromString(typeStr), title = get<String?>("title") ?: "",
        message = get<String?>("message") ?: "", senderId = get<String?>("sender_id"),
        senderName = get<String?>("sender_name"), senderPhoto = get<String?>("sender_photo"),
        referenceId = get<String?>("reference_id"), referenceType = get<String?>("reference_type"),
        actionType = NotificationAction.fromString(actionTypeStr),
        read = get<Boolean?>("read") ?: false, readAt = safeLong("read_at"),
        createdAt = safeLong("created_at"), expiresAt = safeLong("expires_at")
    )
}

internal fun dev.gitlive.firebase.firestore.DocumentSnapshot.toActivityOrNull(): Activity? {
    if (!exists) return null
    return Activity(
        id = id, userId = get<String?>("user_id") ?: "", userName = get<String?>("user_name") ?: "",
        userPhoto = get<String?>("user_photo"), type = ActivityType.fromString(get<String?>("type")),
        title = get<String?>("title") ?: "", description = get<String?>("description") ?: "",
        referenceId = get<String?>("reference_id"), referenceType = get<String?>("reference_type"),
        metadata = (get<Map<*, *>?>("metadata") as? Map<String, String>) ?: emptyMap(),
        createdAt = safeLong("created_at"), visibility = ActivityVisibility.fromString(get<String?>("visibility"))
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

