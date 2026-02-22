package com.futebadosparcas.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GamesTabTest {

    @Test
    fun `StatusFilter ALL has correct properties`() {
        assertEquals("Todos", StatusFilter.ALL.label)
        assertEquals("📅", StatusFilter.ALL.emoji)
        assertEquals(null, StatusFilter.ALL.status)
    }

    @Test
    fun `StatusFilter SCHEDULED has correct properties`() {
        assertEquals("Agendados", StatusFilter.SCHEDULED.label)
        assertEquals("🟢", StatusFilter.SCHEDULED.emoji)
        assertEquals("SCHEDULED", StatusFilter.SCHEDULED.status)
    }

    @Test
    fun `StatusFilter CONFIRMED has correct properties`() {
        assertEquals("Fechados", StatusFilter.CONFIRMED.label)
        assertEquals("🟡", StatusFilter.CONFIRMED.emoji)
        assertEquals("CONFIRMED", StatusFilter.CONFIRMED.status)
    }

    @Test
    fun `StatusFilter LIVE has correct properties`() {
        assertEquals("Ao Vivo", StatusFilter.LIVE.label)
        assertEquals("🔴", StatusFilter.LIVE.emoji)
        assertEquals("LIVE", StatusFilter.LIVE.status)
    }

    @Test
    fun `StatusFilter FINISHED has correct properties`() {
        assertEquals("Finalizados", StatusFilter.FINISHED.label)
        assertEquals("✅", StatusFilter.FINISHED.emoji)
        assertEquals("FINISHED", StatusFilter.FINISHED.status)
    }

    @Test
    fun `StatusFilter has exactly 5 entries`() {
        assertEquals(5, StatusFilter.entries.size)
    }

    @Test
    fun `DateFilter TODAY has correct properties`() {
        assertEquals("Hoje", DateFilter.TODAY.label)
        assertEquals("📅", DateFilter.TODAY.emoji)
    }

    @Test
    fun `DateFilter WEEK has correct properties`() {
        assertEquals("Semana", DateFilter.WEEK.label)
        assertEquals("📆", DateFilter.WEEK.emoji)
    }

    @Test
    fun `DateFilter MONTH has correct properties`() {
        assertEquals("Mes", DateFilter.MONTH.label)
        assertEquals("🗓️", DateFilter.MONTH.emoji)
    }

    @Test
    fun `DateFilter ALL has correct properties`() {
        assertEquals("Todos", DateFilter.ALL.label)
        assertEquals("📋", DateFilter.ALL.emoji)
    }

    @Test
    fun `DateFilter has exactly 4 entries`() {
        assertEquals(4, DateFilter.entries.size)
    }

    @Test
    fun `WebGame default values are correct`() {
        val game = WebGame(
            id = "game1",
            title = "",
            date = "",
            time = "",
            locationName = "",
            locationAddress = "",
            status = "",
            playersCount = 0,
            maxPlayers = 0,
            gameType = "",
            dailyPrice = 0.0,
            ownerName = "",
            groupId = null,
            groupName = null
        )
        assertEquals("game1", game.id)
        assertEquals("", game.title)
        assertEquals("", game.status)
        assertEquals(0, game.playersCount)
        assertEquals(0, game.maxPlayers)
        assertEquals(0.0, game.dailyPrice)
        assertEquals(null, game.groupId)
        assertEquals(emptyList<WebConfirmation>(), game.confirmations)
        assertEquals("Time A", game.team1Name)
        assertEquals("Time B", game.team2Name)
        assertEquals(0, game.team1Score)
        assertEquals(0, game.team2Score)
    }

    @Test
    fun `WebGame with all fields populated`() {
        val game = WebGame(
            id = "game123",
            title = "Pelada do Sábado",
            date = "2026-02-22",
            time = "14:00",
            locationName = "Campo do Parque",
            locationAddress = "Rua das Flores, 123",
            status = "SCHEDULED",
            playersCount = 10,
            maxPlayers = 14,
            gameType = "Society",
            dailyPrice = 25.0,
            ownerName = "João Silva",
            groupId = "group1",
            groupName = "Pelada dos Amigos",
            confirmations = listOf(
                WebConfirmation(
                    userId = "user1",
                    userName = "Jogador 1",
                    userPhoto = null,
                    position = "Atacante",
                    status = "CONFIRMED",
                    paymentStatus = "PAID"
                )
            ),
            team1Name = "Time Vermelho",
            team2Name = "Time Azul",
            team1Score = 2,
            team2Score = 1,
            team1Players = listOf("Jogador 1", "Jogador 2"),
            team2Players = listOf("Jogador 3", "Jogador 4")
        )
        assertEquals("game123", game.id)
        assertEquals("Pelada do Sábado", game.title)
        assertEquals("2026-02-22", game.date)
        assertEquals("14:00", game.time)
        assertEquals("Campo do Parque", game.locationName)
        assertEquals("Rua das Flores, 123", game.locationAddress)
        assertEquals("SCHEDULED", game.status)
        assertEquals(10, game.playersCount)
        assertEquals(14, game.maxPlayers)
        assertEquals("Society", game.gameType)
        assertEquals(25.0, game.dailyPrice)
        assertEquals("João Silva", game.ownerName)
        assertEquals("group1", game.groupId)
        assertEquals("Pelada dos Amigos", game.groupName)
        assertEquals(1, game.confirmations.size)
        assertEquals("Time Vermelho", game.team1Name)
        assertEquals("Time Azul", game.team2Name)
        assertEquals(2, game.team1Score)
        assertEquals(1, game.team2Score)
        assertEquals(2, game.team1Players.size)
        assertEquals(2, game.team2Players.size)
    }

    @Test
    fun `WebConfirmation default values are correct`() {
        val confirmation = WebConfirmation(
            userId = "",
            userName = "",
            userPhoto = null,
            position = "",
            status = "",
            paymentStatus = ""
        )
        assertEquals("", confirmation.userId)
        assertEquals("", confirmation.userName)
        assertEquals(null, confirmation.userPhoto)
        assertEquals("", confirmation.position)
        assertEquals("", confirmation.status)
        assertEquals("", confirmation.paymentStatus)
    }

    @Test
    fun `WebConfirmation with all fields populated`() {
        val confirmation = WebConfirmation(
            userId = "user123",
            userName = "Maria Silva",
            userPhoto = "https://example.com/photo.jpg",
            position = "Goleiro",
            status = "CONFIRMED",
            paymentStatus = "PAID"
        )
        assertEquals("user123", confirmation.userId)
        assertEquals("Maria Silva", confirmation.userName)
        assertEquals("https://example.com/photo.jpg", confirmation.userPhoto)
        assertEquals("Goleiro", confirmation.position)
        assertEquals("CONFIRMED", confirmation.status)
        assertEquals("PAID", confirmation.paymentStatus)
    }

    @Test
    fun `UiState Loading is correct`() {
        val state = UiState.Loading
        assertTrue(state is UiState.Loading)
    }

    @Test
    fun `UiState Empty is correct`() {
        val state = UiState.Empty
        assertTrue(state is UiState.Empty)
    }

    @Test
    fun `UiState Error has correct message`() {
        val state = UiState.Error("Erro ao carregar jogos")
        assertTrue(state is UiState.Error)
        assertEquals("Erro ao carregar jogos", (state as UiState.Error).message)
    }

    @Test
    fun `UiState Success has correct data`() {
        val games = listOf(
            WebGame(
                id = "game1",
                title = "Test Game",
                date = "2026-02-22",
                time = "10:00",
                locationName = "Test Location",
                locationAddress = "",
                status = "SCHEDULED",
                playersCount = 5,
                maxPlayers = 10,
                gameType = "Society",
                dailyPrice = 0.0,
                ownerName = "",
                groupId = null,
                groupName = null
            )
        )
        val state: UiState<List<WebGame>> = UiState.Success(games)
        assertTrue(state is UiState.Success)
        assertEquals(1, (state as UiState.Success).data.size)
        assertEquals("game1", state.data.first().id)
    }

    @Test
    fun `filterGamesByStatus filters SCHEDULED correctly`() {
        val games = createTestGames()
        val filtered = games.filter { it.status == StatusFilter.SCHEDULED.status }
        assertEquals(2, filtered.size)
        assertTrue(filtered.all { it.status == "SCHEDULED" })
    }

    @Test
    fun `filterGamesByStatus filters FINISHED correctly`() {
        val games = createTestGames()
        val filtered = games.filter { it.status == StatusFilter.FINISHED.status }
        assertEquals(1, filtered.size)
        assertEquals("game3", filtered.first().id)
    }

    @Test
    fun `filterGamesByStatus ALL returns all games`() {
        val games = createTestGames()
        val filtered = if (StatusFilter.ALL.status == null) games
        else games.filter { it.status == StatusFilter.ALL.status }
        assertEquals(4, filtered.size)
    }

    @Test
    fun `sortGamesByDate sorts ascending correctly`() {
        val games = listOf(
            createGame("1", "2026-02-25"),
            createGame("2", "2026-02-22"),
            createGame("3", "2026-02-28")
        )
        val sorted = games.sortedWith(compareBy({ it.date }, { it.time }))
        assertEquals("2", sorted[0].id)
        assertEquals("1", sorted[1].id)
        assertEquals("3", sorted[2].id)
    }

    @Test
    fun `sortGamesByDateAndTime sorts correctly`() {
        val games = listOf(
            createGameWithTime("1", "2026-02-22", "14:00"),
            createGameWithTime("2", "2026-02-22", "10:00"),
            createGameWithTime("3", "2026-02-22", "16:00")
        )
        val sorted = games.sortedWith(compareBy({ it.date }, { it.time }))
        assertEquals("2", sorted[0].id)
        assertEquals("1", sorted[1].id)
        assertEquals("3", sorted[2].id)
    }

    @Test
    fun `empty games list returns empty filtered list`() {
        val games = emptyList<WebGame>()
        assertTrue(games.isEmpty())
    }

    @Test
    fun `mapToWebGame extracts id correctly`() {
        val map = mapOf<String, Any?>(
            "id" to "game123",
            "title" to "Test Game"
        )
        val game = mapToWebGameTest(map)
        assertEquals("game123", game.id)
    }

    @Test
    fun `mapToWebGame extracts nested confirmations`() {
        val map = mapOf<String, Any?>(
            "id" to "game1",
            "confirmations" to listOf(
                mapOf(
                    "userId" to "user1",
                    "userName" to "João",
                    "status" to "CONFIRMED"
                )
            )
        )
        val game = mapToWebGameTest(map)
        assertEquals(1, game.confirmations.size)
        assertEquals("user1", game.confirmations.first().userId)
        assertEquals("João", game.confirmations.first().userName)
        assertEquals("CONFIRMED", game.confirmations.first().status)
    }

    @Test
    fun `mapToWebGame handles missing optional fields`() {
        val map = mapOf<String, Any?>(
            "id" to "game1"
        )
        val game = mapToWebGameTest(map)
        assertEquals("", game.title)
        assertEquals("", game.date)
        assertEquals("", game.time)
        assertEquals("", game.locationName)
        assertEquals("SCHEDULED", game.status)
        assertEquals(0, game.playersCount)
        assertEquals(14, game.maxPlayers)
        assertEquals("Society", game.gameType)
        assertEquals(0.0, game.dailyPrice)
        assertEquals("", game.ownerName)
    }

    @Test
    fun `mapToWebGame extracts numbers correctly`() {
        val map = mapOf<String, Any?>(
            "id" to "game1",
            "playersCount" to 10,
            "maxPlayers" to 14,
            "dailyPrice" to 25.5,
            "team1Score" to 3,
            "team2Score" to 2
        )
        val game = mapToWebGameTest(map)
        assertEquals(10, game.playersCount)
        assertEquals(14, game.maxPlayers)
        assertEquals(25.5, game.dailyPrice)
        assertEquals(3, game.team1Score)
        assertEquals(2, game.team2Score)
    }

    @Test
    fun `mapToWebGame extracts teams correctly`() {
        val map = mapOf<String, Any?>(
            "id" to "game1",
            "team1Name" to "Time Vermelho",
            "team2Name" to "Time Azul",
            "team1Players" to listOf("Jogador 1", "Jogador 2"),
            "team2Players" to listOf("Jogador 3")
        )
        val game = mapToWebGameTest(map)
        assertEquals("Time Vermelho", game.team1Name)
        assertEquals("Time Azul", game.team2Name)
        assertEquals(2, game.team1Players.size)
        assertEquals(1, game.team2Players.size)
    }

    private fun createTestGames(): List<WebGame> = listOf(
        WebGame(
            id = "game1",
            title = "Game 1",
            date = "2026-02-22",
            time = "10:00",
            locationName = "Location 1",
            locationAddress = "",
            status = "SCHEDULED",
            playersCount = 5,
            maxPlayers = 10,
            gameType = "Society",
            dailyPrice = 0.0,
            ownerName = "",
            groupId = null,
            groupName = null
        ),
        WebGame(
            id = "game2",
            title = "Game 2",
            date = "2026-02-23",
            time = "14:00",
            locationName = "Location 2",
            locationAddress = "",
            status = "SCHEDULED",
            playersCount = 8,
            maxPlayers = 10,
            gameType = "Society",
            dailyPrice = 20.0,
            ownerName = "",
            groupId = null,
            groupName = null
        ),
        WebGame(
            id = "game3",
            title = "Game 3",
            date = "2026-02-20",
            time = "16:00",
            locationName = "Location 3",
            locationAddress = "",
            status = "FINISHED",
            playersCount = 14,
            maxPlayers = 14,
            gameType = "Society",
            dailyPrice = 25.0,
            ownerName = "",
            groupId = null,
            groupName = null
        ),
        WebGame(
            id = "game4",
            title = "Game 4",
            date = "2026-02-24",
            time = "09:00",
            locationName = "Location 4",
            locationAddress = "",
            status = "LIVE",
            playersCount = 10,
            maxPlayers = 10,
            gameType = "Society",
            dailyPrice = 30.0,
            ownerName = "",
            groupId = null,
            groupName = null
        )
    )

    private fun createGame(id: String, date: String): WebGame = WebGame(
        id = id,
        title = "",
        date = date,
        time = "",
        locationName = "",
        locationAddress = "",
        status = "",
        playersCount = 0,
        maxPlayers = 0,
        gameType = "",
        dailyPrice = 0.0,
        ownerName = "",
        groupId = null,
        groupName = null
    )

    private fun createGameWithTime(id: String, date: String, time: String): WebGame = WebGame(
        id = id,
        title = "",
        date = date,
        time = time,
        locationName = "",
        locationAddress = "",
        status = "",
        playersCount = 0,
        maxPlayers = 0,
        gameType = "",
        dailyPrice = 0.0,
        ownerName = "",
        groupId = null,
        groupName = null
    )

    @Suppress("UNCHECKED_CAST")
    private fun mapToWebGameTest(map: Map<String, Any?>): WebGame {
        val confirmationsMap = map["confirmations"] as? List<Map<String, Any?>> ?: emptyList()
        val confirmations = confirmationsMap.map { c ->
            WebConfirmation(
                userId = c["userId"] as? String ?: "",
                userName = c["userName"] as? String ?: "Jogador",
                userPhoto = c["userPhoto"] as? String,
                position = c["position"] as? String ?: "Linheiro",
                status = c["status"] as? String ?: "PENDING",
                paymentStatus = c["paymentStatus"] as? String ?: "PENDING"
            )
        }

        return WebGame(
            id = map["id"] as? String ?: "",
            title = map["title"] as? String ?: "",
            date = map["date"] as? String ?: "",
            time = map["time"] as? String ?: "",
            locationName = map["locationName"] as? String ?: map["location"] as? String ?: "",
            locationAddress = map["locationAddress"] as? String ?: "",
            status = map["status"] as? String ?: "SCHEDULED",
            playersCount = (map["playersCount"] as? Number)?.toInt() ?: (map["players"] as? Number)?.toInt() ?: 0,
            maxPlayers = (map["maxPlayers"] as? Number)?.toInt() ?: 14,
            gameType = map["gameType"] as? String ?: "Society",
            dailyPrice = (map["dailyPrice"] as? Number)?.toDouble() ?: 0.0,
            ownerName = map["ownerName"] as? String ?: "",
            groupId = map["groupId"] as? String,
            groupName = map["groupName"] as? String,
            confirmations = confirmations,
            team1Name = map["team1Name"] as? String ?: "Time A",
            team2Name = map["team2Name"] as? String ?: "Time B",
            team1Score = (map["team1Score"] as? Number)?.toInt() ?: 0,
            team2Score = (map["team2Score"] as? Number)?.toInt() ?: 0,
            team1Players = (map["team1Players"] as? List<String>) ?: emptyList(),
            team2Players = (map["team2Players"] as? List<String>) ?: emptyList()
        )
    }
}
