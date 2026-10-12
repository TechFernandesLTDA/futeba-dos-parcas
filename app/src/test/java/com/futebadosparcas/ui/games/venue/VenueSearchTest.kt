package com.futebadosparcas.ui.games.venue

import com.futebadosparcas.domain.model.Location
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

@DisplayName("VenueSearch")
class VenueSearchTest {

    private val arenaPortao = venue(
        id = "arena",
        name = "Arena Society Portão",
        neighborhood = "Portão",
        address = "Rua João Bettega, 1200",
        city = "Curitiba",
        state = "PR",
        cep = "81070-001",
        primaryFieldType = "SOCIETY"
    )
    private val jardimFutsal = venue(
        id = "jardim",
        name = "Ginásio Jd. das Américas",
        neighborhood = "Jardim das Américas",
        address = "Av. Prefeito Maurício Fruet, 500",
        city = "Curitiba",
        state = "PR",
        cep = "81530200",
        primaryFieldType = "FUTSAL"
    )
    private val vilaCampo = venue(
        id = "vila",
        name = "Campo da Vila Hauer",
        neighborhood = "Hauer",
        address = "Rua Pedro Gusso, 80",
        city = "Curitiba",
        state = "PR",
        activeFieldTypes = listOf("CAMPO")
    )

    @Nested
    @DisplayName("normalização")
    inner class Normalization {
        @Test
        fun `ignora acento e caixa`() {
            assertEquals("portao", VenueSearch.normalize("  PORTÃO "))
            assertEquals("sao jose", VenueSearch.normalize("São José"))
        }

        @Test
        fun `tokeniza por pontuacao`() {
            assertEquals(listOf("jd", "america", "80250", "100"), VenueSearch.tokenize("Jd. América, 80250-100"))
        }
    }

    @Nested
    @DisplayName("campos pesquisáveis")
    inner class Fields {
        @Test
        fun `acha por nome sem acento e sem caixa`() {
            assertTrue(VenueSearch.matches(arenaPortao, "ARENA"))
            assertTrue(VenueSearch.matches(arenaPortao, "portao"))
            assertTrue(VenueSearch.matches(arenaPortao, "PORTÃO"))
        }

        @Test
        fun `acha por bairro, endereco e cidade`() {
            assertTrue(VenueSearch.matches(jardimFutsal, "americas"))
            assertTrue(VenueSearch.matches(jardimFutsal, "mauricio fruet"))
            assertTrue(VenueSearch.matches(jardimFutsal, "curitiba"))
        }

        @Test
        fun `acha por CEP com e sem hifen`() {
            assertTrue(VenueSearch.matches(arenaPortao, "81070-001"))
            assertTrue(VenueSearch.matches(arenaPortao, "81070001"))
            assertTrue(VenueSearch.matches(arenaPortao, "81070"))
            assertTrue(VenueSearch.matches(jardimFutsal, "81530-200"))
            assertTrue(VenueSearch.matches(jardimFutsal, "81530200"))
            assertFalse(VenueSearch.matches(jardimFutsal, "81070"))
        }

        @Test
        fun `acha por tipo de campo`() {
            assertTrue(VenueSearch.matches(arenaPortao, "society"))
            assertTrue(VenueSearch.matches(jardimFutsal, "futsal"))
            assertTrue(VenueSearch.matches(vilaCampo, "campo"))
            assertFalse(VenueSearch.matches(vilaCampo, "futsal"))
        }
    }

    @Nested
    @DisplayName("vários termos")
    inner class MultiTerm {
        @Test
        fun `todos os termos precisam bater, em qualquer campo`() {
            assertTrue(VenueSearch.matches(arenaPortao, "arena portao society"))
            assertTrue(VenueSearch.matches(arenaPortao, "society curitiba"))
            assertFalse(VenueSearch.matches(arenaPortao, "arena futsal"))
        }

        @Test
        fun `ordem dos termos nao importa`() {
            assertTrue(VenueSearch.matches(arenaPortao, "portao arena"))
        }

        @Test
        fun `busca vazia ou so com espacos casa tudo`() {
            assertTrue(VenueSearch.matches(arenaPortao, ""))
            assertTrue(VenueSearch.matches(arenaPortao, "   "))
            assertEquals(3, VenueSearch.filter(listOf(arenaPortao, jardimFutsal, vilaCampo), " ").size)
        }
    }

    @Nested
    @DisplayName("prefixo")
    inner class Prefix {
        @Test
        fun `aceita prefixo de palavra`() {
            assertTrue(VenueSearch.matches(arenaPortao, "are"))
            assertTrue(VenueSearch.matches(arenaPortao, "por"))
            assertTrue(VenueSearch.matches(arenaPortao, "soci"))
        }

        @Test
        fun `nao aceita meio de palavra`() {
            assertFalse(VenueSearch.matches(arenaPortao, "rena"))
            assertFalse(VenueSearch.matches(arenaPortao, "tao"))
        }
    }

