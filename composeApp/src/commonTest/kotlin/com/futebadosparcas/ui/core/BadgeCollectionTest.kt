package com.futebadosparcas.ui.core

import com.futebadosparcas.domain.gamification.BadgeDefinitions
import com.futebadosparcas.domain.model.UserBadge
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class BadgeCollectionTest {

    @Test
    fun semConquistas_listaVaziaETodoCatalogoVisivelBloqueado() {
        val collection = buildBadgeCollection(emptyList())

        assertTrue(collection.earned.isEmpty())
        assertEquals(BadgeDefinitions.allBadges.count { !it.isHidden }, collection.locked.size)
    }

    @Test
    fun conquistaDoCatalogo_usaDefinicaoESaiDosBloqueados() {
        val collection = buildBadgeCollection(
            listOf(UserBadge(id = "a", userId = "u1", badgeId = "hat_trick", unlockCount = 3))
        )

        assertEquals(1, collection.earned.size)
        val earned = collection.earned.single()
        assertEquals("hat_trick", earned.definition.id)
        assertEquals(3, earned.count)
        assertTrue(collection.locked.none { it.id == "hat_trick" })
    }

    @Test
    fun documentosRepetidos_somamContagem() {
        val collection = buildBadgeCollection(
            listOf(
                UserBadge(id = "a", badgeId = "poker", unlockCount = 1),
                UserBadge(id = "b", badgeId = "POKER", unlockCount = 0)
            )
        )

        assertEquals(1, collection.earned.size)
        assertEquals(2, collection.earned.single().count)
    }

    @Test
    fun idForaDoCatalogo_apareceComNomeDerivado() {
        val collection = buildBadgeCollection(
            listOf(UserBadge(id = "a", badgeId = "rei_da_pelada"))
        )

        assertEquals("Rei Da Pelada", collection.earned.single().definition.name)
    }

    @Test
    fun badgeIdVazio_ignorado() {
        val collection = buildBadgeCollection(listOf(UserBadge(id = "a", badgeId = "")))

        assertTrue(collection.earned.isEmpty())
    }
}
