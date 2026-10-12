package com.futebadosparcas.ui.games.venue

import com.futebadosparcas.domain.model.Game
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

@DisplayName("Ordem, cidade e lista do seletor de quadras")
class VenueOrderingAndCityTest {

    @Nested
    @DisplayName("VenueOrdering")
    inner class Ordering {
        @Test
        fun `quadras usadas vem primeiro, da mais recente para a mais antiga`() {
            val a = venue("a", name = "Alfa")
            val b = venue("b", name = "Beta")
            val c = venue("c", name = "Gama")
            val d = venue("d", name = "Delta")

            val ordered = VenueOrdering.order(
                listOf(a, b, c, d),
                mapOf("c" to 300L, "b" to 100L)
            )

            assertEquals(listOf("c", "b", "a", "d"), ordered.map { it.id })
        }

        @Test
        fun `as demais seguem alfabetica pt-BR ignorando acento e caixa`() {
            val ordered = VenueOrdering.order(
                listOf(
                    venue("1", name = "Zico Arena"),
                    venue("2", name = "árvore Society"),
                    venue("3", name = "Arena Beta"),
                    venue("4", name = "Ênio Quadras"),
                    venue("5", name = "estádio Alfa"),
                    venue("6", name = "Bola Cheia")
                ),
                emptyMap()
            )

            assertEquals(
                listOf("Arena Beta", "árvore Society", "Bola Cheia", "Ênio Quadras", "estádio Alfa", "Zico Arena"),
                ordered.map { it.name }
            )
        }

        @Test
        fun `empate de uso desempata por nome e depois id`() {
            val ordered = VenueOrdering.order(
                listOf(venue("2", name = "Beta"), venue("1", name = "Alfa"), venue("3", name = "Alfa")),
                mapOf("1" to 10L, "2" to 10L, "3" to 10L)
            )
            assertEquals(listOf("1", "3", "2"), ordered.map { it.id })
        }

        @Test
        fun `lastUsedByLocation guarda o jogo mais recente de cada quadra`() {
            val used = VenueOrdering.lastUsedByLocation(
                listOf(
                    VenueGameRef("a", 10),
                    VenueGameRef("a", 50),
                    VenueGameRef("a", 20),
                    VenueGameRef("b", 5),
                    VenueGameRef("", 99)
                )
            )
            assertEquals(mapOf("a" to 50L, "b" to 5L), used)
        }

        @Test
        fun `gameRefs ignora jogo apagado e sem quadra e usa data e hora`() {
            val refs = VenueOrdering.gameRefs(
                listOf(
                    Game(id = "1", locationId = "q1", date = "2026-10-01", time = "20:00"),
                    Game(id = "2", locationId = "q2", date = "2026-10-02", time = "08:00", isSoftDeleted = true),
                    Game(id = "3", locationId = "", date = "2026-10-03", time = "08:00"),
                    Game(id = "4", locationId = "q1", date = "2026-10-05", time = "")
                )
            )
            assertEquals(listOf("q1", "q1"), refs.map { it.locationId })
            val used = VenueOrdering.lastUsedByLocation(refs)
            assertEquals(1, used.size)
            assertTrue(used.getValue("q1") > VenueOrdering.playedAtMillis(Game(date = "2026-10-01", time = "20:00")))
        }

        @Test
        fun `data invalida cai no createdAt`() {
            assertEquals(777L, VenueOrdering.playedAtMillis(Game(date = "ontem", time = "x", createdAt = 777L)))
            assertEquals(0L, VenueOrdering.playedAtMillis(Game(date = "", time = "")))
        }
    }

    @Nested
    @DisplayName("VenueCityResolver")
    inner class CityResolver {
        private val curitiba = VenueGeoPoint(-25.4284, -49.2733)
        private val centroCuritiba = venue("cwb", city = "Curitiba", state = "PR", latitude = -25.43, longitude = -49.27)
        private val saoPaulo = venue("sp", city = "São Paulo", state = "SP", latitude = -23.55, longitude = -46.63)
        private val semCoordenadas = venue("x", city = "Maringá", state = "PR")

        @Test
        fun `cidade vem da quadra mais proxima, sem geocodificacao externa`() {
            val city = VenueCityResolver.cityFromDevice(curitiba, listOf(saoPaulo, semCoordenadas, centroCuritiba))
            assertEquals(VenueCity("Curitiba", "PR"), city)
        }

        @Test
        fun `quadra longe demais nao define a cidade`() {
            assertNull(VenueCityResolver.cityFromDevice(curitiba, listOf(saoPaulo)))
            assertNotNull(VenueCityResolver.cityFromDevice(curitiba, listOf(saoPaulo), maxKm = 500.0))
        }

        @Test
        fun `ignora coordenada 0,0 e quadra sem cidade`() {
            val zero = venue("z", city = "Curitiba", latitude = 0.0, longitude = 0.0)
            val semCidade = venue("s", city = "", latitude = -25.43, longitude = -49.27)
            assertNull(VenueCityResolver.nearestVenue(curitiba, listOf(zero, semCidade)))
        }

        @Test
        fun `distancia haversine confere com valor conhecido`() {
            // Curitiba -> Sao Paulo ~ 340 km em linha reta
            val km = VenueCityResolver.distanceKm(curitiba, -23.55, -46.63)
            assertTrue(km in 330.0..350.0, "km=$km")
        }

        @Test
        fun `faixa de latitude cobre o raio`() {
            val band = VenueCityResolver.latitudeBand(curitiba, 111.0)
            assertEquals(curitiba.latitude - 1.0, band.start, 1e-9)
            assertEquals(curitiba.latitude + 1.0, band.endInclusive, 1e-9)
        }

        @Test
        fun `ordem de prioridade aparelho, perfil, ultima cidade`() {
            val device = VenueCity("Curitiba", "PR")
            val profile = VenueCity("Londrina", "PR")
            val last = VenueCity("Joinville", "SC")

            assertEquals(CityResolution(device, CitySource.DEVICE), VenueCityResolver.resolve(device, profile, last))
            assertEquals(CityResolution(profile, CitySource.PROFILE), VenueCityResolver.resolve(null, profile, last))
            assertEquals(CityResolution(last, CitySource.LAST_CHOSEN), VenueCityResolver.resolve(null, null, last))
            assertNull(VenueCityResolver.resolve(null, null, null))
        }

        @Test
        fun `cidades de uma UF, distintas e em ordem alfabetica sem acento`() {
            val venues = listOf(
                venue("1", city = "São José dos Pinhais", state = "PR"),
                venue("2", city = "Curitiba", state = "PR"),
                venue("3", city = "curitiba", state = "Paraná"),
                venue("4", city = "Ápia", state = "PR"),
                venue("5", city = "Joinville", state = "SC")
            )
            assertEquals(listOf("Ápia", "Curitiba", "São José dos Pinhais"), VenueCityResolver.citiesOf(venues, "PR"))
            assertEquals(setOf("PR", "SC"), VenueCityResolver.statesWithVenues(venues))
        }
    }

