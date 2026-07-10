package com.futebadosparcas.ui.groups

import com.futebadosparcas.data.repository.GroupWallRepository
import com.google.firebase.auth.FirebaseAuth
import io.mockk.coEvery
import io.mockk.mockk
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
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

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
        coEvery { repository.createPost("group-1", "Resenha", null) } returns Result.success(Unit)

        viewModel.createPost("group-1", "Resenha")
        advanceUntilIdle()

        assertEquals(
            GroupWallActionState.PostCreated("Publicado no mural"),
            viewModel.actionState.value
        )
    }

    @Test
    fun `falha de publicacao emite erro para preservar draft`() = runTest(dispatcher) {
        coEvery { repository.createPost("group-1", "Resenha", null) } returns
            Result.failure(IllegalStateException("Sem conexão"))

        viewModel.createPost("group-1", "Resenha")
        advanceUntilIdle()

        val state = viewModel.actionState.value
        assertInstanceOf(GroupWallActionState.Error::class.java, state)
        assertEquals("Sem conexão", (state as GroupWallActionState.Error).message)
    }
}
