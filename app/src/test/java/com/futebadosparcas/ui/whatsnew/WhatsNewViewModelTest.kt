package com.futebadosparcas.ui.whatsnew

import com.futebadosparcas.domain.model.ReleaseNote
import com.futebadosparcas.domain.model.ReleaseType
import com.futebadosparcas.domain.repository.ReleaseNotesRepository
import com.futebadosparcas.domain.usecase.GetUnseenReleaseNotesUseCase
import com.futebadosparcas.domain.usecase.UnseenReleaseNotes
import com.futebadosparcas.util.AnalyticsHelper
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitários para [WhatsNewViewModel].
 *
 * Cobre:
 * - Tela "Novidades": Loading → Success / Empty / Error.
 * - Pop-up: detecção, idempotência e marcação de "visto" com o build atual.
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase E, task #19.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("WhatsNewViewModel Tests")
@ExtendWith(MockLogExtension::class)
class WhatsNewViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var getUnseenReleaseNotes: GetUnseenReleaseNotesUseCase
    private lateinit var releaseNotesRepository: ReleaseNotesRepository
    private lateinit var analytics: AnalyticsHelper
    private lateinit var viewModel: WhatsNewViewModel

    private val platform = "android"
    private val currentBuild = 50

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        getUnseenReleaseNotes = mockk(relaxed = true)
        releaseNotesRepository = mockk(relaxed = true)
        analytics = mockk(relaxed = true)
        viewModel = WhatsNewViewModel(
            getUnseenReleaseNotes = getUnseenReleaseNotes,
            releaseNotesRepository = releaseNotesRepository,
            analytics = analytics,
            currentBuild = currentBuild,
            platform = platform,
        )
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun note(version: String, build: Int, showPopup: Boolean = false) = ReleaseNote(
        platform = platform,
        version = version,
        buildNumber = build,
        type = ReleaseType.MINOR,
        headline = "Headline $version",
        showPopup = showPopup,
    )

    // ─── Estado inicial ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("Estado inicial deve ser Loading")
    fun initialState_isLoading() {
        assertInstanceOf(WhatsNewUiState.Loading::class.java, viewModel.uiState.value)
    }

    @Test
    @DisplayName("popupNote inicial é null")
    fun initialPopup_isNull() {
        assertNull(viewModel.popupNote.value)
    }

    // ─── loadHistory ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("loadHistory_comSucesso_retornaSuccessOrdenadoDecrescente")
    fun loadHistory_success_updatesToSuccessSortedDescending() = runTest {
        val notes = listOf(note("1.24.0", 48), note("1.26.0", 50), note("1.25.0", 49))
        coEvery { releaseNotesRepository.getReleaseNotes(platform, 0) } returns Result.success(notes)

        viewModel.loadHistory()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertInstanceOf(WhatsNewUiState.Success::class.java, state)
        val ordered = (state as WhatsNewUiState.Success).notes.map { it.buildNumber }
        assertEquals(listOf(50, 49, 48), ordered)
    }

    @Test
    @DisplayName("loadHistory_listaVazia_retornaEmpty")
    fun loadHistory_emptyList_updatesToEmpty() = runTest {
        coEvery { releaseNotesRepository.getReleaseNotes(platform, 0) } returns Result.success(emptyList())

        viewModel.loadHistory()
        advanceUntilIdle()

        assertInstanceOf(WhatsNewUiState.Empty::class.java, viewModel.uiState.value)
    }

    @Test
    @DisplayName("loadHistory_comFalha_retornaError")
    fun loadHistory_failure_updatesToError() = runTest {
        coEvery { releaseNotesRepository.getReleaseNotes(platform, 0) } returns
            Result.failure(RuntimeException("Sem conexão"))

        viewModel.loadHistory()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertInstanceOf(WhatsNewUiState.Error::class.java, state)
        assertEquals("Sem conexão", (state as WhatsNewUiState.Error).message)
    }

    // ─── checkForPopup ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("checkForPopup_comNotaDePopup_emitePopupEDisparaAnalytics")
    fun checkForPopup_withPopupNote_emitsPopupAndLogsAnalytics() = runTest {
        val popup = note("1.26.0", 50, showPopup = true)
        coEvery { getUnseenReleaseNotes.invoke(platform, currentBuild) } returns
            Result.success(UnseenReleaseNotes(notes = listOf(popup), popupNote = popup))

        viewModel.checkForPopup()
        advanceUntilIdle()

        assertEquals(popup, viewModel.popupNote.value)
        verify { analytics.logWhatsNewPopupShown("1.26.0", platform) }
    }

    @Test
    @DisplayName("checkForPopup_semNotaDePopup_popupContinuaNull")
    fun checkForPopup_noPopupNote_popupRemainsNull() = runTest {
        coEvery { getUnseenReleaseNotes.invoke(platform, currentBuild) } returns
            Result.success(UnseenReleaseNotes(notes = emptyList(), popupNote = null))

        viewModel.checkForPopup()
        advanceUntilIdle()

        assertNull(viewModel.popupNote.value)
    }

    @Test
    @DisplayName("checkForPopup_chamadoDuasVezes_executaUmaVez")
    fun checkForPopup_calledTwice_runsOnce() = runTest {
        coEvery { getUnseenReleaseNotes.invoke(platform, currentBuild) } returns
            Result.success(UnseenReleaseNotes(notes = emptyList(), popupNote = null))

        viewModel.checkForPopup()
        viewModel.checkForPopup()
        advanceUntilIdle()

        coVerify(exactly = 1) { getUnseenReleaseNotes.invoke(platform, currentBuild) }
    }

    @Test
    @DisplayName("checkForPopup_comFalha_naoBloqueia_popupNull")
    fun checkForPopup_failure_popupRemainsNull() = runTest {
        coEvery { getUnseenReleaseNotes.invoke(platform, currentBuild) } returns
            Result.failure(RuntimeException("boom"))

        viewModel.checkForPopup()
        advanceUntilIdle()

        assertNull(viewModel.popupNote.value)
    }

    // ─── dismissPopup ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("dismissPopup_limpaPopupEMarcaBuildAtualComoVisto")
    fun dismissPopup_clearsPopupAndMarksSeenWithCurrentBuild() = runTest {
        val popup = note("1.26.0", 50, showPopup = true)
        coEvery { getUnseenReleaseNotes.invoke(platform, currentBuild) } returns
            Result.success(UnseenReleaseNotes(notes = listOf(popup), popupNote = popup))

        viewModel.checkForPopup()
        advanceUntilIdle()

        viewModel.dismissPopup()
        advanceUntilIdle()

        assertNull(viewModel.popupNote.value)
        coVerify { getUnseenReleaseNotes.markSeen(currentBuild) }
        verify { analytics.logWhatsNewDismissed("1.26.0") }
    }

    // ─── Analytics ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("onScreenOpened_disparaAnalytics")
    fun onScreenOpened_logsAnalytics() {
        viewModel.onScreenOpened()

        verify { analytics.logWhatsNewOpened("settings") }
    }
}
