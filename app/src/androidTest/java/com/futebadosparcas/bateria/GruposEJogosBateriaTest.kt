package com.futebadosparcas.bateria

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.repository.GameQueryRepository
import com.google.android.gms.tasks.Tasks
import com.google.common.truth.Truth.assertThat
import com.google.common.truth.Truth.assertWithMessage
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.koin.core.context.GlobalContext
import java.util.concurrent.TimeUnit

/**
 * Bateria — grupos e jogos no Android contra o seed do emulador.
 *
 * Regressões de 15/11/2026 (1.43.3 e 1.43.4, PRs #4566 e #4569): documentos
 * antigos têm o campo `id` gravado e os modelos usam `@DocumentId`. O seed
 * grava esse campo de propósito em `users/{uid}/groups/{id}` e em
 * `groups/{id}/members/{uid}` de três contas do grupo alfa. Os testes leem pelo
 * repositório real, o mesmo caminho da tela de grupos.
 *
 * Jogos (#4576): o seed cria os jogos no formato do web, sem o campo `id`. O detalhe e a lista de próximos
 * jogos precisam devolver o ID do documento.
 */
@RunWith(AndroidJUnit4::class)
class GruposEJogosBateriaTest {

    private val grupos: GroupRepository by lazy { GlobalContext.get().get() }
    private val jogos: GameQueryRepository by lazy { GlobalContext.get().get() }
    private val idAlfa = AmbienteBateria.id(AmbienteBateria.GRUPO_ALFA)

    @Before
    fun preparar() = AmbienteBateria.exigirEmulador()

    @After
    fun limpar() {
        if (AmbienteBateria.ativo) AmbienteBateria.sair()
    }

    @Test
    fun seedTemDocumentosLegadosComCampoIdGravado() {
        AmbienteBateria.entrar(AmbienteBateria.conta("jogador01"))
        val db = FirebaseFirestore.getInstance()
        for (chave in AmbienteBateria.LEGADOS_GRUPO_ALFA) {
            val uid = AmbienteBateria.conta(chave).uid
            val membro = Tasks.await(db.document("groups/$idAlfa/members/$uid").get(), 30, TimeUnit.SECONDS)
            assertWithMessage("membro legado $chave tem o campo id").that(membro.contains("id")).isTrue()
        }
        val uid = AmbienteBateria.conta("jogador01").uid
        val espelho = Tasks.await(db.document("users/$uid/groups/$idAlfa").get(), 30, TimeUnit.SECONDS)
        assertWithMessage("espelho legado tem o campo id").that(espelho.contains("id")).isTrue()
    }

    @Test
    fun meusGruposLeEspelhoComCampoIdGravado() = runBlocking {
        for (chave in AmbienteBateria.LEGADOS_GRUPO_ALFA) {
            AmbienteBateria.entrar(AmbienteBateria.conta(chave))
            val resultado = grupos.getMyGroups()
            assertWithMessage("meus grupos de $chave: ${resultado.exceptionOrNull()}")
                .that(resultado.isSuccess).isTrue()
            val alfa = resultado.getOrThrow().firstOrNull { it.groupId == idAlfa }
            assertWithMessage("grupo alfa na lista de $chave").that(alfa).isNotNull()
            assertThat(alfa!!.id).isEqualTo(idAlfa)
            assertThat(alfa.groupName).isEqualTo(AmbienteBateria.NOME_GRUPO_ALFA)
        }
    }

    @Test
    fun membrosDoGrupoLeDocumentosComCampoIdGravado() = runBlocking {
        AmbienteBateria.entrar(AmbienteBateria.conta("jogador01"))
        val resultado = grupos.getGroupMembers(idAlfa)
        assertWithMessage("membros do grupo alfa: ${resultado.exceptionOrNull()}")
            .that(resultado.isSuccess).isTrue()
        val membros = resultado.getOrThrow()
        assertThat(membros).hasSize(AmbienteBateria.MEMBROS_GRUPO_ALFA)
        for (chave in AmbienteBateria.LEGADOS_GRUPO_ALFA) {
            val uid = AmbienteBateria.conta(chave).uid
            val membro = membros.firstOrNull { it.userId == uid }
            assertWithMessage("membro legado $chave na lista").that(membro).isNotNull()
            assertThat(membro!!.id).isEqualTo(uid)
        }
    }

    @Test
    fun jogoDeCadaEstadoEhLidoPeloRepositorio() = runBlocking {
        AmbienteBateria.entrar(AmbienteBateria.conta("jogador01"))
        val esperado = mapOf(
            "jogo-agendado" to "SCHEDULED",
            "jogo-confirmado" to "CONFIRMED",
            "jogo-finalizado" to "FINISHED",
        )
        for ((chave, estado) in esperado) {
            val resultado = jogos.getGameDetails(AmbienteBateria.id(chave))
            assertWithMessage("jogo $chave: ${resultado.exceptionOrNull()}").that(resultado.isSuccess).isTrue()
            val jogo = resultado.getOrThrow()
            // O seed cria o jogo no formato do web, sem o campo `id`: o id vem do ID do documento (#4576).
            assertWithMessage("id de $chave").that(jogo.id).isEqualTo(AmbienteBateria.id(chave))
            assertWithMessage("estado de $chave").that(jogo.status).isEqualTo(estado)
        }
    }

    @Test
    fun detalheEmTempoRealTrazOIdDoDocumento() = runBlocking {
        AmbienteBateria.entrar(AmbienteBateria.conta("jogador01"))
        val idDoJogo = AmbienteBateria.id("jogo-agendado")
        val resultado = withTimeout(ESPERA_MS) { jogos.getGameDetailsFlow(idDoJogo).first() }
        assertWithMessage("detalhe em tempo real: ${resultado.exceptionOrNull()}").that(resultado.isSuccess).isTrue()
        assertThat(resultado.getOrThrow().id).isEqualTo(idDoJogo)
    }

    @Test
    fun proximosJogosTrazemOIdDoDocumentoSemJuntarJogosDiferentes() = runBlocking {
        AmbienteBateria.entrar(AmbienteBateria.conta("jogador01"))
        val esperados = listOf("jogo-agendado", "jogo-confirmado", "jogo-ao-vivo").map { AmbienteBateria.id(it) }
        // A lista junta quatro consultas; espera a emissão que já traz os jogos do grupo alfa.
        // Com o id vazio (#4576) os jogos viravam um só na lista e essa emissão nunca chegava.
        val ids = withTimeoutOrNull(ESPERA_MS) {
            jogos.getLiveAndUpcomingGamesFlow()
                .map { resultado -> resultado.getOrNull().orEmpty().map { it.game.id } }
                .first { it.containsAll(esperados) }
        }
        assertWithMessage("próximos jogos do jogador01 com os ids dos documentos").that(ids).isNotNull()
        assertThat(ids).containsNoDuplicates()
        assertThat(ids).doesNotContain("")
    }

    private companion object {
        const val ESPERA_MS = 30_000L
    }
}
