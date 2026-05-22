package com.futebadosparcas.domain.usecase

import com.futebadosparcas.domain.model.ReleaseNote
import com.futebadosparcas.domain.repository.ReleaseNotesRepository
import com.futebadosparcas.platform.storage.LastSeenVersionStore

/**
 * Resultado de [GetUnseenReleaseNotesUseCase].
 */
data class UnseenReleaseNotes(
    /** Notas ainda não vistas neste dispositivo, mais recente primeiro. */
    val notes: List<ReleaseNote>,
    /** Nota a exibir no pop-up automático pós-update, ou `null` se nenhum. */
    val popupNote: ReleaseNote?,
) {
    /** `true` se o pop-up automático deve aparecer neste boot. */
    val hasPopup: Boolean get() = popupNote != null
}

/**
 * Busca as notas de versão ainda não vistas neste dispositivo e decide se o
 * pop-up automático "Novidades" deve aparecer no boot.
 *
 * Lógica 100% compartilhada entre Android (`:app`) e iOS (`composeApp`) — a UI
 * apenas consome o resultado e chama [markSeen] quando o usuário fecha o pop-up.
 */
class GetUnseenReleaseNotesUseCase(
    private val repository: ReleaseNotesRepository,
    private val store: LastSeenVersionStore,
) {

    /**
     * @param platform "android" | "web" | "ios".
     * @param currentBuild buildNumber instalado neste dispositivo.
     */
    suspend operator fun invoke(platform: String, currentBuild: Int): Result<UnseenReleaseNotes> {
        val lastSeen = store.getLastSeenBuild()
        return repository.getReleaseNotes(platform, sinceBuild = lastSeen).map { notes ->
            decide(notes = notes, lastSeenBuild = lastSeen, currentBuild = currentBuild)
        }
    }

    /** Marca [build] como visto — chamar após o usuário fechar o pop-up. */
    suspend fun markSeen(build: Int) {
        store.setLastSeenBuild(build)
    }

    companion object {
        /**
         * Lógica pura de decisão — testável em `commonTest` sem dependências de
         * plataforma.
         *
         * O pop-up exibe a nota não vista mais recente que:
         * - tem [ReleaseNote.showPopup] = `true`;
         * - tem `buildNumber` maior que [lastSeenBuild] (ainda não vista);
         * - tem `buildNumber` menor ou igual a [currentBuild] (não anuncia um
         *   build que o aparelho ainda não tem instalado).
         */
        fun decide(
            notes: List<ReleaseNote>,
            lastSeenBuild: Int,
            currentBuild: Int,
        ): UnseenReleaseNotes {
            val sorted = notes.sortedByDescending { it.buildNumber }
            val popup = sorted.firstOrNull { note ->
                note.showPopup &&
                    note.buildNumber > lastSeenBuild &&
                    note.buildNumber <= currentBuild
            }
            return UnseenReleaseNotes(notes = sorted, popupNote = popup)
        }
    }
}
