package com.futebadosparcas.domain.usecase.notification

import com.futebadosparcas.domain.model.AppNotification
import com.futebadosparcas.domain.model.NotificationType
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para GetNotificationsUseCase.
 * Verifica agrupamento por periodo, contagem de nao lidas, marcacao e delecao.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GetNotificationsUseCase Tests")
@ExtendWith(MockLogExtension::class)
class GetNotificationsUseCaseTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var notificationRepository: NotificationRepository
    private lateinit var useCase: GetNotificationsUseCase

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        notificationRepository = mockk()
        useCase = GetNotificationsUseCase(notificationRepository)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ========== Agrupamento por Periodo ==========

    @Test
    @DisplayName("Deve agrupar notificacoes por periodo corretamente")
    fun getGroupedNotifications_mixedDates_groupsCorrectly() = runTest {
        // Given
        val now = System.currentTimeMillis()
        val oneHourAgo = now - 3_600_000L          // Hoje
        val oneDayAgo = now - 86_400_000L - 1       // Ontem
        val threeDaysAgo = now - 3 * 86_400_000L    // Esta semana
        val twoWeeksAgo = now - 14 * 86_400_000L    // Mais antigas

        val notifications = listOf(
            createNotification("n1", createdAt = oneHourAgo, read = false),
            createNotification("n2", createdAt = oneDayAgo, read = true),
            createNotification("n3", createdAt = threeDaysAgo, read = false),
            createNotification("n4", createdAt = twoWeeksAgo, read = true)
        )

        coEvery { notificationRepository.getMyNotifications(any()) } returns Result.success(notifications)

        // When
        val result = useCase.getGroupedNotifications()

        // Then
        assertTrue(result.isSuccess)
        val grouped = result.getOrNull()!!
        assertEquals(1, grouped.today.size)
        assertEquals(1, grouped.yesterday.size)
        assertEquals(1, grouped.thisWeek.size)
        assertEquals(1, grouped.older.size)
        assertEquals(2, grouped.unreadCount)
    }

    @Test
    @DisplayName("Deve retornar agrupamento vazio quando nao ha notificacoes")
    fun getGroupedNotifications_empty_returnsEmptyGroups() = runTest {
        // Given
        coEvery { notificationRepository.getMyNotifications(any()) } returns Result.success(emptyList())

        // When
        val result = useCase.getGroupedNotifications()

        // Then
        assertTrue(result.isSuccess)
        val grouped = result.getOrNull()!!
        assertTrue(grouped.today.isEmpty())
        assertTrue(grouped.yesterday.isEmpty())
        assertTrue(grouped.thisWeek.isEmpty())
        assertTrue(grouped.older.isEmpty())
        assertEquals(0, grouped.unreadCount)
    }

    @Test
    @DisplayName("Deve retornar falha quando repositorio falha")
    fun getGroupedNotifications_repositoryFailure_returnsFailure() = runTest {
        // Given
        coEvery { notificationRepository.getMyNotifications(any()) } returns
            Result.failure(Exception("Network error"))

        // When
        val result = useCase.getGroupedNotifications()

        // Then
        assertTrue(result.isFailure)
        assertEquals("Network error", result.exceptionOrNull()?.message)
    }

    @Test
    @DisplayName("Deve ordenar notificacoes dentro de cada grupo por data desc")
    fun getGroupedNotifications_multipleToday_sortedByDateDesc() = runTest {
        // Given
        val now = System.currentTimeMillis()
        val oneHourAgo = now - 3_600_000L
        val twoHoursAgo = now - 7_200_000L
        val threeHoursAgo = now - 10_800_000L

        val notifications = listOf(
            createNotification("n1", createdAt = threeHoursAgo),
            createNotification("n2", createdAt = oneHourAgo),
            createNotification("n3", createdAt = twoHoursAgo)
        )

        coEvery { notificationRepository.getMyNotifications(any()) } returns Result.success(notifications)

        // When
        val result = useCase.getGroupedNotifications()

        // Then
        val today = result.getOrNull()!!.today
        assertEquals(3, today.size)
        // Ordenado por createdAt desc (mais recente primeiro)
        assertEquals("n2", today[0].id)
        assertEquals("n3", today[1].id)
        assertEquals("n1", today[2].id)
    }

    @Test
    @DisplayName("Deve tratar notificacao com createdAt null como antiga")
    fun getGroupedNotifications_nullCreatedAt_goesToOlder() = runTest {
        // Given
        val notifications = listOf(
            createNotification("n1", createdAt = null)
        )
        coEvery { notificationRepository.getMyNotifications(any()) } returns Result.success(notifications)

        // When
        val result = useCase.getGroupedNotifications()

        // Then
        val grouped = result.getOrNull()!!
        assertEquals(1, grouped.older.size)
        assertEquals("n1", grouped.older[0].id)
    }

    // ========== Contagem de Nao Lidas ==========

    @Test
    @DisplayName("Deve contar apenas notificacoes nao lidas")
    fun getGroupedNotifications_mixedReadStatus_countsUnreadOnly() = runTest {
        // Given
        val now = System.currentTimeMillis()
        val notifications = listOf(
            createNotification("n1", createdAt = now - 1000, read = false),
            createNotification("n2", createdAt = now - 2000, read = true),
            createNotification("n3", createdAt = now - 3000, read = false),
            createNotification("n4", createdAt = now - 4000, read = true),
            createNotification("n5", createdAt = now - 5000, read = false)
        )
        coEvery { notificationRepository.getMyNotifications(any()) } returns Result.success(notifications)

        // When
        val result = useCase.getGroupedNotifications()

        // Then
        assertEquals(3, result.getOrNull()!!.unreadCount)
    }

    // ========== Marcar como Lida ==========

    @Test
    @DisplayName("markAsRead deve delegar para repositorio")
    fun markAsRead_validId_delegatesToRepository() = runTest {
        // Given
        coEvery { notificationRepository.markAsRead("n1") } returns Result.success(Unit)

        // When
        val result = useCase.markAsRead("n1")

        // Then
        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { notificationRepository.markAsRead("n1") }
    }

    @Test
    @DisplayName("markAllAsRead deve delegar para repositorio")
    fun markAllAsRead_delegatesToRepository() = runTest {
        // Given
        coEvery { notificationRepository.markAllAsRead() } returns Result.success(Unit)

        // When
        val result = useCase.markAllAsRead()

        // Then
        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { notificationRepository.markAllAsRead() }
    }

    // ========== Deletar Notificacao ==========

    @Test
    @DisplayName("deleteNotification deve delegar para repositorio")
    fun deleteNotification_validId_delegatesToRepository() = runTest {
        // Given
        coEvery { notificationRepository.deleteNotification("n1") } returns Result.success(Unit)

        // When
        val result = useCase.deleteNotification("n1")

        // Then
        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { notificationRepository.deleteNotification("n1") }
    }

    @Test
    @DisplayName("deleteNotification com falha deve propagar erro")
    fun deleteNotification_failure_propagatesError() = runTest {
        // Given
        coEvery { notificationRepository.deleteNotification("n1") } returns
            Result.failure(Exception("Not found"))

        // When
        val result = useCase.deleteNotification("n1")

        // Then
        assertTrue(result.isFailure)
        assertEquals("Not found", result.exceptionOrNull()?.message)
    }

    // ========== Flows ==========

    @Test
    @DisplayName("getNotificationsFlow deve retornar flow do repositorio")
    fun getNotificationsFlow_withData_emitsNotifications() = runTest {
        // Given
        val notifications = listOf(
            createNotification("n1", createdAt = System.currentTimeMillis())
        )
        every { notificationRepository.getMyNotificationsFlow(any()) } returns flowOf(notifications)

        // When
        val result = useCase.getNotificationsFlow().first()

        // Then
        assertEquals(1, result.size)
        assertEquals("n1", result[0].id)
    }

    @Test
    @DisplayName("getUnreadCountFlow deve retornar flow do repositorio")
    fun getUnreadCountFlow_withCount_emitsCount() = runTest {
        // Given
        every { notificationRepository.getUnreadCountFlow() } returns flowOf(5)

        // When
        val result = useCase.getUnreadCountFlow().first()

        // Then
        assertEquals(5, result)
    }

    // ========== Helpers ==========

    private fun createNotification(
        id: String,
        createdAt: Long? = System.currentTimeMillis(),
        read: Boolean = false
    ) = AppNotification(
        id = id,
        userId = "user1",
        type = NotificationType.GENERAL,
        title = "Notificacao $id",
        message = "Mensagem de teste",
        read = read,
        createdAt = createdAt
    )
}
