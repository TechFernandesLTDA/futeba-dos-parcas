package com.futebadosparcas.data

import com.futebadosparcas.domain.model.Team
import com.futebadosparcas.domain.repository.GameConfirmationRepository
import com.futebadosparcas.domain.repository.GameTeamRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map

/**
 * Implementação compartilhada (Android+iOS) do GameTeamRepository.
 *
 * Usa GitLive Firebase Kotlin SDK (cross-platform).
 */
class GameTeamRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource,
    private val confirmationRepository: GameConfirmationRepository
) : GameTeamRepository {

    private val firestore = Firebase.firestore
    private val teamsCollection = firestore.collection("teams")
    private val gamesCollection = firestore.collection("games")

    override suspend fun generateTeams(
        gameId: String,
        numberOfTeams: Int,
        balanceTeams: Boolean
    ): Result<List<Team>> {
        return try {
            // P1 #12: Limit 10 — maximo realista de times por jogo
            val existingTeamsSnapshot = teamsCollection
                .where { "game_id" equalTo gameId }
                .limit(10)
                .get()

            val confirmationsResult = confirmationRepository.getGameConfirmations(gameId)
            if (confirmationsResult.isFailure) {
                return Result.failure(
                    confirmationsResult.exceptionOrNull() ?: Exception("Erro ao buscar confirmações")
                )
            }
            val allPlayers = confirmationsResult.getOrNull() ?: emptyList()

            val teamPlayerLists = List(numberOfTeams) { mutableListOf<String>() }

            val goalkeepers = allPlayers.filter { it.position == "GOALKEEPER" }
            goalkeepers.forEachIndexed { index, gk ->
                teamPlayerLists[index % numberOfTeams].add(gk.userId)
            }

            val fieldPlayers = allPlayers.filter { it.position != "GOALKEEPER" }.shuffled()
            fieldPlayers.forEachIndexed { index, player ->
                teamPlayerLists[index % numberOfTeams].add(player.userId)
            }

            val teamColors = listOf("#58CC02", "#FF9600", "#1CB0F6", "#FF4B4B", "#FFD600", "#CE82FF")
            val teams = mutableListOf<Team>()

            firestore.batch().apply {
                // Deletes
                existingTeamsSnapshot.documents.forEach { doc ->
                    delete(doc.reference)
                }
                // Creates
                teamPlayerLists.forEachIndexed { index, playerIds ->
                    val newDocRef = teamsCollection.document
                    val teamName = "Time ${index + 1}"
                    val color = teamColors.getOrElse(index) { "#58CC02" }
                    val newTeam = Team(
                        id = newDocRef.id,
                        gameId = gameId,
                        name = teamName,
                        color = color,
                        playerIds = playerIds
                    )
                    set(
                        documentRef = newDocRef,
                        data = mapOf(
                            "id" to newTeam.id,
                            "game_id" to newTeam.gameId,
                            "name" to newTeam.name,
                            "color" to newTeam.color,
                            "player_ids" to newTeam.playerIds
                        )
                    )
                    teams.add(newTeam)
                }
            }.commit()

            // Sync denormalized team names to Game
            if (teams.size >= 2) {
                val sortedTeams = teams.sortedBy { it.name }
                gamesCollection.document(gameId).update(
                    mapOf(
                        "team1_name" to sortedTeams[0].name,
                        "team2_name" to sortedTeams[1].name
                    )
                )
            }

            Result.success(teams)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getGameTeams(gameId: String): Result<List<Team>> {
        return try {
            val snapshot = teamsCollection
                .where { "game_id" equalTo gameId }
                .limit(10)
                .get()

            val teams = snapshot.documents.mapNotNull { doc -> docToTeam(doc.id, doc) }
            Result.success(teams)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>> = flow {
        teamsCollection
            .where { "game_id" equalTo gameId }
            .limit(10)
            .snapshots
            .catch { e -> emit(Result.failure(e)) }
            .collect { snap ->
                val teams = snap.documents.mapNotNull { doc -> docToTeam(doc.id, doc) }
                emit(Result.success(teams))
            }
    }

    override suspend fun clearGameTeams(gameId: String): Result<Unit> {
        return try {
            val snapshot = teamsCollection
                .where { "game_id" equalTo gameId }
                .limit(10)
                .get()

            firestore.batch().apply {
                snapshot.documents.forEach { doc -> delete(doc.reference) }
            }.commit()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateTeams(teams: List<Team>): Result<Unit> {
        return try {
            firestore.batch().apply {
                teams.forEach { team ->
                    val teamRef = teamsCollection.document(team.id)
                    set(
                        documentRef = teamRef,
                        data = mapOf(
                            "id" to team.id,
                            "game_id" to team.gameId,
                            "name" to team.name,
                            "color" to team.color,
                            "player_ids" to team.playerIds,
                            "score" to team.score
                        )
                    )
                }
            }.commit()

            // Sync denormalized team names ao Game (quando todos do mesmo jogo)
            val gameIds = teams.map { it.gameId }.distinct()
            if (gameIds.size == 1 && teams.size >= 2) {
                val gameId = gameIds.first()
                val sortedTeams = teams.sortedBy { it.name }
                gamesCollection.document(gameId).update(
                    mapOf(
                        "team1_name" to sortedTeams[0].name,
                        "team2_name" to sortedTeams[1].name
                    )
                )
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun docToTeam(
        id: String,
        doc: dev.gitlive.firebase.firestore.DocumentSnapshot,
    ): Team? {
        return try {
            Team(
                id = id,
                gameId = doc.get<String?>("game_id") ?: "",
                name = doc.get<String?>("name") ?: "",
                color = doc.get<String?>("color") ?: "",
                playerIds = doc.get<List<String>?>("player_ids") ?: emptyList(),
                score = doc.get<Long?>("score")?.toInt() ?: 0
            )
        } catch (_: Exception) {
            null
        }
    }
}
