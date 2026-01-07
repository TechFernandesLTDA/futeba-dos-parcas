package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.model.Team
import com.futebadosparcas.ui.games.GameWithConfirmations
import javax.inject.Inject

class FakeGameRepository @Inject constructor() : GameRepository {

    private var games = mutableListOf<Game>()
    private var confirmations = mutableListOf<GameConfirmation>()

    override suspend fun getUpcomingGames(): Result<List<Game>> {
        return Result.success(games.filter { it.status == GameStatus.SCHEDULED.name || it.status == GameStatus.CONFIRMED.name })
    }

    override suspend fun getAllGames(): Result<List<Game>> {
        return Result.success(games)
    }

    override suspend fun getAllGamesWithConfirmationCount(): Result<List<GameWithConfirmations>> {
        val confirmationsCount = confirmations
            .filter { it.status == "CONFIRMED" }
            .groupBy { it.gameId }
            .mapValues { it.value.size }

        val result = games.map { game ->
            GameWithConfirmations(game, confirmationsCount[game.id] ?: 0)
        }
        return Result.success(result)
    }

    override fun getAllGamesWithConfirmationCountFlow(): kotlinx.coroutines.flow.Flow<Result<List<GameWithConfirmations>>> = kotlinx.coroutines.flow.flow {
        val confirmationsCount = confirmations
            .filter { it.status == "CONFIRMED" }
            .groupBy { it.gameId }
            .mapValues { it.value.size }

        val result = games.map { game ->
            GameWithConfirmations(game, confirmationsCount[game.id] ?: 0)
        }
        emit(Result.success(result))
    }

    override fun getLiveAndUpcomingGamesFlow(): kotlinx.coroutines.flow.Flow<Result<List<GameWithConfirmations>>> = kotlinx.coroutines.flow.flow {
        val confirmationsCount = confirmations
            .filter { it.status == "CONFIRMED" }
            .groupBy { it.gameId }
            .mapValues { it.value.size }

        val liveAndUpcoming = games.filter {
            it.status == GameStatus.SCHEDULED.name ||
            it.status == GameStatus.CONFIRMED.name ||
            it.status == GameStatus.LIVE.name
        }
        val result = liveAndUpcoming.map { game ->
            GameWithConfirmations(game, confirmationsCount[game.id] ?: 0)
        }
        emit(Result.success(result))
    }

    override fun getHistoryGamesFlow(limit: Int): kotlinx.coroutines.flow.Flow<Result<List<GameWithConfirmations>>> = kotlinx.coroutines.flow.flow {
        val confirmationsCount = confirmations
            .filter { it.status == "CONFIRMED" }
            .groupBy { it.gameId }
            .mapValues { it.value.size }

        val historyGames = games.filter {
            it.status == GameStatus.FINISHED.name ||
            it.status == GameStatus.CANCELLED.name
        }.take(limit)
        val result = historyGames.map { game ->
            GameWithConfirmations(game, confirmationsCount[game.id] ?: 0)
        }
        emit(Result.success(result))
    }

    override suspend fun getConfirmedUpcomingGamesForUser(): Result<List<Game>> {
        val confirmedGameIds = confirmations
            .filter { it.userId == "mock_user_id" && it.status == "CONFIRMED" }
            .map { it.gameId }
            .toSet()
        
        val upcomingGames = games.filter { 
            (it.status == GameStatus.SCHEDULED.name || it.status == GameStatus.CONFIRMED.name) && it.id in confirmedGameIds 
        }
        return Result.success(upcomingGames)
    }

    override suspend fun getGameDetails(gameId: String): Result<Game> {
        val game = games.find { it.id == gameId }
        return if (game != null) Result.success(game) else Result.failure(Exception("Game not found"))
    }

    override fun getGameDetailsFlow(gameId: String): kotlinx.coroutines.flow.Flow<Result<Game>> = kotlinx.coroutines.flow.flow {
        val game = games.find { it.id == gameId }
        if (game != null) emit(Result.success(game)) else emit(Result.failure(Exception("Game not found")))
    }

    override suspend fun getPublicGames(limit: Int): Result<List<Game>> {
        return Result.success(games.filter { it.visibility == "PUBLIC_OPEN" || it.visibility == "PUBLIC_CLOSED" }.take(limit))
    }

    override fun getPublicGamesFlow(limit: Int): kotlinx.coroutines.flow.Flow<List<Game>> = kotlinx.coroutines.flow.flow {
        emit(games.filter { it.visibility == "PUBLIC_OPEN" || it.visibility == "PUBLIC_CLOSED" }.take(limit))
    }

