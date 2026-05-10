package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.Team

interface TeamsRepository {
    suspend fun getAllTeams(): Result<List<Team>>
    suspend fun getTeamById(teamId: String): Result<Team>
}
