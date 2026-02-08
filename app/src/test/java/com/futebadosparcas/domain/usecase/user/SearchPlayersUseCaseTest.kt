package com.futebadosparcas.domain.usecase.user

import com.futebadosparcas.domain.model.FieldType
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para SearchPlayersUseCase.
 * Verifica busca com filtros, paginacao, ordenacao e busca por tipo de campo.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("SearchPlayersUseCase Tests")
@ExtendWith(MockLogExtension::class)
class SearchPlayersUseCaseTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var userRepository: UserRepository
    private lateinit var useCase: SearchPlayersUseCase

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        userRepository = mockk()
        useCase = SearchPlayersUseCase(userRepository)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ========== Busca Basica ==========

    @Test
    @DisplayName("Deve buscar jogadores com query e retornar resultado paginado")
    fun search_validQuery_returnsPaginatedResult() = runTest {
        // Given
        val players = (1..5).map { createTestUser("user$it", "Jogador $it") }
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(players)

        // When
        val result = useCase.search(SearchPlayersUseCase.SearchFilters(query = "Jogador"))

        // Then
        assertTrue(result.isSuccess)
        val searchResult = result.getOrNull()!!
        assertEquals(5, searchResult.totalCount)
        assertEquals(5, searchResult.players.size)
        assertFalse(searchResult.hasMore)
        assertEquals(0, searchResult.currentPage)
    }

    @Test
    @DisplayName("Deve retornar lista vazia quando nao encontra jogadores")
    fun search_noResults_returnsEmptyList() = runTest {
        // Given
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(emptyList())

        // When
        val result = useCase.search(SearchPlayersUseCase.SearchFilters(query = "naoexiste"))

        // Then
        assertTrue(result.isSuccess)
        val searchResult = result.getOrNull()!!
        assertEquals(0, searchResult.totalCount)
        assertTrue(searchResult.players.isEmpty())
    }

    // ========== Paginacao ==========

    @Test
    @DisplayName("Deve paginar corretamente com pageSize=2")
    fun search_withPagination_returnsCorrectPage() = runTest {
        // Given
        val players = (1..5).map { createTestUser("user$it", "Jogador $it") }
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(players)

        // When - Pagina 0 com pageSize=2
        val page0 = useCase.search(SearchPlayersUseCase.SearchFilters(), page = 0, pageSize = 2)

        // Then
        val result0 = page0.getOrNull()!!
        assertEquals(2, result0.players.size)
        assertEquals(5, result0.totalCount)
        assertTrue(result0.hasMore)
        assertEquals(0, result0.currentPage)
    }

    @Test
    @DisplayName("Ultima pagina deve ter hasMore=false")
    fun search_lastPage_hasMoreFalse() = runTest {
        // Given
        val players = (1..5).map { createTestUser("user$it", "Jogador $it") }
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(players)

        // When - Pagina 2 com pageSize=2 (indices 4-5, mas so tem 5 itens)
        val lastPage = useCase.search(SearchPlayersUseCase.SearchFilters(), page = 2, pageSize = 2)

        // Then
        val result = lastPage.getOrNull()!!
        assertEquals(1, result.players.size)
        assertFalse(result.hasMore)
    }

    @Test
    @DisplayName("Pagina alem do limite deve retornar lista vazia")
    fun search_pageBeyondLimit_returnsEmpty() = runTest {
        // Given
        val players = (1..3).map { createTestUser("user$it", "Jogador $it") }
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(players)

        // When
        val result = useCase.search(SearchPlayersUseCase.SearchFilters(), page = 10, pageSize = 20)

        // Then
        assertTrue(result.getOrNull()!!.players.isEmpty())
    }

    // ========== Filtros ==========

    @Test
    @DisplayName("Deve filtrar apenas perfis publicos por padrao")
    fun search_defaultFilter_onlyPublicProfiles() = runTest {
        // Given
        val players = listOf(
            createTestUser("u1", "Publico", isPublic = true),
            createTestUser("u2", "Privado", isPublic = false),
            createTestUser("u3", "Publico 2", isPublic = true)
        )
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(players)

        // When
        val result = useCase.search(SearchPlayersUseCase.SearchFilters(onlyPublicProfiles = true))

        // Then
        assertEquals(2, result.getOrNull()!!.totalCount)
    }

    @Test
    @DisplayName("Deve filtrar por nivel minimo")
    fun search_minLevel_filtersCorrectly() = runTest {
        // Given
        val players = listOf(
            createTestUser("u1", "Noob", level = 1),
            createTestUser("u2", "Mid", level = 5),
            createTestUser("u3", "Pro", level = 10)
        )
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(players)

        // When
        val result = useCase.search(SearchPlayersUseCase.SearchFilters(
            minLevel = 5,
            onlyPublicProfiles = false
        ))

        // Then
        assertEquals(2, result.getOrNull()!!.totalCount)
    }

    @Test
    @DisplayName("Deve filtrar por nivel maximo")
    fun search_maxLevel_filtersCorrectly() = runTest {
        // Given
        val players = listOf(
            createTestUser("u1", "Noob", level = 1),
            createTestUser("u2", "Mid", level = 5),
            createTestUser("u3", "Pro", level = 10)
        )
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(players)

        // When
        val result = useCase.search(SearchPlayersUseCase.SearchFilters(
            maxLevel = 5,
            onlyPublicProfiles = false
        ))

        // Then
        assertEquals(2, result.getOrNull()!!.totalCount)
    }

    @Test
    @DisplayName("Deve filtrar por tipo de campo preferido")
    fun search_fieldType_filtersCorrectly() = runTest {
        // Given
        val players = listOf(
            createTestUser("u1", "Fut", fieldTypes = listOf(FieldType.SOCIETY)),
            createTestUser("u2", "Sal", fieldTypes = listOf(FieldType.FUTSAL)),
            createTestUser("u3", "Both", fieldTypes = listOf(FieldType.SOCIETY, FieldType.FUTSAL))
        )
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(players)

        // When
        val result = useCase.search(SearchPlayersUseCase.SearchFilters(
            fieldTypes = listOf(FieldType.FUTSAL),
            onlyPublicProfiles = false
        ))

        // Then
        assertEquals(2, result.getOrNull()!!.totalCount) // u2 e u3
    }

    // ========== Ordenacao ==========

    @Test
    @DisplayName("Deve ordenar por nome ascendente")
    fun search_sortNameAsc_ordersCorrectly() = runTest {
        // Given
        val players = listOf(
            createTestUser("u1", "Carlos"),
            createTestUser("u2", "Ana"),
            createTestUser("u3", "Bruno")
        )
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(players)

        // When
        val result = useCase.search(SearchPlayersUseCase.SearchFilters(
            sortOption = SearchPlayersUseCase.SortOption.NAME_ASC,
            onlyPublicProfiles = false
        ))

        // Then
        val ordered = result.getOrNull()!!.players
        assertEquals("Ana", ordered[0].name)
        assertEquals("Bruno", ordered[1].name)
        assertEquals("Carlos", ordered[2].name)
    }

    @Test
    @DisplayName("Deve ordenar por nivel descendente")
    fun search_sortLevelDesc_ordersCorrectly() = runTest {
        // Given
        val players = listOf(
            createTestUser("u1", "Low", level = 3),
            createTestUser("u2", "High", level = 15),
            createTestUser("u3", "Mid", level = 8)
        )
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(players)

        // When
        val result = useCase.search(SearchPlayersUseCase.SearchFilters(
            sortOption = SearchPlayersUseCase.SortOption.LEVEL_DESC,
            onlyPublicProfiles = false
        ))

        // Then
        val ordered = result.getOrNull()!!.players
        assertEquals("High", ordered[0].name)
        assertEquals("Mid", ordered[1].name)
        assertEquals("Low", ordered[2].name)
    }

    // ========== Falha do Repositorio ==========

    @Test
    @DisplayName("Deve propagar erro do repositorio")
    fun search_repositoryFailure_propagatesError() = runTest {
        // Given
        coEvery { userRepository.searchUsers(any(), any()) } returns
            Result.failure(Exception("Connection timeout"))

        // When
        val result = useCase.search(SearchPlayersUseCase.SearchFilters(query = "test"))

        // Then
        assertTrue(result.isFailure)
        assertEquals("Connection timeout", result.exceptionOrNull()?.message)
    }

    // ========== Busca por Tipo de Campo ==========

    @Test
    @DisplayName("getByFieldType deve retornar jogadores com campo preferido")
    fun getByFieldType_validType_returnsFilteredPlayers() = runTest {
        // Given
        val players = listOf(
            createTestUser("u1", "Fut", fieldTypes = listOf(FieldType.SOCIETY)),
            createTestUser("u2", "Sal", fieldTypes = listOf(FieldType.FUTSAL))
        )
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(players)

        // When
        val result = useCase.getByFieldType(FieldType.SOCIETY)

        // Then
        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrNull()!!.size)
        assertEquals("Fut", result.getOrNull()!![0].name)
    }

    // ========== Helpers ==========

    private fun createTestUser(
        id: String,
        name: String,
        level: Int = 5,
        isPublic: Boolean = true,
        fieldTypes: List<FieldType> = emptyList()
    ) = User(
        id = id,
        name = name,
        email = "$id@test.com",
        level = level,
        experiencePoints = level * 200L,
        isProfilePublic = isPublic,
        preferredFieldTypes = fieldTypes,
        createdAt = System.currentTimeMillis()
    )
}
