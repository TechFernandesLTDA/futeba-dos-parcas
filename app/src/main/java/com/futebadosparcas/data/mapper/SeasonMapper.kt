package com.futebadosparcas.data.mapper

import com.futebadosparcas.data.model.LeagueDivision as AndroidLeagueDivision
import com.futebadosparcas.data.model.Season as AndroidSeason
import com.futebadosparcas.data.model.SeasonParticipationV2
import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.domain.model.Season
import com.futebadosparcas.domain.model.SeasonParticipation
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Mapper para converter entre modelos do shared module e modelos Android
 */
object SeasonMapper {

    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())

    /**
     * Converte Season do shared module para Android model
     */
    fun toAndroidSeason(season: Season): AndroidSeason {
        return AndroidSeason(
            id = season.id,
            name = season.name,
            startDate = dateFormat.format(Date(season.startDate)),
            endDate = dateFormat.format(Date(season.endDate)),
            isActive = season.isActive,
            scheduleId = null,
            createdAt = season.createdAt?.let { Date(it) },
            closedAt = season.closedAt?.let { Date(it) }
        )
    }

    /**
     * Converte lista de Season do shared module para Android models
     */
    fun toAndroidSeasons(seasons: List<Season>): List<AndroidSeason> {
        return seasons.map { toAndroidSeason(it) }
    }

    /**
     * Converte SeasonParticipation do shared module para SeasonParticipationV2
     */
    fun toSeasonParticipationV2(participation: SeasonParticipation): SeasonParticipationV2 {
        return SeasonParticipationV2(
            id = participation.id,
            userId = participation.userId,
            seasonId = participation.seasonId,
            division = toAndroidLeagueDivision(participation.getDivisionEnum()),
            points = participation.points,
            gamesPlayed = participation.gamesPlayed,
            wins = participation.wins,
            draws = participation.draws,
            losses = participation.losses,
            goalsScored = participation.goals,
            goalsConceded = 0,
            assists = participation.assists,
            mvpCount = participation.mvpCount,
            leagueRating = participation.leagueRating.toDouble(),
            recentGames = emptyList(),
            promotionProgress = 0,
            relegationProgress = 0,
            protectionGames = 0
        )
    }

    /**
     * Converte LeagueDivision do shared module para Android model.
     *
     * NOTA: O shared usa PRATA/OURO/DIAMANTE em portugues, enquanto o Android
     * usa os mesmos nomes. Ambos sao equivalentes.
     */
    fun toAndroidLeagueDivision(division: LeagueDivision): AndroidLeagueDivision {
        return when (division) {
            LeagueDivision.BRONZE -> AndroidLeagueDivision.BRONZE
            LeagueDivision.PRATA -> AndroidLeagueDivision.PRATA
            LeagueDivision.OURO -> AndroidLeagueDivision.OURO
            LeagueDivision.DIAMANTE -> AndroidLeagueDivision.DIAMANTE
        }
    }

    /**
     * Converte LeagueDivision do Android model para shared module.
     *
     * NOTA: O shared usa PRATA/OURO/DIAMANTE em portugues, enquanto o Android
     * usa os mesmos nomes. Ambos sao equivalentes.
     */
    fun toDomainLeagueDivision(division: AndroidLeagueDivision): LeagueDivision {
        return when (division) {
            AndroidLeagueDivision.BRONZE -> LeagueDivision.BRONZE
            AndroidLeagueDivision.PRATA -> LeagueDivision.PRATA
            AndroidLeagueDivision.OURO -> LeagueDivision.OURO
            AndroidLeagueDivision.DIAMANTE -> LeagueDivision.DIAMANTE
        }
    }
}
