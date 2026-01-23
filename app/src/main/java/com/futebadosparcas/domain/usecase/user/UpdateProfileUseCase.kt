package com.futebadosparcas.domain.usecase.user

import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.User
import com.futebadosparcas.domain.usecase.SuspendUseCase
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

/**
 * Update Profile Use Case
 *
 * Atualiza o perfil do usuário com novas informações.
 *
 * Responsabilidades:
 * - Validar dados do perfil antes de atualizar
 * - Atualizar documento do usuário no Firestore
 * - Garantir consistência de dados
 * - Retornar o usuário atualizado
 *
 * Uso:
 * ```kotlin
 * val result = updateProfileUseCase(UpdateProfileParams(
 *     userId = "user-123",
 *     name = "João Silva",
 *     photoUrl = "https://...",
 *     nickname = "João"
 * ))
 * ```
 */
class UpdateProfileUseCase @Inject constructor(
    private val firestore: FirebaseFirestore
) : SuspendUseCase<UpdateProfileParams, User>() {

    companion object {
        private const val TAG = "UpdateProfileUseCase"
        private const val NAME_MIN_LENGTH = 3
        private const val NAME_MAX_LENGTH = 100
        private const val NICKNAME_MAX_LENGTH = 50
        private const val PHONE_MAX_LENGTH = 20
    }

    override suspend fun execute(params: UpdateProfileParams): User {
        AppLogger.d(TAG) { "Atualizando perfil do usuário: userId=${params.userId}" }

        // Validar parâmetros
        validateParams(params)

        // Construir mapa de atualizações
        val updates = mutableMapOf<String, Any?>()

        params.name?.let { updates["name"] = it.trim() }
        params.photoUrl?.let { updates["photo_url"] = it.trim() }
        params.nickname?.let { updates["nickname"] = it.trim() }
        params.phone?.let { updates["phone"] = it.trim() }
        params.isProfilePublic?.let { updates["is_profile_public"] = it }
        params.isSearchable?.let { updates["is_searchable"] = it }
        params.preferredFieldTypes?.let { updates["preferred_field_types"] = it.map { type -> type.name } }
        params.birthDate?.let { updates["birth_date"] = it }
        params.gender?.let { updates["gender"] = it }
        params.heightCm?.let { updates["height_cm"] = it }
        params.weightKg?.let { updates["weight_kg"] = it }
        params.dominantFoot?.let { updates["dominant_foot"] = it }
        params.primaryPosition?.let { updates["primary_position"] = it }
        params.secondaryPosition?.let { updates["secondary_position"] = it }
        params.playStyle?.let { updates["play_style"] = it }
        params.experienceYears?.let { updates["experience_years"] = it }

        // Se não houver atualizações, apenas retornar o usuário atual
        if (updates.isEmpty()) {
            val userSnapshot = firestore.collection("users")
                .document(params.userId)
                .get()
                .await()
            return userSnapshot.toObject(User::class.java)
                ?: throw IllegalStateException("Usuário não encontrado: ${params.userId}")
        }

        // Adicionar timestamp de atualização
        updates["updated_at"] = com.google.firebase.firestore.FieldValue.serverTimestamp()

        // Atualizar no Firestore
        firestore.collection("users")
            .document(params.userId)
            .update(updates.filterValues { it != null } as Map<String, Any>)
            .await()

        // Buscar usuário atualizado
        val updatedSnapshot = firestore.collection("users")
            .document(params.userId)
            .get()
            .await()

        val updatedUser = updatedSnapshot.toObject(User::class.java)
            ?: throw IllegalStateException("Erro ao recuperar usuário atualizado")

        AppLogger.d(TAG) { "Perfil atualizado com sucesso: userId=${params.userId}" }

        return updatedUser
    }

    private fun validateParams(params: UpdateProfileParams) {
        require(params.userId.isNotBlank()) { "ID do usuário é obrigatório" }

        params.name?.let { name ->
            val trimmedName = name.trim()
            require(trimmedName.length >= NAME_MIN_LENGTH) {
                "Nome deve ter pelo menos $NAME_MIN_LENGTH caracteres"
            }
            require(trimmedName.length <= NAME_MAX_LENGTH) {
                "Nome deve ter no máximo $NAME_MAX_LENGTH caracteres"
            }
        }

        params.nickname?.let { nickname ->
            require(nickname.trim().length <= NICKNAME_MAX_LENGTH) {
                "Apelido deve ter no máximo $NICKNAME_MAX_LENGTH caracteres"
            }
        }

        params.phone?.let { phone ->
            require(phone.trim().length <= PHONE_MAX_LENGTH) {
                "Telefone deve ter no máximo $PHONE_MAX_LENGTH caracteres"
            }
        }

        params.heightCm?.let { height ->
            require(height in 100..250) { "Altura deve estar entre 100cm e 250cm" }
        }

        params.weightKg?.let { weight ->
            require(weight in 20..200) { "Peso deve estar entre 20kg e 200kg" }
        }

        params.experienceYears?.let { years ->
            require(years >= 0) { "Anos de experiência não podem ser negativos" }
        }
    }
}

/**
 * Parâmetros para atualizar perfil do usuário
 */
data class UpdateProfileParams(
    val userId: String,
    val name: String? = null,
    val photoUrl: String? = null,
    val nickname: String? = null,
    val phone: String? = null,
    val isProfilePublic: Boolean? = null,
    val isSearchable: Boolean? = null,
    val preferredFieldTypes: List<FieldType>? = null,
    val birthDate: java.util.Date? = null,
    val gender: String? = null,
    val heightCm: Int? = null,
    val weightKg: Int? = null,
    val dominantFoot: String? = null,
    val primaryPosition: String? = null,
    val secondaryPosition: String? = null,
    val playStyle: String? = null,
    val experienceYears: Int? = null
)
