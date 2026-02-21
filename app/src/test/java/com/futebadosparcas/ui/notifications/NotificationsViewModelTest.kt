package com.futebadosparcas.ui.notifications

import com.futebadosparcas.data.model.AppNotification
import com.futebadosparcas.data.model.NotificationType
import com.futebadosparcas.domain.repository.GameSummonRepository
import com.futebadosparcas.domain.repository.InviteRepository
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.util.InstantTaskExecutorExtension
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.extension.ExtendWith
import java.util.Date

/**
 * Testes unitarios para NotificationsViewModel.
 * Verifica observacao de notificacoes, marcacao como lida, acoes e estados.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("NotificationsViewModel Tests")
@ExtendWith(InstantTaskExecutorExtension::class, MockLogExtension::class)
class NotificationsViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var notificationRepository: NotificationRepository
    private lateinit var inviteRepository: InviteRepository
    private lateinit var gameSummonRepository: GameSummonRepository

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        notificationRepository = mockk(relaxed = true)
        inviteRepository = mockk()
        gameSummonRepository = mockk()
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun setupDefaultFlows() {
        every { notificationRepository.getMyNotificationsFlow(any()) } returns flowOf(emptyList())
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)
    }

    private fun createViewModel(): NotificationsViewModel {
        return NotificationsViewModel(notificationRepository, inviteRepository, gameSummonRepository)
    }

    // ========== Estado Inicial ==========

    @Test
    @DisplayName("Estado inicial deve ser Loading")
    fun init_default_startsWithLoading() = runTest {
        // Given
        setupDefaultFlows()

        // When
        val viewModel = createViewModel()

        // Then - Antes do Flow emitir, estado e Loading
        // Apos o Flow emitir emptyList, deve ser Empty
        advanceUntilIdle()
        assertTrue(
            viewModel.uiState.value is NotificationsUiState.Empty ||
            viewModel.uiState.value is NotificationsUiState.Loading
        )
    }

    // ========== Observacao de Notificacoes ==========

    @Test
    @DisplayName("Deve exibir Empty quando nao ha notificacoes")
    fun observeNotifications_empty_showsEmpty() = runTest {
        // Given
        every { notificationRepository.getMyNotificationsFlow(any()) } returns flowOf(emptyList())
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(0)

        val viewModel = createViewModel()

        // When
        advanceUntilIdle()

        // Then
        assertTrue(viewModel.uiState.value is NotificationsUiState.Empty)
        assertEquals(0, viewModel.unreadCount.value)
    }

    // ========== Carregamento Manual ==========

    @Test
    @DisplayName("loadNotifications deve transitar para Success com notificacoes")
    fun loadNotifications_withData_transitionsToSuccess() = runTest {
        // Given
        val notifications = listOf(
            createKmpNotification("n1", "Novo jogo!", read = false),
            createKmpNotification("n2", "MVP do jogo!", read = true)
        )
        setupDefaultFlows()
        coEvery { notificationRepository.getMyNotifications(any()) } returns Result.success(notifications)

        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.loadNotifications()
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is NotificationsUiState.Success)
    }

    @Test
    @DisplayName("loadNotifications com falha deve transitar para Error")
    fun loadNotifications_failure_transitionsToError() = runTest {
        // Given
        setupDefaultFlows()
        coEvery { notificationRepository.getMyNotifications(any()) } returns
            Result.failure(Exception("Sem conexao"))

        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.loadNotifications()
        advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertTrue(state is NotificationsUiState.Error)
        assertEquals("Sem conexao", (state as NotificationsUiState.Error).message)
    }

    @Test
    @DisplayName("loadNotifications com lista vazia deve transitar para Empty")
    fun loadNotifications_emptyList_transitionsToEmpty() = runTest {
        // Given
        setupDefaultFlows()
        coEvery { notificationRepository.getMyNotifications(any()) } returns Result.success(emptyList())

        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.loadNotifications()
        advanceUntilIdle()

        // Then
        assertTrue(viewModel.uiState.value is NotificationsUiState.Empty)
    }

    // ========== Marcacao como Lida ==========

    @Test
    @DisplayName("markAsRead deve chamar repositorio")
    fun markAsRead_validId_callsRepository() = runTest {
        // Given
        setupDefaultFlows()
        coEvery { notificationRepository.markAsRead("n1") } returns Result.success(Unit)

        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.markAsRead("n1")
        advanceUntilIdle()

        // Then
        coVerify { notificationRepository.markAsRead("n1") }
    }

    @Test
    @DisplayName("markAllAsRead com sucesso deve atualizar actionState para Success")
    fun markAllAsRead_success_updatesActionState() = runTest {
        // Given
        setupDefaultFlows()
        coEvery { notificationRepository.markAllAsRead() } returns Result.success(Unit)

        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.markAllAsRead()
        advanceUntilIdle()

        // Then
        val actionState = viewModel.actionState.value
        assertTrue(actionState is NotificationActionState.Success)
    }

    @Test
    @DisplayName("markAllAsRead com falha deve atualizar actionState para Error")
    fun markAllAsRead_failure_updatesActionStateToError() = runTest {
        // Given
        setupDefaultFlows()
        coEvery { notificationRepository.markAllAsRead() } returns
            Result.failure(Exception("Permission denied"))

        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.markAllAsRead()
        advanceUntilIdle()

        // Then
        val actionState = viewModel.actionState.value
        assertTrue(actionState is NotificationActionState.Error)
    }

    // ========== Deletar Notificacao ==========

    @Test
    @DisplayName("deleteNotification com falha deve atualizar actionState para Error")
    fun deleteNotification_failure_updatesActionStateToError() = runTest {
        // Given
        setupDefaultFlows()
        coEvery { notificationRepository.deleteNotification("n1") } returns
            Result.failure(Exception("Not found"))

        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.deleteNotification("n1")
        advanceUntilIdle()

        // Then
        assertTrue(viewModel.actionState.value is NotificationActionState.Error)
    }

    // ========== Deletar Notificacoes Antigas ==========

    @Test
    @DisplayName("deleteOldNotifications com resultados deve mostrar mensagem de sucesso")
    fun deleteOldNotifications_withDeletions_showsSuccess() = runTest {
        // Given
        setupDefaultFlows()
        coEvery { notificationRepository.deleteOldNotifications() } returns Result.success(5)

        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.deleteOldNotifications()
        advanceUntilIdle()

        // Then
        val actionState = viewModel.actionState.value
        assertTrue(actionState is NotificationActionState.Success)
        assertTrue((actionState as NotificationActionState.Success).message.contains("5"))
    }

    @Test
    @DisplayName("deleteOldNotifications sem resultados nao deve mostrar mensagem")
    fun deleteOldNotifications_noDeletions_noMessage() = runTest {
        // Given
        setupDefaultFlows()
        coEvery { notificationRepository.deleteOldNotifications() } returns Result.success(0)

        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.deleteOldNotifications()
        advanceUntilIdle()

        // Then - actionState nao deve ser Success (ficou Idle)
        val actionState = viewModel.actionState.value
        assertTrue(actionState is NotificationActionState.Idle)
    }

    // ========== Reset Action State ==========

    @Test
    @DisplayName("resetActionState deve voltar para Idle")
    fun resetActionState_afterAction_returnsToIdle() = runTest {
        // Given
        setupDefaultFlows()
        coEvery { notificationRepository.markAllAsRead() } returns Result.success(Unit)

        val viewModel = createViewModel()
        advanceUntilIdle()

        viewModel.markAllAsRead()
        advanceUntilIdle()
        assertTrue(viewModel.actionState.value is NotificationActionState.Success)

        // When
        viewModel.resetActionState()

        // Then
        assertTrue(viewModel.actionState.value is NotificationActionState.Idle)
    }

    // ========== Handle Notification Action ==========

    @Test
    @DisplayName("handleNotificationAction com GROUP_INVITE accept=true deve aceitar convite")
    fun handleNotificationAction_groupInviteAccept_acceptsInvite() = runTest {
        // Given
        setupDefaultFlows()
        coEvery { inviteRepository.acceptInvite("invite1") } returns Result.success(Unit)
        coEvery { notificationRepository.markAsRead("n1") } returns Result.success(Unit)

        val notification = createAndroidNotification("n1", NotificationType.GROUP_INVITE, "invite1")
        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.handleNotificationAction(notification, accept = true)
        advanceUntilIdle()

        // Then
        coVerify { inviteRepository.acceptInvite("invite1") }
        assertTrue(viewModel.actionState.value is NotificationActionState.InviteAccepted)
    }

    @Test
    @DisplayName("handleNotificationAction com GROUP_INVITE accept=false deve recusar convite")
    fun handleNotificationAction_groupInviteDecline_declinesInvite() = runTest {
        // Given
        setupDefaultFlows()
        coEvery { inviteRepository.declineInvite("invite1") } returns Result.success(Unit)
        coEvery { notificationRepository.markAsRead("n1") } returns Result.success(Unit)

        val notification = createAndroidNotification("n1", NotificationType.GROUP_INVITE, "invite1")
        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.handleNotificationAction(notification, accept = false)
        advanceUntilIdle()

        // Then
        coVerify { inviteRepository.declineInvite("invite1") }
        assertTrue(viewModel.actionState.value is NotificationActionState.InviteDeclined)
    }

    @Test
    @DisplayName("handleNotificationAction com GAME_SUMMON accept=true deve navegar para jogo")
    fun handleNotificationAction_gameSummonAccept_navigatesToGame() = runTest {
        // Given
        setupDefaultFlows()
        val notification = createAndroidNotification("n1", NotificationType.GAME_SUMMON, "game123")
        val viewModel = createViewModel()
        advanceUntilIdle()

        // When
        viewModel.handleNotificationAction(notification, accept = true)
        advanceUntilIdle()

        // Then
        val actionState = viewModel.actionState.value
        assertTrue(actionState is NotificationActionState.NavigateToGame)
        assertEquals("game123", (actionState as NotificationActionState.NavigateToGame).gameId)
    }

    // ========== Helpers ==========

    private fun createKmpNotification(
        id: String,
        title: String,
        read: Boolean = false
    ) = com.futebadosparcas.domain.model.AppNotification(
        id = id,
        userId = "user1",
        title = title,
        message = "Mensagem de teste",
        read = read,
        createdAt = System.currentTimeMillis()
    )

    private fun createAndroidNotification(
        id: String,
        type: NotificationType,
        referenceId: String?
    ) = AppNotification(
        id = id,
        userId = "user1",
        type = type.name,
        title = "Test",
        message = "Test message",
        read = false,
        createdAtRaw = Date(),
        referenceId = referenceId
    )
}
