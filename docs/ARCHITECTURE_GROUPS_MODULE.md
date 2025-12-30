# Arquitetura do Módulo de Grupos - Futeba dos Parças

## Resumo Executivo

Este documento detalha a arquitetura completa para o módulo de **Grupos**, incluindo:
- Sistema de convites
- Notificações in-app
- Convocações de jogos
- Agenda de jogos
- Controle de caixa do grupo

---

## ETAPA 1 - ANÁLISE DO ESTADO ATUAL

### O que já existe:

| Funcionalidade | Status | Observações |
|---|---|---|
| Coleção `users` | ✅ Existe | Perfil completo com roles, FCM token |
| Coleção `games` | ✅ Existe | Jogos com owner, confirmações |
| Coleção `confirmations` | ✅ Existe | Confirmações de presença |
| Coleção `teams` | ✅ Existe | Times para sorteio (não persistentes) |
| Coleção `schedules` | ✅ Existe | Jogos recorrentes com memberIds |
| Coleção `notifications` | ⚠️ Parcial | Estrutura básica, sem implementação |
| FCM Service | ✅ Existe | Infraestrutura pronta |
| Coleção `groups` | ❌ Não existe | A ser criado |
| Coleção `group_invites` | ❌ Não existe | A ser criado |
| Coleção `group_cashbox` | ❌ Não existe | A ser criado |
| Sistema de convites | ❌ Não existe | A ser criado |
| Convocações de jogo | ❌ Não existe | A ser criado |

### Padrões existentes a seguir:

- **Naming de coleções**: plural, lowercase (groups, group_invites)
- **Campos Firestore**: snake_case (owner_id, created_at)
- **Classes Kotlin**: PascalCase (Group, GroupInvite)
- **Annotations**: @PropertyName, @DocumentId, @ServerTimestamp
- **Arquitetura**: Repository Pattern + MVVM + Flow

---

## ETAPA 2 - MODELAGEM DE DADOS (GRUPOS)

### Coleção: `groups`

```kotlin
data class Group(
    @DocumentId
    val id: String = "",

    @PropertyName("name")
    val name: String = "",

    @PropertyName("description")
    val description: String = "",

    @PropertyName("owner_id")
    val ownerId: String = "",

    @PropertyName("owner_name")
    val ownerName: String = "",

    @PropertyName("photo_url")
    val photoUrl: String? = null,

    @PropertyName("member_count")
    val memberCount: Int = 0,

    @PropertyName("status")
    val status: GroupStatus = GroupStatus.ACTIVE,

    @ServerTimestamp
    @PropertyName("created_at")
    val createdAt: Date? = null,

    @PropertyName("updated_at")
    val updatedAt: Date? = null
)

enum class GroupStatus {
    ACTIVE,
    ARCHIVED,
    DELETED
}
```

### Subcoleção: `groups/{groupId}/members`

```kotlin
data class GroupMember(
    @DocumentId
    val id: String = "", // Mesmo que o userId para lookup rápido

    @PropertyName("user_id")
    val userId: String = "",

    @PropertyName("user_name")
    val userName: String = "",

    @PropertyName("user_photo")
    val userPhoto: String? = null,

    @PropertyName("role")
    val role: GroupMemberRole = GroupMemberRole.MEMBER,

    @PropertyName("status")
    val status: GroupMemberStatus = GroupMemberStatus.ACTIVE,

    @ServerTimestamp
    @PropertyName("joined_at")
    val joinedAt: Date? = null,

    @PropertyName("invited_by")
    val invitedBy: String? = null
)

enum class GroupMemberRole {
    OWNER,    // Criador - controle total
    ADMIN,    // Pode convidar, remover membros, criar jogos
    MEMBER    // Pode confirmar presença em jogos
}

enum class GroupMemberStatus {
    ACTIVE,   // Membro ativo
    INACTIVE, // Saiu voluntariamente
    REMOVED   // Removido por admin/owner
}
```

### Coleção auxiliar: `user_groups` (para leitura rápida)

```kotlin
data class UserGroup(
    @DocumentId
    val id: String = "", // groupId

    @PropertyName("group_id")
    val groupId: String = "",

    @PropertyName("group_name")
    val groupName: String = "",

    @PropertyName("group_photo")
    val groupPhoto: String? = null,

    @PropertyName("role")
    val role: GroupMemberRole = GroupMemberRole.MEMBER,

    @PropertyName("member_count")
    val memberCount: Int = 0,

    @ServerTimestamp
    @PropertyName("joined_at")
    val joinedAt: Date? = null
)
```

