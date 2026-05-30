package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.User
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.UserProfileChangeRequest
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.crashlytics.FirebaseCrashlytics
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

class AuthRepository constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val functions: FirebaseFunctions
) {
    companion object {
        private const val TAG = "AuthRepository"
    }

    private val usersCollection = firestore.collection("users")

    // Escopo singleton para manter o stateIn ativo durante ciclo da app.
    // Cancelar via cancel() quando a app é destruída para evitar leak (#2282).
    private val authScopeJob = SupervisorJob()
    private val authScope = CoroutineScope(authScopeJob + Dispatchers.Main)

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

    private val _profileComplete = MutableStateFlow<Boolean?>(null)
    val profileComplete: StateFlow<Boolean?> = _profileComplete.asStateFlow()

    fun checkProfileComplete() {
        authScope.launch {
            val user = auth.currentUser
            if (user == null) {
                _profileComplete.value = false
                return@launch
            }
            try {
                val result = user.getIdToken(false).await()
                _profileComplete.value = result?.claims?.get("profileComplete") == true
            } catch (e: Exception) {
                AppLogger.e(TAG, "checkProfileComplete failed: ${e.message}", e)
                _profileComplete.value = null
            }
        }
    }

    suspend fun refreshProfileComplete() {
        val user = auth.currentUser
        if (user == null) {
            _profileComplete.value = false
            return
        }
        try {
            val result = user.getIdToken(true).await()
            _profileComplete.value = result?.claims?.get("profileComplete") == true
        } catch (e: Exception) {
            AppLogger.e(TAG, "refreshProfileComplete failed: ${e.message}", e)
            _profileComplete.value = null
        }
    }

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

    suspend fun createUserWithEmailAndPassword(email: String, password: String, name: String): Result<User> {
        return try {
            val result = auth.createUserWithEmailAndPassword(email, password).await()
            val profileUpdates = UserProfileChangeRequest.Builder()
                .setDisplayName(name)
                .build()
            result.user?.updateProfile(profileUpdates)?.await()
            getCurrentUser()
        } catch (e: Exception) {
            AppLogger.e(TAG, "createUserWithEmailAndPassword failed: ${e.message}", e)
            Result.failure(e)
        }
    }

    suspend fun signInWithEmailAndPassword(email: String, password: String): Result<User> {
        return try {
            auth.signInWithEmailAndPassword(email, password).await()
            getCurrentUser()
        } catch (e: Exception) {
            AppLogger.e(TAG, "signInWithEmailAndPassword failed: ${e.message}", e)
            Result.failure(e)
        }
    }

    suspend fun sendPasswordResetEmail(email: String): Result<Unit> {
        return try {
            auth.sendPasswordResetEmail(email).await()
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "sendPasswordResetEmail failed: ${e.message}", e)
            Result.failure(e)
        }
    }

    suspend fun deleteAccount(): Result<Unit> {
        return try {
            functions
                .getHttpsCallable("deleteAccount")
                .call()
                .await()
            auth.signOut()
            FirebaseCrashlytics.getInstance().setUserId("")
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "deleteAccount failed: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Cancela o escopo de coroutines do repositório.
     * Deve ser chamado quando a aplicação é destruída para liberar recursos (#2282).
     */
    fun cancel() {
        authScopeJob.cancel()
    }
}
