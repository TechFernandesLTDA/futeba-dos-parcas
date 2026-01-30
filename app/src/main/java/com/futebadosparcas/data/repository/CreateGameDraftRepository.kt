package com.futebadosparcas.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.futebadosparcas.data.model.GameDraft
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.gameDraftDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "game_draft_prefs"
)

/**
 * Repositorio para persistencia de rascunhos de jogos.
 * Utiliza DataStore para salvar o estado do formulario de criacao de jogo.
 */
@Singleton
class CreateGameDraftRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val gson = Gson()

    companion object {
        private val DRAFT_KEY = stringPreferencesKey("game_draft")
    }

    /**
     * Salva o rascunho do jogo.
     */
    suspend fun saveDraft(draft: GameDraft) {
        val draftWithTimestamp = draft.copy(savedAt = System.currentTimeMillis())
        context.gameDraftDataStore.edit { prefs ->
            prefs[DRAFT_KEY] = gson.toJson(draftWithTimestamp)
        }
    }

    /**
     * Obtem o rascunho salvo, se existir e for valido.
     */
    suspend fun getDraft(): GameDraft? {
        return try {
            val prefs = context.gameDraftDataStore.data.first()
            val draftJson = prefs[DRAFT_KEY] ?: return null
            val draft = gson.fromJson(draftJson, GameDraft::class.java)
            if (draft.isValid()) draft else null
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Flow para observar mudancas no rascunho.
     */
    fun getDraftFlow(): Flow<GameDraft?> {
        return context.gameDraftDataStore.data.map { prefs ->
            try {
                val draftJson = prefs[DRAFT_KEY] ?: return@map null
                val draft = gson.fromJson(draftJson, GameDraft::class.java)
                if (draft.isValid()) draft else null
            } catch (e: Exception) {
                null
            }
        }
    }

    /**
     * Limpa o rascunho salvo.
     */
    suspend fun clearDraft() {
        context.gameDraftDataStore.edit { prefs ->
            prefs.remove(DRAFT_KEY)
        }
    }

    /**
     * Verifica se existe um rascunho valido.
     */
    suspend fun hasDraft(): Boolean {
        return getDraft() != null
    }
}