**Localização:** `users/{userId}/groups/{groupId}`

### Estratégia de dados:

1. **Grupo criado** → documento em `groups` + membro owner em subcoleção
2. **Novo membro** → documento em `groups/{id}/members` + documento em `users/{userId}/groups`
3. **Leitura de "meus grupos"** → query em `users/{userId}/groups` (rápido, sem collectionGroup)
4. **Leitura de membros do grupo** → query em `groups/{id}/members`
5. **Contagem** → campo `member_count` atualizado via transaction

---

## ETAPA 3 - SISTEMA DE CONVITES

### Coleção: `group_invites`

```kotlin
data class GroupInvite(
    @DocumentId
    val id: String = "",

    @PropertyName("group_id")
    val groupId: String = "",

    @PropertyName("group_name")
    val groupName: String = "",

    @PropertyName("invited_user_id")
    val invitedUserId: String = "",

    @PropertyName("invited_user_name")
    val invitedUserName: String = "",

    @PropertyName("invited_user_email")
    val invitedUserEmail: String = "",

    @PropertyName("invited_by_id")
    val invitedById: String = "",

    @PropertyName("invited_by_name")
    val invitedByName: String = "",

    @PropertyName("status")
    val status: InviteStatus = InviteStatus.PENDING,

    @ServerTimestamp
    @PropertyName("created_at")
    val createdAt: Date? = null,

    @PropertyName("expires_at")
    val expiresAt: Date? = null,

    @PropertyName("responded_at")
    val respondedAt: Date? = null
)

enum class InviteStatus {
    PENDING,   // Aguardando resposta
    ACCEPTED,  // Aceito
    DECLINED,  // Recusado
    EXPIRED,   // Expirado (48h)
    CANCELLED  // Cancelado pelo remetente
}
```

### Regras de Convite:

1. **Criação**: Apenas OWNER ou ADMIN podem convidar
2. **Expiração**: 48 horas após criação
3. **Unicidade**: Apenas 1 convite pendente por (grupo + usuário)
4. **Aceite**: Jogador entra no grupo como MEMBER
5. **Recusa**: Convite marcado como DECLINED
6. **Cancelamento**: Remetente pode cancelar convite pendente

### Controle de Expiração:

```javascript
// Cloud Function: checkExpiredInvites (scheduled - every hour)
exports.checkExpiredInvites = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const expiredInvites = await db.collection('group_invites')
      .where('status', '==', 'PENDING')
      .where('expires_at', '<=', now)
      .get();

    const batch = db.batch();
    expiredInvites.forEach(doc => {
      batch.update(doc.ref, { status: 'EXPIRED' });
    });
    await batch.commit();
  });
```

### Prevenção de Convite Duplicado:

```kotlin
// No repository, antes de criar convite:
suspend fun canInviteUser(groupId: String, userId: String): Boolean {
    // 1. Verificar se já é membro
    val memberDoc = firestore.collection("groups")
        .document(groupId)
        .collection("members")
        .document(userId)
        .get()
        .await()

    if (memberDoc.exists()) return false

    // 2. Verificar se há convite pendente
    val pendingInvite = firestore.collection("group_invites")
        .whereEqualTo("group_id", groupId)
        .whereEqualTo("invited_user_id", userId)
        .whereEqualTo("status", "PENDING")
        .get()
        .await()

    return pendingInvite.isEmpty
}
```

---

## ETAPA 4 - SISTEMA DE NOTIFICAÇÕES

### Coleção: `notifications`

