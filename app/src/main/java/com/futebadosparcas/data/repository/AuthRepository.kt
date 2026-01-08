package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.User
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.crashlytics.FirebaseCrashlytics
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) {
    private val usersCollection = firestore.collection("users")

    val authStateFlow: Flow<FirebaseUser?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { auth ->
            val user = auth.currentUser
            trySend(user)
            if (user != null) {
                FirebaseCrashlytics.getInstance().setUserId(user.uid)
            } else {
                FirebaseCrashlytics.getInstance().setUserId("")
            }
        }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    fun isLoggedIn(): Boolean = auth.currentUser != null

    fun getCurrentFirebaseUser(): FirebaseUser? = auth.currentUser

    fun getCurrentUserId(): String? = auth.currentUser?.uid

    suspend fun getCurrentUser(): Result<User> {
        return try {
            // Enhanced retry logic for Google Sign-In reliability
            // Firebase Auth may take time to sync after credential validation
            var uid: String? = null
            var retries = 0
            val maxRetries = 10 // Increased from 5
            val baseDelay = 300L // Increased from 200ms

            while (uid == null && retries < maxRetries) {
                uid = auth.currentUser?.uid
                if (uid == null) {
                    // Exponential backoff: 300ms, 600ms, 900ms, 1200ms, etc.
                    val delay = baseDelay * (retries + 1)
                    kotlinx.coroutines.delay(delay)
                    retries++
                }
            }

            if (uid == null) {
                return Result.failure(Exception("Usuario nao autenticado"))
            }

            // Wait a bit more to ensure Firestore is ready
            kotlinx.coroutines.delay(100)

            val doc = usersCollection.document(uid).get().await()

            if (doc.exists()) {
                var user = doc.toObject(User::class.java)
                    ?: return Result.failure(Exception("Erro ao converter usuario"))

                // Verifica se a foto do Google mudou e atualiza
                val firebaseUser = auth.currentUser
                val googlePhotoUrl = firebaseUser?.photoUrl?.toString()

                if (googlePhotoUrl != null && googlePhotoUrl != user.photoUrl) {
                    usersCollection.document(uid).update("photo_url", googlePhotoUrl).await()
                    user = user.copy(photoUrl = googlePhotoUrl)
                }

                Result.success(user)
            } else {
                // Criar usuario automaticamente se nao existir
                val firebaseUser = auth.currentUser!!
                val newUser = User(
                    id = uid,
                    email = firebaseUser.email ?: "",
                    name = firebaseUser.displayName ?: "",
                    photoUrl = firebaseUser.photoUrl?.toString()
                )
                usersCollection.document(uid).set(newUser).await()
                Result.success(newUser)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun logout() {
        auth.signOut()
        FirebaseCrashlytics.getInstance().setUserId("")
    }
}
