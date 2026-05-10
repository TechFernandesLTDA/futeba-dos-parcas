package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.FavoriteTeam

interface TeamsRepository {
    suspend fun getAllTeams(): Result<List<FavoriteTeam>>
    suspend fun getTeamById(teamId: String): Result<FavoriteTeam>
}
