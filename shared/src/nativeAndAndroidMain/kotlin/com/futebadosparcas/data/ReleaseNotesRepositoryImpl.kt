package com.futebadosparcas.data

import com.futebadosparcas.domain.model.ReleaseHighlight
import com.futebadosparcas.domain.model.ReleaseNote
import com.futebadosparcas.domain.model.ReleaseType
import com.futebadosparcas.domain.repository.ReleaseNotesRepository
import com.futebadosparcas.platform.releasenotes.ReleaseNotesAssetReader
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.DocumentSnapshot
import dev.gitlive.firebase.firestore.Timestamp
import dev.gitlive.firebase.firestore.firestore
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Implementação compartilhada (Android + iOS) do [ReleaseNotesRepository].
 *
 * Combina duas fontes (spec §3.8):
 * - **Firestore** (`release_notes`) — fonte primária. Documento aninhado por
 *   locale (`content."pt-BR"`), gravado pela CI via Admin SDK.
 * - **JSON embarcado** — fallback offline, lido via [ReleaseNotesAssetReader].
 *   Formato achatado, gerado por `scripts/release-notes.js bundle`.
 *
 * Política de merge:
 * - Firestore OK → Firestore é a fonte; o fallback só completa versões ausentes.
 * - Firestore falha → degrada para o fallback embarcado; só retorna `failure`
 *   se também não houver fallback.
 */
