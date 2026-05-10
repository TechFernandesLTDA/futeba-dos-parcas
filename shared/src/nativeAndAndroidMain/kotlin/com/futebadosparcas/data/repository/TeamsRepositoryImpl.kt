package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.Team
import com.futebadosparcas.domain.repository.TeamsRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource

class TeamsRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : TeamsRepository {

    private val cache = mutableMapOf<String, Team>()

    override suspend fun getAllTeams(): Result<List<Team>> {
        val result = firebaseDataSource.getAllFavoriteTeams()
        result.getOrNull()?.forEach { team ->
            cache[team.id] = team
        }
        return result
    }

    override suspend fun getTeamById(teamId: String): Result<Team> {
        cache[teamId]?.let { return Result.success(it) }

        val result = firebaseDataSource.getFavoriteTeamById(teamId)
        result.getOrNull()?.let { cache[it.id] = it }
        return result
    }
}
