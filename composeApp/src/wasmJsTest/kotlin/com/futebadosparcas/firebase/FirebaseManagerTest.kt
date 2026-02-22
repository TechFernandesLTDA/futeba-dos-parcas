package com.futebadosparcas.firebase

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FirebaseManagerTest {

    @Test
    fun `FirebaseManager initialize is idempotent`() {
        FirebaseManager.initialize()
        FirebaseManager.initialize()
        assertTrue(true, "Multiple initializations should not throw")
    }

    @Test
    fun `FirebaseManager AdminMetrics default values are correct`() {
        val metrics = FirebaseManager.AdminMetrics()
        assertEquals(0, metrics.totalUsers)
        assertEquals(0, metrics.totalGames)
        assertEquals(0, metrics.totalGroups)
        assertEquals(0, metrics.totalLocations)
        assertEquals(0, metrics.activeUsersToday)
        assertEquals(0, metrics.gamesThisWeek)
        assertEquals(0, metrics.pendingReports)
        assertEquals(0, metrics.newUsersThisMonth)
    }

    @Test
    fun `FirebaseManager AdminMetrics with custom values`() {
        val metrics = FirebaseManager.AdminMetrics(
            totalUsers = 100,
            totalGames = 50,
            totalGroups = 10,
            totalLocations = 20,
            activeUsersToday = 25,
            gamesThisWeek = 15,
            pendingReports = 3,
            newUsersThisMonth = 12
        )
        assertEquals(100, metrics.totalUsers)
        assertEquals(50, metrics.totalGames)
        assertEquals(10, metrics.totalGroups)
        assertEquals(20, metrics.totalLocations)
        assertEquals(25, metrics.activeUsersToday)
        assertEquals(15, metrics.gamesThisWeek)
        assertEquals(3, metrics.pendingReports)
        assertEquals(12, metrics.newUsersThisMonth)
    }

    @Test
    fun `FirebaseManager AdminUser properties are correct`() {
        val user = FirebaseManager.AdminUser(
            id = "user123",
            name = "João Silva",
            email = "joao@email.com",
            role = "PLAYER",
            level = 15,
            totalGames = 45,
            createdAt = 1700000000000L,
            isActive = true
        )
        assertEquals("user123", user.id)
        assertEquals("João Silva", user.name)
        assertEquals("joao@email.com", user.email)
        assertEquals("PLAYER", user.role)
        assertEquals(15, user.level)
        assertEquals(45, user.totalGames)
        assertEquals(1700000000000L, user.createdAt)
        assertTrue(user.isActive)
    }

    @Test
    fun `FirebaseManager AdminUser isActive default is true`() {
        val user = FirebaseManager.AdminUser(
            id = "user1",
            name = "Test",
            email = "test@email.com",
            role = "PLAYER"
        )
        assertTrue(user.isActive)
    }

    @Test
    fun `FirebaseManager AdminUser level default is 1`() {
        val user = FirebaseManager.AdminUser(
            id = "user1",
            name = "Test",
            email = "test@email.com",
            role = "PLAYER"
        )
        assertEquals(1, user.level)
    }

    @Test
    fun `FirebaseManager Report properties are correct`() {
        val report = FirebaseManager.Report(
            id = "r1",
            reporterId = "u1",
            reporterName = "Reporter",
            reportedUserId = "u2",
            reportedUserName = "Reported",
            type = "ABUSE",
            reason = "Bad behavior",
            description = "Detailed description",
            createdAt = 1700000000000L,
            status = "PENDING"
        )
        assertEquals("r1", report.id)
        assertEquals("u1", report.reporterId)
        assertEquals("Reporter", report.reporterName)
        assertEquals("u2", report.reportedUserId)
        assertEquals("Reported", report.reportedUserName)
        assertEquals("ABUSE", report.type)
        assertEquals("Bad behavior", report.reason)
        assertEquals("Detailed description", report.description)
        assertEquals(1700000000000L, report.createdAt)
        assertEquals("PENDING", report.status)
    }

    @Test
    fun `FirebaseManager Report status default is PENDING`() {
        val report = FirebaseManager.Report(
            id = "r1",
            reporterId = "u1",
            reporterName = "Reporter",
            reportedUserId = "u2",
            reportedUserName = "Reported",
            type = "ABUSE",
            reason = "Reason",
            description = "Description",
            createdAt = 0L
        )
        assertEquals("PENDING", report.status)
    }

    @Test
    fun `FirebaseManager Report copy preserves other fields`() {
        val original = FirebaseManager.Report(
            id = "r1",
            reporterId = "u1",
            reporterName = "Reporter",
            reportedUserId = "u2",
            reportedUserName = "Reported",
            type = "ABUSE",
            reason = "Reason",
            description = "Description",
            createdAt = 0L,
            status = "PENDING"
        )
        val resolved = original.copy(status = "RESOLVED")
        assertEquals("r1", resolved.id)
        assertEquals("RESOLVED", resolved.status)
        assertEquals("Reporter", resolved.reporterName)
    }

    @Test
    fun `FirebaseManager getCurrentUserId returns null before login`() {
        val userId = FirebaseManager.getCurrentUserId()
        assertNull(userId, "User ID should be null before login")
    }

    @Test
    fun `FirebaseManager getCurrentUserEmail returns null before login`() {
        val email = FirebaseManager.getCurrentUserEmail()
        assertNull(email, "Email should be null before login")
    }

    @Test
    fun `FirebaseManager getCurrentUserName returns null before login`() {
        val name = FirebaseManager.getCurrentUserName()
        assertNull(name, "Name should be null before login")
    }

    @Test
    fun `FirebaseManager getCurrentUserRole returns null before login`() {
        val role = FirebaseManager.getCurrentUserRole()
        assertNull(role, "Role should be null before login")
    }
}
