package com.futebadosparcas.data.repository

import com.futebadosparcas.util.MockLogExtension
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.CollectionReference
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageException
import com.google.firebase.storage.StorageReference
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Regressão #4413: apagar o vídeo de um jogo não pode deixar o card na tela quando a
 * exclusão da miniatura falha (as rules do Storage negam escrita do cliente em
 * games/{gameId}/video_thumbnails/).
 */
@ExtendWith(MockLogExtension::class)
class GameVideosRepositoryDeleteTest {

    private val firestore = mockk<FirebaseFirestore>()
    private val storage = mockk<FirebaseStorage>()
    private val auth = mockk<FirebaseAuth>(relaxed = true)
    private val functions = mockk<FirebaseFunctions>(relaxed = true)
    private val rootRef = mockk<StorageReference>()
    private val videoRef = mockk<StorageReference>()
    private val thumbnailRef = mockk<StorageReference>()
    private val videosCollection = mockk<CollectionReference>()
    private val videoDoc = mockk<DocumentReference>()

    private lateinit var repository: GameVideosRepository

    private val video = GameVideo(
        id = "video-1",
        gameId = "game-1",
        url = "https://example.invalid/video.mp4",
        storagePath = "games/game-1/videos/user-1/clip.mp4",
        thumbnailPath = "games/game-1/video_thumbnails/clip.jpg",
        uploadedBy = "user-1",
        uploadedByName = "Jogador",
        caption = null,
        reactions = emptyMap(),
        status = "READY",
        durationSec = 10.0
    )

    @BeforeEach
    fun setUp() {
        every { storage.reference } returns rootRef
        every { rootRef.child(video.storagePath) } returns videoRef
        every { rootRef.child(video.thumbnailPath!!) } returns thumbnailRef
        every { firestore.collection("game_videos") } returns videosCollection
        every { videosCollection.document(video.id) } returns videoDoc
        every { videoDoc.delete() } returns voidSuccess()
        repository = GameVideosRepository(firestore, storage, auth, functions)
    }

    @Test
    fun deleteVideo_quandoMiniaturaNegada_apagaDocumentoERetornaSucesso() = runTest {
        every { videoRef.delete() } returns voidSuccess()
        every { thumbnailRef.delete() } returns voidFailure(storageException(StorageException.ERROR_NOT_AUTHORIZED))

        val result = repository.deleteVideo(video)

        assertTrue(result.isSuccess, "A falha da miniatura não pode falhar a exclusão: $result")
        verify(exactly = 1) { videoDoc.delete() }
    }

    @Test
    fun deleteVideo_quandoArquivoJaNaoExiste_apagaDocumento() = runTest {
        every { videoRef.delete() } returns voidFailure(storageException(StorageException.ERROR_OBJECT_NOT_FOUND))
        every { thumbnailRef.delete() } returns voidFailure(storageException(StorageException.ERROR_NOT_AUTHORIZED))

        val result = repository.deleteVideo(video)

        assertTrue(result.isSuccess, "Arquivo já apagado deve destravar o card: $result")
        verify(exactly = 1) { videoDoc.delete() }
    }

    @Test
    fun deleteVideo_quandoArquivoDoVideoNegado_naoApagaDocumento() = runTest {
        every { videoRef.delete() } returns voidFailure(storageException(StorageException.ERROR_NOT_AUTHORIZED))

        val result = repository.deleteVideo(video)

        assertTrue(result.isFailure, "Sem permissão no arquivo do vídeo, a exclusão deve falhar")
        verify(exactly = 0) { thumbnailRef.delete() }
        verify(exactly = 0) { videoDoc.delete() }
    }

    @Test
    fun deleteVideo_semMiniatura_naoTentaApagarMiniatura() = runTest {
        every { videoRef.delete() } returns voidSuccess()

        val result = repository.deleteVideo(video.copy(thumbnailPath = null))

        assertTrue(result.isSuccess)
        verify(exactly = 0) { thumbnailRef.delete() }
        verify(exactly = 1) { videoDoc.delete() }
    }

    private fun voidSuccess(): Task<Void> = Tasks.forResult(null)

    private fun voidFailure(error: Exception): Task<Void> = Tasks.forException(error)

    private fun storageException(code: Int): StorageException = mockk {
        every { errorCode } returns code
        every { message } returns "storage error $code"
    }
}
