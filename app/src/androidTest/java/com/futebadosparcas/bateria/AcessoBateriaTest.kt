package com.futebadosparcas.bateria

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.domain.auth.UserProfileNotReadyException
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.google.android.gms.tasks.Tasks
import com.google.common.truth.Truth.assertThat
import com.google.common.truth.Truth.assertWithMessage
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.koin.core.context.GlobalContext
import java.util.concurrent.TimeUnit

/**
 * Bateria — acesso no Android contra o seed do emulador.
 *
 * Regressões de 15/11/2026 (1.43.1, PR #4563):
 *  - `safeLong` com `get<Any?>` estourava SerializationException ao ler o
 *    perfil: aqui o perfil das 24 contas é lido pelo caminho real do app.
 *  - no primeiro acesso o cliente tentava criar `users/{uid}` e levava
 *    PERMISSION_DENIED: aqui uma conta nova espera o gatilho `onUserCreate`.
 */
@RunWith(AndroidJUnit4::class)
class AcessoBateriaTest {

    private val usuarios: UserRepository by lazy { GlobalContext.get().get() }

    /** O caminho do login: espera o perfil que só o servidor cria. */
    private val autenticacao: AuthRepository by lazy { GlobalContext.get().get() }

    @Before
    fun preparar() = AmbienteBateria.exigirEmulador()

    @After
    fun limpar() {
        if (AmbienteBateria.ativo) AmbienteBateria.sair()
    }

    @Test
    fun asVinteEQuatroContasEntramComOPapelCerto() {
        for (conta in AmbienteBateria.CONTAS) {
            val usuario = AmbienteBateria.entrar(conta)
            assertWithMessage("uid de ${conta.chave}").that(usuario.uid).isEqualTo(conta.uid)
            val claims = Tasks.await(usuario.getIdToken(true), 30, TimeUnit.SECONDS).claims
            assertWithMessage("papel de ${conta.chave}").that(claims["role"]).isEqualTo(conta.papel)
            assertWithMessage("profileComplete de ${conta.chave}").that(claims["profileComplete"]).isEqualTo(true)
        }
    }

    @Test
    fun perfilDeCadaContaEhLidoPeloCaminhoRealDoApp() = runBlocking {
        for (conta in AmbienteBateria.CONTAS) {
            AmbienteBateria.entrar(conta)
            val resultado = usuarios.getCurrentUser()
            assertWithMessage("perfil de ${conta.chave}: ${resultado.exceptionOrNull()}")
                .that(resultado.isSuccess).isTrue()
            val perfil = resultado.getOrThrow()
            assertWithMessage("id de ${conta.chave}").that(perfil.id).isEqualTo(conta.uid)
            assertWithMessage("nome de ${conta.chave}").that(perfil.name).isEqualTo(conta.nome)
            assertWithMessage("papel de ${conta.chave}").that(perfil.role).isEqualTo(conta.papel)
        }
    }

    @Test
    fun perfilComXpGravadoPeloServidorEhLidoSemErroDeNumero() = runBlocking {
        // jogador02 é o MVP do jogo finalizado: o gatilho real gravou XP e nível.
        AmbienteBateria.entrar(AmbienteBateria.conta("jogador02"))
        val perfil = usuarios.getCurrentUser().getOrThrow()
        assertThat(perfil.experiencePoints).isAtLeast(200L)
        assertThat(perfil.level).isAtLeast(1)
    }

    @Test
    fun primeiroAcessoEsperaOPerfilDoServidorSemPermissionDenied() = runBlocking {
        val auth = FirebaseAuth.getInstance()
        auth.signOut()
        val email = "novo-android-${System.currentTimeMillis()}@${AmbienteBateria.DOMINIO_EMAIL}"
        val criado = Tasks.await(
            auth.createUserWithEmailAndPassword(email, AmbienteBateria.SENHA_EMULADOR),
            30,
            TimeUnit.SECONDS,
        )
        val uid = requireNotNull(criado.user).uid

        // O app pode pedir o perfil antes de o gatilho terminar: a única falha
        // aceitável nesse intervalo é "perfil ainda não está pronto".
        var perfilId: String? = null
        val prazo = System.currentTimeMillis() + 60_000
        while (perfilId == null && System.currentTimeMillis() < prazo) {
            val resultado = autenticacao.getCurrentUser()
            val falha = resultado.exceptionOrNull()
            if (falha == null) {
                perfilId = resultado.getOrThrow().id
            } else {
                assertWithMessage("primeiro acesso negado pelas regras: $falha")
                    .that((falha as? FirebaseFirestoreException)?.code)
                    .isNotEqualTo(FirebaseFirestoreException.Code.PERMISSION_DENIED)
                assertWithMessage("falha inesperada no primeiro acesso: $falha")
                    .that(falha).isInstanceOf(UserProfileNotReadyException::class.java)
                Thread.sleep(1_000)
            }
        }
        assertThat(perfilId).isEqualTo(uid)
    }
}
