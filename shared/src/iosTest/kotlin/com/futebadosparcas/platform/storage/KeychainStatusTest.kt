package com.futebadosparcas.platform.storage

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import platform.Security.errSecAuthFailed
import platform.Security.errSecItemNotFound
import platform.Security.errSecSuccess

class KeychainStatusTest {

    @Test
    fun successIsAccepted() {
        requireKeychainSuccess(operation = "test", status = errSecSuccess)
    }

    @Test
    fun itemNotFoundIsAcceptedOnlyWhenRequested() {
        requireKeychainSuccess(
            operation = "delete",
            status = errSecItemNotFound,
            itemNotFoundIsSuccess = true
        )

        val error = assertFailsWith<SecureStorageException> {
            requireKeychainSuccess(operation = "update", status = errSecItemNotFound)
        }
        assertEquals("update", error.operation)
        assertEquals(errSecItemNotFound.toLong(), error.errorCode)
    }

    @Test
    fun failureContainsOnlyOperationAndStatus() {
        val error = assertFailsWith<SecureStorageException> {
            requireKeychainSuccess(operation = "read", status = errSecAuthFailed)
        }

        assertEquals("read", error.operation)
        assertEquals(errSecAuthFailed.toLong(), error.errorCode)
        assertEquals(
            "Secure storage operation failed: read (code ${errSecAuthFailed.toLong()})",
            error.message
        )
    }
}
