package com.futebadosparcas.domain.model

import com.futebadosparcas.util.MockLogExtension
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@DisplayName("AppResult Tests")
@ExtendWith(MockLogExtension::class)
class AppResultTest {

    @Nested
    @DisplayName("Success")
    inner class SuccessTests {

        @Test
        @DisplayName("Cria Success com valor")
        fun `creates Success with value`() {
            val result = AppResult.Success("hello")

            assertTrue(result.isSuccess)
            assertFalse(result.isError)
            assertFalse(result.isLoading)
            assertEquals("hello", result.getOrNull())
        }

        @Test
        @DisplayName("Success.getOrNull retorna valor")
        fun `success getOrNull returns value`() {
            val result = AppResult.Success(42)

            assertEquals(42, result.getOrNull())
        }

        @Test
        @DisplayName("Success.getOrThrow retorna valor")
        fun `success getOrThrow returns value`() {
            val result = AppResult.Success(42)

            assertEquals(42, result.getOrThrow())
        }

        @Test
        @DisplayName("Success com null getOrThrow retorna null")
        fun `success with null getOrThrow returns null`() {
            val result = AppResult.Success(null)

            assertNull(result.getOrThrow())
        }
    }

    @Nested
    @DisplayName("Error")
    inner class ErrorTests {

        @Test
        @DisplayName("Cria Error com mensagem")
        fun `creates Error with message`() {
            val result = AppResult.Error("Algo deu errado")

            assertTrue(result.isError)
            assertFalse(result.isSuccess)
            assertFalse(result.isLoading)
            assertNull(result.getOrNull())
        }

        @Test
        @DisplayName("Error pode carregar exception")
        fun `error can carry exception`() {
            val exception = RuntimeException("Erro interno")
            val result = AppResult.Error("Falha", exception)

            assertEquals("Falha", result.message)
            assertEquals(exception, result.exception)
        }

        @Test
        @DisplayName("Error.getOrNull retorna null")
        fun `error getOrNull returns null`() {
            val result = AppResult.Error("Erro")

            assertNull(result.getOrNull())
        }

        @Test
        @DisplayName("Error.getOrThrow lanca exception")
        fun `error getOrThrow throws exception`() {
            val result = AppResult.Error("Erro", RuntimeException("Falha"))

            val exception = assertThrows(RuntimeException::class.java) { result.getOrThrow() }
            assertEquals("Falha", exception.message)
        }
    }

    @Nested
    @DisplayName("Loading")
    inner class LoadingTests {

        @Test
        @DisplayName("Loading tem isLoading true")
        fun `loading has isLoading true`() {
            val result = AppResult.Loading

            assertTrue(result.isLoading)
            assertFalse(result.isSuccess)
            assertFalse(result.isError)
        }

        @Test
        @DisplayName("Loading.getOrNull retorna null")
        fun `loading getOrNull returns null`() {
            val result = AppResult.Loading

            assertNull(result.getOrNull())
        }

        @Test
        @DisplayName("Loading.getOrThrow retorna null")
        fun `loading getOrThrow returns null`() {
            val result = AppResult.Loading

            assertNull(result.getOrThrow())
        }
    }

    @Nested
    @DisplayName("map")
    inner class MapTests {

        @Test
        @DisplayName("Map transforma valor do Success")
        fun `map transforms Success value`() {
            val result = AppResult.Success(10)
            val mapped = result.map { it * 2 }

            assertEquals(20, (mapped as AppResult.Success).data)
        }

        @Test
        @DisplayName("Map preserva Error")
        fun `map preserves Error`() {
            val result = AppResult.Error("Erro")
            val mapped = result.map { it.toString() }

            assertTrue(mapped.isError)
            assertEquals("Erro", (mapped as AppResult.Error).message)
        }

        @Test
        @DisplayName("Map preserva Loading")
        fun `map preserves Loading`() {
            val result = AppResult.Loading
            val mapped = result.map { it.toString() }

            assertTrue(mapped.isLoading)
        }
    }

    @Nested
    @DisplayName("flatMap")
    inner class FlatMapTests {

        @Test
        @DisplayName("flatMap encadeia resultados")
        fun `flatMap chains results`() {
            val result = AppResult.Success(5)
            val chained = result.flatMap { AppResult.Success(it * 3) }

            assertEquals(15, (chained as AppResult.Success).data)
        }

        @Test
        @DisplayName("flatMap com Error interrompe corrente")
        fun `flatMap with Error breaks chain`() {
            val result = AppResult.Error("Falha")
            val chained = result.flatMap { AppResult.Success(it) }

            assertTrue(chained.isError)
        }
    }

    @Nested
    @DisplayName("Companion Methods")
    inner class CompanionTests {

        @Test
        @DisplayName("fromNullable com valor nao nulo retorna Success")
        fun `fromNullable with non null value returns Success`() {
            val result = AppResult.fromNullable("hello")

            assertTrue(result.isSuccess)
            assertEquals("hello", (result as AppResult.Success).data)
        }

        @Test
        @DisplayName("fromNullable com valor nulo retorna Error")
        fun `fromNullable with null value returns Error`() {
            val result = AppResult.fromNullable(null)

            assertTrue(result.isError)
        }

        @Test
        @DisplayName("catching captura excecoes")
        fun `catching catches exceptions`() = kotlinx.coroutines.test.runTest {
            val result = AppResult.catching("Falha na operacao") {
                throw RuntimeException("Erro interno")
            }

            assertTrue(result.isError)
            assertEquals("Falha na operacao", (result as AppResult.Error).message)
        }

        @Test
        @DisplayName("catching com sucesso retorna Success")
        fun `catching with success returns Success`() = kotlinx.coroutines.test.runTest {
            val result = AppResult.catching("Falha") { 42 }

            assertTrue(result.isSuccess)
            assertEquals(42, (result as AppResult.Success).data)
        }

        @Test
        @DisplayName("combine com todos Success retorna lista")
        fun `combine all Success returns list`() {
            val results = listOf(
                AppResult.Success(1),
                AppResult.Success(2),
                AppResult.Success(3)
            )

            val combined = AppResult.combine(results)

            assertTrue(combined.isSuccess)
            assertEquals(listOf(1, 2, 3), (combined as AppResult.Success).data)
        }

        @Test
        @DisplayName("combine com Error retorna primeiro erro")
        fun `combine with Error returns first error`() {
            val results = listOf(
                AppResult.Success(1),
                AppResult.Error("Segundo falhou"),
                AppResult.Error("Terceiro falhou")
            )

            val combined = AppResult.combine(results)

            assertTrue(combined.isError)
            assertEquals("Segundo falhou", (combined as AppResult.Error).message)
        }
    }
}
