package com.futebadosparcas.util

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupStatus
import com.futebadosparcas.domain.model.BadgeDefinition
import com.futebadosparcas.domain.model.BadgeCategory
import com.futebadosparcas.domain.model.BadgeRarity
import com.futebadosparcas.domain.model.FieldType
import com.futebadosparcas.domain.model.User as SharedUser
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
 * val testGame = TestDataFactory.createGame(date = "2024-02-15")
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
        phone: String? = "+5511999999999",
        nickname: String? = null,
        photoUrl: String? = null,
        level: Int = 1,
        experiencePoints: Long = 100L,
        createdAt: Date? = Date()
    ): User {
        return User(
            id = id,
            name = name,
            email = email,
            phone = phone,
            nickname = nickname,
            photoUrl = photoUrl,
            level = level,
            experiencePoints = experiencePoints,
            createdAt = createdAt
        )
    }

    fun createUserList(count: Int = 5): List<User> {
        return (1..count).map { i ->
            createUser(
                id = "user-$i",
                name = "User $i",
                email = "user$i@example.com",
                experiencePoints = i * 100L
            )
        }
    }

    // ============================================
    // Game Factory
    // ============================================

    fun createGame(
        id: String = "test-game-id",
        date: String = "2024-02-15",
        time: String = "19:00",
        status: String = GameStatus.SCHEDULED.name,
        maxPlayers: Int = 14,
        dailyPrice: Double = 50.0,
        ownerId: String = "test-owner-id",
        ownerName: String = "Test Owner",
        groupId: String? = "test-group-id",
        xpProcessed: Boolean = false
    ): Game {
        return Game(
            id = id,
            date = date,
            time = time,
            status = status,
            maxPlayers = maxPlayers,
            dailyPrice = dailyPrice,
            ownerId = ownerId,
            ownerName = ownerName,
            groupId = groupId,
            xpProcessed = xpProcessed
        )
    }

    fun createGameList(count: Int = 5): List<Game> {
        return (1..count).map { i ->
            createGame(
                id = "game-$i",
                date = "2024-02-${15 + i}"
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
        ownerId: String = "test-user-id",
        ownerName: String = "Test Owner",
        memberCount: Int = 5,
        status: String = GroupStatus.ACTIVE.name
    ): Group {
        return Group(
            id = id,
            name = name,
            description = description,
            ownerId = ownerId,
            ownerName = ownerName,
            memberCount = memberCount,
            status = status
        )
    }

    // ============================================
    // Badge Factory
    // ============================================

    fun createBadgeDefinition(
        id: String = "test-badge-id",
        name: String = "Test Badge",
        description: String = "Test badge description",
        emoji: String = "🏆",
        category: BadgeCategory = BadgeCategory.PERFORMANCE,
        rarity: BadgeRarity = BadgeRarity.COMMON,
        requiredValue: Int = 1
    ): BadgeDefinition {
        return BadgeDefinition(
            id = id,
            name = name,
            description = description,
            emoji = emoji,
            category = category,
            rarity = rarity,
            requiredValue = requiredValue
        )
    }

    // ============================================
    // SharedUser (Domain) Factory
    // ============================================

    /**
     * Cria um SharedUser (domain.model.User) para testes.
     * Usado em ViewModels que dependem do modelo de dominio compartilhado (KMP).
     */
    fun createSharedUser(
        id: String = "test-user-id",
        name: String = "Test User",
        email: String = "test@example.com",
        photoUrl: String = "",
        nickname: String? = null,
        level: Int = 5,
        experiencePoints: Long = 1000L,
        isProfilePublic: Boolean = true,
        preferredFieldTypes: List<FieldType> = emptyList(),
        createdAt: Long = System.currentTimeMillis()
    ): SharedUser {
        return SharedUser(
            id = id,
            name = name,
            email = email,
            photoUrl = photoUrl,
            nickname = nickname,
            level = level,
            experiencePoints = experiencePoints,
            isProfilePublic = isProfilePublic,
            preferredFieldTypes = preferredFieldTypes,
            createdAt = createdAt
        )
    }

    fun createSharedUserList(count: Int = 5): List<SharedUser> {
        return (1..count).map { i ->
            createSharedUser(
                id = "user-$i",
                name = "User $i",
                email = "user$i@example.com",
                experiencePoints = i * 200L
            )
        }
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
