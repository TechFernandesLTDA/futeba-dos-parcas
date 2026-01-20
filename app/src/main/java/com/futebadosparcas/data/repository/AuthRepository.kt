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
        android.util.Log.d("AuthRepository", "=== getCurrentUser() START ===")
        return try {
            // Enhanced retry logic for Google Sign-In reliability
            // Firebase Auth may take time to sync after credential validation
            var uid: String? = null
            var retries = 0
            val maxRetries = 10 // Increased from 5
            val baseDelay = 300L // Increased from 200ms

            android.util.Log.d("AuthRepository", "Starting retry loop (max $maxRetries attempts)")
            while (uid == null && retries < maxRetries) {
                uid = auth.currentUser?.uid
                android.util.Log.d("AuthRepository", "Retry $retries: uid exists = ${uid != null}")
                if (uid == null) {
                    // Exponential backoff: 300ms, 600ms, 900ms, 1200ms, etc.
                    val delay = baseDelay * (retries + 1)
                    android.util.Log.d("AuthRepository", "Waiting ${delay}ms before next retry")
                    kotlinx.coroutines.delay(delay)
                    retries++
                }
            }

            if (uid == null) {
                android.util.Log.e("AuthRepository", "FAILED: No UID after $retries retries")
                return Result.failure(Exception("Usuario nao autenticado"))
            }

            android.util.Log.d("AuthRepository", "SUCCESS: Got UID")
            android.util.Log.d("AuthRepository", "Waiting 100ms for Firestore sync")
            kotlinx.coroutines.delay(100)

            android.util.Log.d("AuthRepository", "Querying Firestore for user document")
            val doc = usersCollection.document(uid).get().await()

            if (doc.exists()) {
                android.util.Log.d("AuthRepository", "User document EXISTS in Firestore")
                var user = doc.toObject(User::class.java)
                    ?: return Result.failure(Exception("Erro ao converter usuario"))

                android.util.Log.d("AuthRepository", "User loaded successfully")

                // Verifica se a foto do Google mudou e atualiza
                val firebaseUser = auth.currentUser
                val googlePhotoUrl = firebaseUser?.photoUrl?.toString()

                if (googlePhotoUrl != null && googlePhotoUrl != user.photoUrl) {
                    android.util.Log.d("AuthRepository", "Updating photo URL")
                    usersCollection.document(uid).update("photo_url", googlePhotoUrl).await()
                    user = user.copy(photoUrl = googlePhotoUrl)
                }

                android.util.Log.d("AuthRepository", "=== getCurrentUser() SUCCESS ===")
                Result.success(user)
            } else {
                android.util.Log.d("AuthRepository", "User document DOES NOT EXIST - creating new user")
                // Criar usuario automaticamente se nao existir
                val firebaseUser = auth.currentUser
                    ?: return Result.failure(Exception("Usuario desconectado durante operacao"))
                val newUser = User(
                    id = uid,
                    email = firebaseUser.email.orEmpty(),
                    name = firebaseUser.displayName.orEmpty(),
                    photoUrl = firebaseUser.photoUrl?.toString()
                )
                android.util.Log.d("AuthRepository", "Creating new user document")
                usersCollection.document(uid).set(newUser).await()
                android.util.Log.d("AuthRepository", "=== getCurrentUser() SUCCESS (new user created) ===")
                Result.success(newUser)
            }
        } catch (e: Exception) {
            android.util.Log.e("AuthRepository", "=== getCurrentUser() EXCEPTION: ${e.message} ===", e)
            Result.failure(e)
        }
    }

    fun logout() {
        auth.signOut()
        FirebaseCrashlytics.getInstance().setUserId("")
    }
}
