# Firestore Patterns

Padrões para Firebase Firestore no projeto Futeba dos Parças.

## Collections

| Collection | Descrição |
|------------|-----------|
| `users` | Perfis e configurações de usuário |
| `games` | Eventos de jogos |
| `groups` | Grupos de pelada |
| `statistics` | Estatísticas de jogadores |
| `season_participation` | Rankings por temporada |
| `seasons` | Temporadas ativas/passadas |
| `xp_logs` | Histórico de XP |
| `user_badges` | Badges desbloqueadas |
| `locations` | Locais de jogos |
| `cashbox` | Controle financeiro |

## Queries

### Batching (Limite de 10 para whereIn)

```kotlin
suspend fun getUsersByIds(ids: List<String>): List<User> {
    return ids.chunked(10)
        .map { chunk ->
            async {
                firestore.collection("users")
                    .whereIn(FieldPath.documentId(), chunk)
                    .get()
                    .await()
            }
        }
        .awaitAll()
        .flatMap { it.toObjects<User>() }
}
```

### Pagination (50 items por página)

```kotlin
suspend fun getUsers(lastUserName: String? = null): List<User> {
    var query = firestore.collection("users")
        .orderBy("name")
        .limit(50)

    if (lastUserName != null) {
        query = query.startAfter(lastUserName)
    }

    return query.get().await().toObjects()
}
```

## Caching

- Implementar LRU cache com max 200 entries
- TTL de 5 minutos para dados frequentes
- Usar `Source.CACHE` para offline-first

## Real-time Listeners

```kotlin
fun getGameFlow(gameId: String): Flow<Game> = callbackFlow {
    val listener = firestore.collection("games")
        .document(gameId)
        .addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            snapshot?.toObject<Game>()?.let { trySend(it) }
        }

    awaitClose { listener.remove() }
}
```

## Security Rules

- Validar `request.auth != null` para operações autenticadas
- Usar `get()` para verificar permissões em documentos relacionados
- Nunca confiar em dados do cliente para campos críticos
