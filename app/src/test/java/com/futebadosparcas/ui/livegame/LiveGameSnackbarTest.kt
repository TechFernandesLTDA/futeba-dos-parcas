package com.futebadosparcas.ui.livegame

import androidx.compose.material3.SnackbarHostState
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LiveGameSnackbarTest {

    @Test
    fun `entrega mensagens repetidas como eventos distintos`() = runTest {
        val messages = MutableSharedFlow<String>()
        val snackbarHostState = SnackbarHostState()
        val collector = backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            collectLiveGameUserMessages(messages, snackbarHostState)
        }

        messages.emit("Erro ao adicionar gol")
        runCurrent()
        assertEquals(
            "Erro ao adicionar gol",
            snackbarHostState.currentSnackbarData?.visuals?.message
        )

        snackbarHostState.currentSnackbarData?.dismiss()
        runCurrent()

        messages.emit("Erro ao adicionar gol")
        runCurrent()
        assertEquals(
            "Erro ao adicionar gol",
            snackbarHostState.currentSnackbarData?.visuals?.message
        )

        snackbarHostState.currentSnackbarData?.dismiss()
        collector.cancelAndJoin()
    }

    @Test
    fun `ignora mensagem vazia`() = runTest {
        val messages = MutableSharedFlow<String>()
        val snackbarHostState = SnackbarHostState()
        val collector = backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            collectLiveGameUserMessages(messages, snackbarHostState)
        }

        messages.emit("  ")
        runCurrent()

        assertNull(snackbarHostState.currentSnackbarData)
        collector.cancelAndJoin()
    }
}
