package com.futebadosparcas.domain.gamification

import com.futebadosparcas.data.model.UserBadge
import com.futebadosparcas.data.repository.AuthRepository
import com.google.firebase.firestore.DocumentChange
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.flowOf
import java.util.Date
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Service that listens for new badges awarded to the current user (via Cloud Functions)
 * and emits them for UI display.
 */
@Singleton
class BadgeAwarder @Inject constructor(
    private val authRepository: AuthRepository,
    private val firestore: FirebaseFirestore
) {

    private val sessionStartTime = Date()

    val newBadges: Flow<UserBadge> = authRepository.authStateFlow
        .flatMapLatest { user ->
            if (user == null) {
                flowOf()
            } else {
                observeBadges(user.uid)
            }
        }

    private fun observeBadges(userId: String): Flow<UserBadge> = callbackFlow {
        // Listen to all badges for this user
        // We filter by client-side timestamp to avoid spamming existing badges on startup
        val observer = firestore.collection("user_badges")
            .whereEqualTo("user_id", userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    // Fail silently or log? Closing the flow effectively stops retry unless handled upstream
                    return@addSnapshotListener
                }

                snapshot?.documentChanges?.forEach { change ->
                    val badge = change.document.toObject(UserBadge::class.java)
                    val earnedAt = badge.lastEarnedAt ?: badge.unlockedAt

                    // Only emit if it was earned/updated AFTER this session started
                    // AND it's a relevant change (Allocated or Updated count)
                    if (earnedAt != null && earnedAt.after(sessionStartTime)) {
                        if (change.type == DocumentChange.Type.ADDED || 
                            change.type == DocumentChange.Type.MODIFIED) {
                            trySend(badge)
                        }
                    }
                }
            }

        awaitClose { observer.remove() }
    }
}
