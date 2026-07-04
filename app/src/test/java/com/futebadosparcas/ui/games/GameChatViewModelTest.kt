package com.futebadosparcas.ui.games

import com.futebadosparcas.data.model.GameChatMessage
import com.futebadosparcas.data.repository.GameChatRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import java.util.Date

/**
 * Testes unitários para GameChatViewModel (issue #3230, épico #3240).
 *
 * Cobertura: estados Loading/Empty/Success/Error, send/delete via repository,
 * idempotência do observeMessages (cancela job anterior).
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GameChatViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class GameChatViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var gameChatRepository: GameChatRepository
    private lateinit var auth: FirebaseAuth
    private lateinit var firebaseUser: FirebaseUser

    private val gameId = "game-123"
    private val uid = "uid-player-a"

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        gameChatRepository = mockk(relaxed = true)
        auth = mockk(relaxed = true)
        firebaseUser = mockk(relaxed = true)
        every { auth.currentUser } returns firebaseUser
        every { firebaseUser.uid } returns uid
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun createViewModel() = GameChatViewModel(gameChatRepository, auth)

    @Test
    @DisplayName("Deve exibir Empty quando não há mensagens")
    fun observeMessages_empty_showsEmpty() = runTest {
        every { gameChatRepository.observeMessages(gameId) } returns flowOf(emptyList())

        val viewModel = createViewModel()
        viewModel.observeMessages(gameId)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is GameChatUiState.Empty)
    }

    @Test
    @DisplayName("Deve exibir Success quando há mensagens")
    fun observeMessages_withMessages_showsSuccess() = runTest {
        val messages = listOf(
            GameChatMessage(id = "m1", senderId = uid, senderName = "A", text = "oi"),
            GameChatMessage(id = "m2", senderId = "other", senderName = "B", text = "ola")
        )
        every { gameChatRepository.observeMessages(gameId) } returns flowOf(messages)

        val viewModel = createViewModel()
        viewModel.observeMessages(gameId)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is GameChatUiState.Success)
        assertEquals(2, (state as GameChatUiState.Success).messages.size)
    }

    @Test
    @DisplayName("Deve exibir Error quando o flow falha")
    fun observeMessages_error_showsError() = runTest {
        every { gameChatRepository.observeMessages(gameId) } returns flow {
            throw RuntimeException("Falha de permissão")
        }

        val viewModel = createViewModel()
        viewModel.observeMessages(gameId)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is GameChatUiState.Error)
        assertTrue((state as GameChatUiState.Error).message.contains("Falha de permissão"))
    }

    @Test
    @DisplayName("Deve ir para Loading antes de receber dados")
    fun observeMessages_setsLoadingFirst() = runTest {
        every { gameChatRepository.observeMessages(gameId) } returns flowOf(emptyList())

        val viewModel = createViewModel()
        viewModel.observeMessages(gameId)

        assertTrue(viewModel.uiState.value is GameChatUiState.Loading)
        advanceUntilIdle()
    }

    @Test
    @DisplayName("observeMessages é idempotente — cancela job anterior")
    fun observeMessages_cancelsPreviousJob() = runTest {
        every { gameChatRepository.observeMessages(gameId) } returns flowOf(emptyList())

        val viewModel = createViewModel()
        viewModel.observeMessages(gameId)
        advanceUntilIdle()
        // Chamar de novo não deve crashar e deve resetar para Loading
        viewModel.observeMessages(gameId)
        assertTrue(viewModel.uiState.value is GameChatUiState.Loading)
    }

    @Test
    @DisplayName("sendMessage chama repository com texto trimado")
    fun sendMessage_callsRepositoryWithTrimmedText() = runTest {
        coEvery { gameChatRepository.sendMessage(gameId, "ola parças") } returns Result.success(Unit)

        val viewModel = createViewModel()
        viewModel.sendMessage(gameId, "  ola parças  ")
        advanceUntilIdle()

        coVerify { gameChatRepository.sendMessage(gameId, "ola parças") }
        assertTrue(viewModel.actionState.value is GameChatActionState.Idle)
    }

    @Test
    @DisplayName("sendMessage com texto vazio não chama repository")
    fun sendMessage_emptyText_doesNotCall() = runTest {
        val viewModel = createViewModel()
        viewModel.sendMessage(gameId, "   ")
        advanceUntilIdle()

        coVerify(exactly = 0) { gameChatRepository.sendMessage(any(), any()) }
    }

    @Test
    @DisplayName("sendMessage em falha seta actionState Error")
    fun sendMessage_failure_setsError() = runTest {
        coEvery { gameChatRepository.sendMessage(gameId, any()) } returns
            Result.failure(RuntimeException("Sem permissão"))

        val viewModel = createViewModel()
        viewModel.sendMessage(gameId, "oi")
        advanceUntilIdle()

        val state = viewModel.actionState.value
        assertTrue(state is GameChatActionState.Error)
        assertTrue((state as GameChatActionState.Error).message.contains("Sem permissão"))
    }

    @Test
    @DisplayName("deleteMessage chama repository com messageId")
    fun deleteMessage_callsRepository() = runTest {
        coEvery { gameChatRepository.deleteMessage(gameId, "msg-1") } returns Result.success(Unit)

        val viewModel = createViewModel()
        viewModel.deleteMessage(gameId, "msg-1")
        advanceUntilIdle()

        coVerify { gameChatRepository.deleteMessage(gameId, "msg-1") }
        assertTrue(viewModel.actionState.value is GameChatActionState.Idle)
    }

    @Test
    @DisplayName("clearActionError reseta Error para Idle")
    fun clearActionError_resetsToIdle() = runTest {
        coEvery { gameChatRepository.sendMessage(gameId, any()) } returns
            Result.failure(RuntimeException("erro"))

        val viewModel = createViewModel()
        viewModel.sendMessage(gameId, "oi")
        advanceUntilIdle()
        assertTrue(viewModel.actionState.value is GameChatActionState.Error)

        viewModel.clearActionError()
        assertTrue(viewModel.actionState.value is GameChatActionState.Idle)
    }

    @Test
    @DisplayName("currentUserId expõe uid do FirebaseAuth")
    fun currentUserId_returnsAuthUid() {
        every { auth.currentUser } returns firebaseUser
        every { firebaseUser.uid } returns uid

        val viewModel = createViewModel()
        assertEquals(uid, viewModel.currentUserId)
    }
}
