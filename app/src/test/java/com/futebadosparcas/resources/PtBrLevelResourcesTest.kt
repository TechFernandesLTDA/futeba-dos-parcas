package com.futebadosparcas.resources

import java.nio.file.Path
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test

class PtBrLevelResourcesTest {

    private val repositoryRoot = listOfNotNull(
        System.getProperty("futeba.repoRoot")?.let { Path.of(it) },
        Path.of("."),
        Path.of("..")
    )
        .first { candidate -> candidate.resolve("shared").toFile().isDirectory }

    private val resourcePaths = listOf(
        repositoryRoot.resolve("shared/src/commonMain/composeResources/values-pt/strings.xml"),
        repositoryRoot.resolve("shared/src/commonMain/mr/values-pt/strings.xml")
    )

    @Test
    fun nivelTranslations_areAccentedAndIdenticalAcrossResourceTrees() {
        val resources = resourcePaths.map { path -> path.toFile().readText() }

        resources.forEach { strings ->
            assertFalse(strings.contains("SUBIU DE NIVEL!"))
            assertFalse(strings.contains(">Nivel %d<"))
            assertFalse(strings.contains(">Nivel %1\$d<"))
            assertFalse(strings.contains("proximo nivel"))
            assertFalse(strings.contains(">NIVEL<"))
            assertEquals(1, Regex("SUBIU DE NÍVEL!").findAll(strings).count())
            assertEquals(4, Regex(">Nível %1\\\$d<").findAll(strings).count())
            assertEquals(1, Regex("Nível %1\\\$d - %2\\\$s").findAll(strings).count())
            assertEquals(1, Regex("%1\\\$d%% para o próximo nível").findAll(strings).count())
            assertEquals(1, Regex(">NÍVEL<").findAll(strings).count())
            assertEquals(1, Regex("Faltam %1\\\$d XP para o próximo nível").findAll(strings).count())
        }

        assertEquals(resources.first(), resources.last())
    }
}
