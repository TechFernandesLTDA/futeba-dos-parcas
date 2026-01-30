package com.futebadosparcas.util

import com.futebadosparcas.data.model.ConfirmationStatus
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.model.GameVisibility
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.GroupMemberStatus
import com.futebadosparcas.data.model.GroupStatus
import com.futebadosparcas.data.model.PaymentStatus
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.data.model.PlayerRatingRole
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.model.UserRole
import java.util.Calendar
import java.util.Date

/**
 * Fornece dados de teste realistas baseados nos modelos de dados do projeto.
 *
 * Uso:
 * ```kotlin
 * @Test
 * fun myTest() {
 *     val testUser = TestFixtures.createUser()
 *     val testGame = TestFixtures.createGame(ownerId = testUser.id)
 * }
 * ```
 */
object TestFixtures {

    // ==================== USUÁRIOS ====================

    /**
     * Cria um usuário de teste com valores padrão realistas.
     */
    fun createUser(
        id: String = "user-123",
        email: String = "jogador@example.com",
        name: String = "João Silva",
        nickname: String? = "Bolinha",
        photoUrl: String? = "https://example.com/photo.jpg",
        strikerRating: Double = 4.0,
        midRating: Double = 3.5,
        defenderRating: Double = 3.0,
        gkRating: Double = 2.5,
        level: Int = 5,
        experiencePoints: Long = 2500L,
        isSearchable: Boolean = true,
        isProfilePublic: Boolean = true,
        role: String = UserRole.PLAYER.name
    ): User {
        val now = Date()
        return User(
            id = id,
            email = email,
            name = name,
            nickname = nickname,
            photoUrl = photoUrl,
            preferredFieldTypes = emptyList(),
            isSearchable = isSearchable,
            isProfilePublic = isProfilePublic,
            fcmToken = "fcm-token-$id",
            role = role,
            createdAt = now,
            updatedAt = now,
            strikerRating = strikerRating,
            midRating = midRating,
            defenderRating = defenderRating,
            gkRating = gkRating,
            level = level,
            experiencePoints = experiencePoints,
            milestonesAchieved = emptyList(),
            autoStrikerRating = strikerRating * 0.8,
            autoMidRating = midRating * 0.8,
            autoDefenderRating = defenderRating * 0.8,
            autoGkRating = gkRating * 0.8,
            autoRatingSamples = 10
        )
    }

    /**
     * Cria um admin de teste.
     */
    fun createAdminUser(
        id: String = "admin-123",
        name: String = "Administrador",
        email: String = "admin@example.com"
    ): User = createUser(
        id = id,
        name = name,
        email = email,
        role = UserRole.ADMIN.name,
        level = 10,
        experiencePoints = 10000L
    )

    /**
     * Cria um dono de quadra de teste.
     */
    fun createFieldOwnerUser(
        id: String = "owner-123",
        name: String = "Dono da Quadra",
        email: String = "owner@example.com"
    ): User = createUser(
        id = id,
        name = name,
        email = email,
        role = UserRole.FIELD_OWNER.name
    )

    /**
     * Cria múltiplos usuários de teste com IDs sequenciais.
     */
    fun createUserList(
        count: Int = 5,
        idPrefix: String = "user"
    ): List<User> {
        return (1..count).map { i ->
            createUser(
                id = "$idPrefix-$i",
                email = "player$i@example.com",
                name = "Jogador $i",
                strikerRating = 2.0 + i * 0.5,
                midRating = 3.0 + i * 0.3,
                level = i
            )
        }
    }

    // ==================== JOGOS ====================

