package com.futebadosparcas.domain

import com.futebadosparcas.domain.model.ReleaseNote
import com.futebadosparcas.domain.model.ReleaseType
import com.futebadosparcas.domain.usecase.GetUnseenReleaseNotesUseCase
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GetUnseenReleaseNotesUseCaseTest {

    private fun note(
        version: String,
        build: Int,
        showPopup: Boolean = true,
    ) = ReleaseNote(
        platform = "android",
        version = version,
        buildNumber = build,
        type = ReleaseType.MINOR,
        headline = "Headline $version",
        showPopup = showPopup,
    )

    @Test
    fun `current build newer than last seen shows popup with newest note`() {
        val notes = listOf(note("1.26.0", 50), note("1.25.0", 49))

        val result = GetUnseenReleaseNotesUseCase.decide(
            notes = notes,
            lastSeenBuild = 49,
            currentBuild = 50,
        )

        assertTrue(result.hasPopup)
        assertEquals(50, result.popupNote?.buildNumber)
    }

    @Test
    fun `current build equal to last seen shows no popup`() {
        val notes = listOf(note("1.26.0", 50))

        val result = GetUnseenReleaseNotesUseCase.decide(
            notes = notes,
            lastSeenBuild = 50,
            currentBuild = 50,
        )

        assertFalse(result.hasPopup)
        assertNull(result.popupNote)
    }

    @Test
    fun `fresh install last seen zero shows popup`() {
        val notes = listOf(note("1.26.0", 50), note("1.25.0", 49))

        val result = GetUnseenReleaseNotesUseCase.decide(
            notes = notes,
            lastSeenBuild = 0,
            currentBuild = 50,
        )

        assertTrue(result.hasPopup)
        assertEquals(50, result.popupNote?.buildNumber)
    }

    @Test
    fun `note for a build newer than installed is not shown in popup`() {
        // buildNumber 51 existe no Firestore mas o aparelho está no 50.
        val notes = listOf(note("1.27.0", 51), note("1.26.0", 50))

        val result = GetUnseenReleaseNotesUseCase.decide(
            notes = notes,
            lastSeenBuild = 49,
            currentBuild = 50,
        )

        assertTrue(result.hasPopup)
        assertEquals(50, result.popupNote?.buildNumber)
    }

    @Test
    fun `note with showPopup false never triggers popup`() {
        val notes = listOf(note("1.26.0", 50, showPopup = false))

        val result = GetUnseenReleaseNotesUseCase.decide(
            notes = notes,
            lastSeenBuild = 0,
            currentBuild = 50,
        )

        assertFalse(result.hasPopup)
        // a nota ainda aparece na lista da tela "Novidades", só não no pop-up.
        assertEquals(1, result.notes.size)
    }

    @Test
    fun `notes are always returned sorted by build descending`() {
        val notes = listOf(note("1.24.0", 48), note("1.26.0", 50), note("1.25.0", 49))

        val result = GetUnseenReleaseNotesUseCase.decide(
            notes = notes,
            lastSeenBuild = 0,
            currentBuild = 50,
        )

        assertEquals(listOf(50, 49, 48), result.notes.map { it.buildNumber })
    }

    @Test
    fun `empty notes yields no popup and empty list`() {
        val result = GetUnseenReleaseNotesUseCase.decide(
            notes = emptyList(),
            lastSeenBuild = 0,
            currentBuild = 50,
        )

        assertFalse(result.hasPopup)
        assertTrue(result.notes.isEmpty())
    }
}
