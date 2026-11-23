package com.futebadosparcas.domain

import com.futebadosparcas.domain.model.JoinRequestWritePlan
import com.futebadosparcas.domain.model.planJoinRequestWrite
import kotlin.test.Test
import kotlin.test.assertEquals

/** #4629 item 22: pedir para entrar de novo depois de recusado ou de sair. */
class JoinRequestWritePlanTest {

    @Test
    fun `quem nunca pediu cria o pedido`() {
        assertEquals(JoinRequestWritePlan.CREATE, planJoinRequestWrite(memberStatus = null, existingRequestStatus = null))
    }

    @Test
    fun `recusado apaga o pedido antigo e cria de novo`() {
        assertEquals(JoinRequestWritePlan.REPLACE, planJoinRequestWrite(memberStatus = null, existingRequestStatus = "REJECTED"))
    }

    @Test
    fun `quem saiu depois de aprovado apaga o pedido antigo e cria de novo`() {
        assertEquals(JoinRequestWritePlan.REPLACE, planJoinRequestWrite(memberStatus = "INACTIVE", existingRequestStatus = "APPROVED"))
    }

    @Test
    fun `quem saiu sem pedido antigo cria o pedido`() {
        assertEquals(JoinRequestWritePlan.CREATE, planJoinRequestWrite(memberStatus = "INACTIVE", existingRequestStatus = null))
    }

    @Test
    fun `aprovado sem vinculo ainda nao apaga a aprovacao`() {
        // O onJoinRequestApproved ainda está criando o membro.
        assertEquals(
            JoinRequestWritePlan.APPROVAL_IN_PROGRESS,
            planJoinRequestWrite(memberStatus = null, existingRequestStatus = "APPROVED")
        )
    }

    @Test
    fun `pedido pendente nao grava de novo`() {
        assertEquals(JoinRequestWritePlan.ALREADY_PENDING, planJoinRequestWrite(memberStatus = null, existingRequestStatus = "PENDING"))
    }

    @Test
    fun `removido bloqueado ou banido nao pode pedir`() {
        for (status in listOf("REMOVED", "BLOCKED", "BANNED")) {
            assertEquals(JoinRequestWritePlan.NOT_ALLOWED, planJoinRequestWrite(memberStatus = status, existingRequestStatus = "REJECTED"))
            assertEquals(JoinRequestWritePlan.NOT_ALLOWED, planJoinRequestWrite(memberStatus = status, existingRequestStatus = null))
        }
    }
}
