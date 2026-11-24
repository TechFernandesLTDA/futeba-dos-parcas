package com.futebadosparcas.data.repository

import com.futebadosparcas.data.firestore.AndroidEscritoresFirestore
import kotlin.test.assertEquals
import org.junit.jupiter.api.Test

class GroupCreationMemberCountTest {
    // Confere os documentos gravados (#4645), não o modelo devolvido à tela.
    @Test
    fun `owner creation starts principal at zero and mirror at one`() {
        val group = AndroidEscritoresFirestore.novoGrupo(
            name = "Pelada",
            description = "Grupo de teste",
            ownerId = "owner-1",
            ownerName = "Owner",
            defaultGender = null
        )
        val mirror = AndroidEscritoresFirestore.espelhoDoDono(
            groupId = "group-1",
            groupName = "Pelada"
        )

        assertEquals(0, group["member_count"])
        assertEquals(1, mirror["member_count"])
    }
}
