package com.futebadosparcas.data.repository

import com.futebadosparcas.data.datasource.GroupPhotoDataSource
import com.futebadosparcas.domain.model.Group
import com.futebadosparcas.domain.model.GroupInvite
import com.futebadosparcas.data.model.Group as PublicGroup
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.GroupMemberStatus
import com.futebadosparcas.data.model.GroupStatus
import com.futebadosparcas.data.model.UserGroup
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.Query
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import com.google.firebase.storage.FirebaseStorage
import android.net.Uri
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.async
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class GroupRepository constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val storage: FirebaseStorage,
    private val groupPhotoDataSource: GroupPhotoDataSource
) {
    companion object {
        private const val TAG = "GroupRepository"
    }

    private val groupsCollection = firestore.collection("groups")
    private val usersCollection = firestore.collection("users")

    /**
     * Faz upload da foto/logo do grupo com validação e compressão.
     *
     * Usa GroupPhotoDataSource que implementa:
     * - Validação de tamanho máximo (2MB)
     * - Validação de magic bytes (JPEG, PNG, WebP)
     * - Compressão adaptativa (90%/85%/75%)
     * - Redimensionamento para 600x600
     * - Geração de thumbnail (200x200)
     * - Metadados de upload
     *
     * Path padronizado: groups/{groupId}/logo.jpg + groups/{groupId}/thumb.jpg
     */
    suspend fun uploadGroupPhoto(groupId: String, imageUri: Uri): Result<String> {
        return try {
            AppLogger.d(TAG) { "Uploading group photo for group: $groupId" }

            when (val result = groupPhotoDataSource.uploadGroupPhoto(groupId, imageUri)) {
                is GroupPhotoDataSource.UploadResult.Success -> {
                    AppLogger.d(TAG) { "Group photo uploaded successfully: ${result.url}" }
                    Result.success(result.url)
                }
                is GroupPhotoDataSource.UploadResult.FileTooLarge -> {
                    AppLogger.w(TAG) { "Group photo too large (max 2MB)" }
                    Result.failure(Exception("Imagem muito grande. O tamanho máximo é 2MB."))
                }
                is GroupPhotoDataSource.UploadResult.InvalidImage -> {
                    AppLogger.w(TAG) { "Invalid image file" }
                    Result.failure(Exception("Arquivo inválido. Selecione uma imagem JPEG, PNG ou WebP."))
                }
                is GroupPhotoDataSource.UploadResult.Error -> {
                    AppLogger.e(TAG, "Error uploading group photo: ${result.message}")
                    Result.failure(Exception(result.message))
                }
                is GroupPhotoDataSource.UploadResult.Progress -> {
                    // Progresso não deveria ser retornado na versão simplificada
                    Result.failure(Exception("Erro inesperado no upload"))
                }
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Exception uploading group photo", e)
            Result.failure(e)
        }
    }

    /**
     * Cria um novo grupo com o usuário atual como owner
     */
    suspend fun createGroup(name: String, description: String, photoUri: String? = null): Result<Group> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val userDoc = usersCollection.document(userId).get().await()
            val userName = userDoc.getString("name") ?: ""
            val userPhoto = userDoc.getString("photo_url")

            // Criar documento do grupo
            val groupRef = groupsCollection.document()
            val groupId = groupRef.id

            val group = Group(
                id = groupId,
                name = name,
                description = description,
                ownerId = userId,
                ownerName = userName,
                photoUrl = null,
                membersCount = 1
            )

            // 1. Transação para criar grupo e adicionar owner como membro (sem foto)
            firestore.runTransaction { transaction ->
                // Criar grupo
                transaction.set(groupRef, group)

                // Adicionar owner como membro
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

                // Adicionar referência no usuário
                val userGroupRef = usersCollection.document(userId)
                    .collection("groups").document(groupRef.id)
                val userGroup = UserGroup(
                    id = groupRef.id,
                    groupId = groupRef.id,
                    groupName = name,
                    groupPhoto = null,
                    role = GroupMemberRole.OWNER.name,
                    memberCount = 1,
                    groupStatus = GroupStatus.ACTIVE.name
                )
                transaction.set(userGroupRef, userGroup)
            }.await()

            // 2. Upload da foto depois que o grupo já existe no Firestore
            if (photoUri != null) {
                val uri = Uri.parse(photoUri)
                val uploadResult = uploadGroupPhoto(groupId, uri)
                uploadResult.fold(
                    onSuccess = { url ->
                        groupsCollection.document(groupId)
                            .update("photo_url", url).await()
                        usersCollection.document(userId)
                            .collection("groups").document(groupId)
                            .update("group_photo", url).await()
                    },
                    onFailure = {
                        AppLogger.w(TAG) { "Foto não subiu, grupo criado sem foto: ${it.message}" }
                    }
                )
            }

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
                .filter { it.groupStatus == GroupStatus.ACTIVE.name }
            Result.success(groups)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Observa os grupos do usuário atual em tempo real
     */
    fun getMyGroupsFlow(): Flow<List<UserGroup>> = callbackFlow {
        var firestoreListener: com.google.firebase.firestore.ListenerRegistration? = null

        val authListener = FirebaseAuth.AuthStateListener { firebaseAuth ->
            firestoreListener?.remove()
            firestoreListener = null

            val uid = firebaseAuth.currentUser?.uid
            if (uid == null) {
                trySend(emptyList())
            } else {
                firestoreListener = usersCollection.document(uid)
                    .collection("groups")
                    .orderBy("joined_at", Query.Direction.DESCENDING)
                    .addSnapshotListener { snapshot, error ->
                        if (error != null) {
                            close(error)
                            return@addSnapshotListener
                        }
                        val groups = snapshot?.toObjects(UserGroup::class.java)
                            ?.filter { it.groupStatus == GroupStatus.ACTIVE.name }
                            ?: emptyList()
                        trySend(groups)
                    }
            }
        }

        auth.addAuthStateListener(authListener)

        awaitClose {
            auth.removeAuthStateListener(authListener)
            firestoreListener?.remove()
        }
    }

    /**
     * Observa grupos publicos para descoberta (issue #517 Phase 1.b).
     *
     * Query: groups where is_public == true.
     * Filtra deleted_at == null no cliente (volume baixo de grupos publicos
     * dispensa composite index).
     *
     * Resultado e ordenado por member_count desc no cliente.
     */
    fun getPublicGroupsFlow(): Flow<Result<List<PublicGroup>>> = callbackFlow {
        val listener = groupsCollection
            .whereEqualTo("is_public", true)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                val groups = snapshot?.toObjects(PublicGroup::class.java)
                    ?.filter { it.deletedAt == null }
                    ?.sortedByDescending { it.memberCount }
                    ?: emptyList()
                trySend(Result.success(groups))
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
        photoUri: String? = null
    ): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se é admin/owner
            val role = getMyRoleInGroup(groupId).getOrElse { return Result.failure(it) }
            if (role != GroupMemberRole.OWNER && role != GroupMemberRole.ADMIN) {
                return Result.failure(Exception("Apenas o dono ou administradores podem editar o grupo"))
            }

            // Upload da foto se houver
            var photoUrl: String? = null
            if (photoUri != null) {
                val uri = Uri.parse(photoUri)
                photoUrl = uploadGroupPhoto(groupId, uri)
                    .getOrElse { return Result.failure(it) }
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
            // Usa paginação com .limit() para evitar estouro de memória em grupos grandes
            val membersCollection = groupsCollection.document(groupId).collection("members")
            val pageSize = 500L
            var lastDoc: com.google.firebase.firestore.DocumentSnapshot? = null

            while (true) {
                var query: Query = membersCollection
                    .orderBy(FieldPath.documentId())
                    .limit(pageSize)
                if (lastDoc != null) {
                    query = query.startAfter(lastDoc)
                }

                val snap = query.get().await()
                if (snap.isEmpty) break

                // Processar em batches de 400 operações
                val batchSize = 400
                val docs = snap.documents

                for (i in docs.indices step batchSize) {
                    val batch = firestore.batch()
                    val chunk = docs.subList(i, minOf(i + batchSize, docs.size))

                    chunk.forEach { memberDoc ->
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
                }

                lastDoc = snap.documents.last()
                if (snap.size() < pageSize) break
            }

            Result.success(Unit)
        } catch (e: FirebaseFirestoreException) {
            if (e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
                Result.failure(Exception("Você não tem permissão para esta ação"))
            } else {
                Result.failure(e)
            }
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
            val role = getMyRoleInGroup(groupId).getOrElse { return Result.failure(it) }
            if (role != GroupMemberRole.OWNER) {
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
        } catch (e: FirebaseFirestoreException) {
            if (e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
                Result.failure(Exception("Você não tem permissão para esta ação"))
            } else {
                Result.failure(e)
            }
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
            val role = getMyRoleInGroup(groupId).getOrElse { return Result.failure(it) }
            if (role != GroupMemberRole.OWNER) {
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
        } catch (e: FirebaseFirestoreException) {
            if (e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
                Result.failure(Exception("Você não tem permissão para esta ação"))
            } else {
                Result.failure(e)
            }
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
            val role = getMyRoleInGroup(groupId).getOrElse { return Result.failure(it) }
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

            // FIX #611 / #626: member_count é SERVER-AUTHORITATIVE.
            // Cloud Function `onMemberWritten` detecta mudança de status ACTIVE→REMOVED
            // e aplica increment(-1) via admin SDK (bypassa rules).
            // Antes: client escrevia member_count direto, abrindo privilege escalation
            // (qualquer auth podia overwrite member_count em qualquer grupo).
            firestore.runTransaction { transaction ->
                val memberRef = groupsCollection.document(groupId)
                    .collection("members").document(memberId)
                transaction.update(memberRef, "status", GroupMemberStatus.REMOVED.name)

                // Remover referência do membro removido
                val userGroupRef = usersCollection.document(memberId)
                    .collection("groups").document(groupId)
                transaction.delete(userGroupRef)
            }.await()

            // Nota: member_count nos UserGroups dos outros membros ficará
            // temporariamente desatualizado. syncGroupMemberCount() corrige
            // quando necessário (abordagem eventual consistency).

            Result.success(Unit)
        } catch (e: FirebaseFirestoreException) {
            if (e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
                Result.failure(Exception("Você não tem permissão para esta ação"))
            } else {
                Result.failure(e)
            }
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
            val role = getMyRoleInGroup(groupId).getOrElse { return Result.failure(it) }
            if (role == GroupMemberRole.OWNER) {
                return Result.failure(Exception("O dono não pode sair do grupo. Transfira a propriedade primeiro."))
            }

            // FIX #611 / #626: member_count é SERVER-AUTHORITATIVE.
            // Cloud Function `onMemberWritten` detecta mudança de status ACTIVE→INACTIVE
            // e aplica increment(-1) via admin SDK (bypassa rules).
            // syncGroupMemberCount() ainda existe pra reconciliar denormalized
            // user-group docs, mas member_count do group em si é managed pela trigger.
            firestore.runTransaction { transaction ->
                val memberRef = groupsCollection.document(groupId)
                    .collection("members").document(userId)
                transaction.update(memberRef, "status", GroupMemberStatus.INACTIVE.name)

                // Remover referência do usuário que está saindo
                val userGroupRef = usersCollection.document(userId)
                    .collection("groups").document(groupId)
                transaction.delete(userGroupRef)
            }.await()

            Result.success(Unit)
        } catch (e: FirebaseFirestoreException) {
            if (e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
                Result.failure(Exception("Você não tem permissão para esta ação"))
            } else {
                Result.failure(e)
            }
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
            val role = getMyRoleInGroup(groupId).getOrElse { return Result.failure(it) }
            if (role != GroupMemberRole.OWNER) {
                return Result.failure(Exception("Apenas o dono pode arquivar o grupo"))
            }

            // Arquivar grupo
            val updates = mapOf(
                "status" to GroupStatus.ARCHIVED.name,
                "updated_at" to FieldValue.serverTimestamp()
            )
            groupsCollection.document(groupId).update(updates).await()

            // Propagar ARCHIVED para UserGroups de todos os membros (denormalizacao)
            val membersCollection = groupsCollection.document(groupId).collection("members")
            val pageSize = 500L
            var lastDoc: com.google.firebase.firestore.DocumentSnapshot? = null

            while (true) {
                var query: Query = membersCollection
                    .orderBy(FieldPath.documentId())
                    .limit(pageSize)
                if (lastDoc != null) {
                    query = query.startAfter(lastDoc)
                }

                val snap = query.get().await()
                if (snap.isEmpty) break

                val batchSize = 400
                val docs = snap.documents

                for (i in docs.indices step batchSize) {
                    val batch = firestore.batch()
                    val chunk = docs.subList(i, minOf(i + batchSize, docs.size))

                    chunk.forEach { memberDoc ->
                        val memberId = memberDoc.getString("user_id") ?: return@forEach
                        val userGroupRef = usersCollection.document(memberId)
                            .collection("groups").document(groupId)
                        batch.update(userGroupRef, "group_status", GroupStatus.ARCHIVED.name)
                    }
                    batch.commit().await()
                }

                lastDoc = snap.documents.last()
                if (snap.size() < pageSize) break
            }

            Result.success(Unit)
        } catch (e: FirebaseFirestoreException) {
            if (e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
                Result.failure(Exception("Você não tem permissão para esta ação"))
            } else {
                Result.failure(e)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Deleta o grupo via Cloud Function (soft delete com cascade - P2 #40).
     */
    suspend fun deleteGroup(groupId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Chamar Cloud Function para cascade soft delete
            // A CF faz: verificação de permissão, rate limiting, marcação do grupo + jogos
            val functions = FirebaseFunctions.getInstance("southamerica-east1")
            functions
                .getHttpsCallable("softDeleteGroup")
                .call(mapOf("groupId" to groupId))
                .await()

            // Remover referências denormalized de todos os membros (CF não trata isso)
            val membersCol = groupsCollection.document(groupId).collection("members")
            val deletePageSize = 500L
            var lastMemberDoc: com.google.firebase.firestore.DocumentSnapshot? = null

            while (true) {
                var memberQuery: Query = membersCol
                    .orderBy(FieldPath.documentId())
                    .limit(deletePageSize)
                if (lastMemberDoc != null) {
                    memberQuery = memberQuery.startAfter(lastMemberDoc)
                }

                val membersPage = memberQuery.get().await()
                if (membersPage.isEmpty) break

                // Processar em batches de 400
                val docs = membersPage.documents
                for (i in docs.indices step 400) {
                    val batch = firestore.batch()
                    val chunk = docs.subList(i, minOf(i + 400, docs.size))

                    chunk.forEach { memberDoc ->
                        val memberId = memberDoc.getString("user_id") ?: return@forEach
                        val userGroupRef = usersCollection.document(memberId)
                            .collection("groups").document(groupId)
                        batch.delete(userGroupRef)
                    }
                    batch.commit().await()
                }

                lastMemberDoc = docs.lastOrNull()
                if (membersPage.size() < deletePageSize) break
            }

            AppLogger.i(TAG) { "Grupo $groupId soft-deletado por $userId" }
            Result.success(Unit)
        } catch (e: FirebaseFunctionsException) {
            if (e.code == FirebaseFunctionsException.Code.PERMISSION_DENIED) {
                Result.failure(Exception("Você não tem permissão para esta ação"))
            } else {
                Result.failure(e)
            }
        } catch (e: FirebaseFirestoreException) {
            if (e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
                Result.failure(Exception("Você não tem permissão para esta ação"))
            } else {
                Result.failure(e)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Realiza soft delete de um grupo (P2 #40).
     * Delega para deleteGroup() que ja faz soft delete completo + limpeza de referencias.
     *
     * @param groupId ID do grupo a ser soft-deletado
     * @return Result<Unit>
     */
    suspend fun softDeleteGroup(groupId: String): Result<Unit> {
        return deleteGroup(groupId)
    }

    /**
     * Restaura um grupo soft-deletado ou arquivado (P2 #40).
     * Limpa deleted_at e deleted_by (se existirem) e restaura o status para ACTIVE.
     * Recria os documentos UserGroup (users/{m}/groups/{g}) para membros ativos,
     * que foram removidos durante o soft delete.
     *
     * @param groupId ID do grupo a ser restaurado
     * @return Result<Unit>
     */
    suspend fun restoreGroup(groupId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se é owner
            val role = getMyRoleInGroup(groupId).getOrElse { return Result.failure(it) }
            if (role != GroupMemberRole.OWNER) {
                return Result.failure(Exception("Apenas o dono pode restaurar o grupo"))
            }

            // Ler dados do grupo para recriar os UserGroups
            val groupDoc = groupsCollection.document(groupId).get().await()
            val groupName = groupDoc.getString("name") ?: ""
            val groupPhoto = groupDoc.getString("photo_url")
            val memberCount = groupDoc.getLong("member_count")?.toInt() ?: 0

            // Restaurar documento principal do grupo
            val updates = mapOf<String, Any>(
                "deleted_at" to FieldValue.delete(),
                "deleted_by" to FieldValue.delete(),
                "status" to GroupStatus.ACTIVE.name,
                "updated_at" to FieldValue.serverTimestamp()
            )
            groupsCollection.document(groupId).update(updates).await()

            // Recriar UserGroup subdocs para membros ativos (removidos pelo deleteGroup)
            val membersCol = groupsCollection.document(groupId).collection("members")
            val pageSize = 500L
            var lastMemberDoc: com.google.firebase.firestore.DocumentSnapshot? = null

            while (true) {
                var memberQuery: Query = membersCol
                    .whereEqualTo("status", GroupMemberStatus.ACTIVE.name)
                    .orderBy(FieldPath.documentId())
                    .limit(pageSize)
                if (lastMemberDoc != null) {
                    memberQuery = memberQuery.startAfter(lastMemberDoc)
                }

                val membersPage = memberQuery.get().await()
                if (membersPage.isEmpty) break

                val docs = membersPage.documents
                for (i in docs.indices step 400) {
                    val batch = firestore.batch()
                    val chunk = docs.subList(i, minOf(i + 400, docs.size))

                    chunk.forEach { memberDoc ->
                        val memberId = memberDoc.getString("user_id") ?: return@forEach
                        val userGroupRef = usersCollection.document(memberId)
                            .collection("groups").document(groupId)

                        val userGroupData = mapOf(
                            "group_id" to groupId,
                            "group_name" to groupName,
                            "group_photo" to groupPhoto,
                            "role" to (memberDoc.getString("role") ?: GroupMemberRole.MEMBER.name),
                            "member_count" to memberCount,
                            "joined_at" to FieldValue.serverTimestamp()
                        )
                        batch.set(userGroupRef, userGroupData)
                    }
                    batch.commit().await()
                }

                lastMemberDoc = docs.lastOrNull()
                if (membersPage.size() < pageSize) break
            }

            AppLogger.i(TAG) { "Grupo $groupId restaurado com sucesso" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao restaurar grupo $groupId", e)
            Result.failure(e)
        }
    }

    /**
     * Verifica se o usuário pode criar jogos (tem grupo válido)
     */
    suspend fun canCreateGames(): Result<Boolean> {
        return try {
            val validGroups = getValidGroupsForGame()
                .getOrElse { return Result.failure(it) }
            Result.success(validGroups.isNotEmpty())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Conta quantos grupos o usuário possui onde é admin
     */
    suspend fun countMyAdminGroups(): Result<Int> {
        return try {
            val groups = getMyGroups().getOrElse { return Result.failure(it) }
            val adminCount = groups.count { it.isAdmin() }
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
            val role = getMyRoleInGroup(groupId).getOrElse { return Result.failure(it) }
            if (role != GroupMemberRole.OWNER) {
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
        } catch (e: FirebaseFirestoreException) {
            if (e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
                Result.failure(Exception("Você não tem permissão para esta ação"))
            } else {
                Result.failure(e)
            }
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

    // REMOVIDO: método duplicado restoreGroup (arquivado).
    // A versão principal em restoreGroup (linha ~719) já trata tanto
    // soft-delete (limpa deleted_at/deleted_by) quanto arquivamento (seta ACTIVE).

    /**
     * Sincroniza o member_count de um grupo específico em todos os UserGroups
     * Útil para corrigir dados inconsistentes
     */
    suspend fun syncGroupMemberCount(groupId: String): Result<Unit> {
        return try {
            // Contar membros ativos com paginação para evitar estouro de memória
            val membersCol = groupsCollection.document(groupId)
                .collection("members")
                .whereEqualTo("status", GroupMemberStatus.ACTIVE.name)
            val allMemberIds = mutableListOf<String>()
            var lastDoc: com.google.firebase.firestore.DocumentSnapshot? = null

            while (true) {
                var query: Query = membersCol
                    .orderBy(FieldPath.documentId())
                    .limit(500)
                if (lastDoc != null) {
                    query = query.startAfter(lastDoc)
                }
                val snap = query.get().await()
                if (snap.isEmpty) break

                snap.documents.mapNotNullTo(allMemberIds) { it.getString("user_id") }
                lastDoc = snap.documents.last()
                if (snap.size() < 500) break
            }

            val correctMemberCount = allMemberIds.size

            // FIX #611 / #626: NÃO atualizar groups/{gid}.member_count aqui.
            // Cloud Function `onMemberWritten` é o único path autorizado a escrever
            // esse campo. Esta função apenas reconcilia denormalized
            // users/{uid}/groups/{gid}.member_count via batch.

            // Atualizar UserGroups em batches de 400
            for (i in allMemberIds.indices step 400) {
                val batch = firestore.batch()
                val chunk = allMemberIds.subList(i, minOf(i + 400, allMemberIds.size))

                chunk.forEach { memberId ->
                    val userGroupRef = usersCollection.document(memberId)
                        .collection("groups").document(groupId)
                    batch.update(userGroupRef, "member_count", correctMemberCount)
                }
                batch.commit().await()
            }

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

            // Sincronizar grupos em paralelo (em vez de sequencial)
            coroutineScope {
                userGroups.documents.map { doc ->
                    val groupId = doc.getString("group_id") ?: doc.id
                    async {
                        try {
                            syncGroupMemberCount(groupId)
                        } catch (e: Exception) {
                            AppLogger.w(TAG) { "Erro ao sincronizar member_count do grupo $groupId: ${e.message}" }
                        }
                    }
                }.forEach { it.await() }
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Bloqueia um jogador no grupo
     */
    suspend fun blockPlayer(
        groupId: String,
        userId: String,
        userName: String,
        reason: String,
        blockedBy: String
    ): Result<Unit> {
        return try {
            val currentUserId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar permissão (owner ou admin)
            val role = getMyRoleInGroup(groupId).getOrElse { return Result.failure(it) }
            if (role != GroupMemberRole.OWNER && role != GroupMemberRole.ADMIN) {
                return Result.failure(Exception("Sem permissão para bloquear jogadores"))
            }

            // Adicionar na lista de bloqueados e atualizar status do membro em transação
            firestore.runTransaction { transaction ->
                val blockedRef = groupsCollection.document(groupId)
                    .collection("blocked_players").document(userId)

                val blockedData = mapOf(
                    "user_id" to userId,
                    "user_name" to userName,
                    "reason" to reason,
                    "blocked_by" to blockedBy,
                    "blocked_at" to FieldValue.serverTimestamp()
                )
                transaction.set(blockedRef, blockedData)

                // Remover da lista de membros se ainda for membro
                val memberRef = groupsCollection.document(groupId)
                    .collection("members").document(userId)
                val memberDoc = transaction.get(memberRef)
                if (memberDoc.exists()) {
                    transaction.update(memberRef, "status", GroupMemberStatus.BLOCKED.name)
                }
            }.await()

            Result.success(Unit)
        } catch (e: FirebaseFirestoreException) {
            if (e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
                Result.failure(Exception("Você não tem permissão para esta ação"))
            } else {
                Result.failure(e)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Desbloqueia um jogador no grupo
     */
    suspend fun unblockPlayer(groupId: String, userId: String): Result<Unit> {
        return try {
            val currentUserId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar permissão (owner ou admin)
            val role = getMyRoleInGroup(groupId).getOrElse { return Result.failure(it) }
            if (role != GroupMemberRole.OWNER && role != GroupMemberRole.ADMIN) {
                return Result.failure(Exception("Sem permissão para desbloquear jogadores"))
            }

            // Remover da lista de bloqueados
            val blockedRef = groupsCollection.document(groupId)
                .collection("blocked_players").document(userId)

            blockedRef.delete().await()

            Result.success(Unit)
        } catch (e: FirebaseFirestoreException) {
            if (e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
                Result.failure(Exception("Você não tem permissão para esta ação"))
            } else {
                Result.failure(e)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== CONVITE DE GRUPO (InviteToGroupUseCase) ==========

    /**
     * Busca um usuário pelo email no Firestore.
     * Retorna mapa com dados do usuário, incluindo uid como campo "uid".
     */
    suspend fun findUserByEmail(email: String): Result<Map<String, Any>> {
        return try {
            val snapshot = firestore.collection("users")
                .whereEqualTo("email", email)
                .limit(1)
                .get()
                .await()

            if (snapshot.isEmpty) {
                Result.failure(Exception("Usuário não encontrado"))
            } else {
                val doc = snapshot.documents.first()
                val userData = doc.data ?: emptyMap()
                val userDataWithId = userData.toMutableMap()
                userDataWithId["uid"] = doc.id
                Result.success(userDataWithId)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Verifica se já existe um convite pendente do mesmo grupo para o usuário.
     */
    suspend fun hasPendingGroupInvite(groupId: String, invitedUserId: String): Result<Boolean> {
        return try {
            val snapshot = firestore.collection("group_invites")
                .whereEqualTo("group_id", groupId)
                .whereEqualTo("invited_user_id", invitedUserId)
                .whereEqualTo("status", "PENDING")
                .limit(1)
                .get()
                .await()

            Result.success(snapshot.size() > 0)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Cria um convite de grupo e atualiza contagem de convites pendentes.
     * Opera em transação para atomicidade.
     */
    suspend fun createGroupInvite(invite: GroupInvite): Result<GroupInvite> {
        return try {
            val inviteRef = firestore.collection("group_invites").document()
            val inviteWithId = invite.copy(id = inviteRef.id)

            firestore.runTransaction { transaction ->
                transaction.set(inviteRef, inviteWithId)
                val userRef = firestore.collection("users").document(invite.invitedUserId)
                transaction.update(userRef, "pending_invites_count", FieldValue.increment(1))
            }.await()

            Result.success(inviteWithId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Verifica se um usuário específico é membro ativo de um grupo.
     */
    suspend fun isUserMemberOfGroup(groupId: String, userId: String): Result<Boolean> {
        return try {
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
     * Retorna o ID do usuário autenticado atual.
     */
    fun getCurrentUserId(): String? = auth.currentUser?.uid

    /**
     * Busca o nome do usuário atual no Firestore.
     */
    suspend fun getCurrentUserName(): Result<String> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val userDoc = firestore.collection("users").document(userId).get().await()
            val name = userDoc.getString("name") ?: "Usuário"
            Result.success(name)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