```kotlin
data class AppNotification(
    @DocumentId
    val id: String = "",

    @PropertyName("user_id")
    val userId: String = "",

    @PropertyName("type")
    val type: NotificationType = NotificationType.GENERAL,

    @PropertyName("title")
    val title: String = "",

    @PropertyName("message")
    val message: String = "",

    @PropertyName("sender_id")
    val senderId: String? = null,

    @PropertyName("sender_name")
    val senderName: String? = null,

    @PropertyName("sender_photo")
    val senderPhoto: String? = null,

    @PropertyName("reference_id")
    val referenceId: String? = null, // ID do grupo, jogo, convite, etc.

    @PropertyName("reference_type")
    val referenceType: String? = null, // "group", "game", "invite"

    @PropertyName("action_type")
    val actionType: NotificationAction? = null,

    @PropertyName("read")
    val read: Boolean = false,

    @PropertyName("read_at")
    val readAt: Date? = null,

    @ServerTimestamp
    @PropertyName("created_at")
    val createdAt: Date? = null,

    @PropertyName("expires_at")
    val expiresAt: Date? = null
)

enum class NotificationType {
    GROUP_INVITE,        // Convite para grupo
    GROUP_INVITE_ACCEPTED, // Convite aceito
    GROUP_INVITE_DECLINED, // Convite recusado
    GAME_SUMMON,         // Convocação para jogo
    GAME_REMINDER,       // Lembrete de jogo (24h, 1h antes)
    GAME_CANCELLED,      // Jogo cancelado
    GAME_CONFIRMED,      // Jogo confirmado (mínimo atingido)
    MEMBER_JOINED,       // Novo membro no grupo
    MEMBER_LEFT,         // Membro saiu do grupo
    CASHBOX_ENTRY,       // Nova entrada no caixa
    CASHBOX_EXIT,        // Nova saída no caixa
    GENERAL              // Notificação geral
}

enum class NotificationAction {
    ACCEPT_DECLINE,      // Botões Aceitar/Recusar
    CONFIRM_POSITION,    // Botões Linha/Goleiro
    VIEW_DETAILS,        // Apenas visualizar
    NONE                 // Sem ação
}
```

### Índices necessários:

```json
{
  "collectionGroup": "notifications",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "user_id", "order": "ASCENDING" },
    { "fieldPath": "read", "order": "ASCENDING" },
    { "fieldPath": "created_at", "order": "DESCENDING" }
  ]
}
```

### Fluxo de notificação:

```
[Evento] → [Cloud Function] → [Cria Notification] → [Envia FCM Push]
                                      ↓
                              [App escuta via Flow]
                                      ↓
                              [UI atualiza badge]
```

### Query para badge de notificações:

```kotlin
fun getUnreadNotificationsCount(userId: String): Flow<Int> {
    return firestore.collection("notifications")
        .whereEqualTo("user_id", userId)
        .whereEqualTo("read", false)
        .addSnapshotListener { snapshot, _ ->
            emit(snapshot?.size() ?: 0)
        }
}
```

### Marcar como lida ao abrir:

```kotlin
suspend fun markNotificationsAsRead(userId: String) {
    val unread = firestore.collection("notifications")
        .whereEqualTo("user_id", userId)
        .whereEqualTo("read", false)
        .get()
        .await()

    val batch = firestore.batch()
    unread.documents.forEach { doc ->
        batch.update(doc.reference, mapOf(
            "read" to true,
            "read_at" to FieldValue.serverTimestamp()
        ))
    }
    batch.commit().await()
}
```

---

## ETAPA 5 - CRIAÇÃO DE JOGO A PARTIR DE GRUPO

### Coleção: `game_summons`

```kotlin
data class GameSummon(
    @DocumentId
    val id: String = "", // gameId_userId

    @PropertyName("game_id")
    val gameId: String = "",

    @PropertyName("group_id")
    val groupId: String = "",

    @PropertyName("user_id")
    val userId: String = "",

    @PropertyName("user_name")
    val userName: String = "",

    @PropertyName("status")
    val status: SummonStatus = SummonStatus.PENDING,

    @PropertyName("position")
    val position: PlayerPosition? = null, // FIELD ou GOALKEEPER

    @PropertyName("summoned_by")
    val summonedBy: String = "",

    @ServerTimestamp
    @PropertyName("summoned_at")
    val summonedAt: Date? = null,

    @PropertyName("responded_at")
    val respondedAt: Date? = null
)

enum class SummonStatus {
    PENDING,    // Aguardando resposta
    CONFIRMED,  // Confirmou presença
    DECLINED,   // Recusou
    CANCELLED   // Jogo cancelado
}
```

### Fluxo de criação de jogo:

```
1. Usuário clica "Criar Jogo"
2. Modal: "Selecione o grupo"
   - Lista apenas grupos válidos (>= 2 membros ativos)
3. Usuário seleciona grupo e preenche dados do jogo
4. Ao confirmar:
   a. Cria documento em `games` com group_id
   b. Para cada membro do grupo (exceto criador):
      - Cria documento em `game_summons`
      - Cria notificação em `notifications`
      - Envia push via FCM
5. Cada jogador pode:
   - Aceitar → informa posição → cria GameConfirmation
   - Recusar → atualiza summon status
```

### Extensão do modelo Game:

```kotlin
// Adicionar ao modelo Game existente:
@PropertyName("group_id")
val groupId: String? = null,

@PropertyName("group_name")
val groupName: String? = null,

@PropertyName("summon_count")
val summonCount: Int = 0,

@PropertyName("confirmed_count")
val confirmedCount: Int = 0,
```

### Query de grupos válidos:

```kotlin
suspend fun getValidGroupsForGame(userId: String): List<Group> {
    val userGroups = firestore.collection("users")
        .document(userId)
        .collection("groups")
        .get()
        .await()

    return userGroups.documents
        .filter { it.getLong("member_count") ?: 0 >= 2 }
        .map { doc ->
            Group(
                id = doc.id,
                name = doc.getString("group_name") ?: "",
                memberCount = doc.getLong("member_count")?.toInt() ?: 0
            )
        }
}
```

---

## ETAPA 6 - AGENDA DE JOGOS (PRÓXIMAS 2 SEMANAS)

### Subcoleção: `users/{userId}/upcoming_games`

```kotlin
data class UpcomingGame(
    @DocumentId
    val id: String = "", // gameId

    @PropertyName("game_id")
    val gameId: String = "",

    @PropertyName("group_id")
    val groupId: String = "",

    @PropertyName("group_name")
    val groupName: String = "",

    @PropertyName("date_time")
    val dateTime: Date = Date(),

    @PropertyName("location_name")
    val locationName: String = "",

    @PropertyName("location_address")
    val locationAddress: String = "",

    @PropertyName("field_name")
    val fieldName: String = "",

    @PropertyName("status")
    val status: GameStatus = GameStatus.SCHEDULED,

    @PropertyName("my_position")
    val myPosition: PlayerPosition? = null,

    @PropertyName("confirmed_count")
    val confirmedCount: Int = 0,

    @PropertyName("max_players")
    val maxPlayers: Int = 0
)
```

### Estratégia de atualização:

1. **Jogador confirma presença** → Cloud Function adiciona em `users/{userId}/upcoming_games`
2. **Jogador cancela** → Cloud Function remove de `users/{userId}/upcoming_games`
3. **Jogo atualizado** → Cloud Function atualiza todos os documentos relacionados
4. **Jogo termina** → Cloud Function remove de todos os `upcoming_games`

### Query performática:

```kotlin
fun getUpcomingGames(userId: String): Flow<List<UpcomingGame>> {
    val twoWeeksFromNow = Calendar.getInstance().apply {
        add(Calendar.DAY_OF_YEAR, 14)
    }.time

    return firestore.collection("users")
        .document(userId)
        .collection("upcoming_games")
        .whereLessThanOrEqualTo("date_time", twoWeeksFromNow)
        .orderBy("date_time", Query.Direction.ASCENDING)
        .snapshots()
        .map { snapshot ->
            snapshot.toObjects(UpcomingGame::class.java)
        }
}
```

### Cloud Function para manter consistência:

```javascript
// Trigger: quando confirmação é criada
exports.onConfirmationCreated = functions.firestore
  .document('confirmations/{confirmationId}')
  .onCreate(async (snap, context) => {
    const confirmation = snap.data();
    const game = await db.collection('games').doc(confirmation.game_id).get();

    if (!game.exists) return;

    const gameData = game.data();

    // Adiciona à agenda do usuário
    await db.collection('users')
      .doc(confirmation.user_id)
      .collection('upcoming_games')
      .doc(gameData.id)
      .set({
        game_id: gameData.id,
        group_id: gameData.group_id || null,
        group_name: gameData.group_name || null,
        date_time: gameData.date_time,
        location_name: gameData.location_name,
        location_address: gameData.location_address,
        field_name: gameData.field_name,
        status: gameData.status,
        my_position: confirmation.position,
        confirmed_count: gameData.players_count,
        max_players: gameData.max_players
      });
  });
```