    override suspend fun getNearbyPublicGames(
        userLat: Double,
        userLng: Double,
        radiusKm: Double,
        limit: Int
    ): Result<List<Game>> {
        // Mock implementation: return all public games
        return getPublicGames(limit)
    }

    override suspend fun getOpenPublicGames(limit: Int): Result<List<Game>> {
        return Result.success(games.filter { it.visibility == "PUBLIC_OPEN" }.take(limit))
    }

    override suspend fun createGame(game: Game): Result<Game> {
        val newGame = game.copy(id = (games.size + 1).toString())
        games.add(newGame)
        return Result.success(newGame)
    }

    override suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>> {
        return Result.success(confirmations.filter { it.gameId == gameId })
    }

    override fun getGameConfirmationsFlow(gameId: String): kotlinx.coroutines.flow.Flow<Result<List<GameConfirmation>>> = kotlinx.coroutines.flow.flow {
        emit(Result.success(confirmations.filter { it.gameId == gameId }))
    }

    override suspend fun confirmPresence(
        gameId: String,
        position: String,
        isCasual: Boolean
    ): Result<GameConfirmation> {
        val confirmation = GameConfirmation(
            id = (confirmations.size + 1).toString(),
            gameId = gameId,
            userId = "mock_user_id",
            userName = "Cristiano Ronaldo",
            status = "CONFIRMED",
            position = position,
            isCasualPlayer = isCasual
        )
        confirmations.add(confirmation)
        return Result.success(confirmation)
    }

    override suspend fun getGoalkeeperCount(gameId: String): Result<Int> {
        return Result.success(confirmations.count { it.gameId == gameId && it.position == "GOALKEEPER" })
    }

    override suspend fun cancelConfirmation(gameId: String): Result<Unit> {
        confirmations.removeAll { it.gameId == gameId && it.userId == "mock_user_id" }
        return Result.success(Unit)
    }

    override suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit> {
        confirmations.removeAll { it.gameId == gameId && it.userId == userId }
        return Result.success(Unit)
    }

    override suspend fun updateGameStatus(gameId: String, status: String): Result<Unit> {
        games.find { it.id == gameId }?.let {
            val index = games.indexOf(it)
            games[index] = it.copy(status = status)
        }
        return Result.success(Unit)
    }

    override suspend fun updateGameConfirmationStatus(gameId: String, isOpen: Boolean): Result<Unit> {
        val status = if (isOpen) GameStatus.SCHEDULED.name else GameStatus.CONFIRMED.name
        return updateGameStatus(gameId, status)
    }

    override suspend fun updatePaymentStatus(gameId: String, userId: String, isPaid: Boolean): Result<Unit> {
        confirmations.find { it.gameId == gameId && it.userId == userId }?.let {
            val index = confirmations.indexOf(it)
            val status = if(isPaid) "PAID" else "PENDING"
            confirmations[index] = it.copy(paymentStatus = status)
        }
        return Result.success(Unit)
    }

    override suspend fun generateTeams(
        gameId: String,
        numberOfTeams: Int,
        balanceTeams: Boolean
    ): Result<List<Team>> {
        // Not implemented for mock
        return Result.success(emptyList())
    }

    override suspend fun getGameTeams(gameId: String): Result<List<Team>> {
        // Not implemented for mock
        return Result.success(emptyList())
    }

    override fun getGameTeamsFlow(gameId: String): kotlinx.coroutines.flow.Flow<Result<List<Team>>> = kotlinx.coroutines.flow.flow {
         emit(Result.success(emptyList()))
    }

    override suspend fun clearGameTeams(gameId: String): Result<Unit> {
        // Not implemented for mock
        return Result.success(Unit)
    }

    override suspend fun updateTeams(teams: List<Team>): Result<Unit> {
        // Not implemented for mock fully, just returning success
        return Result.success(Unit)
    }

    override suspend fun updateGame(game: Game): Result<Unit> {
        val index = games.indexOfFirst { it.id == game.id }
        if (index != -1) {
            games[index] = game
        }
        return Result.success(Unit)
    }

    override suspend fun deleteGame(gameId: String): Result<Unit> {
        games.removeAll { it.id == gameId }
        return Result.success(Unit)
    }

    // Helper to populate from DeveloperViewModel
    fun populate(mockGames: List<Game>) {
        games.clear()
        games.addAll(mockGames)
    }

    override suspend fun clearAll(): Result<Unit> {
        games.clear()
        confirmations.clear()
        return Result.success(Unit)
    }

