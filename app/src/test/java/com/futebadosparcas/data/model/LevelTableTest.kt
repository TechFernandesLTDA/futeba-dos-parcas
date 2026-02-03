package com.futebadosparcas.data.model

import com.futebadosparcas.util.MockLogExtension
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.junit.jupiter.params.provider.ValueSource

/**
 * Testes unitarios para LevelTable.
 * Cobre configuracao dinamica, calculo de nivel, progresso e utilitarios.
 */
@ExtendWith(MockLogExtension::class)
@DisplayName("LevelTable Tests")
class LevelTableTest {

    @BeforeEach
    fun setUp() {
        LevelTable.reset()
    }

    @AfterEach
    fun tearDown() {
        LevelTable.reset()
    }

    // ==================== TESTES DE levels (valores padrao) ====================

    @Nested
    @DisplayName("Niveis padrao")
    inner class DefaultLevelsTests {

        @Test
        @DisplayName("Deve ter 11 niveis padrao (0-10)")
        fun `should have 11 default levels`() {
            assertEquals(11, LevelTable.levels.size)
        }

        @Test
        @DisplayName("Primeiro nivel deve ser 0 (Novato)")
        fun `first level should be 0 Novato`() {
            val first = LevelTable.levels.first()
            assertEquals(0, first.level)
            assertEquals(0L, first.xpRequired)
            assertEquals("Novato", first.name)
        }

        @Test
        @DisplayName("Ultimo nivel deve ser 10 (Imortal)")
        fun `last level should be 10 Imortal`() {
            val last = LevelTable.levels.last()
            assertEquals(10, last.level)
            assertEquals(52850L, last.xpRequired)
            assertEquals("Imortal", last.name)
        }

        @Test
        @DisplayName("XP deve ser crescente entre niveis")
        fun `xp should be increasing between levels`() {
            val levels = LevelTable.levels
            for (i in 1 until levels.size) {
                assertTrue(
                    levels[i].xpRequired > levels[i - 1].xpRequired,
                    "Nivel ${levels[i].level} XP (${levels[i].xpRequired}) deve ser maior que nivel ${levels[i - 1].level} XP (${levels[i - 1].xpRequired})"
                )
            }
        }
    }

    // ==================== TESTES DE getLevelForXp ====================

    @Nested
    @DisplayName("getLevelForXp")
    inner class GetLevelForXpTests {

        @ParameterizedTest
        @CsvSource(
            "0, 0",
            "1, 0",
            "99, 0",
            "100, 1",
            "349, 1",
            "350, 2",
            "849, 2",
            "850, 3",
            "1849, 3",
            "1850, 4",
            "3849, 4",
            "3850, 5",
            "7349, 5",
            "7350, 6",
            "12849, 6",
            "12850, 7",
            "20849, 7",
            "20850, 8",
            "32849, 8",
            "32850, 9",
            "52849, 9",
            "52850, 10",
            "100000, 10"
        )
        @DisplayName("XP deve retornar nivel correto")
        fun `xp should return correct level`(xp: Long, expectedLevel: Int) {
            assertEquals(expectedLevel, LevelTable.getLevelForXp(xp))
        }

        @Test
        @DisplayName("XP negativo deve retornar nivel 0")
        fun `negative xp should return level 0`() {
            assertEquals(0, LevelTable.getLevelForXp(-100))
        }
    }

    // ==================== TESTES DE getXpForLevel ====================

    @Nested
    @DisplayName("getXpForLevel")
    inner class GetXpForLevelTests {

        @ParameterizedTest
        @CsvSource(
            "0, 0",
            "1, 100",
            "2, 350",
            "3, 850",
            "4, 1850",
            "5, 3850",
            "6, 7350",
            "7, 12850",
            "8, 20850",
            "9, 32850",
            "10, 52850"
        )
        @DisplayName("Nivel deve retornar XP correto")
        fun `level should return correct xp`(level: Int, expectedXp: Long) {
            assertEquals(expectedXp, LevelTable.getXpForLevel(level))
        }

        @Test
        @DisplayName("Nivel inexistente deve retornar 0")
        fun `invalid level should return 0`() {
            assertEquals(0L, LevelTable.getXpForLevel(99))
        }
    }

    // ==================== TESTES DE getXpForNextLevel ====================

    @Nested
    @DisplayName("getXpForNextLevel")
    inner class GetXpForNextLevelTests {

        @Test
        @DisplayName("Proximo nivel apos 0 deve ser 100")
        fun `next level after 0 should require 100 xp`() {
            assertEquals(100L, LevelTable.getXpForNextLevel(0))
        }

        @Test
        @DisplayName("Proximo nivel apos 5 deve ser 7350")
        fun `next level after 5 should require 7350 xp`() {
            assertEquals(7350L, LevelTable.getXpForNextLevel(5))
        }

        @Test
        @DisplayName("Nivel maximo deve retornar XP do ultimo nivel")
        fun `max level should return last level xp`() {
            assertEquals(52850L, LevelTable.getXpForNextLevel(10))
        }
    }