    /**
     * Cria um jogo de teste com valores padrão realistas.
     */
    fun createGame(
        id: String = "game-123",
        date: String = "2024-02-15",
        time: String = "19:00",
        endTime: String = "20:30",
        ownerId: String = "user-123",
        ownerName: String = "João Silva",
        status: String = GameStatus.SCHEDULED.name,
        maxPlayers: Int = 14,
        maxGoalkeepers: Int = 3,
        playersCount: Int = 8,
        goalkeepersCount: Int = 1,
        players: List<String> = listOf("user-123", "user-124"),
        dailyPrice: Double = 50.0,
        totalCost: Double = 50.0,
        locationId: String = "loc-123",
        locationName: String = "Quadra Central",
        locationAddress: String = "Rua Principal, 100",
        fieldId: String = "field-123",
        fieldName: String = "Campo 1",
        groupId: String? = "group-123",
        groupName: String? = "Pelada dos Amigos",
        numberOfTeams: Int = 2,
        visibility: String = GameVisibility.GROUP_ONLY.name,
        team1Score: Int = 0,
        team2Score: Int = 0,
        team1Name: String = "Time 1",
        team2Name: String = "Time 2",
        xpProcessed: Boolean = false
    ): Game {
        val now = Date()
        return Game(
            id = id,
            date = date,
            time = time,
            endTime = endTime,
            status = status,
            maxPlayers = maxPlayers,
            maxGoalkeepers = maxGoalkeepers,
            playersCount = playersCount,
            goalkeepersCount = goalkeepersCount,
            players = players,
            dailyPrice = dailyPrice,
            totalCost = totalCost,
            numberOfTeams = numberOfTeams,
            ownerId = ownerId,
            ownerName = ownerName,
            locationId = locationId,
            fieldId = fieldId,
            locationName = locationName,
            locationAddress = locationAddress,
            fieldName = fieldName,
            visibility = visibility,
            team1Score = team1Score,
            team2Score = team2Score,
            team1Name = team1Name,
            team2Name = team2Name,
            groupId = groupId,
            groupName = groupName,
            createdAt = now,
            isPublic = visibility == GameVisibility.PUBLIC_CLOSED.name || visibility == GameVisibility.PUBLIC_OPEN.name,
            xpProcessed = xpProcessed
        )
    }

    /**
     * Cria um jogo com status LIVE (em andamento).
     */
    fun createLiveGame(
        id: String = "live-game-123",
        ownerId: String = "user-123",
        ownerName: String = "João Silva",
        team1Score: Int = 2,
        team2Score: Int = 1
    ): Game = createGame(
        id = id,
        status = GameStatus.LIVE.name,
        ownerId = ownerId,
        ownerName = ownerName,
        playersCount = 12,
        goalkeepersCount = 2,
        team1Score = team1Score,
        team2Score = team2Score
    )

    /**
     * Cria um jogo com status FINISHED (finalizado).
     */
    fun createFinishedGame(
        id: String = "finished-game-123",
        ownerId: String = "user-123",
        ownerName: String = "João Silva",
        team1Score: Int = 3,
        team2Score: Int = 2
    ): Game = createGame(
        id = id,
        status = GameStatus.FINISHED.name,
        ownerId = ownerId,
        ownerName = ownerName,
        playersCount = 14,
        goalkeepersCount = 2,
        team1Score = team1Score,
        team2Score = team2Score,
        xpProcessed = true
    )

    /**
     * Cria múltiplos jogos de teste.
     */
    fun createGameList(
        count: Int = 5,
        idPrefix: String = "game"
    ): List<Game> {
        return (1..count).map { i ->
            createGame(
                id = "$idPrefix-$i",
                date = "2024-02-${15 + i}",
                maxPlayers = 10 + i * 2
            )
        }
    }

    // ==================== CONFIRMAÇÕES DE PRESENÇA ====================

