package com.futebadosparcas.ui.messages

import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.DirectChat
import com.futebadosparcas.data.repository.DirectMessage
import com.futebadosparcas.data.repository.DirectMessagesRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.StandardTestDispatcher
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
@DisplayName("ConversationViewModel Tests")
class ConversationViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var repository: DirectMessagesRepository

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
    fun `same active chat observation remains idempotent`() = runTest {
        every { repository.observeChat("chat-1") } returns pendingChatFlow()
        every { repository.observeMessages("chat-1") } returns pendingMessagesFlow()
        val viewModel = ConversationViewModel(repository)

        viewModel.observe("chat-1")
        runCurrent()
        viewModel.observe("chat-1")
        runCurrent()

        verify(exactly = 1) { repository.observeChat("chat-1") }
        verify(exactly = 1) { repository.observeMessages("chat-1") }
        viewModel.viewModelScope.cancel()
    }

    @Test
    fun `retry after error restarts same chat without duplicate collectors`() = runTest {
        val chatCalls = AtomicInteger(0)
        val activeMessages = AtomicInteger(0)
        val maxActiveMessages = AtomicInteger(0)
        every { repository.observeChat("chat-1") } answers {
            if (chatCalls.incrementAndGet() == 1) {
                flow { throw IllegalStateException("Falha temporaria") }
            } else {
                pendingChatFlow()
            }
        }
        every { repository.observeMessages("chat-1") } answers {
            trackedPendingMessagesFlow(activeMessages, maxActiveMessages)
        }
        val viewModel = ConversationViewModel(repository)

        viewModel.observe("chat-1")
        runCurrent()
        assertEquals("Falha temporaria", viewModel.uiState.value.error)

        viewModel.retry("chat-1")
        runCurrent()

        verify(exactly = 2) { repository.observeChat("chat-1") }
        verify(exactly = 2) { repository.observeMessages("chat-1") }
        assertEquals(1, activeMessages.get())
        assertEquals(1, maxActiveMessages.get())
        assertTrue(viewModel.uiState.value.loading)
        assertEquals(null, viewModel.uiState.value.error)
        viewModel.viewModelScope.cancel()
    }

    private fun pendingChatFlow(): Flow<DirectChat?> = flow {
        awaitCancellation()
    }

    private fun pendingMessagesFlow(): Flow<List<DirectMessage>> = flow {
        awaitCancellation()
    }

    private fun trackedPendingMessagesFlow(
        active: AtomicInteger,
        maxActive: AtomicInteger
    ): Flow<List<DirectMessage>> = flow {
        val current = active.incrementAndGet()
        maxActive.updateAndGet { previous -> maxOf(previous, current) }
        try {
            awaitCancellation()
        } finally {
            active.decrementAndGet()
        }
    }
}