    // ==================== TESTES DE getXpProgress ====================

    @Nested
    @DisplayName("getXpProgress")
    inner class GetXpProgressTests {

        @Test
        @DisplayName("XP 0 deve ter progresso 0 de 100")
        fun `xp 0 should have 0 progress of 100`() {
            val (progress, needed) = LevelTable.getXpProgress(0)
            assertEquals(0L, progress)
            assertEquals(100L, needed)
        }

        @Test
        @DisplayName("XP 50 deve ter progresso 50 de 100")
        fun `xp 50 should have 50 progress of 100`() {
            val (progress, needed) = LevelTable.getXpProgress(50)
            assertEquals(50L, progress)
            assertEquals(100L, needed)
        }

        @Test
        @DisplayName("XP 100 deve ter progresso 0 de 250 (nivel 1)")
        fun `xp 100 should have 0 progress of 250`() {
            val (progress, needed) = LevelTable.getXpProgress(100)
            assertEquals(0L, progress)
            assertEquals(250L, needed)
        }

        @Test
        @DisplayName("XP 200 deve ter progresso 100 de 250 (nivel 1)")
        fun `xp 200 should have 100 progress of 250`() {
            val (progress, needed) = LevelTable.getXpProgress(200)
            assertEquals(100L, progress)
            assertEquals(250L, needed)
        }

        @Test
        @DisplayName("XP no nivel maximo deve ter neededXp = 1 (evitar divisao por zero)")
        fun `xp at max level should have needed 1`() {
            val (progress, needed) = LevelTable.getXpProgress(52850)
            assertEquals(0L, progress)
            assertEquals(1L, needed)
        }

        @Test
        @DisplayName("XP acima do nivel maximo deve ter progresso positivo")
        fun `xp above max level should have positive progress`() {
            val (progress, needed) = LevelTable.getXpProgress(60000)
            assertTrue(progress > 0)
            assertEquals(1L, needed)
        }
    }

    // ==================== TESTES DE getProgressPercent ====================

    @Nested
    @DisplayName("getProgressPercent")
    inner class GetProgressPercentTests {

        @Test
        @DisplayName("XP 0 deve ter 0%")
        fun `xp 0 should have 0 percent`() {
            assertEquals(0, LevelTable.getProgressPercent(0))
        }

        @Test
        @DisplayName("XP 50 deve ter 50% (metade do nivel 0)")
        fun `xp 50 should have 50 percent`() {
            assertEquals(50, LevelTable.getProgressPercent(50))
        }

        @Test
        @DisplayName("XP 99 deve ter 99%")
        fun `xp 99 should have 99 percent`() {
            assertEquals(99, LevelTable.getProgressPercent(99))
        }

        @Test
        @DisplayName("XP no nivel maximo deve ter 0% (inicio do nivel)")
        fun `xp at exact max level boundary should have 0 percent`() {
            // No nivel maximo, progresso e 0 de 1 = 0%
            assertEquals(0, LevelTable.getProgressPercent(52850))
        }

        @Test
        @DisplayName("Porcentagem nunca deve ser negativa")
        fun `percent should never be negative`() {
            assertTrue(LevelTable.getProgressPercent(0) >= 0)
        }

        @Test
        @DisplayName("Porcentagem nunca deve ultrapassar 100")
        fun `percent should never exceed 100`() {
            assertTrue(LevelTable.getProgressPercent(100000) <= 100)
        }
    }

    // ==================== TESTES DE getLevelName ====================

    @Nested
    @DisplayName("getLevelName")
    inner class GetLevelNameTests {

        @ParameterizedTest
        @CsvSource(
            "0, Novato",
            "1, Iniciante",
            "2, Amador",
            "3, Regular",
            "4, Experiente",
            "5, Habilidoso",
            "6, Profissional",
            "7, Expert",
            "8, Mestre",
            "9, Lenda",
            "10, Imortal"
        )
        @DisplayName("Nivel deve ter nome correto")
        fun `level should have correct name`(level: Int, expectedName: String) {
            assertEquals(expectedName, LevelTable.getLevelName(level))
        }

        @Test
        @DisplayName("Nivel inexistente deve retornar Desconhecido")
        fun `invalid level should return Desconhecido`() {
            assertEquals("Desconhecido", LevelTable.getLevelName(99))
        }
    }

    // ==================== TESTES DE maxLevel ====================

