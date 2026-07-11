package com.futebadosparcas.ui.groups

import android.net.Uri
import com.futebadosparcas.data.model.GroupWallPost
import com.futebadosparcas.data.repository.GroupWallMediaDraftState
import com.futebadosparcas.data.repository.GroupWallMediaTerminalException
import com.futebadosparcas.data.repository.GroupWallPage
import com.futebadosparcas.data.repository.GroupWallRealtimeSnapshot
import com.futebadosparcas.data.repository.GroupWallRepository
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.util.Date

@OptIn(ExperimentalCoroutinesApi::class)
class GroupWallViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: GroupWallRepository
    private lateinit var viewModel: GroupWallViewModel

    @BeforeEach
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
        viewModel = GroupWallViewModel(repository, mockk<FirebaseAuth>(relaxed = true))
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `publicacao bem sucedida emite sucesso para limpar draft`() = runTest(dispatcher) {
        coEvery {
            repository.createPost("group-1", "Resenha", null, any(), any())
        } returns Result.success(Unit)

        viewModel.createPost("group-1", "Resenha")
        advanceUntilIdle()

        assertEquals(
            GroupWallActionState.PostCreated("Publicado no mural"),
            viewModel.actionState.value
        )
    }

    @Test
    fun `falha de publicacao emite erro para preservar draft`() = runTest(dispatcher) {
        coEvery {
            repository.createPost("group-1", "Resenha", null, any(), any())
        } returns
            Result.failure(IllegalStateException("Sem conexão"))

        viewModel.createPost("group-1", "Resenha")
        advanceUntilIdle()

        val state = viewModel.actionState.value
        assertInstanceOf(GroupWallActionState.Error::class.java, state)
        assertEquals("Sem conexão", (state as GroupWallActionState.Error).message)
    }

    @Test
    fun `retry do mesmo draft reutiliza client request id`() = runTest(dispatcher) {
        val requestIds = mutableListOf<String>()
        coEvery {
            repository.createPost(
                "group-1",
                "Resenha",
                null,
                capture(requestIds),
                any()
            )
        } returnsMany listOf(
            Result.failure(IllegalStateException("Sem conexão")),
            Result.success(Unit)
        )

        viewModel.createPost("group-1", "Resenha")
        advanceUntilIdle()
        viewModel.resetActionState()
        viewModel.createPost("group-1", "Resenha")
        advanceUntilIdle()

        assertEquals(2, requestIds.size)
        assertEquals(requestIds.first(), requestIds.last())
        assertInstanceOf(GroupWallActionState.PostCreated::class.java, viewModel.actionState.value)
    }

    @Test
    fun `retry apos rejeicao terminal gera novo client request id`() = runTest(dispatcher) {
        val requestIds = mutableListOf<String>()
        coEvery {
            repository.createPost(
                "group-1",
                "Resenha",
                null,
                capture(requestIds),
                any()
            )
        } returnsMany listOf(
            Result.failure(
                GroupWallMediaTerminalException(
                    terminalState = GroupWallMediaDraftState.REJECTED,
                    errorCode = "MIME_MISMATCH",
                    message = "Mídia rejeitada"
                )
            ),
            Result.success(Unit)
        )

        viewModel.createPost("group-1", "Resenha")
        advanceUntilIdle()
        viewModel.resetActionState()
        viewModel.createPost("group-1", "Resenha")
        advanceUntilIdle()

        assertEquals(2, requestIds.size)
        assertNotEquals(requestIds.first(), requestIds.last())
        assertInstanceOf(GroupWallActionState.PostCreated::class.java, viewModel.actionState.value)
    }

    @Test
    fun `progresso de upload e exposto enquanto draft e preservado`() = runTest(dispatcher) {
        val uri = mockk<Uri>()
        every { uri.toString() } returns "content://mural/video.mp4"
        val finishUpload = CompletableDeferred<Unit>()
        coEvery {
            repository.createPost("group-1", "", uri, any(), any())
        } coAnswers {
            arg<(Int) -> Unit>(4).invoke(62)
            finishUpload.await()
            Result.success(Unit)
        }

        viewModel.createPost("group-1", "", uri)
        runCurrent()

        assertEquals(
            GroupWallActionState.Sending(progress = 62, processing = false),
            viewModel.actionState.value
        )

        finishUpload.complete(Unit)
        advanceUntilIdle()
        assertInstanceOf(GroupWallActionState.PostCreated::class.java, viewModel.actionState.value)
    }

    @Test
    fun `cancelamento interrompe envio e mantem rascunho`() = runTest(dispatcher) {
        val uri = mockk<Uri>()
        every { uri.toString() } returns "content://mural/video.mp4"
        coEvery {
            repository.createPost("group-1", "Gol", uri, any(), any())
        } coAnswers {
            awaitCancellation()
        }

        viewModel.createPost("group-1", "Gol", uri)
        runCurrent()
        viewModel.cancelPostUpload()
        advanceUntilIdle()

        val state = viewModel.actionState.value
        assertInstanceOf(GroupWallActionState.Error::class.java, state)
        assertEquals(
            "Envio cancelado. Seu rascunho foi mantido.",
            (state as GroupWallActionState.Error).message
        )
    }

    @Test
    fun `pagina antiga mantem newest first e elimina duplicatas do listener`() = runTest(dispatcher) {
        val firstCursor = mockk<DocumentSnapshot>()
        val lastCursor = mockk<DocumentSnapshot>()
        every { repository.observePosts("group-1") } returns flowOf(
            realtimeSnapshot(
                posts = listOf(post("post-3", 3_000), post("post-2", 2_000)),
                cursor = firstCursor,
                hasMore = true
            )
        )
        coEvery { repository.loadOlderPosts("group-1", firstCursor) } returns Result.success(
            GroupWallPage(
                posts = listOf(post("post-2", 2_000), post("post-1", 1_000)),
                nextCursor = lastCursor,
                hasMore = false
            )
        )

        viewModel.observePosts("group-1")
        advanceUntilIdle()
        val initial = viewModel.uiState.value as GroupWallUiState.Success
        assertEquals(true, initial.hasMore)
        assertEquals(false, initial.loadingMore)

        viewModel.loadMore("group-1")
        advanceUntilIdle()

        val loaded = viewModel.uiState.value as GroupWallUiState.Success
        assertEquals(listOf("post-3", "post-2", "post-1"), loaded.posts.map { it.id })
        assertEquals(false, loaded.hasMore)
        assertEquals(false, loaded.loadingMore)
        coVerify(exactly = 1) { repository.loadOlderPosts("group-1", firstCursor) }
    }

    @Test
    fun `janela realtime preserva item que saiu quando nova mensagem chega`() = runTest(dispatcher) {
        val snapshots = MutableSharedFlow<GroupWallRealtimeSnapshot>()
        every { repository.observePosts("group-1") } returns snapshots

        viewModel.observePosts("group-1")
        runCurrent()
        snapshots.emit(
            realtimeSnapshot(
                posts = listOf(post("post-2", 2_000), post("post-1", 1_000)),
                cursor = mockk(),
                hasMore = true
            )
        )
        runCurrent()
        snapshots.emit(
            realtimeSnapshot(
                posts = listOf(post("post-3", 3_000), post("post-2", 2_000)),
                cursor = mockk(),
                hasMore = true
            )
        )
        runCurrent()

        val state = viewModel.uiState.value as GroupWallUiState.Success
        assertEquals(listOf("post-3", "post-2", "post-1"), state.posts.map { it.id })
    }

    @Test
    fun `erro de pagina antiga e recuperavel sem perder timeline`() = runTest(dispatcher) {
        val cursor = mockk<DocumentSnapshot>()
        every { repository.observePosts("group-1") } returns flowOf(
            realtimeSnapshot(
                posts = listOf(post("post-2", 2_000)),
                cursor = cursor,
                hasMore = true
            )
        )
        coEvery { repository.loadOlderPosts("group-1", cursor) } returnsMany listOf(
            Result.failure(IllegalStateException("Sem conexão")),
            Result.success(
                GroupWallPage(
                    posts = listOf(post("post-1", 1_000)),
                    nextCursor = null,
                    hasMore = false
                )
            )
        )

        viewModel.observePosts("group-1")
        advanceUntilIdle()
        viewModel.loadMore("group-1")
        advanceUntilIdle()

        val failed = viewModel.uiState.value as GroupWallUiState.Success
        assertEquals("Sem conexão", failed.loadMoreError)
        assertEquals(true, failed.hasMore)
        assertEquals(listOf("post-2"), failed.posts.map { it.id })

        viewModel.loadMore("group-1")
        advanceUntilIdle()

        val recovered = viewModel.uiState.value as GroupWallUiState.Success
        assertEquals(null, recovered.loadMoreError)
        assertEquals(listOf("post-2", "post-1"), recovered.posts.map { it.id })
        coVerify(exactly = 2) { repository.loadOlderPosts("group-1", cursor) }
    }

    private fun realtimeSnapshot(
        posts: List<GroupWallPost>,
        cursor: DocumentSnapshot?,
        hasMore: Boolean
    ) = GroupWallRealtimeSnapshot(
        recentPosts = posts,
        pinnedPosts = emptyList(),
        nextCursor = cursor,
        hasMore = hasMore
    )

    private fun post(id: String, timestamp: Long) = GroupWallPost(
        id = id,
        groupId = "group-1",
        authorId = "user-1",
        authorName = "Jogador",
        text = id,
        createdAt = Date(timestamp)
    )
}
