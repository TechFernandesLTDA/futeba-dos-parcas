package com.futebadosparcas.data.repository

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns
import com.futebadosparcas.util.AppLogger
import com.google.android.gms.tasks.OnFailureListener
import com.google.android.gms.tasks.OnSuccessListener
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import com.google.firebase.functions.HttpsCallableOptions
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.OnProgressListener
import com.google.firebase.storage.StorageMetadata
import com.google.firebase.storage.UploadTask
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.Locale
import java.security.MessageDigest
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal const val GROUP_WALL_MAX_IMAGE_BYTES = 10 * 1024 * 1024L
internal const val GROUP_WALL_MAX_VIDEO_BYTES = 25 * 1024 * 1024L
internal const val GROUP_WALL_MAX_VIDEO_DURATION_MS = 30_000L

internal enum class GroupWallMediaValidationReason {
    EMPTY_FILE,
    UNSUPPORTED_TYPE,
    MIME_MISMATCH,
    IMAGE_TOO_LARGE,
    VIDEO_TOO_LARGE,
    INVALID_VIDEO_DURATION,
    VIDEO_TOO_LONG
}

internal class GroupWallMediaValidationException(
    val reason: GroupWallMediaValidationReason,
    message: String
) : IllegalArgumentException(message)

data class GroupWallMediaFile(
    val uri: Uri,
    val contentType: String,
    val sizeBytes: Long,
    val durationMs: Long?,
    val fileName: String,
    val extension: String
) {
    val isVideo: Boolean get() = contentType == MIME_VIDEO_MP4
}

data class GroupWallMediaDraft(
    val groupId: String,
    val postId: String,
    val uploadPath: String,
    val expiresAt: String?,
    val maxBytes: Long,
    val pipelineVersion: Int,
    val duplicate: Boolean
)

enum class GroupWallMediaDraftState {
    AWAITING_UPLOAD,
    PROCESSING,
    READY,
    REJECTED,
    EXPIRED,
    UNKNOWN
}

data class GroupWallMediaDraftStatus(
    val state: GroupWallMediaDraftState,
    val errorCode: String? = null,
    val message: String? = null,
    val expiresAt: String? = null
)

class GroupWallMediaTerminalException(
    val terminalState: GroupWallMediaDraftState,
    val errorCode: String?,
    message: String
) : IllegalStateException(message)

interface GroupWallMediaPipeline {
    suspend fun inspect(uri: Uri): GroupWallMediaFile

    suspend fun createDraft(
        groupId: String,
        text: String,
        media: GroupWallMediaFile,
        clientRequestId: String
    ): GroupWallMediaDraft

    suspend fun getDraftStatus(groupId: String, postId: String): GroupWallMediaDraftStatus

    suspend fun upload(
        draft: GroupWallMediaDraft,
        media: GroupWallMediaFile,
        onProgress: (Int) -> Unit
    )

    suspend fun awaitTerminalStatus(groupId: String, postId: String): GroupWallMediaDraftStatus
}

/**
 * Cliente Android do pipeline assíncrono do mural (#3519).
 *
 * O callable apenas reserva o post e o caminho de staging. O upload em
 * `wall_media_staging` dispara o Storage finalize no servidor; por isso o cliente
 * observa o draft até um estado terminal antes de declarar a publicação concluída.
 */
