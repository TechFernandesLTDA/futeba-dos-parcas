package com.futebadosparcas.data.paging

import com.futebadosparcas.util.AppLogger
import androidx.paging.PagingSource
import androidx.paging.PagingState
import com.futebadosparcas.domain.model.User
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QuerySnapshot
import kotlinx.coroutines.tasks.await

/**
 * Paging 3 - PagingSource for Users
 *
 * Loads users from Firestore in paginated chunks to avoid loading entire list at once.
 * Uses cursor-based pagination with Firestore's startAfter().
 *
 * Benefits:
 * - Memory efficient: Only loads visible items + buffer
 * - Fast scrolling: Pre-fetches next page
 * - Automatic retry: Handles network errors
 * - Pull-to-refresh support
 *
 * Usage:
 * ```kotlin
 * val usersPager = Pager(
 *     config = PagingConfig(pageSize = 20, enablePlaceholders = false),
 *     pagingSourceFactory = { UsersPagingSource(firestore, groupId) }
 * ).flow.cachedIn(viewModelScope)
 * ```
 */
class UsersPagingSource(
    private val firestore: FirebaseFirestore,
    private val groupId: String? = null,
    private val orderBy: String = "name",
    private val pageSize: Int = 20
) : PagingSource<QuerySnapshot, User>() {

    companion object {
        private const val TAG = "UsersPagingSource"
    }

    override suspend fun load(params: LoadParams<QuerySnapshot>): LoadResult<QuerySnapshot, User> {
        return try {
            val currentPage = params.key

            var query: Query = firestore.collection("users")

            // Filter by group if provided
            if (groupId != null) {
                query = query.whereArrayContains("groupIds", groupId)
            }

            // Order by field
            query = query.orderBy(orderBy)

            // Cursor pagination: Start after last document from previous page
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

            // Convert to User objects
            val users = snapshot.documents.mapNotNull { doc ->
                try {
                    doc.toObject(User::class.java)?.copy(id = doc.id)
                } catch (e: Exception) {
                    AppLogger.e(TAG, "Error parsing user document ${doc.id}", e)
                    null
                }
            }

            // Return page result
            LoadResult.Page(
                data = users,
                prevKey = null, // Only forward pagination
                nextKey = if (users.size < params.loadSize) null else snapshot
            )
        } catch (e: Exception) {
            AppLogger.e(TAG, "Error loading users page", e)
            LoadResult.Error(e)
        }
    }

    override fun getRefreshKey(state: PagingState<QuerySnapshot, User>): QuerySnapshot? {
        // Return null to always start from beginning on refresh
        return null
    }
}
