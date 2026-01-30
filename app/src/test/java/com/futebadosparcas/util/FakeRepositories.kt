package com.futebadosparcas.util

import com.futebadosparcas.data.model.ConfirmationStatus
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.GroupMemberStatus
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.model.UserRole
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.GameFilterType
import com.futebadosparcas.data.repository.PaginatedGames
import com.futebadosparcas.data.repository.TimeConflict
import com.futebadosparcas.ui.games.GameWithConfirmations
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.flow

/**
 * Interface para repositório de usuários (facilita testes).
 *
 * Encapsula operações comuns de usuários que podem ser mockadas/testadas.
 */
interface IUserRepository {
    suspend fun getUserById(userId: String): Result<User>
    suspend fun createUser(user: User): Result<User>
    suspend fun updateUser(user: User): Result<Unit>
    suspend fun deleteUser(userId: String): Result<Unit>
    suspend fun getUsersByIds(userIds: List<String>): Result<List<User>>
    fun getUserFlow(userId: String): Flow<Result<User>>
}

/**
 * Implementação fake de IUserRepository para testes.
 *
 * Simula um repositório de usuários em memória sem dependências externas.
 *
 * Uso:
 * ```kotlin
 * @Test
 * fun myTest() = runTest {
 *     val fakeUserRepo = FakeUserRepository()
 *     val testUser = TestFixtures.createUser()
 *     fakeUserRepo.createUser(testUser)
 *
 *     val result = fakeUserRepo.getUserById(testUser.id)
 *     assertEquals(testUser.id, result.getOrNull()?.id)
 * }
 * ```
 */
class FakeUserRepository : IUserRepository {

    /**
     * Armazenamento em memória de usuários (ID -> User)
     */
    private val users = mutableMapOf<String, User>()

    /**
     * Simula delay de operações (útil para testes de performance)
     */
    var simulatedDelayMs: Long = 0L

    /**
     * Força falhas em operações (útil para testar tratamento de erros)
     */
    var shouldFail: Boolean = false
    var failureMessage: String = "Erro simulado"