class FirebaseGroupWallMediaPipeline(
    private val context: Context,
    private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions,
    private val storage: FirebaseStorage,
    private val firestore: FirebaseFirestore
) : GroupWallMediaPipeline {

    override suspend fun inspect(uri: Uri): GroupWallMediaFile =
        inspectGroupWallMedia(context, uri)

    override suspend fun createDraft(
        groupId: String,
        text: String,
        media: GroupWallMediaFile,
        clientRequestId: String
    ): GroupWallMediaDraft {
        val uid = auth.currentUser?.uid ?: error("Usuário não autenticado")
        val response = try {
            functions.getHttpsCallable(
                CREATE_DRAFT_CALLABLE,
                HttpsCallableOptions.Builder()
                    .setLimitedUseAppCheckTokens(true)
                    .build()
            )
                .call(
                    mapOf(
                        "groupId" to groupId,
                        "text" to text,
                        // O valor enviado é derivado da assinatura real, não do nome do arquivo.
                        "declaredContentType" to media.contentType,
                        "sizeBytes" to media.sizeBytes,
                        "fileName" to media.fileName,
                        "clientRequestId" to clientRequestId
                    )
                )
                .await()
        } catch (error: FirebaseFunctionsException) {
            // Retry depois de timeout pode encontrar o draft já encerrado; o callable
            // responde failed-precondition antes de devolver postId. Derivamos o mesmo
            // id opaco do servidor e convertemos o estado em exceção terminal tipada.
            if (error.code == FirebaseFunctionsException.Code.FAILED_PRECONDITION) {
                val postId = deterministicWallMediaPostId(groupId, uid, clientRequestId)
                try {
                    getDraftStatus(groupId, postId).requireReady()
                } catch (terminal: GroupWallMediaTerminalException) {
                    throw terminal
                } catch (cancellation: CancellationException) {
                    throw cancellation
                } catch (_: Exception) {
                    // Mantém a exceção original quando o draft não pode ser consultado.
                }
            }
            throw error
        }

        val data = response.data as? Map<*, *>
            ?: error("Resposta inválida ao preparar a mídia")
        return parseGroupWallMediaDraft(data, groupId, uid, media.contentType)
    }

    override suspend fun getDraftStatus(
        groupId: String,
        postId: String
    ): GroupWallMediaDraftStatus {
        val snapshot = draftDocument(groupId, postId).get().await()
        check(snapshot.exists()) { "Rascunho de mídia não encontrado. Tente enviar novamente." }
        return parseGroupWallMediaDraftStatus(snapshot.data)
    }

    override suspend fun upload(
        draft: GroupWallMediaDraft,
        media: GroupWallMediaFile,
        onProgress: (Int) -> Unit
    ) {
        require(media.sizeBytes < draft.maxBytes) {
            "A mídia excede o limite aceito pelo servidor."
        }
        val ref = storage.getReference(draft.uploadPath)

        // Retry idempotente: se o mesmo objeto já chegou integralmente ao staging,
        // não o sobrescreve enquanto o trigger de finalize o processa.
        val alreadyUploaded = try {
            val metadata = ref.metadata.await()
            metadata.sizeBytes == media.sizeBytes &&
                normalizeMime(metadata.contentType) == media.contentType
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            false
        }

        if (alreadyUploaded) {
            onProgress(100)
            return
        }

        // O finalize pode ter movido o objeto entre a leitura inicial do repository
        // e esta tentativa. Nesse caso não recria o source no staging.
        val latestStatus = getDraftStatus(draft.groupId, draft.postId)
        when (latestStatus.state) {
            GroupWallMediaDraftState.PROCESSING,
            GroupWallMediaDraftState.READY -> {
                onProgress(100)
                return
            }
            GroupWallMediaDraftState.REJECTED,
            GroupWallMediaDraftState.EXPIRED -> {
                latestStatus.requireReady()
                return
            }
            GroupWallMediaDraftState.AWAITING_UPLOAD -> Unit
            GroupWallMediaDraftState.UNKNOWN -> error(
                "O servidor retornou um estado de mídia desconhecido."
            )
        }

        val metadata = StorageMetadata.Builder()
            .setContentType(media.contentType)
            .build()
        val task = ref.putFile(media.uri, metadata)
        onProgress(0)

        suspendCancellableCoroutine { continuation ->
            val progressListener = OnProgressListener<UploadTask.TaskSnapshot> { snapshot ->
                val total = snapshot.totalByteCount
                if (total > 0L) {
                    val progress = ((snapshot.bytesTransferred * 100L) / total)
                        .toInt()
                        .coerceIn(0, 100)
                    onProgress(progress)
                }
            }
            val successListener = OnSuccessListener<UploadTask.TaskSnapshot> {
                if (continuation.isActive) {
                    onProgress(100)
                    continuation.resume(Unit)
                }
            }
            val failureListener = OnFailureListener { error ->
                if (continuation.isActive) continuation.resumeWithException(error)
            }

            task.addOnProgressListener(progressListener)
            task.addOnSuccessListener(successListener)
            task.addOnFailureListener(failureListener)
            continuation.invokeOnCancellation {
                task.removeOnProgressListener(progressListener)
                task.removeOnSuccessListener(successListener)
                task.removeOnFailureListener(failureListener)
                task.cancel()
            }
        }
    }

    override suspend fun awaitTerminalStatus(
        groupId: String,
        postId: String
    ): GroupWallMediaDraftStatus {
        return try {
            withTimeout(PROCESSING_TIMEOUT_MS) {
                callbackFlow {
                    val listener = draftDocument(groupId, postId)
                        .addSnapshotListener { snapshot, error ->
                            if (error != null) {
                                close(error)
                                return@addSnapshotListener
                            }
                            if (snapshot == null || !snapshot.exists()) {
                                close(IllegalStateException("Rascunho de mídia não encontrado."))
                                return@addSnapshotListener
                            }
                            trySend(parseGroupWallMediaDraftStatus(snapshot.data))
                        }
                    awaitClose { listener.remove() }
                }.first { status -> status.state.isTerminal() }
            }
        } catch (_: TimeoutCancellationException) {
            error(
                "A mídia ainda está sendo processada. Tente novamente em alguns instantes."
            )
        }
    }

    private fun draftDocument(groupId: String, postId: String) =
        firestore.collection("groups")
            .document(groupId)
            .collection("wall_post_drafts")
            .document(postId)

    private companion object {
        const val CREATE_DRAFT_CALLABLE = "createGroupWallMediaDraft"
        const val PROCESSING_TIMEOUT_MS = 90_000L
    }
}

