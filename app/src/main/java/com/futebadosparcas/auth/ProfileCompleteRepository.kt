package com.futebadosparcas.auth

import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await

class ProfileCompleteRepository {

    suspend fun isProfileComplete(): Boolean {
        val user = FirebaseAuth.getInstance().currentUser ?: return false
        val tokenResult = user.getIdToken(false).await()
        return tokenResult?.claims?.get("profileComplete") == true
    }

    suspend fun refreshClaims(): Boolean {
        val user = FirebaseAuth.getInstance().currentUser ?: return false
        val tokenResult = user.getIdToken(true).await()
        return tokenResult?.claims?.get("profileComplete") == true
    }
}