    override suspend fun checkTimeConflict(
        fieldId: String,
        date: String,
        startTime: String,
        endTime: String,
        excludeGameId: String?
    ): Result<List<TimeConflict>> {
        if (fieldId.isEmpty()) {
            return Result.success(emptyList())
        }

        val existingGames = games
            .filter { it.fieldId == fieldId && it.date == date }
            .filter { it.id != excludeGameId }
            .filter { it.status != GameStatus.CANCELLED.name }

        val conflicts = mutableListOf<TimeConflict>()

        val newStart = timeToMinutes(startTime)
        val newEnd = timeToMinutes(endTime)

        for (game in existingGames) {
            val existingStart = timeToMinutes(game.time)
            val existingEnd = timeToMinutes(game.endTime)

            if (newStart < existingEnd && existingStart < newEnd) {
                val overlapStart = maxOf(newStart, existingStart)
                val overlapEnd = minOf(newEnd, existingEnd)
                val overlapMinutes = overlapEnd - overlapStart
                conflicts.add(TimeConflict(game, overlapMinutes))
            }
        }

        return Result.success(conflicts)
    }

    override suspend fun getGamesByFieldAndDate(fieldId: String, date: String): Result<List<Game>> {
        return Result.success(games.filter { it.fieldId == fieldId && it.date == date })
    }

    override suspend fun summonPlayers(gameId: String, confirmations: List<GameConfirmation>): Result<Unit> {
        this.confirmations.addAll(confirmations)
        return Result.success(Unit)
    }

    private val events = mutableListOf<com.futebadosparcas.data.model.GameEvent>()

    override fun getGameEventsFlow(gameId: String): kotlinx.coroutines.flow.Flow<Result<List<com.futebadosparcas.data.model.GameEvent>>> = kotlinx.coroutines.flow.flow {
        emit(Result.success(events.filter { it.gameId == gameId }))
    }

    override fun getLiveScoreFlow(gameId: String): kotlinx.coroutines.flow.Flow<com.futebadosparcas.data.model.LiveGameScore?> = kotlinx.coroutines.flow.flow {
        emit(null)
    }

    override suspend fun sendGameEvent(gameId: String, event: com.futebadosparcas.data.model.GameEvent): Result<Unit> {
        events.add(event.copy(id = (events.size + 1).toString(), gameId = gameId))
        return Result.success(Unit)
    }

    override suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> {
        events.removeAll { it.id == eventId }
        return Result.success(Unit)
    }

    override suspend fun getGamesByFilter(filterType: GameFilterType): Result<List<GameWithConfirmations>> {
        val confirmationsCount = confirmations
            .filter { it.status == "CONFIRMED" }
            .groupBy { it.gameId }
            .mapValues { it.value.size }

        val filteredGames = when (filterType) {
            GameFilterType.ALL -> games
            GameFilterType.OPEN -> games.filter { it.status == GameStatus.SCHEDULED.name }
            GameFilterType.MY_GAMES -> {
                val myGameIds = confirmations.filter { it.userId == "mock_user_id" }.map { it.gameId }.toSet()
                games.filter { it.id in myGameIds }
            }
            GameFilterType.LIVE -> games.filter { it.status == GameStatus.LIVE.name }
        }

        val result = filteredGames.map { game ->
            GameWithConfirmations(game, confirmationsCount[game.id] ?: 0)
        }
        return Result.success(result)
    }

    override suspend fun getHistoryGamesPaginated(pageSize: Int, lastGameId: String?): Result<PaginatedGames> {
        val historyGames = games.filter {
            it.status == GameStatus.FINISHED.name || it.status == GameStatus.CANCELLED.name
        }.sortedByDescending { it.dateTime }

        val startIndex = if (lastGameId != null) {
            historyGames.indexOfFirst { it.id == lastGameId } + 1
        } else {
            0
        }

        val page = historyGames.drop(startIndex).take(pageSize)
        val hasMore = startIndex + pageSize < historyGames.size

        val result = page.map { game ->
            GameWithConfirmations(game, 0)
        }

        return Result.success(PaginatedGames(
            games = result,
            lastGameId = page.lastOrNull()?.id,
            hasMore = hasMore
        ))
    }

    private fun timeToMinutes(time: String): Int {
        return try {
            val parts = time.split(":")
            val hours = parts[0].toInt()
            val minutes = if (parts.size > 1) parts[1].toInt() else 0
            hours * 60 + minutes
        } catch (e: Exception) {
            0
        }
    }
}
