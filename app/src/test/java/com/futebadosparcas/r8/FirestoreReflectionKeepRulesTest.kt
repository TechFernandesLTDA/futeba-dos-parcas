package com.futebadosparcas.r8

import java.io.File
import java.nio.file.Path
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * Contrato de build (#4410): toda classe passada a `toObject()`/`toObjects()` do Firestore
 * precisa estar coberta por uma regra `-keep class <padrão> { *; }` em `app/proguard-rules.pro`.
 *
 * O CustomClassMapper do Firestore usa reflexão (construtor sem argumentos, getters, campos e
 * nomes de constantes de enum). No release minificado com R8 full mode, uma classe sem keep
 * perde o `<init>()` e tem os membros renomeados, o que vira crash ou objeto vazio em tempo
 * de execução. Este teste falha quando alguém passa a ler um modelo novo fora dos pacotes
 * cobertos sem acrescentar a regra.
 */
class FirestoreReflectionKeepRulesTest {

    private val repositoryRoot = listOfNotNull(
        System.getProperty("futeba.repoRoot")?.let { Path.of(it) },
        Path.of("."),
        Path.of("..")
    )
        .first { candidate -> candidate.resolve("app/proguard-rules.pro").toFile().isFile }
        .toFile()

    private val sourceRoots = listOf(
        "app/src/main/java",
        "shared/src/commonMain/kotlin",
        "shared/src/androidMain/kotlin",
        "shared/src/nativeAndAndroidMain/kotlin"
    ).map { File(repositoryRoot, it) }.filter { it.isDirectory }

    private val callSiteSourceRoots = listOf(
        "app/src/main/java",
        "shared/src/androidMain/kotlin",
        "shared/src/nativeAndAndroidMain/kotlin"
    ).map { File(repositoryRoot, it) }.filter { it.isDirectory }

    private val toObjectCall =
        Regex("""\btoObjects?\s*(?:\(\s*([A-Za-z_][\w]*)::class\.java|<\s*([A-Za-z_][\w]*)\s*>)""")
    private val importLine = Regex("""^import\s+([\w.]+?)(\.\*)?(?:\s+as\s+(\w+))?\s*$""", RegexOption.MULTILINE)
    private val packageLine = Regex("""^package\s+([\w.]+)""", RegexOption.MULTILINE)
    private val topLevelClass =
        Regex("""^(?:@[\w.()"=, ]+\s+)*(?:(?:public|internal|data|open|abstract|sealed|enum)\s+)*class\s+(\w+)""", RegexOption.MULTILINE)

    @Test
    fun todaClasseLidaPorToObject_temKeepCompletoNoProguard() {
        val keepPatterns = keepAllMembersPatterns()
        assertTrue(keepPatterns.isNotEmpty(), "Nenhuma regra -keep class ... { *; } encontrada")

        val classIndex = indexTopLevelClasses()
        val resolved = mutableMapOf<String, MutableSet<String>>()

        callSiteSourceRoots.forEach { root ->
            root.walkTopDown().filter { it.isFile && it.extension == "kt" }.forEach { file ->
                val text = file.readText()
                val packageName = packageLine.find(text)?.groupValues?.get(1).orEmpty()
                val explicitImports = mutableMapOf<String, String>()
                val wildcardPackages = mutableListOf(packageName)
                importLine.findAll(text).forEach { match ->
                    val path = match.groupValues[1]
                    when {
                        match.groupValues[2].isNotEmpty() -> wildcardPackages += path
                        else -> explicitImports[match.groupValues[3].ifEmpty { path.substringAfterLast('.') }] = path
                    }
                }
                toObjectCall.findAll(text).forEach { call ->
                    val simpleName = call.groupValues[1].ifEmpty { call.groupValues[2] }
                    val fqn = explicitImports[simpleName]
                        ?: wildcardPackages
                            .map { "$it.$simpleName" }
                            .singleOrNull { it in classIndex }
                    if (fqn != null && fqn.startsWith("com.futebadosparcas.")) {
                        resolved.getOrPut(fqn) { mutableSetOf() } += file.relativeTo(repositoryRoot).path
                    }
                }
            }
        }

        // Garante que o scanner continua enxergando as chamadas (evita passar por estar cego).
        assertTrue(
            resolved.keys.any { it.startsWith("com.futebadosparcas.domain.model.") },
            "O scanner não encontrou nenhum modelo de domain.model lido por toObject: $resolved"
        )

        val uncovered = resolved.filterKeys { fqn -> keepPatterns.none { it.matches(fqn) } }
        assertTrue(
            uncovered.isEmpty(),
            "Classes lidas por toObject()/toObjects() sem '-keep class ... { *; }' em app/proguard-rules.pro " +
                "(o R8 remove o construtor sem argumentos e renomeia os membros):\n" +
                uncovered.entries.joinToString("\n") { (fqn, files) -> "- $fqn <- ${files.sorted()}" }
        )
    }

    /** Converte cada `-keep class <padrão> { *; }` em Regex de nome de classe totalmente qualificado. */
    private fun keepAllMembersPatterns(): List<Regex> {
        val rules = File(repositoryRoot, "app/proguard-rules.pro").readLines()
        val keepRule = Regex("""^-keep\s+class\s+([\w.*$]+)\s*\{\s*\*;\s*}\s*$""")
        return rules.mapNotNull { line -> keepRule.find(line.trim())?.groupValues?.get(1) }
            .map { pattern ->
                val regex = pattern
                    .replace(".", "\\.")
                    .replace("$", "\\$")
                    .replace("\\.**", "\\.@@")
                    .replace("**", "@@")
                    .replace("*", "[^.]*")
                    .replace("@@", ".*")
                Regex("^$regex$")
            }
    }

    /** Índice de classes de topo declaradas nos fontes (FQN), para resolver imports com curinga. */
    private fun indexTopLevelClasses(): Set<String> = sourceRoots.flatMap { root ->
        root.walkTopDown().filter { it.isFile && it.extension == "kt" }.flatMap { file ->
            val text = file.readText()
            val packageName = packageLine.find(text)?.groupValues?.get(1).orEmpty()
            topLevelClass.findAll(text).map { "$packageName.${it.groupValues[1]}" }.toList()
        }
    }.toSet()
}
