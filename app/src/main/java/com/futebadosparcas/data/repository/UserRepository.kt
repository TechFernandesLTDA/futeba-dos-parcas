package com.futebadosparcas.data.repository

import android.net.Uri
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.User
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Resultado paginado de usuarios.
 * @param users Lista de usuarios da pagina atual
 * @param nextCursor Cursor para buscar proxima pagina (null se nao houver mais)
 * @param hasNextPage Indica se existe proxima pagina
 */
data class PaginatedUsers(
    val users: List<User>,
    val nextCursor: String?,
    val hasNextPage: Boolean
)

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
        gkRating: Double = 0.0,
        birthDate: java.util.Date?,
        gender: String?,
        heightCm: Int?,
        weightKg: Int?,
        dominantFoot: String?,
        primaryPosition: String?,
        secondaryPosition: String?,
        playStyle: String?,
        experienceYears: Int?
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

            updates["birth_date"] = birthDate ?: FieldValue.delete()
            updates["gender"] = gender ?: FieldValue.delete()
            updates["height_cm"] = heightCm ?: FieldValue.delete()
            updates["weight_kg"] = weightKg ?: FieldValue.delete()
            updates["dominant_foot"] = dominantFoot ?: FieldValue.delete()
            updates["primary_position"] = primaryPosition ?: FieldValue.delete()
            updates["secondary_position"] = secondaryPosition ?: FieldValue.delete()
            updates["play_style"] = playStyle ?: FieldValue.delete()
            updates["experience_years"] = experienceYears ?: FieldValue.delete()

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

    suspend fun updateAutoRatings(
        autoStrikerRating: Double,
        autoMidRating: Double,
        autoDefenderRating: Double,
        autoGkRating: Double,
        autoRatingSamples: Int
    ): Result<Unit> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            val updates = mapOf(
                "auto_striker_rating" to autoStrikerRating,
                "auto_mid_rating" to autoMidRating,
                "auto_defender_rating" to autoDefenderRating,
                "auto_gk_rating" to autoGkRating,
                "auto_rating_samples" to autoRatingSamples,
                "auto_rating_updated_at" to FieldValue.serverTimestamp()
            )

            usersCollection.document(uid).update(updates).await()
            Result.success(Unit)
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

            // Firestore 'in' query supports max 10 values
            val chunks = userIds.chunked(10)
            val allUsers = mutableListOf<User>()

            // Process chunks in parallel or sequence? Sequence is safer for now.
            for (chunk in chunks) {
                val snapshot = usersCollection.whereIn(com.google.firebase.firestore.FieldPath.documentId(), chunk).get().await()
                allUsers.addAll(snapshot.toObjects(User::class.java))
            }
            
            Result.success(allUsers)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca todos os usuarios com paginacao.
     *
     * OTIMIZACAO: Implementa paginacao com cursor para evitar carregar todos os usuarios
     * de uma vez, o que pode ser lento e consumir muita memoria em bases grandes.
     *
     * @param limit Numero maximo de usuarios por pagina (padrao: 50)
     * @param lastUserName Nome do ultimo usuario da pagina anterior (cursor para proxima pagina)
     * @return Result contendo PaginatedUsers com lista de usuarios e cursor para proxima pagina
     */
    suspend fun getAllUsers(
        limit: Int = 50,
        lastUserName: String? = null
    ): Result<PaginatedUsers> {
        return try {
            var query = usersCollection
                .orderBy("name")
                .limit(limit.toLong() + 1) // Busca 1 a mais para saber se tem proxima pagina

            // Se temos um cursor, comecar a partir dele
            if (lastUserName != null) {
                query = query.startAfter(lastUserName)
            }

            val snapshot = query.get().await()
            val allUsers = snapshot.toObjects(User::class.java)

            // Verificar se tem proxima pagina
            val hasNextPage = allUsers.size > limit
            val users = if (hasNextPage) allUsers.dropLast(1) else allUsers
            val nextCursor = if (hasNextPage && users.isNotEmpty()) users.last().name else null

            Result.success(PaginatedUsers(
                users = users,
                nextCursor = nextCursor,
                hasNextPage = hasNextPage
            ))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca todos os usuarios sem paginacao (uso interno/legado).
     * @deprecated Preferir getAllUsers(limit, cursor) para melhor performance.
     */
    @Deprecated("Use getAllUsers(limit, cursor) para paginacao", ReplaceWith("getAllUsers(limit = 50)"))
    suspend fun getAllUsersUnpaginated(): Result<List<User>> {
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

    /**
     * Busca todos os usuários que são donos de quadra (FIELD_OWNER)
     * Usado para selecionar o dono ao criar/editar um local
     */
    suspend fun getFieldOwners(): Result<List<User>> {
        return try {
            val snapshot = usersCollection
                .whereEqualTo("role", "FIELD_OWNER")
                .orderBy("name")
                .get()
                .await()
            val fieldOwners = snapshot.toObjects(User::class.java)
            Result.success(fieldOwners)
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