internal suspend fun inspectGroupWallMedia(context: Context, uri: Uri): GroupWallMediaFile =
    withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        val declaredType = normalizeMime(resolver.getType(uri))
        val header = resolver.openInputStream(uri)?.use { input ->
            val buffer = ByteArray(MEDIA_HEADER_BYTES)
            val read = input.read(buffer)
            if (read > 0) buffer.copyOf(read) else ByteArray(0)
        } ?: ByteArray(0)
        val detectedType = detectGroupWallMediaContentType(header)
        val sizeBytes = queryGroupWallMediaSize(context, uri)
        val durationMs = if (detectedType == MIME_VIDEO_MP4) {
            queryGroupWallVideoDuration(context, uri)
        } else {
            null
        }

        validateGroupWallMediaFacts(
            declaredContentType = declaredType,
            detectedContentType = detectedType,
            sizeBytes = sizeBytes,
            durationMs = durationMs
        )

        val contentType = checkNotNull(detectedType)
        val extension = extensionForMime(contentType)
        GroupWallMediaFile(
            uri = uri,
            contentType = contentType,
            sizeBytes = sizeBytes,
            durationMs = durationMs,
            fileName = canonicalMediaFileName(queryDisplayName(context, uri), extension),
            extension = extension
        )
    }

internal fun validateGroupWallMediaFacts(
    declaredContentType: String?,
    detectedContentType: String?,
    sizeBytes: Long,
    durationMs: Long?
) {
    if (sizeBytes <= 0L) {
        failGroupWallMediaValidation(
            GroupWallMediaValidationReason.EMPTY_FILE,
            "Não foi possível ler o arquivo selecionado."
        )
    }
    if (detectedContentType !in SUPPORTED_MEDIA_TYPES) {
        failGroupWallMediaValidation(
            GroupWallMediaValidationReason.UNSUPPORTED_TYPE,
            "Use uma foto JPEG, PNG ou WebP, ou um vídeo MP4."
        )
    }

    val normalizedDeclared = normalizeMime(declaredContentType)
    if (
        normalizedDeclared != null &&
        normalizedDeclared !in GENERIC_MEDIA_TYPES &&
        !normalizedDeclared.endsWith("/*") &&
        normalizedDeclared != detectedContentType
    ) {
        failGroupWallMediaValidation(
            GroupWallMediaValidationReason.MIME_MISMATCH,
            "O conteúdo do arquivo não corresponde ao tipo informado."
        )
    }

    if (detectedContentType == MIME_VIDEO_MP4) {
        if (sizeBytes >= GROUP_WALL_MAX_VIDEO_BYTES) {
            failGroupWallMediaValidation(
                GroupWallMediaValidationReason.VIDEO_TOO_LARGE,
                "O vídeo precisa ter menos de 25 MB."
            )
        }
        if (durationMs == null || durationMs <= 0L) {
            failGroupWallMediaValidation(
                GroupWallMediaValidationReason.INVALID_VIDEO_DURATION,
                "Não foi possível verificar a duração deste vídeo."
            )
        }
        if (durationMs > GROUP_WALL_MAX_VIDEO_DURATION_MS) {
            failGroupWallMediaValidation(
                GroupWallMediaValidationReason.VIDEO_TOO_LONG,
                "O vídeo pode ter no máximo 30 segundos."
            )
        }
    } else if (sizeBytes >= GROUP_WALL_MAX_IMAGE_BYTES) {
        failGroupWallMediaValidation(
            GroupWallMediaValidationReason.IMAGE_TOO_LARGE,
            "A foto precisa ter menos de 10 MB."
        )
    }
}

