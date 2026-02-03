package com.futebadosparcas.domain

import com.futebadosparcas.domain.usecase.ValidateGroupNameUseCase
import com.futebadosparcas.domain.usecase.ValidateGroupDescriptionUseCase
import com.futebadosparcas.domain.usecase.ValidationResult
import kotlin.test.Test
import kotlin.test.assertTrue
import kotlin.test.assertFalse
import kotlin.test.assertEquals

/**
 * Testes compartilhados para ValidateGroupNameUseCase.
 * Executam em Android (JVM) e iOS (Native).
 */
class ValidateGroupNameUseCaseTest {

    @Test
    fun nomeVazio_retornaErro() {
        val result = ValidateGroupNameUseCase("")
        assertTrue(result.isError())
    }

    @Test
    fun nomeApenasEspacos_retornaErro() {
        val result = ValidateGroupNameUseCase("   ")
        assertTrue(result.isError())
    }

    @Test
    fun nomeMuitoCurto_retornaErro() {
        val result = ValidateGroupNameUseCase("ab")
        assertTrue(result.isError())
    }

    @Test
    fun nomeComExatamente3Caracteres_retornaSucesso() {
        val result = ValidateGroupNameUseCase("abc")
        assertTrue(result.isSuccess())
    }

    @Test
    fun nomeComExatamente50Caracteres_retornaSucesso() {
        val nome = "a".repeat(50)
        val result = ValidateGroupNameUseCase(nome)
        assertTrue(result.isSuccess())
    }

    @Test
    fun nomeMuitoLongo_retornaErro() {
        val nome = "a".repeat(51)
        val result = ValidateGroupNameUseCase(nome)
        assertTrue(result.isError())
    }

    @Test
    fun nomeValido_retornaSucesso() {
        val result = ValidateGroupNameUseCase("Pelada dos Parcas")
        assertTrue(result.isSuccess())
        assertEquals("Pelada dos Parcas", result.getOrNull())
    }

    @Test
    fun nomeComAcentos_retornaSucesso() {
        val result = ValidateGroupNameUseCase("Futebol Sao Joao")
        assertTrue(result.isSuccess())
    }

    @Test
    fun nomeComHifenUnderscoreApostrofo_retornaSucesso() {
        val result = ValidateGroupNameUseCase("Time-A_B'C")
        assertTrue(result.isSuccess())
    }

    @Test
    fun nomeComCaracteresEspeciais_retornaErro() {
        val result = ValidateGroupNameUseCase("Time@#\$%")
        assertTrue(result.isError())
    }

    @Test
    fun nomeComEspacosNasExtremidades_removeTrim() {
        val result = ValidateGroupNameUseCase("  Pelada dos Parcas  ")
        assertTrue(result.isSuccess())
        assertEquals("Pelada dos Parcas", result.getOrNull())
    }
}

/**
 * Testes compartilhados para ValidateGroupDescriptionUseCase.
 */
class ValidateGroupDescriptionUseCaseTest {

    @Test
    fun descricaoVazia_retornaSucesso() {
        val result = ValidateGroupDescriptionUseCase("")
        assertTrue(result.isSuccess())
    }

    @Test
    fun descricaoValida_retornaSucesso() {
        val result = ValidateGroupDescriptionUseCase("Pelada toda sexta-feira as 20h")
        assertTrue(result.isSuccess())
    }

    @Test
    fun descricaoMuitoLonga_retornaErro() {
        val desc = "a".repeat(201)
        val result = ValidateGroupDescriptionUseCase(desc)
        assertTrue(result.isError())
    }

    @Test
    fun descricaoComExatamente200Caracteres_retornaSucesso() {
        val desc = "a".repeat(200)
        val result = ValidateGroupDescriptionUseCase(desc)
        assertTrue(result.isSuccess())
    }
}
