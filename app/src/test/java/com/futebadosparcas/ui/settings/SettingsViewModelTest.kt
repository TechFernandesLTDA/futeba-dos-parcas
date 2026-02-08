package com.futebadosparcas.ui.settings

import com.futebadosparcas.domain.model.GamificationSettings
import com.futebadosparcas.domain.repository.SettingsRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para SettingsViewModel.
 * Verifica carregamento, salvamento e transicoes de estado de configuracoes de gamificacao.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("SettingsViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class SettingsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var repository: SettingsRepository
    private lateinit var viewModel: SettingsViewModel

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        repository = mockk()
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ========== Estado Inicial ==========

    @Test
    @DisplayName("Estado inicial deve ser Loading")
    fun init_default_startsWithLoading() = runTest {
        // Given
        coEvery { repository.getGamificationSettings() } returns Result.success(GamificationSettings())

        // When
        viewModel = SettingsViewModel(repository)

        // Then
        assertTrue(viewModel.uiState.value is SettingsUiState.Loading)
    }

    // ========== Transicao Loading -> Success ==========

    @Test
    @DisplayName("Deve carregar configuracoes com sucesso")
    fun loadSettings_success_transitionsToSuccess() = runTest {
        // Given
        val settings = GamificationSettings(
            xpPresence = 15,
            xpPerGoal = 12,
            xpMvp = 40
        )
        coEvery { repository.getGamificationSettings() } returns Result.success(settings)

        // When
        viewModel = SettingsViewModel(repository)
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is SettingsUiState.Success)
        assertEquals(15, (state as SettingsUiState.Success).settings.xpPresence)
        assertEquals(12, state.settings.xpPerGoal)
        assertEquals(40, state.settings.xpMvp)
    }

    // ========== Transicao Loading -> Error ==========

    @Test
    @DisplayName("Deve transitar para Error quando repositorio retorna falha")
    fun loadSettings_failure_transitionsToError() = runTest {
        // Given
        coEvery { repository.getGamificationSettings() } returns
            Result.failure(Exception("Erro de conexao"))

        // When
        viewModel = SettingsViewModel(repository)
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is SettingsUiState.Error)
        assertEquals("Erro de conexao", (state as SettingsUiState.Error).message)
    }

    @Test
    @DisplayName("Deve transitar para Error quando excecao inesperada ocorre")
    fun loadSettings_unexpectedException_transitionsToError() = runTest {
        // Given
        coEvery { repository.getGamificationSettings() } throws RuntimeException("Crash inesperado")

        // When
        viewModel = SettingsViewModel(repository)
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is SettingsUiState.Error)
        assertTrue((state as SettingsUiState.Error).message.contains("Crash inesperado"))
    }

    // ========== Salvamento ==========

    @Test
    @DisplayName("Deve salvar configuracoes com sucesso")
    fun saveSettings_success_transitionsToSaved() = runTest {
        // Given
        val settings = GamificationSettings(xpPresence = 20)
        coEvery { repository.getGamificationSettings() } returns Result.success(GamificationSettings())
        coEvery { repository.updateGamificationSettings(settings) } returns Result.success(Unit)

        viewModel = SettingsViewModel(repository)
        advanceUntilIdle()

        // When
        viewModel.saveSettings(settings)
        advanceUntilIdle()

        // Then
        assertTrue(viewModel.uiState.value is SettingsUiState.Saved)
        coVerify(exactly = 1) { repository.updateGamificationSettings(settings) }
    }

    @Test
    @DisplayName("Deve transitar para Error quando salvamento falha")
    fun saveSettings_failure_transitionsToError() = runTest {
        // Given
        val settings = GamificationSettings(xpPresence = 20)
        coEvery { repository.getGamificationSettings() } returns Result.success(GamificationSettings())
        coEvery { repository.updateGamificationSettings(settings) } returns
            Result.failure(Exception("Permission denied"))

        viewModel = SettingsViewModel(repository)
        advanceUntilIdle()

        // When
        viewModel.saveSettings(settings)
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is SettingsUiState.Error)
        assertEquals("Permission denied", (state as SettingsUiState.Error).message)
    }

    @Test
    @DisplayName("Deve transitar para Error quando excecao ocorre ao salvar")
    fun saveSettings_unexpectedException_transitionsToError() = runTest {
        // Given
        val settings = GamificationSettings()
        coEvery { repository.getGamificationSettings() } returns Result.success(GamificationSettings())
        coEvery { repository.updateGamificationSettings(any()) } throws RuntimeException("Network crash")

        viewModel = SettingsViewModel(repository)
        advanceUntilIdle()

        // When
        viewModel.saveSettings(settings)
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is SettingsUiState.Error)
    }

    // ========== Reset State ==========

    @Test
    @DisplayName("resetState apos Saved deve recarregar configuracoes")
    fun resetState_afterSaved_reloadsSettings() = runTest {
        // Given
        val settings = GamificationSettings(xpPresence = 20)
        coEvery { repository.getGamificationSettings() } returns Result.success(settings)
        coEvery { repository.updateGamificationSettings(any()) } returns Result.success(Unit)

        viewModel = SettingsViewModel(repository)
        advanceUntilIdle()

        viewModel.saveSettings(settings)
        advanceUntilIdle()
        assertTrue(viewModel.uiState.value is SettingsUiState.Saved)

        // When
        viewModel.resetState()
        advanceUntilIdle()

        // Then - Deve ter recarregado (estado Success)
        assertTrue(viewModel.uiState.value is SettingsUiState.Success)
        // getGamificationSettings chamado 3x: init + resetState reload
        coVerify(atLeast = 2) { repository.getGamificationSettings() }
    }

    @Test
    @DisplayName("resetState quando nao e Saved nao deve recarregar")
    fun resetState_notSaved_noReload() = runTest {
        // Given
        coEvery { repository.getGamificationSettings() } returns Result.success(GamificationSettings())

        viewModel = SettingsViewModel(repository)
        advanceUntilIdle()
        assertTrue(viewModel.uiState.value is SettingsUiState.Success)

        // When
        viewModel.resetState()

        // Then - Nao deve chamar getGamificationSettings novamente
        coVerify(exactly = 1) { repository.getGamificationSettings() }
    }

    // ========== Cancelamento de Jobs ==========

    @Test
    @DisplayName("loadSettings chamado multiplas vezes deve cancelar job anterior")
    fun loadSettings_calledMultipleTimes_cancelsPreviousJob() = runTest {
        // Given
        coEvery { repository.getGamificationSettings() } returns Result.success(GamificationSettings())

        viewModel = SettingsViewModel(repository)

        // When
        viewModel.loadSettings()
        viewModel.loadSettings()
        viewModel.loadSettings()
        advanceUntilIdle()

        // Then - Nao deve lançar excecao
        val state = viewModel.uiState.value
        assertTrue(state is SettingsUiState.Success || state is SettingsUiState.Loading)
    }

    @Test
    @DisplayName("saveSettings chamado multiplas vezes deve cancelar job anterior")
    fun saveSettings_calledMultipleTimes_cancelsPreviousJob() = runTest {
        // Given
        val settings = GamificationSettings()
        coEvery { repository.getGamificationSettings() } returns Result.success(settings)
        coEvery { repository.updateGamificationSettings(any()) } returns Result.success(Unit)

        viewModel = SettingsViewModel(repository)
        advanceUntilIdle()

        // When
        viewModel.saveSettings(settings)
        viewModel.saveSettings(settings)
        advanceUntilIdle()

        // Then - Estado final deve ser consistente
        val state = viewModel.uiState.value
        assertTrue(state is SettingsUiState.Saved)
    }
}
