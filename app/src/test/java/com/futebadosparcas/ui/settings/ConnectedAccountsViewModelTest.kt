package com.futebadosparcas.ui.settings

import com.futebadosparcas.R
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("ConnectedAccountsViewModel Tests")
@ExtendWith(MockLogExtension::class)
class ConnectedAccountsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var authRepository: AuthRepository

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        authRepository = mockk(relaxed = true)
        every { authRepository.getLinkedProviders() } returns listOf("password")
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun init_loadsProviders() {
        val vm = ConnectedAccountsViewModel(authRepository)
        val state = vm.uiState.value
        assertTrue(state is ConnectedAccountsUiState.Success)
        assertEquals(listOf("password"), (state as ConnectedAccountsUiState.Success).providers)
    }

    @Test
    fun linkGoogleAccount_success_emitsShowSuccessAndRefreshes() = runTest(testDispatcher) {
        every { authRepository.getLinkedProviders() } returnsMany listOf(
            listOf("password"),
            listOf("password", "google.com"),
        )
        coEvery { authRepository.linkGoogleAccount(any()) } returns Result.success(Unit)
        val vm = ConnectedAccountsViewModel(authRepository)
        val events = mutableListOf<ConnectedAccountsEvent>()
        val collector = launch { vm.events.toList(events) }

        vm.linkGoogleAccount("id-token")
        advanceUntilIdle()
        collector.cancel()

        assertEquals(1, events.size)
        assertTrue(events[0] is ConnectedAccountsEvent.ShowSuccess)
        assertEquals(
            R.string.connected_accounts_link_success,
            (events[0] as ConnectedAccountsEvent.ShowSuccess).messageRes,
        )
        val state = vm.uiState.value as ConnectedAccountsUiState.Success
        assertEquals(listOf("password", "google.com"), state.providers)
        assertTrue(!state.isLinking)
    }

    @Test
    fun linkGoogleAccount_failure_emitsShowError() = runTest(testDispatcher) {
        every { authRepository.getLinkedProviders() } returns listOf("password")
        coEvery { authRepository.linkGoogleAccount(any()) } returns Result.failure(RuntimeException("boom"))
        val vm = ConnectedAccountsViewModel(authRepository)
        val events = mutableListOf<ConnectedAccountsEvent>()
        val collector = launch { vm.events.toList(events) }

        vm.linkGoogleAccount("id-token")
        advanceUntilIdle()
        collector.cancel()

        assertEquals(1, events.size)
        assertTrue(events[0] is ConnectedAccountsEvent.ShowError)
        assertEquals(
            R.string.connected_accounts_link_error,
            (events[0] as ConnectedAccountsEvent.ShowError).messageRes,
        )
    }

    @Test
    fun unlinkGoogleAccount_success_emitsShowSuccess() = runTest(testDispatcher) {
        every { authRepository.getLinkedProviders() } returnsMany listOf(
            listOf("password", "google.com"),
            listOf("password"),
        )
        coEvery { authRepository.unlinkGoogleAccount() } returns Result.success(Unit)
        val vm = ConnectedAccountsViewModel(authRepository)
        val events = mutableListOf<ConnectedAccountsEvent>()
        val collector = launch { vm.events.toList(events) }

        vm.unlinkGoogleAccount()
        advanceUntilIdle()
        collector.cancel()

        assertEquals(1, events.size)
        assertTrue(events[0] is ConnectedAccountsEvent.ShowSuccess)
        assertEquals(
            R.string.connected_accounts_unlink_success,
            (events[0] as ConnectedAccountsEvent.ShowSuccess).messageRes,
        )
    }

    @Test
    fun unlinkGoogleAccount_guardFailure_emitsCannotUnlink() = runTest(testDispatcher) {
        every { authRepository.getLinkedProviders() } returns listOf("google.com")
        coEvery { authRepository.unlinkGoogleAccount() } returns
            Result.failure(IllegalStateException("app/require-primary-method"))
        val vm = ConnectedAccountsViewModel(authRepository)
        val events = mutableListOf<ConnectedAccountsEvent>()
        val collector = launch { vm.events.toList(events) }

        vm.unlinkGoogleAccount()
        advanceUntilIdle()
        collector.cancel()

        assertEquals(1, events.size)
        assertTrue(events[0] is ConnectedAccountsEvent.ShowError)
        assertEquals(
            R.string.connected_accounts_cannot_unlink,
            (events[0] as ConnectedAccountsEvent.ShowError).messageRes,
        )
    }

    @Test
    fun unlinkGoogleAccount_genericFailure_emitsUnlinkError() = runTest(testDispatcher) {
        every { authRepository.getLinkedProviders() } returns listOf("password", "google.com")
        coEvery { authRepository.unlinkGoogleAccount() } returns
            Result.failure(RuntimeException("auth/requires-recent-login"))
        val vm = ConnectedAccountsViewModel(authRepository)
        val events = mutableListOf<ConnectedAccountsEvent>()
        val collector = launch { vm.events.toList(events) }

        vm.unlinkGoogleAccount()
        advanceUntilIdle()
        collector.cancel()

        assertEquals(1, events.size)
        assertTrue(events[0] is ConnectedAccountsEvent.ShowError)
        assertEquals(
            R.string.connected_accounts_unlink_error,
            (events[0] as ConnectedAccountsEvent.ShowError).messageRes,
        )
    }
}