    @Nested
    @DisplayName("Estados e cidades")
    inner class StatesAndCities {
        @Test
        fun `UF aceita sigla, nome por extenso e caixa`() {
            assertEquals("PR", BrazilianStates.toUf("pr"))
            assertEquals("PR", BrazilianStates.toUf("Paraná"))
            assertEquals("SP", BrazilianStates.toUf("sao paulo"))
            assertEquals("", BrazilianStates.toUf("  "))
            assertEquals(listOf("PR", "Paraná"), BrazilianStates.storedValues("pr"))
            assertEquals(27, BrazilianStates.all.size)
        }

        @Test
        fun `mesma cidade ignora acento, caixa e UF por extenso`() {
            assertTrue(VenueCity("São Paulo", "SP").sameAs(VenueCity("sao paulo", "São Paulo")))
            assertFalse(VenueCity("Campinas", "SP").sameAs(VenueCity("Campinas", "MG")))
            assertEquals("Curitiba - PR", VenueCity("Curitiba", "Paraná").label)
        }
    }

    @Nested
    @DisplayName("VenueListBuilder")
    inner class ListBuilder {
        private val curitiba = VenueCity("Curitiba", "PR")
        private val cityPool = listOf(
            venue("1", name = "Arena Portão", city = "Curitiba", neighborhood = "Portão"),
            venue("2", name = "Bola Cheia", city = "Curitiba", neighborhood = "Centro"),
            venue("3", name = "Campo Sul", city = "Curitiba", neighborhood = "Sítio Cercado"),
            venue("9", name = "Inativa", city = "Curitiba", isActive = false)
        )
        private val others = listOf(
            venue("10", name = "Arena Londrina Society", city = "Londrina"),
            venue("11", name = "Quadra Maringá", city = "Maringá"),
            venue("1", name = "Arena Portão", city = "Curitiba")
        )

        @Test
        fun `busca vazia mostra a lista da cidade na ordem do produto`() {
            val result = VenueListBuilder.build(curitiba, cityPool, others, "", mapOf("3" to 10L))
            assertEquals(listOf("3", "1", "2"), result.cityVenues.map { it.id })
            assertTrue(result.otherCityVenues.isEmpty())
        }

        @Test
        fun `busca com resultado na cidade nao mistura outras cidades`() {
            val result = VenueListBuilder.build(curitiba, cityPool, others, "arena", emptyMap())
            assertEquals(listOf("1"), result.cityVenues.map { it.id })
            assertTrue(result.otherCityVenues.isEmpty())
        }

        @Test
        fun `sem resultado na cidade busca em outras cidades`() {
            val result = VenueListBuilder.build(curitiba, cityPool, others, "londrina", emptyMap())
            assertTrue(result.cityVenues.isEmpty())
            assertEquals(listOf("10"), result.otherCityVenues.map { it.id })
        }

        @Test
        fun `outras cidades nao repetem quadras da cidade atual`() {
            val result = VenueListBuilder.build(curitiba, emptyList(), others, "arena", emptyMap())
            assertEquals(listOf("10"), result.otherCityVenues.map { it.id })
        }

        @Test
        fun `sem resultado em lugar nenhum fica vazio`() {
            val result = VenueListBuilder.build(curitiba, cityPool, others, "zzzzzz", emptyMap())
            assertTrue(result.isEmpty)
        }

        @Test
        fun `quadra inativa nao aparece`() {
            val result = VenueListBuilder.build(curitiba, cityPool, others, "", emptyMap())
            assertFalse(result.cityVenues.any { it.id == "9" })
        }

        @Test
        fun `selo nao verificada so para rascunho sem verificacao`() {
            assertTrue(VenueListBuilder.isUnverified(venue("a", isVerified = false, publicationStatus = "DRAFT")))
            assertFalse(VenueListBuilder.isUnverified(venue("b", isVerified = true, publicationStatus = "PUBLISHED")))
            assertFalse(VenueListBuilder.isUnverified(venue("c", isVerified = true, publicationStatus = "DRAFT")))
            assertFalse(VenueListBuilder.isUnverified(venue("d", isVerified = false, publicationStatus = "PUBLISHED")))
        }
    }
}
