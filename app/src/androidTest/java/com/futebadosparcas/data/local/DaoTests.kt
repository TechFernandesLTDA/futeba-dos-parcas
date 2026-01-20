package com.futebadosparcas.data.local

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.local.dao.UserDao
import com.futebadosparcas.data.local.model.GameEntity
import com.futebadosparcas.data.local.model.UserEntity
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Testes instrumentados para os DAOs do Room.
 * Verificam operacoes CRUD e queries especiais.
 */
@RunWith(AndroidJUnit4::class)
class DaoTests {

    private lateinit var database: AppDatabase
    private lateinit var gameDao: GameDao
    private lateinit var userDao: UserDao

    @Before
    fun setup() {
        // Cria banco em memoria para testes
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java
        )
            .allowMainThreadQueries()
            .build()

        gameDao = database.gameDao()
        userDao = database.userDao()
    }

    @After
    fun teardown() {
        database.close()
    }

    // ==================== GameDao Tests ====================

    @Test
    fun insertGame_andGetById_returnsGame() = runTest {
        // Given
        val game = createTestGame("game-1")

        // When
        gameDao.insertGame(game)
        val result = gameDao.getGameById("game-1")

        // Then
        assertThat(result).isNotNull()
        assertThat(result?.id).isEqualTo("game-1")
        assertThat(result?.status).isEqualTo("SCHEDULED")
    }

    @Test
    fun insertGames_andGetAll_returnsAllGames() = runTest {
        // Given
        val games = listOf(
            createTestGame("game-1", date = "2026-01-20"),
            createTestGame("game-2", date = "2026-01-21"),
            createTestGame("game-3", date = "2026-01-22")
        )

        // When
        gameDao.insertGames(games)
        val result = gameDao.getAllGamesSnapshot()

        // Then
        assertThat(result).hasSize(3)
    }

    @Test
    fun getUpcomingGames_returnsOnlyScheduledAndConfirmed() = runTest {
        // Given - Mix de status
        val games = listOf(
            createTestGame("game-scheduled", status = "SCHEDULED"),
            createTestGame("game-confirmed", status = "CONFIRMED"),
            createTestGame("game-finished", status = "FINISHED"),
            createTestGame("game-cancelled", status = "CANCELLED")
        )
        gameDao.insertGames(games)

        // When
        val result = gameDao.getUpcomingGamesSnapshot()

        // Then
        assertThat(result).hasSize(2)
        assertThat(result.map { it.status }).containsExactly("SCHEDULED", "CONFIRMED")
    }

    @Test
    fun deleteGame_removesGame() = runTest {
        // Given
        val game = createTestGame("game-to-delete")
        gameDao.insertGame(game)

        // When
        gameDao.deleteGame("game-to-delete")
        val result = gameDao.getGameById("game-to-delete")

        // Then
        assertThat(result).isNull()
    }

    @Test
    fun clearAll_removesAllGames() = runTest {
        // Given
        gameDao.insertGames(listOf(
            createTestGame("game-1"),
            createTestGame("game-2")
        ))

        // When
        gameDao.clearAll()
        val result = gameDao.getAllGamesSnapshot()

        // Then
        assertThat(result).isEmpty()
    }

    @Test
    fun deleteExpiredGames_removesOldGames() = runTest {
        // Given - Jogo com cache antigo (simulado)
        val oldGame = createTestGame("old-game", cachedAt = 1000L)
        val newGame = createTestGame("new-game", cachedAt = System.currentTimeMillis())
        gameDao.insertGames(listOf(oldGame, newGame))

        // When - Delete jogos cacheados antes de 5000ms
        gameDao.deleteExpiredGames(5000L)
        val result = gameDao.getAllGamesSnapshot()

        // Then
        assertThat(result).hasSize(1)
        assertThat(result[0].id).isEqualTo("new-game")
    }

    @Test
    fun getAllGames_observesChanges() = runTest {
        // Given - Flow observando
        val game = createTestGame("flow-test-game")

        // When
        gameDao.insertGame(game)
        val result = gameDao.getAllGames().first()

        // Then
        assertThat(result).hasSize(1)
        assertThat(result[0].id).isEqualTo("flow-test-game")
    }

    // ==================== UserDao Tests ====================

    @Test
    fun insertUser_andGetById_returnsUser() = runTest {
        // Given
        val user = createTestUser("user-1")

        // When
        userDao.insertUser(user)
        val result = userDao.getUserById("user-1")

        // Then
        assertThat(result).isNotNull()
        assertThat(result?.id).isEqualTo("user-1")
        assertThat(result?.name).isEqualTo("Jogador Teste")
    }

    @Test
    fun insertUsers_replacesOnConflict() = runTest {
        // Given - Usuario inicial
        val originalUser = createTestUser("user-1", name = "Nome Original")
        userDao.insertUser(originalUser)

        // When - Insere com mesmo ID e nome diferente
        val updatedUser = createTestUser("user-1", name = "Nome Atualizado")
        userDao.insertUser(updatedUser)
        val result = userDao.getUserById("user-1")

        // Then
        assertThat(result?.name).isEqualTo("Nome Atualizado")
    }

    @Test
    fun deleteExpiredUsers_removesOldUsers() = runTest {
        // Given - Usuario com cache antigo
        val oldUser = createTestUser("old-user", cachedAt = 1000L)
        val newUser = createTestUser("new-user", cachedAt = System.currentTimeMillis())
        userDao.insertUsers(listOf(oldUser, newUser))

        // When - Delete usuarios cacheados antes de 5000ms
        userDao.deleteExpiredUsers(5000L)
        val oldResult = userDao.getUserById("old-user")
        val newResult = userDao.getUserById("new-user")

        // Then
        assertThat(oldResult).isNull()
        assertThat(newResult).isNotNull()
    }

    @Test
    fun clearAllUsers_removesAllUsers() = runTest {
        // Given
        userDao.insertUsers(listOf(
            createTestUser("user-1"),
            createTestUser("user-2")
        ))

        // When
        userDao.clearAll()
        val result1 = userDao.getUserById("user-1")
        val result2 = userDao.getUserById("user-2")

        // Then
        assertThat(result1).isNull()
        assertThat(result2).isNull()
    }

    // ==================== Helpers ====================

    private fun createTestGame(
        id: String,
        status: String = "SCHEDULED",
        date: String = "2026-01-20",
        cachedAt: Long = System.currentTimeMillis()
    ) = GameEntity(
        id = id,
        scheduleId = "schedule-$id",
        date = date,
        time = "20:00",
        endTime = "22:00",
        status = status,
        maxPlayers = 14,
        maxGoalkeepers = 2,
        players = emptyList(),
        dailyPrice = 25.0,
        confirmationClosesAt = null,
        numberOfTeams = 2,
        ownerId = "owner-123",
        ownerName = "Organizador Teste",
        locationId = "loc-1",
        fieldId = "field-1",
        locationName = "Arena Teste",
        locationAddress = "Rua Teste, 123",
        locationLat = -23.5,
        locationLng = -46.6,
        fieldName = "Quadra 1",
        gameType = "SOCIETY",
        recurrence = "WEEKLY",
        createdAt = System.currentTimeMillis(),
        dateTime = null,
        cachedAt = cachedAt
    )

    private fun createTestUser(
        id: String,
        name: String = "Jogador Teste",
        cachedAt: Long = System.currentTimeMillis()
    ) = UserEntity(
        id = id,
        email = "$id@test.com",
        name = name,
        photoUrl = null,
        fcmToken = null,
        createdAt = System.currentTimeMillis(),
        updatedAt = System.currentTimeMillis(),
        cachedAt = cachedAt
    )
}
