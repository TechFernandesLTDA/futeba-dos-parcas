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

    // ---- TimeZone / effectiveTimeZone ----

    @Test
    fun location_timeZone_nulo_por_default_retornaNull() {
        val location = makeLocation()
        assertEquals(null, location.timeZone)
    }

    @Test
    fun location_effectiveTimeZone_aplicaFallback_quandoAusente() {
        val location = makeLocation()
        assertEquals(Location.DEFAULT_LOCATION_TIME_ZONE, location.effectiveTimeZone())
    }

    @Test
    fun location_effectiveTimeZone_aplicaFallback_quandoVazio() {
        val location = makeLocation().copy(timeZone = "   ")
        assertEquals(Location.DEFAULT_LOCATION_TIME_ZONE, location.effectiveTimeZone())
    }

    @Test
    fun location_effectiveTimeZone_preservaValor_quandoPreenchido() {
        val location = makeLocation().copy(timeZone = "America/Manaus")
        assertEquals("America/Manaus", location.effectiveTimeZone())
    }

    // ---- Commercial availability / venue monetization ----

    @Test
    fun location_isCommerciallyAvailable_publicadaAtivaEComCampo_retornaTrue() {
        val location = makeLocation(isVerified = true).copy(
            isActive = true,
            publicationStatus = "PUBLISHED",
            subscriptionStatus = "ACTIVE",
            hasActiveFields = true
        )

        assertTrue(location.isCommerciallyAvailable())
    }

    @Test
    fun location_isCommerciallyAvailable_publicacaoNaoAprovada_retornaFalse() {
        val location = makeLocation(isVerified = true).copy(
            publicationStatus = "PENDING_REVIEW",
            subscriptionStatus = "ACTIVE",
            hasActiveFields = true
        )

        assertFalse(location.isCommerciallyAvailable())
    }

    @Test
    fun location_preservaContratoComercialEAgregadosDeQuadra() {
        val location = makeLocation(isVerified = true).copy(
            publicationStatus = "PUBLISHED",
            commercialStatus = "ACTIVE",
            subscriptionStatus = "TRIAL",
            billingPlanCode = "PRO",
            billingPlanLabel = "Pro",
            billingCycle = "MONTHLY",
            billingBaseFeeCents = 14990,
            monthlyFeeCents = 12990,
            billingDueDay = 10,
            venueAccountId = "owner-1",
            venueAccountStatus = "ACTIVE",
            venueAccountChargeScope = "FIELD_COUNT",
            venueAccountMonthlyTotalCents = 25980,
            venueAccountLinkedLocationsCount = 2,
            venueAccountActiveFieldsCount = 4,
            activeFieldCount = 2,
            activeFieldTypes = listOf("FUTSAL", "SOCIETY"),
            activeFieldAmenities = listOf("parking", "bbq"),
            primaryFieldType = "FUTSAL",
            hasActiveFields = true,
            minHourlyPriceCents = 8000,
            averageHourlyPriceCents = 9500,
            gamesCount = 12,
            gamesLast30DaysCount = 3
        )

        assertEquals("PRO", location.billingPlanCode)
        assertEquals(12990, location.monthlyFeeCents)
        assertEquals("FIELD_COUNT", location.venueAccountChargeScope)
        assertEquals(2, location.activeFieldCount)
        assertEquals(listOf("FUTSAL", "SOCIETY"), location.activeFieldTypes)
        assertEquals(8000, location.minHourlyPriceCents)
        assertEquals(12, location.gamesCount)
        assertTrue(location.isCommerciallyAvailable())
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
