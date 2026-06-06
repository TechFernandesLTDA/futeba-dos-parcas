package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.model.Group
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

@DisplayName("CreateGroupUseCase Tests")
@ExtendWith(MockLogExtension::class)
class CreateGroupUseCaseTest {

    private lateinit var groupRepository: GroupRepository
    private lateinit var useCase: CreateGroupUseCase

    @BeforeEach
    fun setup() {
        groupRepository = mockk(relaxed = true)
        useCase = CreateGroupUseCase(groupRepository)
    }

    @Nested
    @DisplayName("invoke")
    inner class InvokeTests {

        @Test
        @DisplayName("Cria grupo com nome e descricao validos")
        fun `creates group with valid name and description`() = runTest {
            val expectedGroup = Group(id = "group-1", name = "Pelada do Parque", description = "Grupo para peladas")
            coEvery { groupRepository.createGroup(any(), any(), any(), any()) } returns Result.success(expectedGroup)

            val result = useCase("Pelada do Parque", "Grupo para peladas")

            assertTrue(result.isSuccess)
            val group = result.getOrNull()
            assertNotNull(group)
            assertEquals("Pelada do Parque", group?.name)
        }

        @Test
        @DisplayName("Nome com menos de 3 caracteres retorna erro de validacao")
        fun `name shorter than 3 chars returns validation error`() = runTest {
            val result = useCase("ab", "Descricao")

            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull() is GroupValidationException)
        }

        @ParameterizedTest
        @ValueSource(strings = ["ab", "a", ""])
        @DisplayName("Nome invalido retorna GroupValidationException")
        fun `invalid name returns GroupValidationException`(name: String) = runTest {
            val result = useCase(name, "Descricao valida")

            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull() is GroupValidationException)
        }

        @Test
        @DisplayName("Nome com espacos e tratado corretamente")
        fun `name with whitespace is trimmed correctly`() = runTest {
            val expectedGroup = Group(id = "group-1", name = "Pelada Legal", description = "Descricao")
            coEvery { groupRepository.createGroup(any(), any(), any(), any()) } returns Result.success(expectedGroup)

            val result = useCase("  Pelada Legal  ", "Descricao")

            assertTrue(result.isSuccess)
        }

        @Test
        @DisplayName("Erro do repositorio ao criar grupo propaga falha")
        fun `repository error propagates failure`() = runTest {
            coEvery { groupRepository.createGroup(any(), any(), any(), any()) } returns Result.failure(RuntimeException("Erro ao criar"))

            val result = useCase("Pelada do Parque", "Descricao")

            assertTrue(result.isFailure)
            assertEquals("Erro ao criar", result.exceptionOrNull()?.message)
        }

        @Test
        @DisplayName("Cria grupo com foto")
        fun `creates group with photo`() = runTest {
            val expectedGroup = Group(id = "group-1", name = "Pelada", description = "Desc")
            coEvery { groupRepository.createGroup(any(), any(), any(), any()) } returns Result.success(expectedGroup)

            val result = useCase("Pelada", "Desc", "https://foto.url")

            assertTrue(result.isSuccess)
        }
    }
}
