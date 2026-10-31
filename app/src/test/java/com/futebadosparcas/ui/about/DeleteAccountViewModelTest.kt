package com.futebadosparcas.ui.about

import com.futebadosparcas.R
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.BlockingGroup
import com.futebadosparcas.data.repository.DeleteAccountError
import com.futebadosparcas.data.repository.mapDeleteAccountError
import com.futebadosparcas.util.MockLogExtension
import com.google.firebase.functions.FirebaseFunctionsException
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
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
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("DeleteAccount (mapeamento de erro + ViewModel) Tests")
@ExtendWith(MockLogExtension::class)
class DeleteAccountViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var authRepository: AuthRepository

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        authRepository = mockk(relaxed = true)
        every { authRepository.getReauthProviders() } returns listOf("google.com", "password")
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun functionsError(
        code: FirebaseFunctionsException.Code,
        details: Any?,
    ): FirebaseFunctionsException {
        val e = mockk<FirebaseFunctionsException>(relaxed = true)
        every { e.code } returns code
        every { e.details } returns details
        every { e.message } returns "erro"
        return e
    }

    // ---------- mapeamento ----------

    @Test
    fun mapDeleteAccountError_recentLogin_returnsRequiresRecentLogin() {
        val e = functionsError(
            FirebaseFunctionsException.Code.FAILED_PRECONDITION,
            mapOf("reason" to "requires-recent-login", "maxAgeSeconds" to 600)
        )
        assertTrue(mapDeleteAccountError(e) is DeleteAccountError.RequiresRecentLogin)
    }

    @Test
    fun mapDeleteAccountError_soleOwner_returnsGroups() {
        val e = functionsError(
            FirebaseFunctionsException.Code.FAILED_PRECONDITION,
            mapOf(
                "reason" to "sole-owner-groups",
                "groupCount" to 2,
                "groups" to listOf(
                    mapOf("id" to "g1", "name" to "Pelada de Quinta"),
                    mapOf("id" to "g2", "name" to "Racha"),
                    mapOf("name" to "sem id"),
                )
            )
        )
        val mapped = mapDeleteAccountError(e)
        assertTrue(mapped is DeleteAccountError.SoleOwnerGroups)
        assertEquals(
            listOf(BlockingGroup("g1", "Pelada de Quinta"), BlockingGroup("g2", "Racha")),
            (mapped as DeleteAccountError.SoleOwnerGroups).groups
        )
    }

    @Test
    fun mapDeleteAccountError_unknownReason_returnsGeneric() {
        val e = functionsError(
            FirebaseFunctionsException.Code.FAILED_PRECONDITION,
            mapOf("reason" to "outra-coisa")
        )
        assertTrue(mapDeleteAccountError(e) is DeleteAccountError.Generic)
    }

    @Test
    fun mapDeleteAccountError_otherCodeOrNoDetails_returnsGeneric() {
        val other = functionsError(
            FirebaseFunctionsException.Code.INTERNAL,
            mapOf("reason" to "requires-recent-login")
        )
        val noDetails = functionsError(FirebaseFunctionsException.Code.FAILED_PRECONDITION, null)
        assertTrue(mapDeleteAccountError(other) is DeleteAccountError.Generic)
        assertTrue(mapDeleteAccountError(noDetails) is DeleteAccountError.Generic)
        assertTrue(mapDeleteAccountError(RuntimeException("x")) is DeleteAccountError.Generic)
    }

    // ---------- ViewModel ----------

    @Test
    fun deleteAccount_success_marksDeleted() = runTest {
        coEvery { authRepository.deleteAccount() } returns Result.success(Unit)
        val vm = DeleteAccountViewModel(authRepository)

        vm.deleteAccount()
        advanceUntilIdle()

        assertTrue(vm.uiState.value.deleted)
        assertFalse(vm.uiState.value.isDeleting)
    }

    @Test
    fun deleteAccount_recentLoginRequired_opensReauthWithProviders() = runTest {
        coEvery { authRepository.deleteAccount() } returns
            Result.failure(DeleteAccountError.RequiresRecentLogin())
        val vm = DeleteAccountViewModel(authRepository)

        vm.deleteAccount()
        advanceUntilIdle()

        assertEquals(listOf("google.com", "password"), vm.uiState.value.reauthProviders)
        assertFalse(vm.uiState.value.deleted)
        assertFalse(vm.uiState.value.isDeleting)
    }

    @Test
    fun deleteAccount_soleOwner_exposesBlockingGroups() = runTest {
        val groups = listOf(BlockingGroup("g1", "Pelada"))
        coEvery { authRepository.deleteAccount() } returns
            Result.failure(DeleteAccountError.SoleOwnerGroups(groups))
        val vm = DeleteAccountViewModel(authRepository)

        vm.deleteAccount()
        advanceUntilIdle()
        assertEquals(groups, vm.uiState.value.blockingGroups)

        vm.dismissBlockingGroups()
        assertNull(vm.uiState.value.blockingGroups)
    }

    @Test
    fun deleteAccount_genericFailure_setsError() = runTest {
        coEvery { authRepository.deleteAccount() } returns Result.failure(RuntimeException("boom"))
        val vm = DeleteAccountViewModel(authRepository)

        vm.deleteAccount()
        advanceUntilIdle()

        assertEquals(R.string.delete_account_error_generic, vm.uiState.value.errorRes)
        assertFalse(vm.uiState.value.isDeleting)
    }

    @Test
    fun reauthenticateWithPassword_success_retriesDeletion() = runTest {
        coEvery { authRepository.deleteAccount() } returnsMany listOf(
            Result.failure(DeleteAccountError.RequiresRecentLogin()),
            Result.success(Unit)
        )
        coEvery { authRepository.reauthenticateWithPassword("segredo") } returns Result.success(Unit)
        val vm = DeleteAccountViewModel(authRepository)

        vm.deleteAccount()
        advanceUntilIdle()
        vm.reauthenticateWithPassword("segredo")
        advanceUntilIdle()

        assertTrue(vm.uiState.value.deleted)
        assertNull(vm.uiState.value.reauthProviders)
        coVerify(exactly = 2) { authRepository.deleteAccount() }
    }

    @Test
    fun reauthenticateWithGoogle_failure_keepsDialogAndShowsError() = runTest {
        coEvery { authRepository.deleteAccount() } returns
            Result.failure(DeleteAccountError.RequiresRecentLogin())
        coEvery { authRepository.reauthenticateWithGoogle("tok") } returns
            Result.failure(RuntimeException("invalid"))
        val vm = DeleteAccountViewModel(authRepository)

        vm.deleteAccount()
        advanceUntilIdle()
        vm.reauthenticateWithGoogle("tok")
        advanceUntilIdle()

        assertEquals(R.string.delete_account_reauth_error, vm.uiState.value.reauthErrorRes)
        assertTrue(vm.uiState.value.reauthProviders != null)
        assertFalse(vm.uiState.value.deleted)
        coVerify(exactly = 1) { authRepository.deleteAccount() }
    }

    @Test
    fun reauthenticate_thenStillRecentLoginError_reopensReauth() = runTest {
        coEvery { authRepository.deleteAccount() } returns
            Result.failure(DeleteAccountError.RequiresRecentLogin())
        coEvery { authRepository.reauthenticateWithPassword(any()) } returns Result.success(Unit)
        val vm = DeleteAccountViewModel(authRepository)

        vm.deleteAccount()
        advanceUntilIdle()
        vm.reauthenticateWithPassword("x")
        advanceUntilIdle()

        assertTrue(vm.uiState.value.reauthProviders != null)
        assertFalse(vm.uiState.value.deleted)
    }
}