---

## ETAPA 7 - GERENCIAMENTO DE GRUPOS (PERFIL)

### Telas necessárias:

1. **MyGroupsFragment** - Lista de meus grupos
2. **GroupDetailFragment** - Detalhes do grupo
3. **CreateGroupFragment** - Criar novo grupo
4. **EditGroupFragment** - Editar grupo (nome, descrição)
5. **GroupMembersFragment** - Gerenciar membros
6. **InvitePlayersFragment** - Buscar e convidar jogadores

### Regras de permissão:

| Ação | OWNER | ADMIN | MEMBER |
|------|-------|-------|--------|
| Editar nome/descrição | ✅ | ✅ | ❌ |
| Convidar membros | ✅ | ✅ | ❌ |
| Remover membros | ✅ | ✅* | ❌ |
| Promover a admin | ✅ | ❌ | ❌ |
| Rebaixar admin | ✅ | ❌ | ❌ |
| Criar jogo | ✅ | ✅ | ❌ |
| Arquivar grupo | ✅ | ❌ | ❌ |
| Deletar grupo | ✅ | ❌ | ❌ |
| Sair do grupo | ❌ | ✅ | ✅ |

*Admin não pode remover outro admin

### Proteção de jogos antigos:

```kotlin
// Jogos mantêm referência ao group_id mesmo se grupo for deletado
// O group_name é denormalizado no jogo

// Ao deletar grupo:
suspend fun archiveGroup(groupId: String) {
    firestore.runTransaction { transaction ->
        // 1. Atualiza status do grupo para ARCHIVED
        val groupRef = firestore.collection("groups").document(groupId)
        transaction.update(groupRef, "status", GroupStatus.ARCHIVED.name)

        // 2. Remove de todos os user_groups
        // Isso será feito por Cloud Function assíncrona
    }

    // Cloud Function cuidará de:
    // - Remover referências em users/{userId}/groups
    // - Cancelar convites pendentes
    // - NÃO altera jogos históricos (mantém dados denormalizados)
}
```

---

## ETAPA 8 - CONTROLE DE CAIXA DO GRUPO

### Coleção: `groups/{groupId}/cashbox`

```kotlin
data class CashboxEntry(
    @DocumentId
    val id: String = "",

    @PropertyName("type")
    val type: CashboxEntryType = CashboxEntryType.INCOME,

    @PropertyName("category")
    val category: CashboxCategory = CashboxCategory.OTHER,

    @PropertyName("custom_category")
    val customCategory: String? = null,

    @PropertyName("amount")
    val amount: Double = 0.0,

    @PropertyName("description")
    val description: String = "",

    @PropertyName("created_by_id")
    val createdById: String = "",

    @PropertyName("created_by_name")
    val createdByName: String = "",

    @PropertyName("reference_date")
    val referenceDate: Date = Date(), // Data de referência (ex: mês da mensalidade)

    @ServerTimestamp
    @PropertyName("created_at")
    val createdAt: Date? = null,

    @PropertyName("player_id")
    val playerId: String? = null, // Para entradas individuais (mensalidade)

    @PropertyName("player_name")
    val playerName: String? = null,

    @PropertyName("game_id")
    val gameId: String? = null, // Para despesas de jogo específico

    @PropertyName("receipt_url")
    val receiptUrl: String? = null // Comprovante
)

enum class CashboxEntryType {
    INCOME,   // Entrada
    EXPENSE   // Saída
}

enum class CashboxCategory {
    // Entradas
    MONTHLY_FEE,      // Mensalidade
    WEEKLY_FEE,       // Taxa semanal
    SINGLE_PAYMENT,   // Avulso
    DONATION,         // Doação

    // Saídas
    FIELD_RENTAL,     // Aluguel de quadra
    EQUIPMENT,        // Equipamentos (bolas, coletes)
    CELEBRATION,      // Confraternização
    REFUND,           // Reembolso

    // Comum
    OTHER             // Outros (usa custom_category)
}
```

### Documento de saldo: `groups/{groupId}/cashbox_summary`

