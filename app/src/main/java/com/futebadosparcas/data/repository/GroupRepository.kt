package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.GroupMemberStatus
import com.futebadosparcas.data.model.GroupStatus
import com.futebadosparcas.data.model.UserGroup
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.storage.FirebaseStorage
import android.net.Uri
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GroupRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val storage: FirebaseStorage
) {
    private val groupsCollection = firestore.collection("groups")
    private val usersCollection = firestore.collection("users")

    /**
     * Faz upload da foto do grupo
     */
    suspend fun uploadGroupPhoto(groupId: String, imageUri: Uri): Result<String> {
        return try {
            val filename = "group_photo_${System.currentTimeMillis()}.jpg"
            val ref = storage.reference.child("groups_photos/$groupId/$filename")
            
            ref.putFile(imageUri).await()
            val downloadUrl = ref.downloadUrl.await()
            
            Result.success(downloadUrl.toString())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Cria um novo grupo com o usuário atual como owner
     */
    suspend fun createGroup(name: String, description: String, photoUri: Uri? = null): Result<Group> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val userDoc = usersCollection.document(userId).get().await()
            val userName = userDoc.getString("name") ?: ""
            val userPhoto = userDoc.getString("photo_url")

            // Criar documento do grupo
            val groupRef = groupsCollection.document()
            val groupId = groupRef.id

            // Upload da foto se houver
            var photoUrl: String? = null
            photoUri?.let { uri ->
                val uploadResult = uploadGroupPhoto(groupId, uri)
                photoUrl = uploadResult.getOrNull()
            }

            val group = Group(
                id = groupId,
                name = name,
                description = description,
                ownerId = userId,
                ownerName = userName,
                photoUrl = photoUrl,
                memberCount = 1,
                status = GroupStatus.ACTIVE.name
            )

            // Transação para criar grupo e adicionar owner como membro
            firestore.runTransaction { transaction ->
                // 1. Criar grupo
                transaction.set(groupRef, group)

                // 2. Adicionar owner como membro
                val memberRef = groupRef.collection("members").document(userId)
                val member = GroupMember(
                    id = userId,
                    userId = userId,
                    userName = userName,
                    userPhoto = userPhoto,
                    role = GroupMemberRole.OWNER.name,
                    status = GroupMemberStatus.ACTIVE.name
                )
                transaction.set(memberRef, member)

                // 3. Adicionar referência no usuário
                val userGroupRef = usersCollection.document(userId)
                    .collection("groups").document(groupRef.id)
                val userGroup = UserGroup(
                    id = groupRef.id,
                    groupId = groupRef.id,
                    groupName = name,
                    groupPhoto = photoUrl,
                    role = GroupMemberRole.OWNER.name,
                    memberCount = 1
                )
                transaction.set(userGroupRef, userGroup)
            }.await()

            Result.success(group)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca todos os grupos do usuário atual
     */
    suspend fun getMyGroups(): Result<List<UserGroup>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = usersCollection.document(userId)
                .collection("groups")
                .orderBy("joined_at", Query.Direction.DESCENDING)
                .get()
                .await()

            val groups = snapshot.toObjects(UserGroup::class.java)
            Result.success(groups)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Observa os grupos do usuário atual em tempo real
     */
    fun getMyGroupsFlow(): Flow<List<UserGroup>> = callbackFlow {
        val userId = auth.currentUser?.uid ?: run {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val listener = usersCollection.document(userId)
            .collection("groups")
            .orderBy("joined_at", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val groups = snapshot?.toObjects(UserGroup::class.java) ?: emptyList()
                trySend(groups)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Busca grupos válidos para criar jogos (>= 2 membros ativos)
     */
    suspend fun getValidGroupsForGame(): Result<List<UserGroup>> {
        return try {
            val result = getMyGroups()
            if (result.isFailure) {
                return result
            }

            val validGroups = result.getOrDefault(emptyList())
                .filter { it.memberCount >= 2 && it.isAdmin() }

            Result.success(validGroups)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca detalhes de um grupo
     */
    suspend fun getGroupById(groupId: String): Result<Group> {
        return try {
            val doc = groupsCollection.document(groupId).get().await()

            if (doc.exists()) {
                val group = doc.toObject(Group::class.java)
                    ?: return Result.failure(Exception("Erro ao converter grupo"))
                Result.success(group)
            } else {
                Result.failure(Exception("Grupo não encontrado"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Observa detalhes de um grupo em tempo real
     */
    fun getGroupFlow(groupId: String): Flow<Result<Group>> = callbackFlow {
        val listener = groupsCollection.document(groupId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    val group = snapshot.toObject(Group::class.java)
                    if (group != null) {
                        trySend(Result.success(group))
                    } else {
                        trySend(Result.failure(Exception("Erro ao converter grupo")))
                    }
                } else {
                    trySend(Result.failure(Exception("Grupo não encontrado")))
                }
            }

        awaitClose { listener.remove() }
    }

    /**
     * Busca membros de um grupo
     */
    suspend fun getGroupMembers(groupId: String): Result<List<GroupMember>> {
        return try {
            val snapshot = groupsCollection.document(groupId)
                .collection("members")
                .whereEqualTo("status", GroupMemberStatus.ACTIVE.name)
                .orderBy("joined_at", Query.Direction.ASCENDING)
                .get()
                .await()

            val members = snapshot.toObjects(GroupMember::class.java)
            Result.success(members)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Observa membros de um grupo em tempo real
     */
    fun getGroupMembersFlow(groupId: String): Flow<List<GroupMember>> = callbackFlow {
        val listener = groupsCollection.document(groupId)
            .collection("members")
            .whereEqualTo("status", GroupMemberStatus.ACTIVE.name)
            .orderBy("joined_at", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val members = snapshot?.toObjects(GroupMember::class.java) ?: emptyList()
                trySend(members)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Busca o papel do usuário atual em um grupo
     */
    suspend fun getMyRoleInGroup(groupId: String): Result<GroupMemberRole?> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val memberDoc = groupsCollection.document(groupId)
                .collection("members")
                .document(userId)
                .get()
                .await()

            if (memberDoc.exists()) {
                val member = memberDoc.toObject(GroupMember::class.java)
                Result.success(member?.getRoleEnum())
            } else {
                Result.success(null)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Verifica se o usuário é membro ativo de um grupo
     */
    suspend fun isMemberOfGroup(groupId: String): Result<Boolean> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val memberDoc = groupsCollection.document(groupId)
                .collection("members")
                .document(userId)
                .get()
                .await()

            if (memberDoc.exists()) {
                val status = memberDoc.getString("status")
                Result.success(status == GroupMemberStatus.ACTIVE.name)
            } else {
                Result.success(false)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Atualiza nome e descrição do grupo
     */
    suspend fun updateGroup(
        groupId: String,
        name: String,
        description: String,
        photoUri: Uri? = null
    ): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se é admin/owner
            val roleResult = getMyRoleInGroup(groupId)
            if (roleResult.isFailure) return Result.failure(roleResult.exceptionOrNull()!!)
            
            val role = roleResult.getOrNull()
            if (role != GroupMemberRole.OWNER && role != GroupMemberRole.ADMIN) {
                return Result.failure(Exception("Apenas o dono ou administradores podem editar o grupo"))
            }

            // Upload da foto se houver
            var photoUrl: String? = null
            photoUri?.let { uri ->
                val uploadResult = uploadGroupPhoto(groupId, uri)
                photoUrl = uploadResult.getOrNull()
            }

            // Atualizar grupo
            val updates = mutableMapOf<String, Any>(
                "name" to name,
                "description" to description,
                "updated_at" to FieldValue.serverTimestamp()
            )
            if (photoUrl != null) {
                updates["photo_url"] = photoUrl
            }

            groupsCollection.document(groupId).update(updates).await()

            // Atualizar referência em todos os membros (denormalização)
            // Buscar todos os membros ativos para atualizar o UserGroup deles
            val members = groupsCollection.document(groupId)
                .collection("members")
                .get()
                .await()

            val batch = firestore.batch()
            members.documents.forEach { memberDoc ->
                val memberId = memberDoc.getString("user_id") ?: return@forEach
                val userGroupRef = usersCollection.document(memberId)
                    .collection("groups").document(groupId)
                
                val groupUpdates = mutableMapOf<String, Any>(
                    "group_name" to name
                )
                if (photoUrl != null) {
                    groupUpdates["group_photo"] = photoUrl
                }
                batch.update(userGroupRef, groupUpdates)
            }
            batch.commit().await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Promove um membro a admin
     */
    suspend fun promoteMemberToAdmin(groupId: String, memberId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se é owner
            val roleResult = getMyRoleInGroup(groupId)
            if (roleResult.isFailure) return Result.failure(roleResult.exceptionOrNull()!!)

            if (roleResult.getOrNull() != GroupMemberRole.OWNER) {
                return Result.failure(Exception("Apenas o dono pode promover administradores"))
            }

            // Atualizar papel do membro
            firestore.runTransaction { transaction ->
                val memberRef = groupsCollection.document(groupId)
                    .collection("members").document(memberId)
                transaction.update(memberRef, "role", GroupMemberRole.ADMIN.name)

                val userGroupRef = usersCollection.document(memberId)
                    .collection("groups").document(groupId)
                transaction.update(userGroupRef, "role", GroupMemberRole.ADMIN.name)
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Rebaixa um admin a membro
     */
    suspend fun demoteAdminToMember(groupId: String, memberId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se é owner
            val roleResult = getMyRoleInGroup(groupId)
            if (roleResult.isFailure) return Result.failure(roleResult.exceptionOrNull()!!)

            if (roleResult.getOrNull() != GroupMemberRole.OWNER) {
                return Result.failure(Exception("Apenas o dono pode rebaixar administradores"))
            }

            // Atualizar papel do membro
            firestore.runTransaction { transaction ->
                val memberRef = groupsCollection.document(groupId)
                    .collection("members").document(memberId)
                transaction.update(memberRef, "role", GroupMemberRole.MEMBER.name)

                val userGroupRef = usersCollection.document(memberId)
                    .collection("groups").document(groupId)
                transaction.update(userGroupRef, "role", GroupMemberRole.MEMBER.name)
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Remove um membro do grupo
     */
    suspend fun removeMember(groupId: String, memberId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar permissão
            val roleResult = getMyRoleInGroup(groupId)
            if (roleResult.isFailure) return Result.failure(roleResult.exceptionOrNull()!!)

            val role = roleResult.getOrNull()
            if (role != GroupMemberRole.OWNER && role != GroupMemberRole.ADMIN) {
                return Result.failure(Exception("Sem permissão para remover membros"))
            }

            // Verificar se o membro a ser removido não é owner
            val targetMemberDoc = groupsCollection.document(groupId)
                .collection("members").document(memberId).get().await()
            val targetRole = targetMemberDoc.getString("role")
            if (targetRole == GroupMemberRole.OWNER.name) {
                return Result.failure(Exception("Não é possível remover o dono do grupo"))
            }

            // Admin não pode remover outro admin
            if (role == GroupMemberRole.ADMIN && targetRole == GroupMemberRole.ADMIN.name) {
                return Result.failure(Exception("Administrador não pode remover outro administrador"))
            }

            // Buscar membros ativos para atualizar member_count em todos
            val activeMembers = groupsCollection.document(groupId)
                .collection("members")
                .whereEqualTo("status", GroupMemberStatus.ACTIVE.name)
                .get()
                .await()

            val remainingMemberIds = activeMembers.documents
                .mapNotNull { it.getString("user_id") }
                .filter { it != memberId }

            val newMemberCount = remainingMemberIds.size

            // Remover membro e atualizar contagem em todos os UserGroups
            firestore.runTransaction { transaction ->
                val memberRef = groupsCollection.document(groupId)
                    .collection("members").document(memberId)
                transaction.update(memberRef, "status", GroupMemberStatus.REMOVED.name)

                val groupRef = groupsCollection.document(groupId)
                transaction.update(groupRef, "member_count", newMemberCount)

                // Remover referência do membro removido
                val userGroupRef = usersCollection.document(memberId)
                    .collection("groups").document(groupId)
                transaction.delete(userGroupRef)

                // Atualizar member_count em todos os membros restantes
                remainingMemberIds.forEach { remainingMemberId ->
                    val remainingUserGroupRef = usersCollection.document(remainingMemberId)
                        .collection("groups").document(groupId)
                    transaction.update(remainingUserGroupRef, "member_count", newMemberCount)
                }
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Sair do grupo voluntariamente
     */
    suspend fun leaveGroup(groupId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se não é owner
            val roleResult = getMyRoleInGroup(groupId)
            if (roleResult.isFailure) return Result.failure(roleResult.exceptionOrNull()!!)

            if (roleResult.getOrNull() == GroupMemberRole.OWNER) {
                return Result.failure(Exception("O dono não pode sair do grupo. Transfira a propriedade primeiro."))
            }

            // Sair do grupo - apenas atualiza o próprio documento e o grupo principal
            // A sincronização do member_count nos outros membros será feita via syncGroupMemberCount
            // quando eles abrirem a tela de grupos (evita erro de permissão do Firestore)
            firestore.runTransaction { transaction ->
                val memberRef = groupsCollection.document(groupId)
                    .collection("members").document(userId)
                transaction.update(memberRef, "status", GroupMemberStatus.INACTIVE.name)

                val groupRef = groupsCollection.document(groupId)
                transaction.update(groupRef, "member_count", FieldValue.increment(-1))

                // Remover referência do usuário que está saindo
                val userGroupRef = usersCollection.document(userId)
                    .collection("groups").document(groupId)
                transaction.delete(userGroupRef)
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Arquiva o grupo (apenas owner)
     */
    suspend fun archiveGroup(groupId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se é owner
            val roleResult = getMyRoleInGroup(groupId)
            if (roleResult.isFailure) return Result.failure(roleResult.exceptionOrNull()!!)

            if (roleResult.getOrNull() != GroupMemberRole.OWNER) {
                return Result.failure(Exception("Apenas o dono pode arquivar o grupo"))
            }

            // Arquivar grupo
            val updates = mapOf(
                "status" to GroupStatus.ARCHIVED.name,
                "updated_at" to FieldValue.serverTimestamp()
            )
            groupsCollection.document(groupId).update(updates).await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Deleta o grupo (soft delete - apenas owner)
     */
    suspend fun deleteGroup(groupId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se é owner
            val roleResult = getMyRoleInGroup(groupId)
            if (roleResult.isFailure) return Result.failure(roleResult.exceptionOrNull()!!)

            if (roleResult.getOrNull() != GroupMemberRole.OWNER) {
                return Result.failure(Exception("Apenas o dono pode deletar o grupo"))
            }

            // Soft delete do grupo
            val updates = mapOf(
                "status" to GroupStatus.DELETED.name,
                "updated_at" to FieldValue.serverTimestamp()
            )
            groupsCollection.document(groupId).update(updates).await()

            // Remover referências de todos os membros
            val members = groupsCollection.document(groupId)
                .collection("members")
                .get()
                .await()

            val batch = firestore.batch()
            members.documents.forEach { memberDoc ->
                val memberId = memberDoc.getString("user_id") ?: return@forEach
                val userGroupRef = usersCollection.document(memberId)
                    .collection("groups").document(groupId)
                batch.delete(userGroupRef)
            }
            batch.commit().await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Verifica se o usuário pode criar jogos (tem grupo válido)
     */
    suspend fun canCreateGames(): Result<Boolean> {
        return try {
            val validGroups = getValidGroupsForGame()
            if (validGroups.isFailure) {
                return Result.failure(validGroups.exceptionOrNull()!!)
            }
            Result.success(validGroups.getOrDefault(emptyList()).isNotEmpty())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Conta quantos grupos o usuário possui onde é admin
     */
    suspend fun countMyAdminGroups(): Result<Int> {
        return try {
            val groups = getMyGroups()
            if (groups.isFailure) {
                return Result.failure(groups.exceptionOrNull()!!)
            }
            val adminCount = groups.getOrDefault(emptyList())
                .count { it.isAdmin() }
            Result.success(adminCount)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Transfere a propriedade do grupo para outro membro
     */
    suspend fun transferOwnership(groupId: String, newOwnerId: String): Result<Unit> {
        return try {
            val currentUserId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se é owner atual
            val roleResult = getMyRoleInGroup(groupId)
            if (roleResult.isFailure) return Result.failure(roleResult.exceptionOrNull()!!)

            if (roleResult.getOrNull() != GroupMemberRole.OWNER) {
                return Result.failure(Exception("Apenas o dono pode transferir a propriedade"))
            }

            // Verificar se o novo owner é membro ativo
            val newOwnerDoc = groupsCollection.document(groupId)
                .collection("members").document(newOwnerId).get().await()

            if (!newOwnerDoc.exists()) {
                return Result.failure(Exception("Membro não encontrado"))
            }

            val newOwnerStatus = newOwnerDoc.getString("status")
            if (newOwnerStatus != GroupMemberStatus.ACTIVE.name) {
                return Result.failure(Exception("O membro precisa estar ativo"))
            }

            // Buscar dados do novo owner
            val newOwnerUserDoc = usersCollection.document(newOwnerId).get().await()
            val newOwnerName = newOwnerUserDoc.getString("name") ?: ""

            // Transferir propriedade em transação
            firestore.runTransaction { transaction ->
                // 1. Atualizar grupo com novo owner
                val groupRef = groupsCollection.document(groupId)
                transaction.update(groupRef, mapOf(
                    "owner_id" to newOwnerId,
                    "owner_name" to newOwnerName,
                    "updated_at" to FieldValue.serverTimestamp()
                ))

                // 2. Atualizar membro antigo owner para ADMIN
                val oldOwnerMemberRef = groupsCollection.document(groupId)
                    .collection("members").document(currentUserId)
                transaction.update(oldOwnerMemberRef, "role", GroupMemberRole.ADMIN.name)

                // 3. Atualizar novo membro para OWNER
                val newOwnerMemberRef = groupsCollection.document(groupId)
                    .collection("members").document(newOwnerId)
                transaction.update(newOwnerMemberRef, "role", GroupMemberRole.OWNER.name)

                // 4. Atualizar referência do usuário antigo
                val oldOwnerGroupRef = usersCollection.document(currentUserId)
                    .collection("groups").document(groupId)
                transaction.update(oldOwnerGroupRef, "role", GroupMemberRole.ADMIN.name)

                // 5. Atualizar referência do novo owner
                val newOwnerGroupRef = usersCollection.document(newOwnerId)
                    .collection("groups").document(groupId)
                transaction.update(newOwnerGroupRef, "role", GroupMemberRole.OWNER.name)
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Observa membros ordenados por papel (Owner > Admin > Member)
     */
    fun getOrderedGroupMembersFlow(groupId: String): Flow<List<GroupMember>> = callbackFlow {
        val listener = groupsCollection.document(groupId)
            .collection("members")
            .whereEqualTo("status", GroupMemberStatus.ACTIVE.name)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val members = snapshot?.toObjects(GroupMember::class.java) ?: emptyList()
                // Ordenar por role e depois por nome
                val sortedMembers = members.sortedWith(
                    compareBy<GroupMember> { member ->
                        when (member.getRoleEnum()) {
                            GroupMemberRole.OWNER -> 0
                            GroupMemberRole.ADMIN -> 1
                            GroupMemberRole.MEMBER -> 2
                        }
                    }.thenBy { it.userName.lowercase() }
                )
                trySend(sortedMembers)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Restaura um grupo arquivado
     */
    suspend fun restoreGroup(groupId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se é owner
            val roleResult = getMyRoleInGroup(groupId)
            if (roleResult.isFailure) return Result.failure(roleResult.exceptionOrNull()!!)

            if (roleResult.getOrNull() != GroupMemberRole.OWNER) {
                return Result.failure(Exception("Apenas o dono pode restaurar o grupo"))
            }

            // Restaurar grupo
            val updates = mapOf(
                "status" to GroupStatus.ACTIVE.name,
                "updated_at" to FieldValue.serverTimestamp()
            )
            groupsCollection.document(groupId).update(updates).await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Sincroniza o member_count de um grupo específico em todos os UserGroups
     * Útil para corrigir dados inconsistentes
     */
    suspend fun syncGroupMemberCount(groupId: String): Result<Unit> {
        return try {
            // Contar membros ativos
            val activeMembers = groupsCollection.document(groupId)
                .collection("members")
                .whereEqualTo("status", GroupMemberStatus.ACTIVE.name)
                .get()
                .await()

            val memberIds = activeMembers.documents.mapNotNull { it.getString("user_id") }
            val correctMemberCount = memberIds.size

            // Atualizar grupo principal e todos os UserGroups
            val batch = firestore.batch()

            // Atualizar grupo principal
            val groupRef = groupsCollection.document(groupId)
            batch.update(groupRef, "member_count", correctMemberCount)

            // Atualizar em cada membro
            memberIds.forEach { memberId ->
                val userGroupRef = usersCollection.document(memberId)
                    .collection("groups").document(groupId)
                batch.update(userGroupRef, "member_count", correctMemberCount)
            }

            batch.commit().await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Sincroniza o member_count de todos os grupos do usuário atual
     */
    suspend fun syncAllMyGroupsMemberCount(): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Buscar todos os grupos do usuário
            val userGroups = usersCollection.document(userId)
                .collection("groups")
                .get()
                .await()

            // Sincronizar cada grupo
            userGroups.documents.forEach { doc ->
                val groupId = doc.getString("group_id") ?: doc.id
                syncGroupMemberCount(groupId)
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