class ReleaseNotesRepositoryImpl(
    private val assetReader: ReleaseNotesAssetReader,
) : ReleaseNotesRepository {

    // `by lazy` evita tocar o Firebase na construção do repositório: em builds
    // iOS sem `GoogleService-Info.plist` (smoke-test mode), `Firebase.firestore`
    // lança `FIRIllegalStateException` por falta de `FirebaseApp.configure()`.
    // Adiado para o 1º uso (dentro do `try` de `getReleaseNotes`), a falha é
    // capturada e o repositório degrada para o fallback embarcado — honrando o
    // contrato de "degrada para o fallback" descrito acima.
    private val firestore by lazy { Firebase.firestore }

    override suspend fun getReleaseNotes(
        platform: String,
        sinceBuild: Int,
    ): Result<List<ReleaseNote>> {
        val fallback = readFallback(platform).filter { it.buildNumber > sinceBuild }
        return try {
            val remote = queryFirestore(platform, sinceBuild)
            val remoteVersions = remote.mapTo(mutableSetOf()) { it.version }
            val merged = (remote + fallback.filterNot { it.version in remoteVersions })
                .sortedByDescending { it.buildNumber }
            Result.success(merged)
        } catch (e: Exception) {
            // Firestore indisponível — degrada para o fallback embarcado.
            if (fallback.isNotEmpty()) {
                Result.success(fallback.sortedByDescending { it.buildNumber })
            } else {
                Result.failure(e)
            }
        }
    }

    // ====================== Firestore (fonte primária) ======================

    private suspend fun queryFirestore(platform: String, sinceBuild: Int): List<ReleaseNote> {
        val snapshot = firestore.collection(COLLECTION)
            .where { "platform" equalTo platform }
            .where { "buildNumber" greaterThan sinceBuild }
            .orderBy("buildNumber", Direction.DESCENDING)
            .limit(QUERY_LIMIT)
            .get()
        return snapshot.documents.mapNotNull { it.toReleaseNoteOrNull() }
    }

    /**
     * Mapeia um documento Firestore (forma aninhada por locale) para [ReleaseNote].
     * Qualquer falha de leitura descarta a nota (retorna `null`) sem quebrar a lista.
     */
    private fun DocumentSnapshot.toReleaseNoteOrNull(): ReleaseNote? {
        if (!exists) return null
        return try {
            val content = get<Map<*, *>?>("content").asStringMap()
            val ptBr = content?.get(LOCALE).asStringMap()
            val sections = ptBr?.get("sections").asStringMap()
            val displayConfig = get<Map<*, *>?>("displayConfig").asStringMap()
            ReleaseNote(
                platform = get<String?>("platform") ?: "",
                version = get<String?>("version") ?: "",
                buildNumber = get<Long?>("buildNumber")?.toInt() ?: 0,
                releaseDate = get<Timestamp?>("releaseDate").toEpochMillis(),
                type = ReleaseType.fromString(get<String?>("type")),
                headline = ptBr?.get("headline") as? String ?: "",
                highlights = ptBr?.get("highlights").toHighlights(),
                added = sections?.get("added").toStringList(),
                improved = sections?.get("improved").toStringList(),
                fixed = sections?.get("fixed").toStringList(),
                issueRefs = (get<List<*>?>("issueRefs")).toIntList(),
                showPopup = displayConfig?.get("showPopup") as? Boolean ?: false,
            )
        } catch (_: Exception) {
            null
        }
    }

    // ====================== Fallback embarcado (offline) ====================

    private fun readFallback(platform: String): List<ReleaseNote> {
        return try {
            val raw = assetReader.readBundleJson() ?: return emptyList()
            val bundle = json.decodeFromString<BundledReleaseNotes>(raw)
            // O bundle é por plataforma; ignora se não casar com a solicitada.
            if (bundle.platform.isNotEmpty() &&
                platform.isNotEmpty() &&
                bundle.platform != platform
            ) {
                return emptyList()
            }
            val resolvedPlatform = platform.ifEmpty { bundle.platform }
            bundle.notes
                .filter { it.published }
                .map { it.toDomain(resolvedPlatform) }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun BundledReleaseNote.toDomain(platform: String): ReleaseNote = ReleaseNote(
        platform = platform,
        version = version,
        buildNumber = buildNumber,
        releaseDate = parseIsoDate(releaseDate),
        type = ReleaseType.fromString(type),
        headline = headline,
        highlights = highlights,
        added = added,
        improved = improved,
        fixed = fixed,
        issueRefs = issueRefs,
        showPopup = showPopup,
    )

    private companion object {
        const val COLLECTION = "release_notes"
        const val LOCALE = "pt-BR"
        const val QUERY_LIMIT = 20
        val json = Json { ignoreUnknownKeys = true }
    }
}

// ============================== Helpers ====================================

@Suppress("UNCHECKED_CAST")
private fun Any?.asStringMap(): Map<String, Any?>? = this as? Map<String, Any?>

private fun Timestamp?.toEpochMillis(): Long =
    this?.let { it.seconds * 1000L + it.nanoseconds / 1_000_000L } ?: 0L

private fun Any?.toHighlights(): List<ReleaseHighlight> =
    (this as? List<*>)?.mapNotNull { item ->
        item.asStringMap()?.let { m ->
            ReleaseHighlight(
                icon = m["icon"] as? String ?: "",
                title = m["title"] as? String ?: "",
                description = m["description"] as? String ?: "",
            )
        }
    } ?: emptyList()

private fun Any?.toStringList(): List<String> =
    (this as? List<*>)?.mapNotNull { it as? String } ?: emptyList()

private fun List<*>?.toIntList(): List<Int> =
    this?.mapNotNull { (it as? Number)?.toInt() } ?: emptyList()

private fun parseIsoDate(date: String): Long = try {
    LocalDate.parse(date).atStartOfDayIn(TimeZone.UTC).toEpochMilliseconds()
} catch (_: Exception) {
    0L
}

// =========================== DTO do fallback ===============================
// Espelha o JSON gerado por scripts/release-notes.js (forma achatada).

@Serializable
private data class BundledReleaseNotes(
    val platform: String = "",
    val generatedAt: String = "",
    val notes: List<BundledReleaseNote> = emptyList(),
)

@Serializable
private data class BundledReleaseNote(
    val version: String = "",
    val buildNumber: Int = 0,
    val releaseDate: String = "",
    val type: String = "minor",
    val showPopup: Boolean = false,
    val published: Boolean = true,
    val headline: String = "",
    val highlights: List<ReleaseHighlight> = emptyList(),
    val added: List<String> = emptyList(),
    val improved: List<String> = emptyList(),
    val fixed: List<String> = emptyList(),
    val issueRefs: List<Int> = emptyList(),
)
