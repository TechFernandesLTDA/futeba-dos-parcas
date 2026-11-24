package com.futebadosparcas.di

import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.io.File

/**
 * #4612: o Firestore e o Storage do app vêm do Koin, que entrega a instância já
 * configurada por `FirebaseInicial` (emulador ou cache de produção). Pegar a
 * instância direto em outro lugar foi o que deixou o build de emulador falar com
 * produção. Este teste barra o padrão no código do app.
 */
class FirebaseInstanciaDiretaTest {

    private val proibidos = listOf(
        Regex("""FirebaseFirestore\.getInstance\("""),
        Regex("""\bFirebase\.firestore\b"""),
        Regex("""FirebaseStorage\.getInstance\("""),
        Regex("""\bFirebase\.storage\b"""),
    )

    /** Únicos arquivos que podem criar as instâncias. */
    private val permitidos = setOf("FirebaseKoinModule.kt", "FirebaseInicial.kt")

    @Test
    fun codigoDoApp_naoPegaFirestoreNemStorageForaDoKoin() {
        val raiz = File("src/main/java")
        assertTrue(raiz.isDirectory, "Rode a partir do módulo :app (achou ${raiz.absolutePath})")

        val violacoes = raiz.walkTopDown()
            .filter { it.isFile && it.extension == "kt" && it.name !in permitidos }
            .flatMap { arquivo ->
                arquivo.readLines().withIndex()
                    .filter { (_, linha) ->
                        val codigo = linha.trimStart()
                        !codigo.startsWith("//") && !codigo.startsWith("*") &&
                            proibidos.any { it.containsMatchIn(codigo) }
                    }
                    .map { (i, linha) -> "${arquivo.relativeTo(raiz)}:${i + 1}: ${linha.trim()}" }
            }
            .toList()

        assertTrue(
            violacoes.isEmpty(),
            "Use a instância do Koin (get<FirebaseFirestore>() / get<FirebaseStorage>()):\n" +
                violacoes.joinToString("\n")
        )
    }
}
