package com.futebadosparcas.ui.onboarding

import com.futebadosparcas.domain.model.onboarding.OnboardingState
import com.futebadosparcas.domain.model.onboarding.OnboardingStep
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

/**
 * Testes unitários para OnboardingState — serialização e merge offline.
 */
@DisplayName("OnboardingState Tests")
class OnboardingStateTest {

    // ─── fromMap — deserialização ────────────────────────────────────────────────

    @Test
    @DisplayName("fromMap_mapaVazio_retornaEstadoDefault")
    fun fromMap_emptyMap_returnsDefault() {
        val state = OnboardingState.fromMap(emptyMap())

        assertNull(state.carouselCompletedAt)
        assertFalse(state.carouselSkipped)
        assertEquals(emptyMap<String, Boolean>(), state.checklistSteps)
        assertNull(state.checklistCompletedAt)
        assertFalse(state.checklistDismissed)
        assertFalse(state.rewardGranted)
        assertEquals(OnboardingState.CURRENT_ONBOARDING_VERSION, state.version)
    }

    @Test
    @DisplayName("fromMap_mapaCompleto_mapeiaCorretamente")
    fun fromMap_fullMap_mapsCorrectly() {
        val timestamp = 1716000000000L
        val map = mapOf(
            "carousel_completed_at" to timestamp,
            "carousel_skipped" to false,
            "checklist_steps" to mapOf(
                OnboardingStep.COMPLETE_PROFILE.id to true,
                OnboardingStep.JOIN_OR_CREATE_GROUP.id to false
            ),
            "checklist_completed_at" to null,
            "checklist_dismissed" to true,
            "reward_granted" to false,
            "version" to 1
        )

        val state = OnboardingState.fromMap(map)

        assertEquals(timestamp, state.carouselCompletedAt)
        assertFalse(state.carouselSkipped)
        assertTrue(state.checklistSteps[OnboardingStep.COMPLETE_PROFILE.id] == true)
        assertFalse(state.checklistSteps[OnboardingStep.JOIN_OR_CREATE_GROUP.id] == true)
        assertNull(state.checklistCompletedAt)
        assertTrue(state.checklistDismissed)
        assertFalse(state.rewardGranted)
        assertEquals(1, state.version)
    }

    @Test
    @DisplayName("fromMap_camposNumericos_toleraTiposFirestore")
    fun fromMap_numericFields_toleratesFirestoreTypes() {
        // Firestore pode retornar Long ou Int dependendo da plataforma
        val mapWithLong = mapOf(
            "carousel_completed_at" to 1716000000000L,
            "version" to 1L // Long do Firestore
        )
        val state = OnboardingState.fromMap(mapWithLong)

        assertEquals(1716000000000L, state.carouselCompletedAt)
        assertEquals(1, state.version)
    }

    // ─── toMap — serialização ────────────────────────────────────────────────────

    @Test
    @DisplayName("toMap_estadoDefault_omiteNulls")
    fun toMap_defaultState_omitsNulls() {
        val state = OnboardingState()
        val map = state.toMap()

        assertFalse(map.containsKey("carousel_completed_at"))
        assertFalse(map.containsKey("checklist_completed_at"))
        assertTrue(map.containsKey("carousel_skipped"))
        assertTrue(map.containsKey("version"))
    }

    @Test
    @DisplayName("toMap_comTimestamp_incluiTimestamp")
    fun toMap_withTimestamp_includesTimestamp() {
        val ts = 1716000000000L
        val state = OnboardingState(carouselCompletedAt = ts)
        val map = state.toMap()

        assertEquals(ts, map["carousel_completed_at"])
    }

    // ─── hasSeenCarousel ────────────────────────────────────────────────────────

    @Test
    @DisplayName("hasSeenCarousel_carouselNaoVisto_retornaFalso")
    fun hasSeenCarousel_notSeen_returnsFalse() {
        val state = OnboardingState()
        assertFalse(state.hasSeenCarousel())
    }

    @Test
    @DisplayName("hasSeenCarousel_carouselConcluido_retornaVerdadeiro")
    fun hasSeenCarousel_completed_returnsTrue() {
        val state = OnboardingState(
            carouselCompletedAt = 1716000000000L,
            version = OnboardingState.CURRENT_ONBOARDING_VERSION
        )
        assertTrue(state.hasSeenCarousel())
    }

    @Test
    @DisplayName("hasSeenCarousel_carouselPulado_retornaVerdadeiro")
    fun hasSeenCarousel_skipped_returnsTrue() {
        val state = OnboardingState(
            carouselSkipped = true,
            version = OnboardingState.CURRENT_ONBOARDING_VERSION
        )
        assertTrue(state.hasSeenCarousel())
    }

    @Test
    @DisplayName("hasSeenCarousel_versaoAntiga_retornaFalso_mesmoPulado")
    fun hasSeenCarousel_oldVersion_returnsFalse_evenIfSkipped() {
        val state = OnboardingState(
            carouselSkipped = true,
            version = 0 // versão anterior — deve reapresentar
        )
        assertFalse(state.hasSeenCarousel())
    }

    // ─── isChecklistComplete ─────────────────────────────────────────────────────

    @Test
    @DisplayName("isChecklistComplete_semTimestamp_retornaFalso")
    fun isChecklistComplete_withoutTimestamp_returnsFalse() {
        val state = OnboardingState()
        assertFalse(state.isChecklistComplete())
    }

    @Test
    @DisplayName("isChecklistComplete_comTimestamp_retornaVerdadeiro")
    fun isChecklistComplete_withTimestamp_returnsTrue() {
        val state = OnboardingState(checklistCompletedAt = 1716000000000L)
        assertTrue(state.isChecklistComplete())
    }

    // ─── OnboardingStep.fromId ───────────────────────────────────────────────────

    @Test
    @DisplayName("OnboardingStep.fromId_idValido_retornaEnum")
    fun fromId_validId_returnsEnum() {
        assertEquals(
            OnboardingStep.COMPLETE_PROFILE,
            OnboardingStep.fromId("complete_profile")
        )
        assertEquals(
            OnboardingStep.PLAY_FIRST_GAME,
            OnboardingStep.fromId("play_first_game")
        )
    }

    @Test
    @DisplayName("OnboardingStep.fromId_idInvalido_retornaNull")
    fun fromId_invalidId_returnsNull() {
        assertNull(OnboardingStep.fromId("invalid_step"))
    }
}