    /**
     * Cria uma confirmação de presença de teste.
     */
    fun createGameConfirmation(
        id: String = "conf-123",
        gameId: String = "game-123",
        userId: String = "user-123",
        userName: String = "João Silva",
        userPhoto: String? = "https://example.com/photo.jpg",
        position: String = PlayerPosition.FIELD.name,
        status: String = ConfirmationStatus.CONFIRMED.name,
        paymentStatus: String = PaymentStatus.PENDING.name,
        isCasualPlayer: Boolean = false,
        goals: Int = 0,
        assists: Int = 0,
        yellowCards: Int = 0,
        redCards: Int = 0,
        saves: Int = 0,
        xpEarned: Int = 50,
        isMvp: Boolean = false,
        isBestGk: Boolean = false,
        isWorstPlayer: Boolean = false
    ): GameConfirmation {
        val now = Date()
        return GameConfirmation(
            id = id,
            gameId = gameId,
            userId = userId,
            userName = userName,
            userPhoto = userPhoto,
            position = position,
            status = status,
            paymentStatus = paymentStatus,
            isCasualPlayer = isCasualPlayer,
            goals = goals,
            yellowCards = yellowCards,
            redCards = redCards,
            assists = assists,
            saves = saves,
            confirmedAt = now,
            xpEarned = xpEarned,
            isMvp = isMvp,
            isBestGk = isBestGk,
            isWorstPlayer = isWorstPlayer
        )
    }

    /**
     * Cria uma confirmação de goleiro.
     */
    fun createGoalkeeperConfirmation(
        id: String = "conf-gk-123",
        gameId: String = "game-123",
        userId: String = "gk-user-123",
        userName: String = "Goleiro Silva",
        saves: Int = 5,
        goals: Int = 0
    ): GameConfirmation = createGameConfirmation(
        id = id,
        gameId = gameId,
        userId = userId,
        userName = userName,
        position = PlayerPosition.GOALKEEPER.name,
        saves = saves,
        goals = goals
    )

    /**
     * Cria múltiplas confirmações de teste.
     */
    fun createGameConfirmationList(
        gameId: String = "game-123",
        count: Int = 5,
        idPrefix: String = "conf",
        userPrefix: String = "user"
    ): List<GameConfirmation> {
        return (1..count).map { i ->
            createGameConfirmation(
                id = "$idPrefix-$i",
                gameId = gameId,
                userId = "$userPrefix-$i",
                userName = "Jogador $i"
            )
        }
    }

    // ==================== GRUPOS ====================

    /**
     * Cria um grupo de teste com valores padrão realistas.
     */
    fun createGroup(
        id: String = "group-123",
        name: String = "Pelada dos Amigos",
        description: String = "Grupo de pelada de terça e quinta",
        ownerId: String = "user-123",
        ownerName: String = "João Silva",
        photoUrl: String? = "https://example.com/group-photo.jpg",
        memberCount: Int = 15,
        status: String = GroupStatus.ACTIVE.name,
        isPublic: Boolean = false
    ): Group {
        val now = Date()
        return Group(
            id = id,
            name = name,
            description = description,
            ownerId = ownerId,
            ownerName = ownerName,
            photoUrl = photoUrl,
            memberCount = memberCount,
            status = status,
            createdAt = now,
            updatedAt = now,
            isPublic = isPublic
        )
    }

    /**
     * Cria um grupo arquivado.
     */
    fun createArchivedGroup(
        id: String = "archived-group-123",
        name: String = "Grupo Antigo",
        ownerId: String = "user-123"
    ): Group = createGroup(
        id = id,
        name = name,
        ownerId = ownerId,
        status = GroupStatus.ARCHIVED.name,
        memberCount = 8
    )

    /**
     * Cria múltiplos grupos de teste.
     */
    fun createGroupList(
        count: Int = 3,
        idPrefix: String = "group",
        ownerPrefix: String = "owner"
    ): List<Group> {
        return (1..count).map { i ->
            createGroup(
                id = "$idPrefix-$i",
                name = "Grupo $i",
                ownerId = "$ownerPrefix-$i",
                memberCount = 10 + i * 3
            )
        }
    }

    // ==================== MEMBROS DO GRUPO ====================

