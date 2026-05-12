package com.futebadosparcas.domain.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Testes compartilhados para o modelo Location.
 * Executam em Android (JVM) e iOS (Native).
 */
class LocationTest {

    private fun makeLocation(
        ownerId: String = "owner-1",
        managers: List<String> = emptyList(),
        isVerified: Boolean = false,
        latitude: Double? = null,
        longitude: Double? = null
    ) = Location(
        id = "loc-1",
        name = "Quadra Apollo",
        ownerId = ownerId,
        managers = managers,
        isVerified = isVerified,
        latitude = latitude,
        longitude = longitude,
        city = "Curitiba",
        state = "PR"
    )

    // ---- isOwner ----

    @Test
    fun location_isOwner_ownerIdCorreto_retornaTrue() {
        val location = makeLocation(ownerId = "user-abc")
        assertTrue(location.isOwner("user-abc"))
    }

    @Test
    fun location_isOwner_outraId_retornaFalse() {
        val location = makeLocation(ownerId = "user-abc")
        assertFalse(location.isOwner("user-xyz"))
    }

    // ---- isManager ----

    @Test
    fun location_isManager_userNaLista_retornaTrue() {
        val location = makeLocation(managers = listOf("manager-1", "manager-2"))
        assertTrue(location.isManager("manager-1"))
    }

    @Test
    fun location_isManager_userForaDaLista_retornaFalse() {
        val location = makeLocation(managers = listOf("manager-1"))
        assertFalse(location.isManager("manager-999"))
    }

    @Test
    fun location_isManager_listaVazia_retornaFalse() {
        val location = makeLocation(managers = emptyList())
        assertFalse(location.isManager("user-1"))
    }

    // ---- canManage (owner OU manager) ----

    @Test
    fun location_canManage_owner_retornaTrue() {
        val location = makeLocation(ownerId = "owner-1", managers = emptyList())
        assertTrue(location.canManage("owner-1"))
    }

    @Test
    fun location_canManage_manager_retornaTrue() {
        val location = makeLocation(ownerId = "owner-1", managers = listOf("manager-1"))
        assertTrue(location.canManage("manager-1"))
    }

    @Test
    fun location_canManage_usuarioComum_retornaFalse() {
        val location = makeLocation(ownerId = "owner-1", managers = listOf("manager-1"))
        assertFalse(location.canManage("user-stranger"))
    }

    // ---- isVerified ----

    @Test
    fun location_isVerified_verificado_retornaTrue() {
        val location = makeLocation(isVerified = true)
        assertTrue(location.isVerified)
    }

    @Test
    fun location_isVerified_naoVerificado_retornaFalse() {
        val location = makeLocation(isVerified = false)
        assertFalse(location.isVerified)
    }

    // ---- Coordenadas ----

    @Test
    fun location_latitude_longitude_nulos_por_default() {
        val location = makeLocation()
        assertEquals(null, location.latitude)
        assertEquals(null, location.longitude)
    }

    @Test
    fun location_latitude_longitude_preenchidos() {
        val location = makeLocation(latitude = -25.4284, longitude = -49.2733)
        assertEquals(-25.4284, location.latitude)
        assertEquals(-49.2733, location.longitude)
    }

    // ---- LocationReview ----

    @Test
    fun locationReview_rating_valorValido_naoLancaExcecao() {
        // Nao deve lancar IllegalArgumentException
        val review = LocationReview(rating = 4.5f)
        assertEquals(4.5f, review.rating)
    }

    @Test
    fun locationReview_rating_zero_eValido() {
        val review = LocationReview(rating = 0f)
        assertEquals(0f, review.rating)
    }

    @Test
    fun locationReview_rating_cinco_eValido() {
        val review = LocationReview(rating = 5f)
        assertEquals(5f, review.rating)
    }
}
