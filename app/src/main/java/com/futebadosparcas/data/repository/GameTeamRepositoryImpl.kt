package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.Team
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GameTeamRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val teamBalancer: com.futebadosparcas.domain.ai.TeamBalancer,
    private val confirmationRepository: GameConfirmationRepository
) : GameTeamRepository {

    private val teamsCollection = firestore.collection("teams")
    private val gamesCollection = firestore.collection("games")

    companion object {
        private const val TAG = "GameTeamRepository"
    }

    override suspend fun generateTeams(
        gameId: String,
        numberOfTeams: Int,
        balanceTeams: Boolean
    ): Result<List<Team>> {
        return try {
            // Fetch existing teams to delete in the same batch
            val existingTeamsSnapshot = teamsCollection
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            val confirmationsResult = confirmationRepository.getGameConfirmations(gameId)
            if (confirmationsResult.isFailure) return Result.failure(confirmationsResult.exceptionOrNull()!!)

            val allPlayers = confirmationsResult.getOrNull()!!

            // Logic to generate teams (keep existing)
            val goalkeepers = allPlayers.filter { it.position == "GOALKEEPER" }.toMutableList()
            val fieldPlayers = allPlayers.filter { it.position == "FIELD" }.toMutableList()

            goalkeepers.shuffle()

            // Prepare Teams containers
            val teamPlayerLists = List(numberOfTeams) { mutableListOf<String>() }

            // Distribute Goalkeepers first
            goalkeepers.forEachIndexed { index, goalkeeper ->
                val teamIndex = index % numberOfTeams
                teamPlayerLists[teamIndex].add(goalkeeper.userId)
            }

            if (balanceTeams) {
                // Use AI/Smart Balancer
                val balancedTeamsResult = teamBalancer.balanceTeams(gameId, allPlayers, numberOfTeams)

                if (balancedTeamsResult.isSuccess) {
                    val balancedTeams = balancedTeamsResult.getOrNull()!!
                    // Map playerIds from balancedTeams to teamPlayerLists for persistence
                    // Or simply use the balanced Teams directly, but we need to respect the colors and naming logic below if not provided

                    // Just override the lists if the balancer returns ordered teams
                    balancedTeams.forEachIndexed { index, team ->
                        if (index < numberOfTeams) {
                            teamPlayerLists[index].clear()
                            teamPlayerLists[index].addAll(team.playerIds)
                        }
                    }
                } else {
                    // Fallback if balancer fails
                    AppLogger.w(TAG) { "Falha no balanceamento: ${balancedTeamsResult.exceptionOrNull()?.message}. Usando aleatório." }
                    val fieldPlayers = allPlayers.filter { it.position == "FIELD" }.toMutableList()
                    fieldPlayers.shuffle()
                    fieldPlayers.forEachIndexed { index, player ->
                        val teamIndex = index % numberOfTeams
                        teamPlayerLists[teamIndex].add(player.userId)
                    }
                }
            } else {
                fieldPlayers.shuffle()

                // Simple distribution
                fieldPlayers.forEachIndexed { index, player ->
                    val teamIndex = index % numberOfTeams
                    teamPlayerLists[teamIndex].add(player.userId)
                }
            }

            val teams = mutableListOf<Team>()
            val teamColors = listOf("#58CC02", "#FF9600", "#1CB0F6", "#FF4B4B", "#FFD600", "#CE82FF")

            val batch = firestore.batch()

            // 1. Queue Deletes
            existingTeamsSnapshot.documents.forEach { doc ->
                batch.delete(doc.reference)
            }

            // 2. Queue Creates
            teamPlayerLists.forEachIndexed { index, playerIds ->
                val teamRef = teamsCollection.document()
                val teamName = "Time ${index + 1}"
                val color = teamColors.getOrElse(index) { "#${String.format("%06X", (0..0xFFFFFF).random())}" }

                val newTeam = Team(
                    id = teamRef.id,
                    gameId = gameId,
                    name = teamName,
                    playerIds = playerIds,
                    color = color
                )

                batch.set(teamRef, newTeam)
                teams.add(newTeam)
            }

            batch.commit().await()

            // Sync denormalized team names to Game
            if (teams.size >= 2) {
                // Ensure sorting matches typical Team 1, Team 2 order (by name usually)
                val sortedTeams = teams.sortedBy { it.name }
                val updates = mapOf(
                    "team1_name" to sortedTeams[0].name,
                    "team2_name" to sortedTeams[1].name
                )
                gamesCollection.document(gameId).update(updates).await()
            }

            Result.success(teams)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getGameTeams(gameId: String): Result<List<Team>> {
        return try {
            val snapshot = teamsCollection
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            val teams = snapshot.documents.mapNotNull { doc ->
                doc.toObject(Team::class.java)?.apply { id = doc.id }
            }
            Result.success(teams)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>> = callbackFlow {
        val subscription = teamsCollection
            .whereEqualTo("game_id", gameId)
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    trySend(Result.failure(e))
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val teams = snapshot.documents.mapNotNull { doc ->
                        doc.toObject(Team::class.java)?.apply { id = doc.id }
                    }
                    trySend(Result.success(teams))
                } else {
                    trySend(Result.success(emptyList()))
                }
            }
        awaitClose { subscription.remove() }
    }

    override suspend fun clearGameTeams(gameId: String): Result<Unit> {
        return try {
            val snapshot = teamsCollection
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.delete(doc.reference)
            }
            batch.commit().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateTeams(teams: List<Team>): Result<Unit> {
        return try {
            val batch = firestore.batch()
            teams.forEach { team ->
                val teamRef = teamsCollection.document(team.id)
                batch.set(teamRef, team)
            }
            batch.commit().await()

            // Sync denormalized team names to Game if applicable
            val gameIds = teams.map { it.gameId }.distinct()
            if (gameIds.size == 1) {
                val gameId = gameIds.first()
                if (teams.size >= 2) {
                    val sortedTeams = teams.sortedBy { it.name }
                    val updates = mapOf(
                        "team1_name" to sortedTeams[0].name,
                        "team2_name" to sortedTeams[1].name
                    )
                    gamesCollection.document(gameId).update(updates)
                }
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