private fun failGroupWallMediaValidation(
    reason: GroupWallMediaValidationReason,
    message: String
): Nothing = throw GroupWallMediaValidationException(reason, message)

internal fun detectGroupWallMediaContentType(header: ByteArray): String? = when {
    header.size >= 3 &&
        header[0].toUnsignedInt() == 0xFF &&
        header[1].toUnsignedInt() == 0xD8 &&
        header[2].toUnsignedInt() == 0xFF -> MIME_IMAGE_JPEG

    header.size >= 8 && header.take(8).map(Byte::toUnsignedInt) == PNG_SIGNATURE -> MIME_IMAGE_PNG

    header.size >= 12 &&
        header.asAscii(0, 4) == "RIFF" &&
        header.asAscii(8, 12) == "WEBP" -> MIME_IMAGE_WEBP

    header.size >= 12 && header.asAscii(4, 8) == "ftyp" -> MIME_VIDEO_MP4
    else -> null
}

internal fun parseGroupWallMediaDraft(
    data: Map<*, *>,
    groupId: String,
    uid: String,
    contentType: String
): GroupWallMediaDraft {
    val postId = data["postId"] as? String
    val uploadPath = data["uploadPath"] as? String
    require(!postId.isNullOrBlank() && !uploadPath.isNullOrBlank()) {
        "Resposta inválida ao preparar a mídia"
    }

    val segments = uploadPath.split('/')
    val allowedExtensions = when (contentType) {
        MIME_IMAGE_JPEG -> setOf("jpg", "jpeg")
        MIME_IMAGE_PNG -> setOf("png")
        MIME_IMAGE_WEBP -> setOf("webp")
        MIME_VIDEO_MP4 -> setOf("mp4")
        else -> emptySet()
    }
    val extension = segments.lastOrNull()?.substringAfterLast('.', "")?.lowercase(Locale.ROOT)
    require(
        segments.size == 6 &&
            segments[0] == "groups" &&
            segments[1] == groupId &&
            segments[2] == "wall_media_staging" &&
            segments[3] == postId &&
            WALL_MEDIA_POST_ID_REGEX.matches(postId) &&
            segments[4] == uid &&
            segments[5].startsWith("source.") &&
            extension in allowedExtensions
    ) {
        "Caminho de upload inválido"
    }

    val maxBytes = (data["maxBytes"] as? Number)?.toLong()
        ?: error("Limite de upload ausente")
    require(maxBytes > 0L) { "Limite de upload inválido" }
    val pipelineVersion = (data["pipelineVersion"] as? Number)?.toInt()
        ?: error("Versão do pipeline ausente")
    require(pipelineVersion > 0) { "Versão do pipeline inválida" }

    return GroupWallMediaDraft(
        groupId = groupId,
        postId = postId,
        uploadPath = uploadPath,
        expiresAt = data["expiresAt"]?.toString(),
        maxBytes = maxBytes,
        pipelineVersion = pipelineVersion,
        duplicate = data["duplicate"] as? Boolean
            ?: error("Indicador de idempotência ausente")
    )
}

internal fun parseGroupWallMediaDraftStatus(data: Map<String, Any>?): GroupWallMediaDraftStatus {
    val rawState = (data?.get("status") as? String)
        ?.trim()
        ?.uppercase(Locale.ROOT)
    val state = runCatching {
        GroupWallMediaDraftState.valueOf(rawState.orEmpty())
    }.getOrDefault(GroupWallMediaDraftState.UNKNOWN)
    return GroupWallMediaDraftStatus(
        state = state,
        errorCode = (data?.get("error_code") as? String)?.takeIf { it.isNotBlank() },
        message = (data?.get("error_message") as? String)?.takeIf { it.isNotBlank() },
        expiresAt = data?.get("expires_at")?.toString()
    )
}

internal fun GroupWallMediaDraftStatus.requireReady() {
    when (state) {
        GroupWallMediaDraftState.READY -> Unit
        GroupWallMediaDraftState.REJECTED -> throw GroupWallMediaTerminalException(
            terminalState = state,
            errorCode = errorCode,
            message = message
                ?: "O servidor rejeitou a mídia. Escolha outro arquivo e tente novamente."
        )
        GroupWallMediaDraftState.EXPIRED -> throw GroupWallMediaTerminalException(
            terminalState = state,
            errorCode = errorCode,
            message = message
                ?: "O prazo deste envio expirou. Toque em publicar para tentar novamente."
        )
        else -> error("A mídia não terminou de ser processada.")
    }
}

