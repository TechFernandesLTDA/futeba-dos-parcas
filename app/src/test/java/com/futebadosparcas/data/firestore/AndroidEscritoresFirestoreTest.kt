package com.futebadosparcas.data.firestore

import com.futebadosparcas.domain.model.GameTemplate
import com.futebadosparcas.domain.model.GamificationSettings
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.util.Date

/**
 * #4645: os quatro escritores do Android gravam snake_case, com os campos que as
 * regras exigem. Os mesmos documentos vão contra as regras reais em
 * `firestore-rules-tests/src/android-snake-case-4645.test.ts`.
 */
class AndroidEscritoresFirestoreTest {

    private val camelCase = Regex("[a-z][A-Z]")

    private fun semCamelCase(nome: String, doc: Map<String, Any?>) {
        val erradas = doc.keys.filter { camelCase.containsMatchIn(it) }
        assertTrue(erradas.isEmpty(), "$nome tem chave em camelCase: $erradas")
    }

    private fun horaDoServidor(valor: Any?) = assertEquals(FieldValue.serverTimestamp(), valor)

    @Test
    fun novoGrupo_gravaOsCamposQueARegraDeCriacaoExige() {
        val grupo = AndroidEscritoresFirestore.novoGrupo("Pelada de Quinta", "desc", "uid-a", "Ana", null)

        semCamelCase("grupo", grupo)
        assertEquals("uid-a", grupo["owner_id"])
        assertEquals("Ana", grupo["owner_name"])
        assertEquals("ACTIVE", grupo["status"])
        assertEquals(0, grupo["member_count"])
        assertEquals("Pelada de Quinta", grupo["name"])
        assertEquals(false, grupo["is_public"])
        assertFalse("deleted_at" in grupo)
        assertFalse("default_gender" in grupo)
        horaDoServidor(grupo["created_at"])
        horaDoServidor(grupo["updated_at"])
    }

    @Test
    fun novoGrupo_comCategoriaPadrao_gravaDefaultGender() {
        val grupo = AndroidEscritoresFirestore.novoGrupo("Pelada", "", "uid-a", "Ana", "MIXED")

        assertEquals("MIXED", grupo["default_gender"])
    }

    @Test
    fun membroEEspelhoDoDono_saemEmSnakeCaseComDataDeEntrada() {
        val membro = AndroidEscritoresFirestore.membroDono("uid-a", "Ana", null)
        val espelho = AndroidEscritoresFirestore.espelhoDoDono("g1", "Pelada")

        semCamelCase("membro", membro)
        semCamelCase("espelho", espelho)
        assertEquals("uid-a", membro["user_id"])
        assertEquals("OWNER", membro["role"])
        assertEquals("ACTIVE", membro["status"])
        horaDoServidor(membro["joined_at"])
        assertEquals("g1", espelho["group_id"])
        assertEquals("OWNER", espelho["role"])
        assertEquals("ACTIVE", espelho["group_status"])
        horaDoServidor(espelho["joined_at"])
    }

    @Test
    fun perfilNovo_temRolePlayerERatingsESemCamposQueARegraRecusa() {
        val perfil = AndroidEscritoresFirestore.perfilNovo("bia@example.com", "Bia", null)

        semCamelCase("perfil", perfil)
        assertEquals("PLAYER", perfil["role"])
        assertEquals("Bia", perfil["name"])
        listOf("striker_rating", "mid_rating", "defender_rating", "gk_rating").forEach {
            assertEquals(0, perfil[it], it)
        }
        val recusados = listOf(
            "experience_points", "level", "milestones_achieved", "phone", "status",
            "verified", "invite_code", "invited_by", "followers_count", "following_count",
            "auto_striker_rating", "auto_rating_samples", "deleted_at"
        )
        assertTrue(recusados.none { it in perfil }, "campo recusado pela regra: ${recusados.filter { it in perfil }}")
        horaDoServidor(perfil["created_at"])
    }

    @Test
    fun perfilNovo_semNome_usaNomeDeReservaQueARegraAceita() {
        val perfil = AndroidEscritoresFirestore.perfilNovo("", " ", null)

        assertTrue((perfil["name"] as String).length >= 2)
    }

    @Test
    fun modeloDeJogo_gravaSnakeCaseEDataDoServidor() {
        val modelo = AndroidEscritoresFirestore.modeloDeJogo(
            GameTemplate(userId = "uid-a", templateName = "Quinta", maxPlayers = 12, createdAt = 123L)
        )

        semCamelCase("modelo de jogo", modelo)
        assertEquals("uid-a", modelo["user_id"])
        assertEquals("Quinta", modelo["template_name"])
        assertEquals(12, modelo["max_players"])
        assertFalse("id" in modelo)
        horaDoServidor(modelo["created_at"])
    }

    @Test
    fun lerModeloDeJogo_leSnakeCaseComTimestampEOCamelCaseAntigo() {
        val quando = Timestamp(Date(1_700_000_000_000L))
        val novo = AndroidEscritoresFirestore.lerModeloDeJogo(
            "t1",
            mapOf("user_id" to "uid-a", "template_name" to "Quinta", "max_players" to 12L, "created_at" to quando)
        )
        val antigo = AndroidEscritoresFirestore.lerModeloDeJogo(
            "t2",
            mapOf("userId" to "uid-a", "templateName" to "Sexta", "maxPlayers" to 10L, "createdAt" to 5L)
        )

        assertEquals("t1", novo.id)
        assertEquals("Quinta", novo.templateName)
        assertEquals(12, novo.maxPlayers)
        assertEquals(1_700_000_000_000L, novo.createdAt)
        assertEquals("Sexta", antigo.templateName)
        assertEquals(10, antigo.maxPlayers)
        assertEquals(5L, antigo.createdAt)
    }

    @Test
    fun configuracoesGamificacao_gravaOsNomesQueAsFunctionsLeem() {
        val doc = AndroidEscritoresFirestore.configuracoesGamificacao(
            GamificationSettings(xpPerGoal = 40, xpStreak3 = 22, updatedBy = "uid-admin")
        )

        semCamelCase("gamificação", doc)
        assertEquals(40, doc["xp_per_goal"])
        assertEquals(22, doc["xp_streak_3"])
        assertEquals("uid-admin", doc["updated_by"])
        horaDoServidor(doc["updated_at"])
    }

    @Test
    fun lerConfiguracoesGamificacao_leSnakeCaseEOCamelCaseAntigo() {
        val novo = AndroidEscritoresFirestore.lerConfiguracoesGamificacao(
            mapOf("xp_per_goal" to 40L, "updated_at" to Timestamp(Date(9_000L)))
        )
        val antigo = AndroidEscritoresFirestore.lerConfiguracoesGamificacao(mapOf("xpPerGoal" to 33L))

        assertEquals(40, novo.xpPerGoal)
        assertEquals(9_000L, novo.updatedAt)
        assertEquals(GamificationSettings().xpWin, novo.xpWin)
        assertEquals(33, antigo.xpPerGoal)
    }
}
