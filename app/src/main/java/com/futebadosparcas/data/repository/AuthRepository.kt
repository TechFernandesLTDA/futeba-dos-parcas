package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.User
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.crashlytics.FirebaseCrashlytics
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) {
    companion object {
        private const val TAG = "AuthRepository"
    }

    private val usersCollection = firestore.collection("users")

    // Escopo singleton para manter o stateIn ativo durante ciclo da app
    private val authScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    // Flow raw para listeners de autenticação
    private val rawAuthStateFlow: Flow<FirebaseUser?> = callbackFlow {
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

    /**
     * Estado de autenticação compartilhado com stateIn().
     * Benefícios:
     * - Evita reexecução de listeners ao subscrever múltiplas vezes
     * - Mantém último valor sem subscrição ativa
     * - WhileSubscribed(5000) permite resubscription automática eficiente
     */
    val authStateFlow: StateFlow<FirebaseUser?> = rawAuthStateFlow
        .stateIn(
            scope = authScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = auth.currentUser
        )

    fun isLoggedIn(): Boolean = auth.currentUser != null

    fun getCurrentFirebaseUser(): FirebaseUser? = auth.currentUser

    fun getCurrentUserId(): String? = auth.currentUser?.uid

    suspend fun getCurrentUser(): Result<User> {
        AppLogger.d(TAG) { "=== getCurrentUser() START ===" }
        return try {
            // Retry em IO para não bloquear a Main thread e causar frame drops
            val uid = withContext(Dispatchers.IO) {
                var result: String? = null
                var retries = 0
                val maxRetries = 5
                val baseDelay = 200L

                AppLogger.d(TAG) { "Starting retry loop (max $maxRetries attempts)" }
                while (result == null && retries < maxRetries) {
                    result = auth.currentUser?.uid
                    AppLogger.d(TAG) { "Retry $retries: uid exists = ${result != null}" }
                    if (result == null) {
                        val delay = baseDelay * (retries + 1)
                        AppLogger.d(TAG) { "Waiting ${delay}ms before next retry" }
                        kotlinx.coroutines.delay(delay)
                        retries++
                    }
                }
                result
            }

            if (uid == null) {
                AppLogger.e(TAG, "FAILED: No UID after retries")
                return Result.failure(Exception("Usuario nao autenticado"))
            }

            AppLogger.d(TAG) { "SUCCESS: Got UID" }
            AppLogger.d(TAG) { "Waiting 100ms for Firestore sync" }
            kotlinx.coroutines.delay(100)

            AppLogger.d(TAG) { "Querying Firestore for user document" }
            val doc = usersCollection.document(uid).get().await()

            if (doc.exists()) {
                AppLogger.d(TAG) { "User document EXISTS in Firestore" }
                var user = doc.toObject(User::class.java)
                    ?: return Result.failure(Exception("Erro ao converter usuario"))

                AppLogger.d(TAG) { "User loaded successfully" }

                // Verifica se a foto do Google mudou e atualiza
                val firebaseUser = auth.currentUser
                val googlePhotoUrl = firebaseUser?.photoUrl?.toString()

                if (googlePhotoUrl != null && googlePhotoUrl != user.photoUrl) {
                    AppLogger.d(TAG) { "Updating photo URL" }
                    usersCollection.document(uid).update("photo_url", googlePhotoUrl).await()
                    user = user.copy(photoUrl = googlePhotoUrl)
                }

                AppLogger.d(TAG) { "=== getCurrentUser() SUCCESS ===" }
                Result.success(user)
            } else {
                AppLogger.d(TAG) { "User document DOES NOT EXIST - creating new user" }
                // Criar usuario automaticamente se nao existir
                val firebaseUser = auth.currentUser
                    ?: return Result.failure(Exception("Usuario desconectado durante operacao"))
                val newUser = User(
                    id = uid,
                    email = firebaseUser.email.orEmpty(),
                    name = firebaseUser.displayName.orEmpty(),
                    photoUrl = firebaseUser.photoUrl?.toString()
                )
                AppLogger.d(TAG) { "Creating new user document" }
                usersCollection.document(uid).set(newUser).await()
                AppLogger.d(TAG) { "=== getCurrentUser() SUCCESS (new user created) ===" }
                Result.success(newUser)
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "=== getCurrentUser() EXCEPTION: ${e.message} ===", e)
            Result.failure(e)
        }
    }

    fun logout() {
        auth.signOut()
        FirebaseCrashlytics.getInstance().setUserId("")
    }
}
