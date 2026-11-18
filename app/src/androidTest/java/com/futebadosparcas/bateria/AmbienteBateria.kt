package com.futebadosparcas.bateria

import android.os.Bundle
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import org.junit.Assume.assumeTrue
import java.util.concurrent.TimeUnit

/**
 * Ambiente da bateria no Android: portas dos emuladores e as 24 contas do seed.
 *
 * Espelha `scripts/bateria/contas.ts`, `cenario.ts` e `portas.ts`. A conferência
 * rápida (`scripts/bateria/conferir.ts`) falha se este arquivo divergir deles.
 */
object AmbienteBateria {
    const val PROJETO = "demo-futebadosparcas"
    const val REGIAO = "southamerica-east1"
    const val SENHA_EMULADOR = "Bateria#2026"
    const val DOMINIO_EMAIL = "bateria.futeba.test"
    const val PREFIXO_ID = "bat-"

    /** O emulador Android enxerga o Mac por 10.0.2.2. */
    var host: String = "10.0.2.2"
        private set
    var portaAuth: Int = 19099
        private set
    var portaFirestore: Int = 18085
        private set
    var portaFunctions: Int = 15001
        private set
    var portaStorage: Int = 19199
        private set

    /** Só o [BateriaTestRunner] no modo bateria liga. Sem isso os testes da bateria são pulados. */
    @Volatile
    var ativo: Boolean = false

    fun lerArgumentos(argumentos: Bundle?) {
        argumentos ?: return
        argumentos.getString("bateriaHost")?.let { host = it }
        argumentos.getString("bateriaPortaAuth")?.toIntOrNull()?.let { portaAuth = it }
        argumentos.getString("bateriaPortaFirestore")?.toIntOrNull()?.let { portaFirestore = it }
        argumentos.getString("bateriaPortaFunctions")?.toIntOrNull()?.let { portaFunctions = it }
        argumentos.getString("bateriaPortaStorage")?.toIntOrNull()?.let { portaStorage = it }
    }

    /** Pula o teste quando o app não está apontado para os emuladores. */
    fun exigirEmulador() {
        assumeTrue(
            "Teste da bateria: rode por scripts/bateria/rodar.sh android (BateriaTestRunner).",
            ativo,
        )
    }

    data class Conta(val chave: String, val papel: String, val nome: String) {
        val uid: String get() = "$PREFIXO_ID$chave"
        val email: String get() = "$chave@$DOMINIO_EMAIL"
    }

    private fun doisDigitos(n: Int) = n.toString().padStart(2, '0')

    val JOGADORES: List<Conta> = (1..20).map {
        Conta("jogador${doisDigitos(it)}", "PLAYER", "Teste ${doisDigitos(it)} Jogador")
    }
    val DONOS: List<Conta> = (1..3).map {
        Conta("dono${doisDigitos(it)}", "FIELD_OWNER", "Teste ${doisDigitos(20 + it)} Dono de Quadra")
    }
    val ADMIN = Conta("admin", "ADMIN", "Teste 24 Administrador")
    val CONTAS: List<Conta> = JOGADORES + DONOS + ADMIN

    fun conta(chave: String): Conta = CONTAS.first { it.chave == chave }

    fun id(chave: String): String = "$PREFIXO_ID$chave"

    const val GRUPO_ALFA = "grupo-alfa"
    const val NOME_GRUPO_ALFA = "Pelada Teste Alfa"
    const val MEMBROS_GRUPO_ALFA = 12

    /** Contas do grupo alfa cujo documento de membro e espelho têm o campo `id` gravado. */
    val LEGADOS_GRUPO_ALFA = listOf("jogador01", "jogador02", "jogador03")

    fun entrar(conta: Conta): FirebaseUser {
        val auth = FirebaseAuth.getInstance()
        auth.signOut()
        val resultado = Tasks.await(
            auth.signInWithEmailAndPassword(conta.email, SENHA_EMULADOR),
            30,
            TimeUnit.SECONDS,
        )
        return requireNotNull(resultado.user) { "login sem usuário: ${conta.chave}" }
    }

    fun sair() = FirebaseAuth.getInstance().signOut()
}