private fun GroupWallMediaDraftState.isTerminal(): Boolean =
    this == GroupWallMediaDraftState.READY ||
        this == GroupWallMediaDraftState.REJECTED ||
        this == GroupWallMediaDraftState.EXPIRED

private fun queryGroupWallMediaSize(context: Context, uri: Uri): Long {
    val descriptorSize = runCatching {
        context.contentResolver.openFileDescriptor(uri, "r")?.use { it.statSize }
    }.getOrNull()
    if (descriptorSize != null && descriptorSize > 0L) return descriptorSize

    return runCatching {
        context.contentResolver.query(
            uri,
            arrayOf(OpenableColumns.SIZE),
            null,
            null,
            null
        )?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (index >= 0 && cursor.moveToFirst() && !cursor.isNull(index)) {
                cursor.getLong(index)
            } else {
                -1L
            }
        } ?: -1L
    }.getOrDefault(-1L)
}

private fun queryDisplayName(context: Context, uri: Uri): String? = runCatching {
    context.contentResolver.query(
        uri,
        arrayOf(OpenableColumns.DISPLAY_NAME),
        null,
        null,
        null
    )?.use { cursor ->
        val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (index >= 0 && cursor.moveToFirst() && !cursor.isNull(index)) {
            cursor.getString(index)
        } else {
            null
        }
    }
}.getOrNull()

private fun queryGroupWallVideoDuration(context: Context, uri: Uri): Long = runCatching {
    MediaMetadataRetriever().use { retriever ->
        retriever.setDataSource(context, uri)
        retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
            ?.toLongOrNull()
            ?: -1L
    }
}.onFailure { error ->
    AppLogger.w("GroupWallMediaPipeline") { "Falha ao ler duração do vídeo: ${error.message}" }
}.getOrDefault(-1L)

private fun canonicalMediaFileName(originalName: String?, extension: String): String {
    val base = originalName
        ?.substringBeforeLast('.')
        ?.replace(Regex("[^A-Za-z0-9_-]"), "-")
        ?.trim('-')
        ?.take(80)
        ?.takeIf { it.isNotBlank() }
        ?: "media"
    return "$base.$extension"
}

private fun extensionForMime(contentType: String): String = when (contentType) {
    MIME_IMAGE_JPEG -> "jpg"
    MIME_IMAGE_PNG -> "png"
    MIME_IMAGE_WEBP -> "webp"
    MIME_VIDEO_MP4 -> "mp4"
    else -> error("Tipo de mídia sem extensão segura")
}

private fun normalizeMime(value: String?): String? = value
    ?.substringBefore(';')
    ?.trim()
    ?.lowercase(Locale.ROOT)
    ?.takeIf { it.isNotBlank() }
    ?.let { if (it == "image/jpg") MIME_IMAGE_JPEG else it }

private fun Byte.toUnsignedInt(): Int = toInt() and 0xFF

private fun ByteArray.asAscii(start: Int, end: Int): String =
    copyOfRange(start, end).toString(Charsets.US_ASCII)

internal fun deterministicWallMediaPostId(
    groupId: String,
    ownerId: String,
    clientRequestId: String
): String = MessageDigest.getInstance("SHA-256")
    .digest("wall-media:$groupId:$ownerId:$clientRequestId".toByteArray(Charsets.UTF_8))
    .joinToString(separator = "") { byte -> "%02x".format(byte.toInt() and 0xFF) }
    .take(40)

private const val MEDIA_HEADER_BYTES = 32
private const val MIME_IMAGE_JPEG = "image/jpeg"
private const val MIME_IMAGE_PNG = "image/png"
private const val MIME_IMAGE_WEBP = "image/webp"
private const val MIME_VIDEO_MP4 = "video/mp4"
private val SUPPORTED_MEDIA_TYPES = setOf(
    MIME_IMAGE_JPEG,
    MIME_IMAGE_PNG,
    MIME_IMAGE_WEBP,
    MIME_VIDEO_MP4
)
private val GENERIC_MEDIA_TYPES = setOf("application/octet-stream", "binary/octet-stream")
private val PNG_SIGNATURE = listOf(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
private val WALL_MEDIA_POST_ID_REGEX = Regex("^[a-f0-9]{40}$")
