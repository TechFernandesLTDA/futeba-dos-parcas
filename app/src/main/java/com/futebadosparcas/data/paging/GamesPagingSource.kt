package com.futebadosparcas.data.paging

import android.util.Log
import androidx.paging.PagingSource
import androidx.paging.PagingState
import com.futebadosparcas.data.model.Game
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QuerySnapshot
import kotlinx.coroutines.tasks.await

/**
 * Paging 3 - PagingSource for Games
 *
 * Loads games from Firestore in paginated chunks ordered by date.
 *
 * Usage:
 * ```kotlin
 * val gamesPager = Pager(
 *     config = PagingConfig(pageSize = 30, enablePlaceholders = false),
 *     pagingSourceFactory = { GamesPagingSource(firestore, groupId, includeFinished = true) }
 * ).flow.cachedIn(viewModelScope)
 * ```
 */
class GamesPagingSource(
    private val firestore: FirebaseFirestore,
    private val groupId: String? = null,
    private val includeFinished: Boolean = true,
    private val pageSize: Int = 30
) : PagingSource<QuerySnapshot, Game>() {

    companion object {
        private const val TAG = "GamesPagingSource"
    }

    override suspend fun load(params: LoadParams<QuerySnapshot>): LoadResult<QuerySnapshot, Game> {
        return try {
            val currentPage = params.key

            var query: Query = firestore.collection("games")

            // Filter by group if provided
            if (groupId != null) {
                query = query.whereEqualTo("groupId", groupId)
            }

            // Filter finished games if requested
            if (!includeFinished) {
                query = query.whereEqualTo("finished", false)
            }

            // Order by date (newest first)
            query = query.orderBy("date", Query.Direction.DESCENDING)

            // Cursor pagination
            if (currentPage != null) {
                val lastDocument = currentPage.documents.lastOrNull()
                if (lastDocument != null) {
                    query = query.startAfter(lastDocument)
                }
            }

            // Limit page size
            query = query.limit(params.loadSize.toLong())

            // Execute query
            val snapshot = query.get().await()

            // Convert to Game objects
            val games = snapshot.documents.mapNotNull { doc ->
                try {
                    doc.toObject(Game::class.java)?.copy(id = doc.id)
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing game document ${doc.id}", e)
                    null
                }
            }

            // Return page result
            LoadResult.Page(
                data = games,
                prevKey = null,
                nextKey = if (games.size < params.loadSize) null else snapshot
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error loading games page", e)
            LoadResult.Error(e)
        }
    }

    override fun getRefreshKey(state: PagingState<QuerySnapshot, Game>): QuerySnapshot? {
        return null
    }
}