    @Nested
    @DisplayName("maxLevel")
    inner class MaxLevelTests {

        @Test
        @DisplayName("Nivel maximo padrao deve ser 10")
        fun `default max level should be 10`() {
            assertEquals(10, LevelTable.maxLevel)
        }
    }

    // ==================== TESTES DE isMaxLevel ====================

    @Nested
    @DisplayName("isMaxLevel")
    inner class IsMaxLevelTests {

        @Test
        @DisplayName("Nivel 10 deve ser nivel maximo")
        fun `level 10 should be max level`() {
            assertTrue(LevelTable.isMaxLevel(10))
        }

        @Test
        @DisplayName("Nivel acima de 10 deve ser nivel maximo")
        fun `level above 10 should be max level`() {
            assertTrue(LevelTable.isMaxLevel(15))
        }

        @Test
        @DisplayName("Nivel 9 nao deve ser nivel maximo")
        fun `level 9 should not be max level`() {
            assertFalse(LevelTable.isMaxLevel(9))
        }

        @Test
        @DisplayName("Nivel 0 nao deve ser nivel maximo")
        fun `level 0 should not be max level`() {
            assertFalse(LevelTable.isMaxLevel(0))
        }
    }

    // ==================== TESTES DE getLevelsGained ====================

    @Nested
    @DisplayName("getLevelsGained")
    inner class GetLevelsGainedTests {

        @Test
        @DisplayName("XP de 0 para 100 deve ganhar 1 nivel")
        fun `xp from 0 to 100 should gain 1 level`() {
            assertEquals(1, LevelTable.getLevelsGained(0, 100))
        }

        @Test
        @DisplayName("XP de 0 para 850 deve ganhar 3 niveis")
        fun `xp from 0 to 850 should gain 3 levels`() {
            assertEquals(3, LevelTable.getLevelsGained(0, 850))
        }

        @Test
        @DisplayName("XP de 50 para 90 deve ganhar 0 niveis")
        fun `xp from 50 to 90 should gain 0 levels`() {
            assertEquals(0, LevelTable.getLevelsGained(50, 90))
        }

        @Test
        @DisplayName("XP diminuindo deve retornar 0")
        fun `decreasing xp should return 0`() {
            assertEquals(0, LevelTable.getLevelsGained(1000, 500))
        }

        @Test
        @DisplayName("XP igual deve retornar 0")
        fun `same xp should return 0`() {
            assertEquals(0, LevelTable.getLevelsGained(100, 100))
        }

        @Test
        @DisplayName("XP de 0 para max deve ganhar 10 niveis")
        fun `xp from 0 to max should gain 10 levels`() {
            assertEquals(10, LevelTable.getLevelsGained(0, 52850))
        }
    }

    // ==================== TESTES DE configure ====================

    @Nested
    @DisplayName("configure")
    inner class ConfigureTests {

        @Test
        @DisplayName("Configuracao valida deve ser aplicada")
        fun `valid configuration should be applied`() {
            val customLevels = listOf(
                LevelDefinition(0, 0L, "Iniciante"),
                LevelDefinition(1, 50L, "Intermediario"),
                LevelDefinition(2, 150L, "Avancado")
            )

            assertTrue(LevelTable.configure(customLevels))
            assertEquals(3, LevelTable.levels.size)
            assertEquals("Intermediario", LevelTable.getLevelName(1))
        }

        @Test
        @DisplayName("Lista vazia deve ser rejeitada")
        fun `empty list should be rejected`() {
            assertFalse(LevelTable.configure(emptyList()))
            // Deve manter valores padrao
            assertEquals(11, LevelTable.levels.size)
        }

        @Test
        @DisplayName("Lista sem nivel 0 deve ser rejeitada")
        fun `list without level 0 should be rejected`() {
            val invalidLevels = listOf(
                LevelDefinition(1, 100L, "Nivel1"),
                LevelDefinition(2, 200L, "Nivel2")
            )

            assertFalse(LevelTable.configure(invalidLevels))
            assertEquals(11, LevelTable.levels.size)
        }

        @Test
        @DisplayName("XP nao crescente deve ser rejeitado")
        fun `non-increasing xp should be rejected`() {
            val invalidLevels = listOf(
                LevelDefinition(0, 0L, "Nivel0"),
                LevelDefinition(1, 100L, "Nivel1"),
                LevelDefinition(2, 50L, "Nivel2") // XP menor que nivel anterior
            )

            assertFalse(LevelTable.configure(invalidLevels))
            assertEquals(11, LevelTable.levels.size)
        }

        @Test
        @DisplayName("XP igual entre niveis deve ser rejeitado")
        fun `equal xp between levels should be rejected`() {
            val invalidLevels = listOf(
                LevelDefinition(0, 0L, "Nivel0"),
                LevelDefinition(1, 100L, "Nivel1"),
                LevelDefinition(2, 100L, "Nivel2") // XP igual ao nivel anterior
            )

            assertFalse(LevelTable.configure(invalidLevels))
        }

        @Test
        @DisplayName("Niveis fora de ordem devem ser ordenados automaticamente")
        fun `out of order levels should be sorted automatically`() {
            val unorderedLevels = listOf(
                LevelDefinition(2, 200L, "Avancado"),
                LevelDefinition(0, 0L, "Iniciante"),
                LevelDefinition(1, 100L, "Intermediario")
            )

            assertTrue(LevelTable.configure(unorderedLevels))
            assertEquals(0, LevelTable.levels.first().level)
            assertEquals(2, LevelTable.levels.last().level)
        }

        @Test
        @DisplayName("Configuracao customizada deve afetar getLevelForXp")
        fun `custom configuration should affect getLevelForXp`() {
            val customLevels = listOf(
                LevelDefinition(0, 0L, "Iniciante"),
                LevelDefinition(1, 50L, "Intermediario"),
                LevelDefinition(2, 150L, "Avancado")
            )

            LevelTable.configure(customLevels)
            assertEquals(0, LevelTable.getLevelForXp(0))
            assertEquals(0, LevelTable.getLevelForXp(49))
            assertEquals(1, LevelTable.getLevelForXp(50))
            assertEquals(2, LevelTable.getLevelForXp(150))
        }

        @Test
        @DisplayName("maxLevel deve refletir configuracao customizada")
        fun `maxLevel should reflect custom configuration`() {
            val customLevels = listOf(
                LevelDefinition(0, 0L, "Nivel0"),
                LevelDefinition(1, 100L, "Nivel1"),
                LevelDefinition(2, 200L, "Nivel2")
            )

            LevelTable.configure(customLevels)
            assertEquals(2, LevelTable.maxLevel)
        }
    }