```kotlin
data class CashboxSummary(
    @PropertyName("balance")
    val balance: Double = 0.0,

    @PropertyName("total_income")
    val totalIncome: Double = 0.0,

    @PropertyName("total_expense")
    val totalExpense: Double = 0.0,

    @PropertyName("last_entry_at")
    val lastEntryAt: Date? = null,

    @PropertyName("entry_count")
    val entryCount: Int = 0
)
```

### Cálculo de saldo (transacional):

```kotlin
suspend fun addCashboxEntry(groupId: String, entry: CashboxEntry): Result<String> {
    return try {
        firestore.runTransaction { transaction ->
            val summaryRef = firestore.collection("groups")
                .document(groupId)
                .collection("cashbox_summary")
                .document("current")

            val summaryDoc = transaction.get(summaryRef)
            val currentSummary = summaryDoc.toObject(CashboxSummary::class.java)
                ?: CashboxSummary()

            val newBalance = if (entry.type == CashboxEntryType.INCOME) {
                currentSummary.balance + entry.amount
            } else {
                currentSummary.balance - entry.amount
            }

            val newTotalIncome = if (entry.type == CashboxEntryType.INCOME) {
                currentSummary.totalIncome + entry.amount
            } else {
                currentSummary.totalIncome
            }

            val newTotalExpense = if (entry.type == CashboxEntryType.EXPENSE) {
                currentSummary.totalExpense + entry.amount
            } else {
                currentSummary.totalExpense
            }

            // Atualiza resumo
            transaction.set(summaryRef, mapOf(
                "balance" to newBalance,
                "total_income" to newTotalIncome,
                "total_expense" to newTotalExpense,
                "last_entry_at" to FieldValue.serverTimestamp(),
                "entry_count" to currentSummary.entryCount + 1
            ))

            // Adiciona entrada
            val entryRef = firestore.collection("groups")
                .document(groupId)
                .collection("cashbox")
                .document()

            transaction.set(entryRef, entry)

            entryRef.id
        }.await()

        Result.success(entryId)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

### Query para histórico:

```kotlin
fun getCashboxHistory(
    groupId: String,
    limit: Int = 50
): Flow<List<CashboxEntry>> {
    return firestore.collection("groups")
        .document(groupId)
        .collection("cashbox")
        .orderBy("created_at", Query.Direction.DESCENDING)
        .limit(limit.toLong())
        .snapshots()
        .map { it.toObjects(CashboxEntry::class.java) }
}
```

### Possível evolução futura (rateio):

```kotlin
// Para rateio automático de despesas entre membros
data class CashboxRateio(
    val entryId: String,
    val totalAmount: Double,
    val memberShares: Map<String, Double>, // userId -> valor
    val status: Map<String, Boolean> // userId -> pago
)
```

---

## ETAPA 9 - ARQUITETURA DE EVENTOS

### Cloud Functions necessárias:

```
functions/
├── invites/
│   ├── onInviteCreated.ts      # Envia notificação
│   ├── onInviteAccepted.ts     # Adiciona membro ao grupo
│   └── checkExpiredInvites.ts  # Scheduled: marca expirados
├── groups/
│   ├── onMemberAdded.ts        # Atualiza member_count, notifica
│   ├── onMemberRemoved.ts      # Atualiza member_count
│   └── onGroupArchived.ts      # Limpa referências
├── games/
│   ├── onGameCreated.ts        # Cria summons, notificações
│   ├── onSummonResponded.ts    # Atualiza contadores
│   └── onGameStatusChanged.ts  # Notifica participantes
├── confirmations/
│   ├── onConfirmationCreated.ts  # Adiciona à agenda
│   └── onConfirmationCancelled.ts # Remove da agenda
└── cashbox/
    └── onEntryCreated.ts       # Notifica admins (opcional)
