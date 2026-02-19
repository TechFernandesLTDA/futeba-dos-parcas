package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.Team
import com.futebadosparcas.domain.repository.GameConfirmationRepository
import com.futebadosparcas.domain.repository.GameTeamRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.firebase.getFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Implementacao Android do GameTeamRepository.
 */
class GameTeamRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource,
    private val confirmationRepository: GameConfirmationRepository
) : GameTeamRepository {

    private val firestore get() = firebaseDataSource.getFirestore()
    private val teamsCollection get() = firestore.collection("teams")
    private val gamesCollection get() = firestore.collection("games")

    override suspend fun generateTeams(
        gameId: String,
        numberOfTeams: Int,
        balanceTeams: Boolean
    ): Result<List<Team>> {
        return try {
            // P1 #12: Limit 10 - maximo realista de times por jogo
            val existingTeamsSnapshot = teamsCollection
                .whereEqualTo("game_id", gameId)
                .limit(10)
                .get()
                .await()

            val confirmationsResult = confirmationRepository.getGameConfirmations(gameId)
            if (confirmationsResult.isFailure) return Result.failure(confirmationsResult.exceptionOrNull() ?: Exception("Erro ao buscar confirmações"))

            val allPlayers = confirmationsResult.getOrNull() ?: emptyList()

            // Prepare Teams containers
            val teamPlayerLists = List(numberOfTeams) { mutableListOf<String>() }

            // Distribute Goalkeepers first
            val goalkeepers = allPlayers.filter { it.position == "GOALKEEPER" }
            goalkeepers.forEachIndexed { index, gk ->
                val teamIndex = index % numberOfTeams
                teamPlayerLists[teamIndex].add(gk.userId)
            }

            // Distribute field players
            val fieldPlayers = allPlayers.filter { it.position != "GOALKEEPER" }.shuffled()
            fieldPlayers.forEachIndexed { index, player ->
                val teamIndex = index % numberOfTeams
                teamPlayerLists[teamIndex].add(player.userId)
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
                    color = color,
                    playerIds = playerIds
                )

                batch.set(teamRef, mapOf(
                    "id" to newTeam.id,
                    "game_id" to newTeam.gameId,
                    "name" to newTeam.name,
                    "color" to newTeam.color,
                    "player_ids" to newTeam.playerIds
                ))
                teams.add(newTeam)
            }

            batch.commit().await()

            // Sync denormalized team names to Game
            if (teams.size >= 2) {
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
            // P1 #12: Limit 10 - maximo realista de times por jogo
            val snapshot = teamsCollection
                .whereEqualTo("game_id", gameId)
                .limit(10)
                .get()
                .await()

            val teams = snapshot.documents.mapNotNull { doc ->
                docToTeam(doc.id, doc.data)
            }
            Result.success(teams)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>> = callbackFlow {
        // P1 #12: Limit 10 no listener real-time
        val subscription = teamsCollection
            .whereEqualTo("game_id", gameId)
            .limit(10)
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    trySend(Result.failure(e))
                    return@addSnapshotListener
                }

                val teams = snapshot?.documents?.mapNotNull { doc ->
                    docToTeam(doc.id, doc.data)
                } ?: emptyList()
                trySend(Result.success(teams))
            }
        awaitClose { subscription.remove() }
    }

    override suspend fun clearGameTeams(gameId: String): Result<Unit> {
        return try {
            // P1 #12: Limit 10 - maximo realista para delete de times
            val snapshot = teamsCollection
                .whereEqualTo("game_id", gameId)
                .limit(10)
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
                batch.set(teamRef, mapOf(
                    "id" to team.id,
                    "game_id" to team.gameId,
                    "name" to team.name,
                    "color" to team.color,
                    "player_ids" to team.playerIds,
                    "score" to team.score
                ))
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

    private fun docToTeam(id: String, data: Map<String, Any>?): Team? {
        if (data == null) return null
        return try {
            Team(
                id = id,
                gameId = data["game_id"] as? String ?: "",
                name = data["name"] as? String ?: "",
                color = data["color"] as? String ?: "",
                playerIds = (data["player_ids"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                score = (data["score"] as? Number)?.toInt() ?: 0
            )
        } catch (e: Exception) {
            null
        }
    }
}