    // ==================== TESTES DE configureFromMap ====================

    @Nested
    @DisplayName("configureFromMap")
    inner class ConfigureFromMapTests {

        @Test
        @DisplayName("Mapa valido deve ser configurado")
        fun `valid map should be configured`() {
            val data = mapOf(
                "levels" to listOf(
                    mapOf("level" to 0, "xp_required" to 0L, "name" to "Base"),
                    mapOf("level" to 1, "xp_required" to 100L, "name" to "Bronze"),
                    mapOf("level" to 2, "xp_required" to 300L, "name" to "Prata")
                )
            )

            assertTrue(LevelTable.configureFromMap(data))
            assertEquals(3, LevelTable.levels.size)
            assertEquals("Bronze", LevelTable.getLevelName(1))
        }

        @Test
        @DisplayName("Mapa sem chave levels deve falhar")
        fun `map without levels key should fail`() {
            val data = mapOf("other" to "value")
            assertFalse(LevelTable.configureFromMap(data))
        }

        @Test
        @DisplayName("Mapa com levels nulo deve falhar")
        fun `map with null levels should fail`() {
            val data = mapOf<String, Any>("levels" to "invalid")
            assertFalse(LevelTable.configureFromMap(data))
        }

        @Test
        @DisplayName("Mapa com campos faltando deve ignorar entradas invalidas")
        fun `map with missing fields should skip invalid entries`() {
            val data = mapOf(
                "levels" to listOf(
                    mapOf("level" to 0, "xp_required" to 0L, "name" to "Base"),
                    mapOf("level" to 1, "name" to "SemXP"), // falta xp_required
                    mapOf("level" to 2, "xp_required" to 200L, "name" to "Completo")
                )
            )

            // Nivel 1 sera ignorado, restam 0 e 2 que tem XP crescente
            assertTrue(LevelTable.configureFromMap(data))
        }

        @Test
        @DisplayName("Mapa vazio deve manter valores padrao")
        fun `empty map should keep defaults`() {
            val data = emptyMap<String, Any>()
            assertFalse(LevelTable.configureFromMap(data))
            assertEquals(11, LevelTable.levels.size)
        }
    }

    // ==================== TESTES DE reset ====================

    @Nested
    @DisplayName("reset")
    inner class ResetTests {

        @Test
        @DisplayName("Reset deve restaurar valores padrao")
        fun `reset should restore default values`() {
            val customLevels = listOf(
                LevelDefinition(0, 0L, "Custom0"),
                LevelDefinition(1, 50L, "Custom1")
            )
            LevelTable.configure(customLevels)
            assertEquals(2, LevelTable.levels.size)

            LevelTable.reset()
            assertEquals(11, LevelTable.levels.size)
            assertEquals("Novato", LevelTable.getLevelName(0))
        }
    }
}
