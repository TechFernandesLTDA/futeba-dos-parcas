package com.futebadosparcas.util

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.model.Badge
import com.futebadosparcas.data.model.Group
import java.util.Date

/**
 * Test Data Factory
 *
 * Provides factory functions to create test data objects.
 * Reduces boilerplate and ensures consistent test data.
 *
 * Usage:
 * ```kotlin
 * val testUser = TestDataFactory.createUser(name = "Test User")
 * val testGame = TestDataFactory.createGame(title = "Test Game")
 * ```
 */
object TestDataFactory {

    // ============================================
    // User Factory
    // ============================================

    fun createUser(
        id: String = "test-user-id",
        name: String = "Test User",
        email: String = "test@example.com",
        phone: String = "+5511999999999",
        xp: Int = 100,
        level: Int = 1,
        groupIds: List<String> = listOf("test-group-id"),
        photoUrl: String? = null,
        createdAt: Date = Date()
    ): User {
        return User(
            id = id,
            name = name,
            email = email,
            phone = phone,
            xp = xp,
            level = level,
            groupIds = groupIds,
            photoUrl = photoUrl,
            createdAt = createdAt
        )
    }

    fun createUserList(count: Int = 5): List<User> {
        return (1..count).map { i ->
            createUser(
                id = "user-$i",
                name = "User $i",
                email = "user$i@example.com",
                xp = i * 100
            )
        }
    }

    // ============================================
    // Game Factory
    // ============================================

    fun createGame(
        id: String = "test-game-id",
        title: String = "Test Game",
        groupId: String = "test-group-id",
        date: Date = Date(),
        maxPlayers: Int = 20,
        price: Double = 50.0,
        confirmed: List<String> = emptyList(),
        finished: Boolean = false
    ): Game {
        return Game(
            id = id,
            title = title,
            groupId = groupId,
            date = date,
            maxPlayers = maxPlayers,
            price = price,
            confirmed = confirmed,
            finished = finished
        )
    }

    fun createGameList(count: Int = 5): List<Game> {
        return (1..count).map { i ->
            createGame(
                id = "game-$i",
                title = "Game $i",
                date = Date(System.currentTimeMillis() + i * 86400000L) // i days from now
            )
        }
    }

    // ============================================
    // Group Factory
    // ============================================

    fun createGroup(
        id: String = "test-group-id",
        name: String = "Test Group",
        description: String = "Test group description",
        adminIds: List<String> = listOf("test-user-id"),
        memberIds: List<String> = listOf("test-user-id")
    ): Group {
        return Group(
            id = id,
            name = name,
            description = description,
            adminIds = adminIds,
            memberIds = memberIds
        )
    }

    // ============================================
    // Badge Factory
    // ============================================

    fun createBadge(
        id: String = "test-badge-id",
        name: String = "Test Badge",
        description: String = "Test badge description",
        iconUrl: String = "https://example.com/badge.png",
        requiredXp: Int = 100
    ): Badge {
        return Badge(
            id = id,
            name = name,
            description = description,
            iconUrl = iconUrl,
            requiredXp = requiredXp
        )
    }

    // ============================================
    // Result Wrappers
    // ============================================

    fun <T> successResult(data: T): Result<T> {
        return Result.success(data)
    }

    fun <T> errorResult(message: String = "Test error"): Result<T> {
        return Result.failure(Exception(message))
    }
}
