package com.futebadosparcas.domain.model

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Testes unitários para FieldType.
 * Cobre tipos de campo e propriedades.
 */
@DisplayName("FieldType Tests")
class FieldTypeTest {

    // ==================== TESTES DE ENUM VALUES ====================

    @Nested
    @DisplayName("Enum Values")
    inner class EnumValuesTests {

        @Test
        @DisplayName("Deve ter exatamente 5 tipos de campo")
        fun `should have exactly 5 field types`() {
            assertEquals(5, FieldType.entries.size)
        }

        @Test
        @DisplayName("Deve conter todos os tipos esperados")
        fun `should contain all expected field types`() {
            val types = FieldType.entries.map { it.name }

            assertTrue(types.contains("SOCIETY"))
            assertTrue(types.contains("FUTSAL"))
            assertTrue(types.contains("CAMPO"))
            assertTrue(types.contains("AREIA"))
            assertTrue(types.contains("OUTROS"))
        }

        @Test
        @DisplayName("Ordem dos valores deve estar correta")
        fun `order should be correct`() {
            val values = FieldType.entries

            assertEquals(FieldType.SOCIETY, values[0])
            assertEquals(FieldType.FUTSAL, values[1])
            assertEquals(FieldType.CAMPO, values[2])
            assertEquals(FieldType.AREIA, values[3])
            assertEquals(FieldType.OUTROS, values[4])
        }

        @Test
        @DisplayName("valueOf deve funcionar corretamente")
        fun `valueOf should work correctly`() {
            assertEquals(FieldType.SOCIETY, FieldType.valueOf("SOCIETY"))
            assertEquals(FieldType.FUTSAL, FieldType.valueOf("FUTSAL"))
            assertEquals(FieldType.CAMPO, FieldType.valueOf("CAMPO"))
            assertEquals(FieldType.AREIA, FieldType.valueOf("AREIA"))
            assertEquals(FieldType.OUTROS, FieldType.valueOf("OUTROS"))
        }

        @Test
        @DisplayName("ordinal deve ser correto")
        fun `ordinal should be correct`() {
            assertEquals(0, FieldType.SOCIETY.ordinal)
            assertEquals(1, FieldType.FUTSAL.ordinal)
            assertEquals(2, FieldType.CAMPO.ordinal)
            assertEquals(3, FieldType.AREIA.ordinal)
            assertEquals(4, FieldType.OUTROS.ordinal)
        }
    }

    // ==================== TESTES DE displayName ====================

    @Nested
    @DisplayName("displayName")
    inner class DisplayNameTests {

        @Test
        @DisplayName("Todos os tipos devem ter displayName não vazio")
        fun `all types should have non-empty displayName`() {
            FieldType.entries.forEach { type ->
                assertTrue(type.displayName.isNotEmpty(), "$type deveria ter displayName")
            }
        }

        @Test
        @DisplayName("SOCIETY deve ter displayName 'Society'")
        fun `SOCIETY should have correct displayName`() {
            assertEquals("Society", FieldType.SOCIETY.displayName)
        }

        @Test
        @DisplayName("FUTSAL deve ter displayName 'Futsal'")
        fun `FUTSAL should have correct displayName`() {
            assertEquals("Futsal", FieldType.FUTSAL.displayName)
        }

        @Test
        @DisplayName("CAMPO deve ter displayName 'Campo'")
        fun `CAMPO should have correct displayName`() {
            assertEquals("Campo", FieldType.CAMPO.displayName)
        }

        @Test
        @DisplayName("AREIA deve ter displayName 'Areia'")
        fun `AREIA should have correct displayName`() {
            assertEquals("Areia", FieldType.AREIA.displayName)
        }

        @Test
        @DisplayName("OUTROS deve ter displayName 'Outros'")
        fun `OUTROS should have correct displayName`() {
            assertEquals("Outros", FieldType.OUTROS.displayName)
        }
    }

    // ==================== TESTES DE COMPARAÇÃO ====================

    @Nested
    @DisplayName("Comparison")
    inner class ComparisonTests {

        @Test
        @DisplayName("Mesmo tipo deve ser igual")
        fun `same type should be equal`() {
            assertEquals(FieldType.SOCIETY, FieldType.SOCIETY)
            assertEquals(FieldType.FUTSAL, FieldType.FUTSAL)
        }

        @Test
        @DisplayName("Tipos diferentes não devem ser iguais")
        fun `different types should not be equal`() {
            assertNotEquals(FieldType.SOCIETY, FieldType.FUTSAL)
            assertNotEquals(FieldType.CAMPO, FieldType.AREIA)
        }

        @Test
        @DisplayName("Mesma instância deve ser idêntica")
        fun `same instance should be identical`() {
            val type1 = FieldType.SOCIETY
            val type2 = FieldType.SOCIETY
            assertSame(type1, type2)
        }
    }

    // ==================== TESTES DE SERIALIZAÇÃO ====================

    @Nested
    @DisplayName("Serialization")
    inner class SerializationTests {

        @Test
        @DisplayName("name deve retornar string correta")
        fun `name should return correct string`() {
            assertEquals("SOCIETY", FieldType.SOCIETY.name)
            assertEquals("FUTSAL", FieldType.FUTSAL.name)
            assertEquals("CAMPO", FieldType.CAMPO.name)
            assertEquals("AREIA", FieldType.AREIA.name)
            assertEquals("OUTROS", FieldType.OUTROS.name)
        }

        @Test
        @DisplayName("toString deve retornar name")
        fun `toString should return name`() {
            assertEquals("SOCIETY", FieldType.SOCIETY.toString())
            assertEquals("FUTSAL", FieldType.FUTSAL.toString())
            assertEquals("CAMPO", FieldType.CAMPO.toString())
            assertEquals("AREIA", FieldType.AREIA.toString())
            assertEquals("OUTROS", FieldType.OUTROS.toString())
        }
    }

    // ==================== TESTES DE CENÁRIOS DE USO ====================

    @Nested
    @DisplayName("Usage Scenarios")
    inner class UsageScenariosTests {

        @Test
        @DisplayName("Deve permitir iterar sobre todos os tipos")
        fun `should allow iterating over all types`() {
            var count = 0
            FieldType.entries.forEach { _ -> count++ }
            assertEquals(5, count)
        }

        @Test
        @DisplayName("Deve poder usar em when expression")
        fun `should work in when expression`() {
            val type = FieldType.FUTSAL
            val result = when (type) {
                FieldType.SOCIETY -> "society"
                FieldType.FUTSAL -> "futsal"
                FieldType.CAMPO -> "campo"
                FieldType.AREIA -> "areia"
                FieldType.OUTROS -> "outros"
            }
            assertEquals("futsal", result)
        }

        @Test
        @DisplayName("Deve poder filtrar por tipo")
        fun `should be able to filter by type`() {
            val indoorTypes = FieldType.entries.filter {
                it == FieldType.FUTSAL || it == FieldType.SOCIETY
            }
            assertEquals(2, indoorTypes.size)
        }
    }
}
