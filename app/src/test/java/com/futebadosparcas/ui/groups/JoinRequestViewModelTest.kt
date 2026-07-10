package com.futebadosparcas.ui.groups

import com.futebadosparcas.domain.model.GroupJoinRequest
import com.futebadosparcas.domain.model.GroupJoinRequestStatus
import com.futebadosparcas.domain.repository.GroupRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.flow
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
 *
 * Migrado em 2026-05-07 (PR #557): VM agora usa GroupRepository (shared) em vez de
 * JoinRequestRepository (Android-only). Models trocaram de JoinRequest/JoinRequestStatus
 * para GroupJoinRequest/GroupJoinRequestStatus.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("JoinRequestViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class JoinRequestViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var groupRepo: GroupRepository

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        groupRepo = mockk(relaxed = true)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("observeMyJoinRequest sem request emite NotRequested")
    fun observeMyRequest_noRequest_emitsNotRequested() = runTest(testDispatcher) {
        every { groupRepo.observeMyJoinRequest("g1") } returns flowOf(null)

        val vm = JoinRequestViewModel(groupRepo)
        vm.observeMyRequest("g1")
        advanceUntilIdle()

        assertEquals(MyJoinRequestState.NotRequested, vm.myRequestState.value)
    }

    @Test
    @DisplayName("observeMyJoinRequest com PENDING emite Pending")
    fun observeMyRequest_pending_emitsPending() = runTest(testDispatcher) {
        val req = GroupJoinRequest(
            id = "uid-1",
            userId = "uid-1",
            userName = "Test User",
            status = GroupJoinRequestStatus.PENDING,
        )
        every { groupRepo.observeMyJoinRequest("g1") } returns flowOf(req)

        val vm = JoinRequestViewModel(groupRepo)
        vm.observeMyRequest("g1")
        advanceUntilIdle()

        assertTrue(vm.myRequestState.value is MyJoinRequestState.Pending)
    }

    @Test
    @DisplayName("observeMyJoinRequest com APPROVED emite Approved")
    fun observeMyRequest_approved_emitsApproved() = runTest(testDispatcher) {
        val req = GroupJoinRequest(
            id = "uid-1",
            userId = "uid-1",
            userName = "Test",
            status = GroupJoinRequestStatus.APPROVED,
        )
        every { groupRepo.observeMyJoinRequest("g1") } returns flowOf(req)

        val vm = JoinRequestViewModel(groupRepo)
        vm.observeMyRequest("g1")
        advanceUntilIdle()

        assertTrue(vm.myRequestState.value is MyJoinRequestState.Approved)
    }

    @Test
    @DisplayName("observeMyJoinRequest com REJECTED emite Rejected")
    fun observeMyRequest_rejected_emitsRejected() = runTest(testDispatcher) {
        val req = GroupJoinRequest(
            id = "uid-1",
            userId = "uid-1",
            userName = "Test",
            status = GroupJoinRequestStatus.REJECTED,
        )
        every { groupRepo.observeMyJoinRequest("g1") } returns flowOf(req)

        val vm = JoinRequestViewModel(groupRepo)
        vm.observeMyRequest("g1")
        advanceUntilIdle()

        assertTrue(vm.myRequestState.value is MyJoinRequestState.Rejected)
    }

    @Test
    @DisplayName("observePendingJoinRequests popula lista")
    fun observePendingRequests_populates() = runTest(testDispatcher) {
        val items = listOf(
            GroupJoinRequest(id = "u1", userId = "u1", userName = "U1"),
            GroupJoinRequest(id = "u2", userId = "u2", userName = "U2"),
        )
        every { groupRepo.observePendingJoinRequests("g1") } returns flowOf(items)

        val vm = JoinRequestViewModel(groupRepo)
        vm.observePendingRequests("g1")
        advanceUntilIdle()

        assertEquals(2, vm.pendingRequests.value.size)
    }

    @Test
    @DisplayName("observePendingJoinRequests preserva erro para retry")
    fun observePendingRequests_error_exposesError() = runTest(testDispatcher) {
        every { groupRepo.observePendingJoinRequests("g1") } returns flow {
            throw IllegalStateException("Sem permissão")
        }

        val vm = JoinRequestViewModel(groupRepo)
        vm.observePendingRequests("g1")
        advanceUntilIdle()

        assertEquals("Sem permissão", vm.pendingRequestsError.value?.message)
        assertTrue(vm.pendingRequests.value.isEmpty())
    }

    @Test
    @DisplayName("requestJoin chama createJoinRequest")
    fun requestJoin_callsCreateRequest() = runTest(testDispatcher) {
        coEvery { groupRepo.createJoinRequest("g1") } returns Result.success(Unit)

        val vm = JoinRequestViewModel(groupRepo)
        vm.requestJoin("g1")
        advanceUntilIdle()

        coVerify { groupRepo.createJoinRequest("g1") }
    }

    @Test
    @DisplayName("cancelRequest chama cancelMyJoinRequest")
    fun cancelRequest_callsRepo() = runTest(testDispatcher) {
        coEvery { groupRepo.cancelMyJoinRequest("g1") } returns Result.success(Unit)

        val vm = JoinRequestViewModel(groupRepo)
        vm.cancelRequest("g1")
        advanceUntilIdle()

        coVerify { groupRepo.cancelMyJoinRequest("g1") }
    }

    @Test
    @DisplayName("approve chama approveJoinRequest com requesterId correto")
    fun approve_callsRepo() = runTest(testDispatcher) {
        coEvery { groupRepo.approveJoinRequest("g1", "u-req") } returns Result.success(Unit)

        val vm = JoinRequestViewModel(groupRepo)
        vm.approve("g1", "u-req")
        advanceUntilIdle()

        coVerify { groupRepo.approveJoinRequest("g1", "u-req") }
    }

    @Test
    @DisplayName("reject chama rejectJoinRequest com requesterId correto")
    fun reject_callsRepo() = runTest(testDispatcher) {
        coEvery { groupRepo.rejectJoinRequest("g1", "u-req") } returns Result.success(Unit)

        val vm = JoinRequestViewModel(groupRepo)
        vm.reject("g1", "u-req")
        advanceUntilIdle()

        coVerify { groupRepo.rejectJoinRequest("g1", "u-req") }
    }
}
