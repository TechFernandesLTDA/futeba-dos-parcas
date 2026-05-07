package com.futebadosparcas.ui.groups

import com.futebadosparcas.data.repository.JoinRequest
import com.futebadosparcas.data.repository.JoinRequestRepository
import com.futebadosparcas.data.repository.JoinRequestStatus
import com.futebadosparcas.domain.repository.UserRepository
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
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

/**
 * Testes unitarios para JoinRequestViewModel (issue #517 Phase 2).
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("JoinRequestViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class JoinRequestViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var repo: JoinRequestRepository
    private lateinit var userRepo: UserRepository
    private lateinit var auth: FirebaseAuth
    private lateinit var firebaseUser: FirebaseUser

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        repo = mockk(relaxed = true)
        userRepo = mockk()
        auth = mockk()
        firebaseUser = mockk()
        every { firebaseUser.uid } returns "uid-1"
        every { firebaseUser.displayName } returns "Test User"
        every { firebaseUser.photoUrl } returns null
        every { auth.currentUser } returns firebaseUser
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("observeMyRequest sem request emite NotRequested")
    fun observeMyRequest_noRequest_emitsNotRequested() = runTest(testDispatcher) {
        every { repo.observeMyRequest("g1") } returns flowOf(null)

        val vm = JoinRequestViewModel(repo, userRepo, auth)
        vm.observeMyRequest("g1")
        advanceUntilIdle()

        assertEquals(MyJoinRequestState.NotRequested, vm.myRequestState.value)
    }

    @Test
    @DisplayName("observeMyRequest com PENDING emite Pending")
    fun observeMyRequest_pending_emitsPending() = runTest(testDispatcher) {
        val req = JoinRequest(id = "uid-1", userId = "uid-1", userName = "Test User", status = JoinRequestStatus.PENDING)
        every { repo.observeMyRequest("g1") } returns flowOf(req)

        val vm = JoinRequestViewModel(repo, userRepo, auth)
        vm.observeMyRequest("g1")
        advanceUntilIdle()

        assertTrue(vm.myRequestState.value is MyJoinRequestState.Pending)
    }

    @Test
    @DisplayName("observeMyRequest com APPROVED emite Approved")
    fun observeMyRequest_approved_emitsApproved() = runTest(testDispatcher) {
        val req = JoinRequest(id = "uid-1", userId = "uid-1", userName = "Test", status = JoinRequestStatus.APPROVED)
        every { repo.observeMyRequest("g1") } returns flowOf(req)

        val vm = JoinRequestViewModel(repo, userRepo, auth)
        vm.observeMyRequest("g1")
        advanceUntilIdle()

        assertTrue(vm.myRequestState.value is MyJoinRequestState.Approved)
    }

    @Test
    @DisplayName("observeMyRequest com REJECTED emite Rejected")
    fun observeMyRequest_rejected_emitsRejected() = runTest(testDispatcher) {
        val req = JoinRequest(id = "uid-1", userId = "uid-1", userName = "Test", status = JoinRequestStatus.REJECTED)
        every { repo.observeMyRequest("g1") } returns flowOf(req)

        val vm = JoinRequestViewModel(repo, userRepo, auth)
        vm.observeMyRequest("g1")
        advanceUntilIdle()

        assertTrue(vm.myRequestState.value is MyJoinRequestState.Rejected)
    }

    @Test
    @DisplayName("observePendingRequests popula lista")
    fun observePendingRequests_populates() = runTest(testDispatcher) {
        val items = listOf(
            JoinRequest(id = "u1", userId = "u1", userName = "U1"),
            JoinRequest(id = "u2", userId = "u2", userName = "U2")
        )
        every { repo.observePendingRequests("g1") } returns flowOf(items)

        val vm = JoinRequestViewModel(repo, userRepo, auth)
        vm.observePendingRequests("g1")
        advanceUntilIdle()

        assertEquals(2, vm.pendingRequests.value.size)
    }

    @Test
    @DisplayName("requestJoin chama createRequest com nome do usuario")
    fun requestJoin_callsCreateRequest() = runTest(testDispatcher) {
        coEvery { userRepo.getUserById("uid-1") } returns Result.success(
            com.futebadosparcas.domain.model.User(
                id = "uid-1",
                name = "Test User",
                email = "test@example.com"
            )
        )
        coEvery { repo.createRequest("g1", "Test User", null) } returns Result.success(Unit)

        val vm = JoinRequestViewModel(repo, userRepo, auth)
        vm.requestJoin("g1")
        advanceUntilIdle()

        coVerify { repo.createRequest("g1", "Test User", null) }
    }

    @Test
    @DisplayName("cancelRequest chama cancelRequest no repo")
    fun cancelRequest_callsRepo() = runTest(testDispatcher) {
        coEvery { repo.cancelRequest("g1") } returns Result.success(Unit)

        val vm = JoinRequestViewModel(repo, userRepo, auth)
        vm.cancelRequest("g1")
        advanceUntilIdle()

        coVerify { repo.cancelRequest("g1") }
    }

    @Test
    @DisplayName("approve chama approveRequest com requesterId correto")
    fun approve_callsRepo() = runTest(testDispatcher) {
        coEvery { repo.approveRequest("g1", "u-req") } returns Result.success(Unit)

        val vm = JoinRequestViewModel(repo, userRepo, auth)
        vm.approve("g1", "u-req")
        advanceUntilIdle()

        coVerify { repo.approveRequest("g1", "u-req") }
    }

    @Test
    @DisplayName("reject chama rejectRequest com requesterId correto")
    fun reject_callsRepo() = runTest(testDispatcher) {
        coEvery { repo.rejectRequest("g1", "u-req") } returns Result.success(Unit)

        val vm = JoinRequestViewModel(repo, userRepo, auth)
        vm.reject("g1", "u-req")
        advanceUntilIdle()

        coVerify { repo.rejectRequest("g1", "u-req") }
    }
}