    /**
     * Cria um membro de grupo de teste.
     */
    fun createGroupMember(
        id: String = "user-123",
        userId: String = "user-123",
        userName: String = "João Silva",
        userPhoto: String? = "https://example.com/photo.jpg",
        role: String = GroupMemberRole.MEMBER.name,
        status: String = GroupMemberStatus.ACTIVE.name,
        nickname: String? = null
    ): GroupMember {
        val now = Date()
        return GroupMember(
            id = id,
            userId = userId,
            userName = userName,
            userPhoto = userPhoto,
            role = role,
            status = status,
            joinedAt = now,
            nickname = nickname
        )
    }

    /**
     * Cria um owner de grupo.
     */
    fun createGroupOwnerMember(
        id: String = "owner-123",
        userId: String = "owner-123",
        userName: String = "Dono do Grupo"
    ): GroupMember = createGroupMember(
        id = id,
        userId = userId,
        userName = userName,
        role = GroupMemberRole.OWNER.name
    )

    /**
     * Cria um admin de grupo.
     */
    fun createGroupAdminMember(
        id: String = "admin-123",
        userId: String = "admin-123",
        userName: String = "Administrador do Grupo"
    ): GroupMember = createGroupMember(
        id = id,
        userId = userId,
        userName = userName,
        role = GroupMemberRole.ADMIN.name
    )

    /**
     * Cria múltiplos membros de grupo com diferentes papéis.
     */
    fun createGroupMemberList(
        groupSize: Int = 10,
        idPrefix: String = "user"
    ): List<GroupMember> {
        val members = mutableListOf<GroupMember>()

        // Adicionar owner (1)
        members.add(
            createGroupOwnerMember(
                id = "$idPrefix-owner",
                userId = "$idPrefix-owner"
            )
        )

        // Adicionar admins (2)
        for (i in 1..2) {
            members.add(
                createGroupAdminMember(
                    id = "$idPrefix-admin-$i",
                    userId = "$idPrefix-admin-$i"
                )
            )
        }

        // Adicionar membros normais (resto)
        for (i in 1..(groupSize - 3)) {
            members.add(
                createGroupMember(
                    id = "$idPrefix-$i",
                    userId = "$idPrefix-$i",
                    userName = "Membro $i"
                )
            )
        }

        return members
    }

    // ==================== UTILITÁRIOS ====================

    /**
     * Cria uma data no formato String (YYYY-MM-DD) a partir de um número de dias a partir de hoje.
     */
    fun createDateString(daysFromNow: Int = 0): String {
        val calendar = Calendar.getInstance()
        calendar.add(Calendar.DAY_OF_YEAR, daysFromNow)

        val year = calendar.get(Calendar.YEAR)
        val month = (calendar.get(Calendar.MONTH) + 1).toString().padStart(2, '0')
        val day = calendar.get(Calendar.DAY_OF_MONTH).toString().padStart(2, '0')

        return "$year-$month-$day"
    }

    /**
     * Cria uma data em formato Date a partir de dias a partir de hoje.
     */
    fun createDate(daysFromNow: Int = 0): Date {
        val calendar = Calendar.getInstance()
        calendar.add(Calendar.DAY_OF_YEAR, daysFromNow)
        return calendar.time
    }

    /**
     * Cria ratings realistas para um jogador.
     */
    fun createPlayerRatings(
        striker: Double = 3.5,
        mid: Double = 3.0,
        defender: Double = 2.5,
        goalkeeper: Double = 2.0
    ): Map<PlayerRatingRole, Double> = mapOf(
        PlayerRatingRole.STRIKER to striker,
        PlayerRatingRole.MID to mid,
        PlayerRatingRole.DEFENDER to defender,
        PlayerRatingRole.GOALKEEPER to goalkeeper
    )

    /**
     * Cria uma lista de IDs de usuários para simular jogadores em um jogo.
     */
    fun createPlayerIdList(
        count: Int = 5,
        prefix: String = "user"
    ): List<String> {
        return (1..count).map { "$prefix-$it" }
    }
}
