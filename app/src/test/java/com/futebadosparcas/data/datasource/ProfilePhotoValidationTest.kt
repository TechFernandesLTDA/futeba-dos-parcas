package com.futebadosparcas.data.datasource

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ProfilePhotoValidationTest {

    @Test
    fun `source photo up to ten MiB is accepted for compression`() {
        assertTrue(ProfilePhotoValidation.isSourceSizeAllowed(2L * 1024L * 1024L + 1L))
        assertTrue(
            ProfilePhotoValidation.isSourceSizeAllowed(
                ProfilePhotoValidation.MAX_SOURCE_FILE_SIZE_BYTES
            )
        )
    }

    @Test
    fun `source photo above ten MiB is rejected`() {
        assertFalse(
            ProfilePhotoValidation.isSourceSizeAllowed(
                ProfilePhotoValidation.MAX_SOURCE_FILE_SIZE_BYTES + 1L
            )
        )
    }

    @Test
    fun `only non-empty compressed payload below two MiB is uploadable`() {
        assertFalse(ProfilePhotoValidation.isUploadSizeAllowed(0))
        assertTrue(ProfilePhotoValidation.isUploadSizeAllowed(400 * 1024))
        assertFalse(
            ProfilePhotoValidation.isUploadSizeAllowed(
                ProfilePhotoValidation.MAX_UPLOAD_SIZE_BYTES
            )
        )
    }
}
