package com.futebadosparcas.data.repository

import android.net.Uri
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.User
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UserRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val storage: FirebaseStorage
) {
    private val usersCollection = firestore.collection("users")

    suspend fun getCurrentUser(): Result<User> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            val doc = usersCollection.document(uid).get().await()

            if (doc.exists()) {
                val user = doc.toObject(User::class.java)
                    ?: return Result.failure(Exception("Erro ao converter usuario"))
                Result.success(user)
            } else {
                // Criar usuario no Firestore se nao existir
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

    suspend fun createOrUpdateUser(user: User): Result<User> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            usersCollection.document(uid).set(user, SetOptions.merge()).await()
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateProfile(
        name: String,
        nickname: String?,
        preferredFieldTypes: List<FieldType>,
        photoUri: Uri?,
        strikerRating: Double = 0.0,
        midRating: Double = 0.0,
        defenderRating: Double = 0.0,
        gkRating: Double = 0.0
    ): Result<User> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            var photoUrl: String? = null
            photoUri?.let {
                val storageRef = storage.reference.child("profile_images/$uid")
                val uploadTask = storageRef.putFile(it).await()
                photoUrl = uploadTask.storage.downloadUrl.await().toString()
            }

            val updates = mutableMapOf<String, Any>(
                "name" to name,
                "preferred_field_types" to (preferredFieldTypes.map { it.name } as Any),
                "nickname" to (nickname ?: "") as Any,
                "striker_rating" to strikerRating,
                "mid_rating" to midRating,
                "defender_rating" to defenderRating,
                "gk_rating" to gkRating
            )

            photoUrl?.let {
                updates["photo_url"] = it
            }

            usersCollection.document(uid).update(updates).await()

            // Retornar usuario atualizado
            getCurrentUser()
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateProfileVisibility(isSearchable: Boolean): Result<Unit> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            usersCollection.document(uid).update("is_searchable", isSearchable).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateFcmToken(token: String): Result<Unit> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            usersCollection.document(uid).update("fcm_token", token).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun searchUsers(query: String): Result<List<User>> {
        return try {
            val baseQuery = usersCollection
                .orderBy("name")

            val snapshot = if (query.isBlank()) {
                baseQuery.limit(50).get().await()
            } else {
                baseQuery
                    .startAt(query)
                    .endAt(query + "\uf8ff")
                    .limit(20)
                    .get()
                    .await()
            }

            val users = snapshot.documents.mapNotNull { it.toObject(User::class.java) }
                .filter { it.id != auth.currentUser?.uid }

            Result.success(users)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getUserById(userId: String): Result<User> {
        return try {
            val doc = usersCollection.document(userId).get().await()

            if (doc.exists()) {
                val user = doc.toObject(User::class.java)
                    ?: return Result.failure(Exception("Erro ao converter usuario"))
                Result.success(user)
            } else {
                Result.failure(Exception("Usuario nao encontrado"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getUsersByIds(userIds: List<String>): Result<List<User>> {
        return try {
            if (userIds.isEmpty()) {
                return Result.success(emptyList())
            }

            val snapshot = usersCollection.whereIn(com.google.firebase.firestore.FieldPath.documentId(), userIds).get().await()
            val users = snapshot.toObjects(User::class.java)
            Result.success(users)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getAllUsers(): Result<List<User>> {
        return try {
            val snapshot = usersCollection.orderBy("name").get().await()
            val users = snapshot.toObjects(User::class.java)
            Result.success(users)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateUserRole(userId: String, newRole: String): Result<Unit> {
        return try {
            usersCollection.document(userId).update("role", newRole).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateUserRatings(
        userId: String,
        strikerRating: Double,
        midRating: Double,
        defenderRating: Double,
        gkRating: Double
    ): Result<Unit> {
        return try {
            val updates = mapOf(
                "striker_rating" to strikerRating,
                "mid_rating" to midRating,
                "defender_rating" to defenderRating,
                "gk_rating" to gkRating
            )
            usersCollection.document(userId).update(updates).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun isLoggedIn(): Boolean = auth.currentUser != null

    fun getCurrentUserId(): String? = auth.currentUser?.uid

    fun logout() {
        auth.signOut()
    }
}
