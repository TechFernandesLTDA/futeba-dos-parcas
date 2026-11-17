package com.futebadosparcas.bateria

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.domain.repository.InviteRepository
import com.google.android.gms.tasks.Tasks
import com.google.common.truth.Truth.assertThat
import com.google.common.truth.Truth.assertWithMessage
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.koin.core.context.GlobalContext
import java.util.concurrent.TimeUnit

/**
 * Bateria — convites de grupo no Android contra as regras reais do emulador.
 *
 * Regressão de 16/11/2026 (Crashlytics, 1.43.4): "Erro ao enviar convite para grupo" com
 * PERMISSION_DENIED. O repositório gravava o modelo do domínio direto no Firestore, em camelCase e
 * com `expiresAt` numérico; as regras de `group_invites` exigem snake_case e datas. Na leitura, os
 * mesmos campos chegavam vazios e o convidado não conseguia responder. Antes da gravação, o
 * repositório ainda lia `users/{convidado}`, que as regras negam quando o perfil tem e-mail gravado
 * (caso das contas do seed, como em produção).
 *
 * O teste passa pelo repositório real (o mesmo das telas de jogadores e de notificações).
 */
@RunWith(AndroidJUnit4::class)
class ConvitesBateriaTest {

    private val convites: InviteRepository by lazy { GlobalContext.get().get() }
    private val idAlfa = AmbienteBateria.id(AmbienteBateria.GRUPO_ALFA)

    @Before
    fun preparar() = AmbienteBateria.exigirEmulador()

    @After
    fun limpar() {
        if (AmbienteBateria.ativo) AmbienteBateria.sair()
    }

    @Test
    fun donoConvidaEOConvidadoLeERecusa() = runBlocking {
        // jogador20 não é membro do grupo alfa; jogador01 é o dono.
        val convidado = AmbienteBateria.conta("jogador20")
        AmbienteBateria.entrar(AmbienteBateria.conta("jogador01"))

        val criado = convites.createInvite(idAlfa, convidado.uid, convidado.nome)
        assertWithMessage("convite criado pelo dono: ${criado.exceptionOrNull()}")
            .that(criado.isSuccess).isTrue()
        val idDoConvite = criado.getOrThrow().id
        assertThat(idDoConvite).isNotEmpty()

        // Formato gravado: snake_case, datas como data e sem o campo `id` no corpo.
        val documento = Tasks.await(
            FirebaseFirestore.getInstance().document("group_invites/$idDoConvite").get(),
            30,
            TimeUnit.SECONDS,
        )
        assertThat(documento.getString("group_id")).isEqualTo(idAlfa)
        assertThat(documento.getString("invited_user_id")).isEqualTo(convidado.uid)
        assertThat(documento.getString("invited_user_name")).isEqualTo(convidado.nome)
        assertThat(documento.getString("status")).isEqualTo("PENDING")
        assertThat(documento.getTimestamp("expires_at")).isNotNull()
        assertThat(documento.getTimestamp("created_at")).isNotNull()
        assertWithMessage("campo id gravado no convite").that(documento.contains("id")).isFalse()

        val doGrupo = convites.getGroupPendingInvites(idAlfa)
        assertWithMessage("convites pendentes do grupo: ${doGrupo.exceptionOrNull()}")
            .that(doGrupo.isSuccess).isTrue()
        val enviado = doGrupo.getOrThrow().firstOrNull { it.id == idDoConvite }
        assertWithMessage("convite na lista do grupo").that(enviado).isNotNull()
        assertThat(enviado!!.invitedUserId).isEqualTo(convidado.uid)

        // Lado do convidado: lê o convite com os campos preenchidos e consegue responder.
        AmbienteBateria.entrar(convidado)
        val meus = convites.getMyPendingInvites()
        assertWithMessage("convites do convidado: ${meus.exceptionOrNull()}").that(meus.isSuccess).isTrue()
        val recebido = meus.getOrThrow().firstOrNull { it.id == idDoConvite }
        assertWithMessage("convite na lista do convidado").that(recebido).isNotNull()
        assertThat(recebido!!.groupId).isEqualTo(idAlfa)
        assertThat(recebido.groupName).isEqualTo(AmbienteBateria.NOME_GRUPO_ALFA)
        assertThat(recebido.invitedUserId).isEqualTo(convidado.uid)
        assertThat(recebido.expiresAt).isNotNull()

        val contagem = convites.countPendingInvites()
        assertWithMessage("contagem de convites: ${contagem.exceptionOrNull()}").that(contagem.isSuccess).isTrue()
        assertThat(contagem.getOrThrow()).isAtLeast(1)

        // Recusa (não aceita) para o seed continuar com o jogador20 fora do grupo alfa.
        val recusa = convites.declineInvite(idDoConvite)
        assertWithMessage("recusa do convite: ${recusa.exceptionOrNull()}").that(recusa.isSuccess).isTrue()
    }

    @Test
    fun donoConvidaSemInformarONomeEDepoisCancela() = runBlocking {
        // Sem o nome, o repositório tenta ler o perfil do convidado; as regras negam e o convite
        // precisa sair mesmo assim.
        val convidado = AmbienteBateria.conta("jogador19")
        AmbienteBateria.entrar(AmbienteBateria.conta("jogador01"))

        val criado = convites.createInvite(idAlfa, convidado.uid)
        assertWithMessage("convite sem o nome do convidado: ${criado.exceptionOrNull()}")
            .that(criado.isSuccess).isTrue()
        val idDoConvite = criado.getOrThrow().id

        val repetido = convites.createInvite(idAlfa, convidado.uid)
        assertWithMessage("segundo convite para o mesmo jogador").that(repetido.isFailure).isTrue()

        val cancelamento = convites.cancelInvite(idDoConvite)
        assertWithMessage("cancelamento pelo dono: ${cancelamento.exceptionOrNull()}")
            .that(cancelamento.isSuccess).isTrue()
        val documento = Tasks.await(
            FirebaseFirestore.getInstance().document("group_invites/$idDoConvite").get(),
            30,
            TimeUnit.SECONDS,
        )
        assertThat(documento.getString("status")).isEqualTo("CANCELLED")
    }

    @Test
    fun administradorQueNaoEDonoNaoConvida() = runBlocking {
        // jogador02 é ADMIN do grupo alfa. As regras só aceitam convite do dono.
        AmbienteBateria.entrar(AmbienteBateria.conta("jogador02"))
        val resultado = convites.createInvite(idAlfa, AmbienteBateria.conta("jogador18").uid)
        assertThat(resultado.isFailure).isTrue()
        assertThat(resultado.exceptionOrNull()).hasMessageThat().contains("dono do grupo")
    }
}
