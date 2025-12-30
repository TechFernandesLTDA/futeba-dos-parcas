package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.User
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) {
    private val usersCollection = firestore.collection("users")

    fun isLoggedIn(): Boolean = auth.currentUser != null

    fun getCurrentFirebaseUser(): FirebaseUser? = auth.currentUser

    fun getCurrentUserId(): String? = auth.currentUser?.uid

    suspend fun getCurrentUser(): Result<User> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))

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
    }
}