    override suspend fun getUserById(userId: String): Result<User> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        val user = users[userId]
        return if (user != null) {
            Result.success(user)
        } else {
            Result.failure(Exception("Usuário não encontrado: $userId"))
        }
    }

    override suspend fun createUser(user: User): Result<User> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        if (users.containsKey(user.id)) {
            return Result.failure(Exception("Usuário já existe: ${user.id}"))
        }

        users[user.id] = user
        return Result.success(user)
    }

    override suspend fun updateUser(user: User): Result<Unit> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        if (!users.containsKey(user.id)) {
            return Result.failure(Exception("Usuário não encontrado: ${user.id}"))
        }

        users[user.id] = user
        return Result.success(Unit)
    }

    override suspend fun deleteUser(userId: String): Result<Unit> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        if (!users.containsKey(userId)) {
            return Result.failure(Exception("Usuário não encontrado: $userId"))
        }

        users.remove(userId)
        return Result.success(Unit)
    }

    override suspend fun getUsersByIds(userIds: List<String>): Result<List<User>> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        val foundUsers = userIds.mapNotNull { users[it] }
        return Result.success(foundUsers)
    }

    override fun getUserFlow(userId: String): Flow<Result<User>> = flow {
        emit(getUserById(userId))
    }

    /**
     * Adiciona múltiplos usuários de uma só vez (útil para setup de testes)
     */
    suspend fun addUsers(users: List<User>): Result<Unit> {
        return try {
            users.forEach { this.users[it.id] = it }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Limpa todos os usuários (útil para reset entre testes)
     */
    fun clear() {
        users.clear()
    }

    /**
     * Retorna todos os usuários armazenados (útil para verificações)
     */
    fun getAllUsers(): List<User> = users.values.toList()

    /**
     * Retorna o número de usuários armazenados
     */
    fun getUserCount(): Int = users.size

    private suspend fun simulateDelay() {
        if (simulatedDelayMs > 0) {
            kotlinx.coroutines.delay(simulatedDelayMs)
        }
    }
}

/**
 * Interface para repositório de jogos (facilita testes).
 *
 * Versão simplificada da GameRepository para testes.
 */
interface IGameRepository {
    suspend fun getGameById(gameId: String): Result<Game>
    suspend fun createGame(game: Game): Result<Game>
    suspend fun updateGame(game: Game): Result<Unit>
    suspend fun deleteGame(gameId: String): Result<Unit>
    suspend fun getUpcomingGames(): Result<List<Game>>
    suspend fun getFinishedGames(): Result<List<Game>>
    suspend fun confirmPresence(gameId: String, userId: String): Result<GameConfirmation>
    suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>>
    suspend fun cancelConfirmation(gameId: String, userId: String): Result<Unit>
}

/**
 * Implementação fake de IGameRepository para testes.
 *
 * Simula um repositório de jogos em memória sem dependências externas.
 *
 * Uso:
 * ```kotlin
 * @Test
 * fun myTest() = runTest {
 *     val fakeGameRepo = FakeGameRepository()
 *     val testGame = TestFixtures.createGame()
 *     fakeGameRepo.createGame(testGame)
 *
 *     val result = fakeGameRepo.getGameById(testGame.id)
 *     assertEquals(testGame.id, result.getOrNull()?.id)
 * }
 * ```
 */
class FakeGameRepository : IGameRepository {

    /**
     * Armazenamento em memória de jogos (ID -> Game)
     */
    private val games = mutableMapOf<String, Game>()

    /**
     * Armazenamento de confirmações (ID -> GameConfirmation)
     */
    private val confirmations = mutableMapOf<String, GameConfirmation>()

    /**
     * Simula delay de operações
     */
    var simulatedDelayMs: Long = 0L

    /**
     * Força falhas em operações
     */
    var shouldFail: Boolean = false
    var failureMessage: String = "Erro simulado"

    override suspend fun getGameById(gameId: String): Result<Game> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        val game = games[gameId]
        return if (game != null) {
            Result.success(game)
        } else {
            Result.failure(Exception("Jogo não encontrado: $gameId"))
        }
    }

    override suspend fun createGame(game: Game): Result<Game> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        if (games.containsKey(game.id)) {
            return Result.failure(Exception("Jogo já existe: ${game.id}"))
        }

        games[game.id] = game
        return Result.success(game)
    }

    override suspend fun updateGame(game: Game): Result<Unit> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        if (!games.containsKey(game.id)) {
            return Result.failure(Exception("Jogo não encontrado: ${game.id}"))
        }

        games[game.id] = game
        return Result.success(Unit)
    }

    override suspend fun deleteGame(gameId: String): Result<Unit> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        if (!games.containsKey(gameId)) {
            return Result.failure(Exception("Jogo não encontrado: $gameId"))
        }

        games.remove(gameId)
        confirmations.values.removeIf { it.gameId == gameId }
        return Result.success(Unit)
    }

    override suspend fun getUpcomingGames(): Result<List<Game>> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        val upcoming = games.values.filter {
            it.status == GameStatus.SCHEDULED.name || it.status == GameStatus.CONFIRMED.name
        }
        return Result.success(upcoming)
    }

    override suspend fun getFinishedGames(): Result<List<Game>> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        val finished = games.values.filter { it.status == GameStatus.FINISHED.name }
        return Result.success(finished)
    }

    override suspend fun confirmPresence(gameId: String, userId: String): Result<GameConfirmation> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        val game = games[gameId] ?: return Result.failure(Exception("Jogo não encontrado"))

        val confirmationId = "${gameId}_$userId"
        val confirmation = GameConfirmation(
            id = confirmationId,
            gameId = gameId,
            userId = userId,
            userName = "Jogador Teste",
            status = ConfirmationStatus.CONFIRMED.name
        )

        confirmations[confirmationId] = confirmation
        return Result.success(confirmation)
    }

    override suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        val gameConfirmations = confirmations.values.filter { it.gameId == gameId }
        return Result.success(gameConfirmations)
    }

    override suspend fun cancelConfirmation(gameId: String, userId: String): Result<Unit> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        val confirmationId = "${gameId}_$userId"
        confirmations.remove(confirmationId)
        return Result.success(Unit)
    }

    /**
     * Adiciona múltiplos jogos de uma só vez
     */
    suspend fun addGames(games: List<Game>): Result<Unit> {
        return try {
            games.forEach { this.games[it.id] = it }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Limpa todos os dados (jogos e confirmações)
     */
    fun clear() {
        games.clear()
        confirmations.clear()
    }

    /**
     * Retorna todos os jogos
     */
    fun getAllGames(): List<Game> = games.values.toList()

    /**
     * Retorna o número de jogos
     */
    fun getGameCount(): Int = games.size

    private suspend fun simulateDelay() {
        if (simulatedDelayMs > 0) {
            kotlinx.coroutines.delay(simulatedDelayMs)
        }
    }
}

/**
 * Interface para repositório de grupos (facilita testes).
 */
interface IGroupRepository {
    suspend fun getGroupById(groupId: String): Result<Group>
    suspend fun createGroup(group: Group): Result<Group>
    suspend fun updateGroup(group: Group): Result<Unit>
    suspend fun deleteGroup(groupId: String): Result<Unit>
    suspend fun getGroupMembers(groupId: String): Result<List<GroupMember>>
    suspend fun addMemberToGroup(groupId: String, member: GroupMember): Result<Unit>
    suspend fun removeMemberFromGroup(groupId: String, memberId: String): Result<Unit>
    suspend fun getUserGroups(userId: String): Result<List<Group>>
}

/**
 * Implementação fake de IGroupRepository para testes.
 *
 * Simula um repositório de grupos em memória sem dependências externas.
 *
 * Uso:
 * ```kotlin
 * @Test
 * fun myTest() = runTest {
 *     val fakeGroupRepo = FakeGroupRepository()
 *     val testGroup = TestFixtures.createGroup()
 *     fakeGroupRepo.createGroup(testGroup)
 *
 *     val result = fakeGroupRepo.getGroupById(testGroup.id)
 *     assertEquals(testGroup.id, result.getOrNull()?.id)
 * }
 * ```
 */
class FakeGroupRepository : IGroupRepository {

    /**
     * Armazenamento em memória de grupos (ID -> Group)
     */
    private val groups = mutableMapOf<String, Group>()

    /**
     * Armazenamento de membros de grupo (groupId -> membros)
     */
    private val groupMembers = mutableMapOf<String, MutableList<GroupMember>>()

    /**
     * Simula delay de operações
     */
    var simulatedDelayMs: Long = 0L

    /**
     * Força falhas em operações
     */
    var shouldFail: Boolean = false
    var failureMessage: String = "Erro simulado"

    override suspend fun getGroupById(groupId: String): Result<Group> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        val group = groups[groupId]
        return if (group != null) {
            Result.success(group)
        } else {
            Result.failure(Exception("Grupo não encontrado: $groupId"))
        }
    }

    override suspend fun createGroup(group: Group): Result<Group> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        if (groups.containsKey(group.id)) {
            return Result.failure(Exception("Grupo já existe: ${group.id}"))
        }

        groups[group.id] = group
        groupMembers[group.id] = mutableListOf()

        // Adicionar owner como primeiro membro
        val ownerMember = GroupMember(
            id = group.ownerId,
            userId = group.ownerId,
            userName = group.ownerName,
            role = GroupMemberRole.OWNER.name,
            status = GroupMemberStatus.ACTIVE.name
        )
        groupMembers[group.id]?.add(ownerMember)

        return Result.success(group)
    }

    override suspend fun updateGroup(group: Group): Result<Unit> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        if (!groups.containsKey(group.id)) {
            return Result.failure(Exception("Grupo não encontrado: ${group.id}"))
        }

        groups[group.id] = group
        return Result.success(Unit)
    }

    override suspend fun deleteGroup(groupId: String): Result<Unit> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        if (!groups.containsKey(groupId)) {
            return Result.failure(Exception("Grupo não encontrado: $groupId"))
        }

        groups.remove(groupId)
        groupMembers.remove(groupId)
        return Result.success(Unit)
    }

    override suspend fun getGroupMembers(groupId: String): Result<List<GroupMember>> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        val members = groupMembers[groupId]
        return if (members != null) {
            Result.success(
                members.filter { it.status == GroupMemberStatus.ACTIVE.name }
            )
        } else {
            Result.failure(Exception("Grupo não encontrado: $groupId"))
        }
    }

    override suspend fun addMemberToGroup(groupId: String, member: GroupMember): Result<Unit> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        val group = groups[groupId] ?: return Result.failure(Exception("Grupo não encontrado"))

        val members = groupMembers[groupId] ?: mutableListOf()
        if (members.any { it.userId == member.userId && it.status == GroupMemberStatus.ACTIVE.name }) {
            return Result.failure(Exception("Membro já está no grupo"))
        }

        members.add(member)
        groupMembers[groupId] = members

        // Atualizar member_count do grupo
        group.memberCount = members.count { it.status == GroupMemberStatus.ACTIVE.name }

        return Result.success(Unit)
    }

    override suspend fun removeMemberFromGroup(groupId: String, memberId: String): Result<Unit> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        val group = groups[groupId] ?: return Result.failure(Exception("Grupo não encontrado"))
        val members = groupMembers[groupId] ?: return Result.failure(Exception("Membros não encontrados"))

        val memberIndex = members.indexOfFirst { it.userId == memberId }
        if (memberIndex == -1) {
            return Result.failure(Exception("Membro não encontrado"))
        }

        val member = members[memberIndex]
        if (member.role == GroupMemberRole.OWNER.name) {
            return Result.failure(Exception("Não é possível remover o dono do grupo"))
        }

        // Substituir membro por cópia com status REMOVED
        val updatedMember = member.copy(status = GroupMemberStatus.REMOVED.name)
        members[memberIndex] = updatedMember

        // Atualizar member_count do grupo
        group.memberCount = members.count { it.status == GroupMemberStatus.ACTIVE.name }

        return Result.success(Unit)
    }

    override suspend fun getUserGroups(userId: String): Result<List<Group>> {
        simulateDelay()
        if (shouldFail) return Result.failure(Exception(failureMessage))

        val userGroups = groups.values.filter { group ->
            groupMembers[group.id]?.any {
                it.userId == userId && it.status == GroupMemberStatus.ACTIVE.name
            } ?: false
        }

        return Result.success(userGroups)
    }

    /**
     * Adiciona múltiplos grupos de uma só vez
     */
    suspend fun addGroups(groups: List<Group>): Result<Unit> {
        return try {
            groups.forEach { createGroup(it) }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Limpa todos os dados
     */
    fun clear() {
        groups.clear()
        groupMembers.clear()
    }

    /**
     * Retorna todos os grupos
     */
    fun getAllGroups(): List<Group> = groups.values.toList()

    /**
     * Retorna o número de grupos
     */
    fun getGroupCount(): Int = groups.size

    private suspend fun simulateDelay() {
        if (simulatedDelayMs > 0) {
            kotlinx.coroutines.delay(simulatedDelayMs)
        }
    }
}
