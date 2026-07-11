package com.futebadosparcas.data.repository

import android.content.Context
import android.net.Uri
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.storage.FirebaseStorage
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class GroupWallMediaPipelineTest {

    @Test
    fun `magic bytes preservam MIME real sem falsificar PNG ou WebP como JPEG`() {
        val jpeg = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0x00)
        val png = byteArrayOf(
            0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
        )
        val webp = "RIFF0000WEBP".toByteArray()
        val mp4 = byteArrayOf(0, 0, 0, 24) + "ftypisom".toByteArray()

        assertEquals("image/jpeg", detectGroupWallMediaContentType(jpeg))
        assertEquals("image/png", detectGroupWallMediaContentType(png))
        assertEquals("image/webp", detectGroupWallMediaContentType(webp))
        assertEquals("video/mp4", detectGroupWallMediaContentType(mp4))
    }

    @Test
    fun `MP4 exige menos de 25 MiB e no maximo 30 segundos`() {
        validateGroupWallMediaFacts(
            declaredContentType = "video/mp4",
            detectedContentType = "video/mp4",
            sizeBytes = GROUP_WALL_MAX_VIDEO_BYTES - 1,
            durationMs = GROUP_WALL_MAX_VIDEO_DURATION_MS
        )

        val sizeError = assertThrows(GroupWallMediaValidationException::class.java) {
            validateGroupWallMediaFacts(
                declaredContentType = "video/mp4",
                detectedContentType = "video/mp4",
                sizeBytes = GROUP_WALL_MAX_VIDEO_BYTES,
                durationMs = 1_000L
            )
        }
        assertEquals(GroupWallMediaValidationReason.VIDEO_TOO_LARGE, sizeError.reason)

        val durationError = assertThrows(GroupWallMediaValidationException::class.java) {
            validateGroupWallMediaFacts(
                declaredContentType = "video/mp4",
                detectedContentType = "video/mp4",
                sizeBytes = 1_024L,
                durationMs = GROUP_WALL_MAX_VIDEO_DURATION_MS + 1
            )
        }
        assertEquals(GroupWallMediaValidationReason.VIDEO_TOO_LONG, durationError.reason)
    }

    @Test
    fun `MIME declarado divergente da assinatura e rejeitado`() {
        val error = assertThrows(GroupWallMediaValidationException::class.java) {
            validateGroupWallMediaFacts(
                declaredContentType = "image/jpeg",
                detectedContentType = "image/png",
                sizeBytes = 1_024L,
                durationMs = null
            )
        }

        assertEquals(GroupWallMediaValidationReason.MIME_MISMATCH, error.reason)
    }

    @Test
    fun `parser exige caminho de staging e contrato exatos`() {
        val postId = "a".repeat(40)
        val draft = parseGroupWallMediaDraft(
            data = mapOf(
                "postId" to postId,
                "uploadPath" to "groups/group-1/wall_media_staging/$postId/user-1/source.mp4",
                "expiresAt" to "2026-07-11T12:00:00.000Z",
                "maxBytes" to GROUP_WALL_MAX_VIDEO_BYTES,
                "pipelineVersion" to 1,
                "duplicate" to true
            ),
            groupId = "group-1",
            uid = "user-1",
            contentType = "video/mp4"
        )

        assertEquals(postId, draft.postId)
        assertEquals(1, draft.pipelineVersion)
        assertTrue(draft.duplicate)

        assertThrows(IllegalArgumentException::class.java) {
            parseGroupWallMediaDraft(
                data = mapOf(
                    "postId" to postId,
                    "uploadPath" to "groups/group-2/wall_media_staging/$postId/user-1/source.mp4",
                    "maxBytes" to GROUP_WALL_MAX_VIDEO_BYTES,
                    "pipelineVersion" to 1,
                    "duplicate" to false
                ),
                groupId = "group-1",
                uid = "user-1",
                contentType = "video/mp4"
            )
        }
    }

    @Test
    fun `post id deterministico coincide com contrato do backend`() {
        assertEquals(
            "03eb331962d1be3fe6c2d0eb07f8de54b7954391",
            deterministicWallMediaPostId("group-1", "user-1", REQUEST_ID)
        )
    }

    @Test
    fun `status usa somente schema snake case do draft`() {
        val status = parseGroupWallMediaDraftStatus(
            mapOf(
                "status" to "REJECTED",
                "error_code" to "DURATION_TOO_LONG",
                "error_message" to "Vídeo acima de 30 segundos",
                "expires_at" to "timestamp"
            )
        )
        val camelCaseOnly = parseGroupWallMediaDraftStatus(
            mapOf("state" to "READY", "errorMessage" to "ignorado")
        )

        assertEquals(GroupWallMediaDraftState.REJECTED, status.state)
        assertEquals("DURATION_TOO_LONG", status.errorCode)
        assertEquals("Vídeo acima de 30 segundos", status.message)
        assertEquals(GroupWallMediaDraftState.UNKNOWN, camelCaseOnly.state)
    }

    @Test
    fun `repository em retry duplicate READY nao reenvia nem aguarda`() = runTest {
        val uri = mockk<Uri>()
        val media = video(uri)
        val pipeline = RecordingMediaPipeline(
            media = media,
            draft = draft(duplicate = true),
            initialStatus = GroupWallMediaDraftStatus(GroupWallMediaDraftState.READY)
        )
        val repository = repository(pipeline)

        val result = repository.createPost(
            groupId = "group-1",
            text = "",
            mediaUri = uri,
            clientRequestId = REQUEST_ID
        )

        assertTrue(result.isSuccess)
        assertFalse(pipeline.uploadCalled)
        assertFalse(pipeline.awaitCalled)
    }

    @Test
    fun `repository envia AWAITING_UPLOAD e so conclui depois de READY`() = runTest {
        val uri = mockk<Uri>()
        val media = video(uri)
        val pipeline = RecordingMediaPipeline(
            media = media,
            draft = draft(duplicate = false),
            initialStatus = GroupWallMediaDraftStatus(GroupWallMediaDraftState.AWAITING_UPLOAD),
            terminalStatus = GroupWallMediaDraftStatus(GroupWallMediaDraftState.READY)
        )
        val repository = repository(pipeline)
        val progress = mutableListOf<Int>()

        val result = repository.createPost(
            groupId = "group-1",
            text = "",
            mediaUri = uri,
            clientRequestId = REQUEST_ID,
            onProgress = progress::add
        )

        assertTrue(result.isSuccess)
        assertTrue(pipeline.uploadCalled)
        assertTrue(pipeline.awaitCalled)
        assertEquals(listOf(25, 100, 100), progress)
    }

    @Test
    fun `repository propaga rejeicao como falha terminal tipada`() = runTest {
        val uri = mockk<Uri>()
        val pipeline = RecordingMediaPipeline(
            media = video(uri),
            draft = draft(duplicate = true),
            initialStatus = GroupWallMediaDraftStatus(
                state = GroupWallMediaDraftState.REJECTED,
                errorCode = "DURATION_TOO_LONG",
                message = "Vídeo acima de 30 segundos"
            )
        )

        val result = repository(pipeline).createPost(
            groupId = "group-1",
            text = "",
            mediaUri = uri,
            clientRequestId = REQUEST_ID
        )

        assertTrue(result.isFailure)
        val error = result.exceptionOrNull()
        assertTrue(error is GroupWallMediaTerminalException)
        assertEquals(
            GroupWallMediaDraftState.REJECTED,
            (error as GroupWallMediaTerminalException).terminalState
        )
        assertEquals("DURATION_TOO_LONG", error.errorCode)
        assertFalse(pipeline.uploadCalled)
    }

    private fun repository(pipeline: GroupWallMediaPipeline): GroupWallRepository {
        val auth = mockk<FirebaseAuth>()
        val user = mockk<FirebaseUser>()
        every { auth.currentUser } returns user
        every { user.uid } returns "user-1"
        every { user.displayName } returns "Jogador"
        every { user.photoUrl } returns null
        return GroupWallRepository(
            firestore = mockk<FirebaseFirestore>(relaxed = true),
            auth = auth,
            storage = mockk<FirebaseStorage>(relaxed = true),
            context = mockk<Context>(relaxed = true),
            functions = mockk<FirebaseFunctions>(relaxed = true),
            mediaPipeline = pipeline
        )
    }

    private fun video(uri: Uri) = GroupWallMediaFile(
        uri = uri,
        contentType = "video/mp4",
        sizeBytes = 1_024L,
        durationMs = 2_000L,
        fileName = "gol.mp4",
        extension = "mp4"
    )

    private fun draft(duplicate: Boolean) = GroupWallMediaDraft(
        groupId = "group-1",
        postId = "a".repeat(40),
        uploadPath = "groups/group-1/wall_media_staging/${"a".repeat(40)}/user-1/source.mp4",
        expiresAt = "2026-07-11T12:00:00.000Z",
        maxBytes = GROUP_WALL_MAX_VIDEO_BYTES,
        pipelineVersion = 1,
        duplicate = duplicate
    )

    private class RecordingMediaPipeline(
        private val media: GroupWallMediaFile,
        private val draft: GroupWallMediaDraft,
        private val initialStatus: GroupWallMediaDraftStatus,
        private val terminalStatus: GroupWallMediaDraftStatus = initialStatus
    ) : GroupWallMediaPipeline {
        var uploadCalled = false
        var awaitCalled = false

        override suspend fun inspect(uri: Uri): GroupWallMediaFile = media

        override suspend fun createDraft(
            groupId: String,
            text: String,
            media: GroupWallMediaFile,
            clientRequestId: String
        ): GroupWallMediaDraft = draft

        override suspend fun getDraftStatus(
            groupId: String,
            postId: String
        ): GroupWallMediaDraftStatus = initialStatus

        override suspend fun upload(
            draft: GroupWallMediaDraft,
            media: GroupWallMediaFile,
            onProgress: (Int) -> Unit
        ) {
            uploadCalled = true
            onProgress(25)
            onProgress(100)
        }

        override suspend fun awaitTerminalStatus(
            groupId: String,
            postId: String
        ): GroupWallMediaDraftStatus {
            awaitCalled = true
            return terminalStatus
        }
    }

    private companion object {
        const val REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000"
    }
}
