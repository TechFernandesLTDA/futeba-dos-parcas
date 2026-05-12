package com.futebadosparcas.domain.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Testes compartilhados para modelos de experiencia de jogo:
 * VoteCategory, MVPVote e MVPVoteResult.
 * Executam em Android (JVM) e iOS (Native).
 */
class GameExperienceModelsTest {

    // ---- VoteCategory ----

    @Test
    fun voteCategory_fromString_mvp_retornaMvp() {
        assertEquals(VoteCategory.MVP, VoteCategory.fromString("MVP"))
    }

    @Test
    fun voteCategory_fromString_worst_retornaWorst() {
        assertEquals(VoteCategory.WORST, VoteCategory.fromString("WORST"))
    }

    @Test
    fun voteCategory_fromString_null_retornaMvpComoFallback() {
        // Fallback seguro para MVP quando categoria e null
        assertEquals(VoteCategory.MVP, VoteCategory.fromString(null))
    }

    @Test
    fun voteCategory_fromString_invalido_retornaMvpComoFallback() {
        assertEquals(VoteCategory.MVP, VoteCategory.fromString("CATEGORIA_INVALIDA"))
    }

    @Test
    fun voteCategory_displayName_mvp_naoEstaVazio() {
        assertTrue(VoteCategory.MVP.displayName.isNotBlank())
    }

    @Test
    fun voteCategory_emoji_worst_naoEstaVazio() {
        assertTrue(VoteCategory.WORST.emoji.isNotBlank())
    }

    // ---- MVPVote ----

    @Test
    fun mvpVote_generateId_retornaFormatoCorreto() {
        val id = MVPVote.generateId("game-1", "voter-1", VoteCategory.MVP)
        assertEquals("game-1_voter-1_MVP", id)
    }

    @Test
    fun mvpVote_generateId_worst_retornaFormatoCorreto() {
        val id = MVPVote.generateId("game-42", "voter-99", VoteCategory.WORST)
        assertEquals("game-42_voter-99_WORST", id)
    }

    @Test
    fun mvpVote_collection_naoEstaVazio() {
        assertTrue(MVPVote.COLLECTION.isNotBlank())
    }

    @Test
    fun mvpVote_defaults_votedAtENull() {
        val vote = MVPVote()
        assertEquals(null, vote.votedAt)
    }

    // ---- MVPVoteResult ----

    @Test
    fun mvpVoteResult_hasPhoto_comFoto_retornaTrue() {
        val result = MVPVoteResult(playerPhoto = "https://example.com/photo.jpg")
        assertTrue(result.hasPhoto())
    }

    @Test
    fun mvpVoteResult_hasPhoto_semFoto_retornaFalse() {
        val result = MVPVoteResult(playerPhoto = null)
        assertFalse(result.hasPhoto())
    }

    @Test
    fun mvpVoteResult_hasPhoto_fotoEmBranco_retornaFalse() {
        val result = MVPVoteResult(playerPhoto = "")
        assertFalse(result.hasPhoto())
    }

    @Test
    fun mvpVoteResult_getFormattedPercentage_75_retorna75Porcento() {
        val result = MVPVoteResult(percentage = 75.0)
        assertEquals("75%", result.getFormattedPercentage())
    }

    @Test
    fun mvpVoteResult_getFormattedPercentage_33_retorna33Porcento() {
        val result = MVPVoteResult(percentage = 33.7)
        assertEquals("33%", result.getFormattedPercentage())
    }
}