    @Nested
    @DisplayName("erro de digitação")
    inner class Typos {
        @Test
        fun `tolera 1 erro em palavra com 5 ou mais letras`() {
            assertTrue(VenueSearch.matches(arenaPortao, "arina")) // troca
            assertTrue(VenueSearch.matches(arenaPortao, "aarena")) // letra a mais
            assertTrue(VenueSearch.matches(arenaPortao, "portaoo")) // letra a mais
            assertTrue(VenueSearch.matches(arenaPortao, "protao")) // inversao
            assertTrue(VenueSearch.matches(arenaPortao, "societ")) // prefixo
            assertTrue(VenueSearch.matches(arenaPortao, "sociery")) // troca dentro de palavra longa
            assertTrue(VenueSearch.matches(arenaPortao, "curtiba")) // letra a menos
        }

        @Test
        fun `nao tolera 2 erros`() {
            assertFalse(VenueSearch.matches(arenaPortao, "orinas"))
            assertFalse(VenueSearch.matches(arenaPortao, "sociaty".replace("t", "ts")))
        }

        @Test
        fun `nao tolera erro em palavra com menos de 5 letras`() {
            assertFalse(VenueSearch.matches(arenaPortao, "aren".replaceRange(1, 2, "x")))
            assertFalse(VenueSearch.matches(arenaPortao, "arma"))
        }

        @Test
        fun `numeros nao sao tratados com tolerancia`() {
            assertFalse(VenueSearch.matches(arenaPortao, "81071"))
        }
    }

    @Nested
    @DisplayName("abreviações")
    inner class Abbreviations {
        @Test
        fun `soc vira society`() {
            assertTrue(VenueSearch.matches(arenaPortao, "soc"))
            assertFalse(VenueSearch.matches(jardimFutsal, "soc"))
        }

        @Test
        fun `fut vira futsal`() {
            assertTrue(VenueSearch.matches(jardimFutsal, "fut"))
            assertFalse(VenueSearch.matches(arenaPortao, "fut"))
        }

        @Test
        fun `jd vira jardim`() {
            assertTrue(VenueSearch.matches(jardimFutsal, "jd americas"))
            // "Jardim" completo tambem acha o nome escrito "Jd."
            val soNome = venue(id = "x", name = "Quadra Jd. Botanico", city = "Curitiba", state = "PR")
            assertTrue(VenueSearch.matches(soNome, "jardim botanico"))
            assertTrue(VenueSearch.matches(soNome, "jd botanico"))
        }

        @Test
        fun `vl vira vila`() {
            assertTrue(VenueSearch.matches(vilaCampo, "vl hauer"))
            assertFalse(VenueSearch.matches(arenaPortao, "vl"))
        }

        @Test
        fun `abreviacao combina com outros termos`() {
            assertTrue(VenueSearch.matches(arenaPortao, "soc portao curitiba"))
        }
    }

    @Nested
    @DisplayName("withinOneEdit")
    inner class Edit {
        @Test
        fun `distancia de edicao 1`() {
            assertTrue(VenueSearch.withinOneEdit("abc", "abc"))
            assertTrue(VenueSearch.withinOneEdit("abc", "abd"))
            assertTrue(VenueSearch.withinOneEdit("abc", "ab"))
            assertTrue(VenueSearch.withinOneEdit("ab", "abc"))
            assertTrue(VenueSearch.withinOneEdit("abcd", "abdc"))
            assertFalse(VenueSearch.withinOneEdit("abc", "xyz"))
            assertFalse(VenueSearch.withinOneEdit("abc", "a"))
            assertFalse(VenueSearch.withinOneEdit("abcd", "badc"))
        }
    }
}

/** Fabrica de quadras para os testes do seletor. */
internal fun venue(
    id: String,
    name: String = "Quadra $id",
    city: String = "Curitiba",
    state: String = "PR",
    neighborhood: String = "",
    address: String = "",
    cep: String = "",
    primaryFieldType: String? = null,
    activeFieldTypes: List<String> = emptyList(),
    latitude: Double? = null,
    longitude: Double? = null,
    isVerified: Boolean = true,
    publicationStatus: String = "PUBLISHED",
    isActive: Boolean = true
): Location = Location(
    id = id,
    name = name,
    city = city,
    state = state,
    neighborhood = neighborhood,
    address = address,
    cep = cep,
    primaryFieldType = primaryFieldType,
    activeFieldTypes = activeFieldTypes,
    latitude = latitude,
    longitude = longitude,
    isVerified = isVerified,
    publicationStatus = publicationStatus,
    isActive = isActive
)