```

### Diagrama de eventos:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONVITE CRIADO                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Admin clica "Convidar"                                      │
│  2. App cria doc em group_invites                               │
│  3. Cloud Function: onInviteCreated                             │
│     → Cria notification para convidado                          │
│     → Envia FCM push                                            │
│  4. App do convidado recebe push + atualiza badge               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    CONVITE ACEITO                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Convidado clica "Aceitar"                                   │
│  2. App atualiza status do invite                               │
│  3. Cloud Function: onInviteAccepted                            │
│     → Cria doc em groups/{id}/members                           │
│     → Cria doc em users/{userId}/groups                         │
│     → Incrementa member_count (transaction)                     │
│     → Cria notification para owner                              │
│     → Envia FCM para owner                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    JOGO CRIADO                                  │
├─────────────────────────────────────────────────────────────────┤
│  1. Owner cria jogo vinculado a grupo                           │
│  2. App cria doc em games com group_id                          │
│  3. Cloud Function: onGameCreated                               │
│     → Para cada membro do grupo:                                │
│        → Cria doc em game_summons                               │
│        → Cria notification                                      │
│        → Envia FCM push                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PRESENÇA CONFIRMADA                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Jogador confirma presença (aceita convocação)               │
│  2. App cria doc em confirmations                               │
│  3. Cloud Function: onConfirmationCreated                       │
│     → Atualiza game_summons status                              │
│     → Cria doc em users/{userId}/upcoming_games                 │
│     → Incrementa confirmed_count no game                        │
│     → Se atingiu mínimo: notifica todos                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    ENTRADA NO CAIXA                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Admin registra entrada/saída                                │
│  2. App executa transaction:                                    │
│     → Cria doc em groups/{id}/cashbox                           │
│     → Atualiza cashbox_summary (saldo)                          │
│  3. Cloud Function: onEntryCreated (opcional)                   │
│     → Notifica outros admins                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Idempotência:

```javascript
// Todas as Cloud Functions usam eventId para evitar duplicação
exports.onInviteCreated = functions.firestore
  .document('group_invites/{inviteId}')
  .onCreate(async (snap, context) => {
    const eventId = context.eventId;

    // Verifica se já processou este evento
    const processedRef = db.collection('processed_events').doc(eventId);
    const processed = await processedRef.get();

    if (processed.exists) {
      console.log(`Event ${eventId} already processed, skipping`);
      return null;
    }

    // Processa o evento
    // ...

    // Marca como processado
    await processedRef.set({ processedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
```

### Consistência eventual:

```
┌──────────────────────────────────────────────────────────────────┐
│  Estratégia: Dados denormalizados + Cloud Functions síncronas   │
├──────────────────────────────────────────────────────────────────┤
│  1. Dados críticos são atualizados em transação                 │
│  2. Dados secundários são atualizados via Cloud Function        │
│  3. Em caso de falha:                                           │
│     → Cloud Function é reexecutada (retry automático)           │
│     → Logs permitem debug                                       │
│     → Função de reparo pode ser executada manualmente           │
│  4. UI mostra dados locais imediatamente, sincroniza depois     │
└──────────────────────────────────────────────────────────────────┘
```

---

## ETAPA 10 - PLANO DE IMPLEMENTAÇÃO

### Fase 1: Grupos + Convites + Notificações Básicas

**Duração estimada:** Sprint 1-2

#### Ajustes de banco:
- [ ] Criar coleção `groups`
- [ ] Criar subcoleção `groups/{id}/members`
- [ ] Criar coleção `user_groups` (via subcoleção users)
- [ ] Criar coleção `group_invites`
- [ ] Atualizar coleção `notifications`

#### Backend (Cloud Functions):
- [ ] onInviteCreated → notificação + push
- [ ] onInviteAccepted → adicionar membro
- [ ] onInviteDeclined → atualizar status
- [ ] checkExpiredInvites → scheduled
- [ ] onMemberAdded → atualizar contador

#### UI:
- [ ] MyGroupsFragment (lista de grupos)
- [ ] CreateGroupFragment (criar grupo)
- [ ] GroupDetailFragment (detalhes + membros)
- [ ] InvitePlayersFragment (buscar e convidar)
- [ ] NotificationsFragment (lista de notificações)
- [ ] Ícone de sino com badge na toolbar

#### Riscos:
- Sincronização de member_count pode falhar → usar transaction
- Notificações duplicadas → usar eventId para idempotência

#### Testes:
- [ ] Criar grupo com sucesso
- [ ] Convidar jogador inexistente (erro)
- [ ] Convidar jogador já membro (erro)
- [ ] Aceitar convite → virar membro
- [ ] Recusar convite → não virar membro
- [ ] Convite expira após 48h
- [ ] Notificação aparece no badge
- [ ] Marcar notificações como lidas

---

### Fase 2: Convocações + Agenda + Integração com Jogos

**Duração estimada:** Sprint 3-4

#### Ajustes de banco:
- [ ] Criar coleção `game_summons`
- [ ] Adicionar campos group_id, group_name ao modelo Game
- [ ] Criar subcoleção `users/{id}/upcoming_games`

#### Backend:
- [ ] onGameCreated → criar summons para membros do grupo
- [ ] onSummonResponded → atualizar contadores
- [ ] onConfirmationCreated → adicionar à agenda
- [ ] onConfirmationCancelled → remover da agenda
- [ ] onGameStatusChanged → notificar participantes

#### UI:
- [ ] Modificar CreateGameFragment → seleção de grupo obrigatória
- [ ] SummonResponseFragment (aceitar/recusar convocação)
- [ ] Atualizar HomeFragment → mostrar próximos jogos
- [ ] UpcomingGamesWidget (lista resumida)

#### Riscos:
- Grupo pode ter muitos membros → batch para criar summons
- Jogador pode estar offline → summon fica pendente

#### Testes:
- [ ] Criar jogo seleciona grupo
- [ ] Todos membros recebem convocação
- [ ] Aceitar convocação → confirma presença
- [ ] Recusar convocação → não aparece na lista
- [ ] Jogo aparece na agenda após confirmar
- [ ] Cancelar presença → remove da agenda

---

### Fase 3: Gerenciamento de Grupos + Controle de Caixa

**Duração estimada:** Sprint 5-6

#### Ajustes de banco:
- [ ] Criar subcoleção `groups/{id}/cashbox`
- [ ] Criar documento `groups/{id}/cashbox_summary`

#### Backend:
- [ ] onGroupArchived → limpar referências
- [ ] onCashboxEntryCreated → atualizar saldo (transaction no app)

#### UI:
- [ ] EditGroupFragment (editar nome, descrição, foto)
- [ ] ManageMembersFragment (promover, rebaixar, remover)
- [ ] CashboxFragment (histórico de entradas/saídas)
- [ ] AddCashboxEntryFragment (nova entrada)
- [ ] CashboxSummaryCard (saldo atual)

#### Riscos:
- Deletar grupo com jogos ativos → bloquear ou arquivar
- Concorrência no saldo → usar transaction

#### Testes:
- [ ] Editar nome do grupo
- [ ] Remover membro → sai da lista
- [ ] Membro sair voluntariamente
- [ ] Adicionar entrada no caixa
- [ ] Saldo atualiza corretamente
- [ ] Histórico ordenado por data

---

## RESUMO FINAL

### Entregas:

1. **Modelagem de dados completa** ✅
   - Group, GroupMember, GroupInvite
   - AppNotification (expandido)
   - GameSummon
   - UpcomingGame
   - CashboxEntry, CashboxSummary

2. **Fluxos funcionais** ✅
   - Criar grupo → convidar → aceitar
   - Criar jogo → convocar → confirmar
   - Registrar caixa → atualizar saldo

3. **Arquitetura de notificações** ✅
   - Tipos: GROUP_INVITE, GAME_SUMMON, etc.
   - Ações: ACCEPT_DECLINE, CONFIRM_POSITION
   - Badge com contador em tempo real

4. **Arquitetura do caixa** ✅
   - Entradas e saídas categorizadas
   - Saldo calculado via transaction
   - Histórico com auditoria

5. **Plano incremental** ✅
   - Fase 1: Grupos + Convites
   - Fase 2: Convocações + Agenda
   - Fase 3: Gerenciamento + Caixa

---

## DIAGRAMA DE COLEÇÕES FINAL

```
firestore/
├── users/
│   └── {userId}/
│       ├── groups/           # Meus grupos (denormalizado)
│       │   └── {groupId}
│       └── upcoming_games/   # Minha agenda
│           └── {gameId}
├── groups/
│   └── {groupId}/
│       ├── members/          # Membros do grupo
│       │   └── {userId}
│       ├── cashbox/          # Histórico do caixa
│       │   └── {entryId}
│       └── cashbox_summary/  # Saldo atual
│           └── current
├── group_invites/            # Convites pendentes
│   └── {inviteId}
├── game_summons/             # Convocações de jogo
│   └── {gameId_userId}
├── games/                    # Jogos (+ group_id)
│   └── {gameId}
├── confirmations/            # Confirmações
│   └── {confirmationId}
└── notifications/            # Notificações in-app
    └── {notificationId}
```
