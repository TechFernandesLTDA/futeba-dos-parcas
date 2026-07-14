package com.futebadosparcas.ui.games

import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.GameVideosRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GameVideosViewModel Tests")
class GameVideosViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var repository: GameVideosRepository

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        repository = mockk(relaxed = true)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `flow failure becomes error state`() = runTest {
        every { repository.observeVideos("game-1") } returns flow {
            throw IllegalStateException("Acesso negado")
        }
        val viewModel = GameVideosViewModel(repository)

        viewModel.observe("game-1")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is GameVideosUiState.Error)
        assertEquals("Acesso negado", (state as GameVideosUiState.Error).message)
    }

    @Test
    fun `same active game observation does not duplicate collector`() = runTest {
        every { repository.observeVideos("game-1") } returns flow {
            awaitCancellation()
        }
        val viewModel = GameVideosViewModel(repository)

        viewModel.observe("game-1")
        runCurrent()
        viewModel.observe("game-1")
        runCurrent()

        verify(exactly = 1) { repository.observeVideos("game-1") }
        viewModel.viewModelScope.cancel()
    }
}
