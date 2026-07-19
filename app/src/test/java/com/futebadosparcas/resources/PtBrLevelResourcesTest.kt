package com.futebadosparcas.resources

import java.nio.file.Files
import java.nio.file.Path
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test

class PtBrLevelResourcesTest {

    private val resourcePaths = listOf(
        Path.of("shared/src/commonMain/composeResources/values-pt/strings.xml"),
        Path.of("shared/src/commonMain/mr/values-pt/strings.xml")
    )

    @Test
    fun nivelTranslations_areAccentedAndIdenticalAcrossResourceTrees() {
        val resources = resourcePaths.map(Files::readString)

        resources.forEach { strings ->
            assertFalse(strings.contains("SUBIU DE NIVEL!"))
            assertFalse(strings.contains(">Nivel %d<"))
            assertFalse(strings.contains("proximo nivel"))
            assertFalse(strings.contains(">NIVEL<"))
            assertEquals(1, Regex("SUBIU DE NÍVEL!").findAll(strings).count())
            assertEquals(2, Regex(">Nível %d<").findAll(strings).count())
            assertEquals(1, Regex("Nível %d - %s").findAll(strings).count())
            assertEquals(1, Regex("%d%% para o próximo nível").findAll(strings).count())
            assertEquals(1, Regex(">NÍVEL<").findAll(strings).count())
            assertEquals(1, Regex("Faltam %d XP para o próximo nível").findAll(strings).count())
        }

        assertEquals(resources.first(), resources.last())
    }
}
