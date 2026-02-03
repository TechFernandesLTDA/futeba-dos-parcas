# Maintenance Functions

Funções de manutenção e limpeza automática de dados.

## Funções Disponíveis

### 1. `cleanupOldXpLogs`

**Schedule**: Domingo às 03:00 (America/Sao_Paulo)
**TTL**: 1 ano
**Coleção**: `xp_logs`

Deleta logs de XP com mais de 1 ano para reduzir custos de armazenamento.

**Batch size**: 500 documentos por batch
**Max batches**: 100 (50k docs por execução)

**Logs de métricas**:
```javascript
{
  type: "xp_logs_cleanup",
  timestamp: Timestamp,
  deleted_count: 1234,
  batches: 3,
  cutoff_date: Timestamp
}
```

### 2. `cleanupOldActivities`

**Schedule**: Domingo às 04:00
**TTL**: 90 dias
**Coleção**: `activities`

Feed de atividades não precisa manter histórico infinito.

### 3. `cleanupOldNotifications`

**Schedule**: Domingo às 05:00
**TTL**: 30 dias (apenas **lidas**)
**Coleção**: `notifications`

**IMPORTANTE**: Notificações não-lidas nunca são deletadas automaticamente.

**Query**:
```typescript
db.collection("notifications")
  .where("read", "==", true)
  .where("created_at", "<", cutoffDate)
```

## Soft Delete Functions

### 4. `cleanupSoftDeletedGames`

**Schedule**: Sábado às 02:00
**TTL**: 90 dias após `deleted_at`
**Coleção**: `games`

Documentos soft-deleted são mantidos por 90 dias para recuperação, depois deletados permanentemente.

**NOTA**: Games têm cascade delete, então limit é menor (100 docs/batch).

### 5. `cleanupSoftDeletedGroups`

**Schedule**: Sábado às 02:30
**TTL**: 90 dias
**Coleção**: `groups`

### 6. `cleanupSoftDeletedLocations`

**Schedule**: Sábado às 03:00
**TTL**: 90 dias
**Coleção**: `locations`

### 7. `softDeleteGame` (Callable)

Callable function para soft-delete de games.

**Uso**:
```kotlin
// Android
val softDeleteGame = functions.getHttpsCallable("softDeleteGame")
val result = softDeleteGame.call(hashMapOf("gameId" to gameId)).await()
```

**Regras**:
- Apenas owner pode soft-delete
- Marca com `deleted_at`, `deleted_by`, `status: DELETED`
- Após 90 dias, cleanup permanente via scheduled function

## Deploy

```bash
cd functions
npm run build
firebase deploy --only functions:cleanupOldXpLogs,functions:cleanupOldActivities,functions:cleanupOldNotifications
```

## Monitoramento

```bash
# Ver logs
firebase functions:log --only cleanupOldXpLogs --limit 100

# Ver métricas
# Firestore Console -> metrics collection -> type: "xp_logs_cleanup"
```

## Troubleshooting

### Erro: "Missing index"

Criar index composto:
- Collection: `xp_logs` (ou outra)
- Fields: `created_at` (Ascending), `__name__` (Ascending)

Link para criar index aparece no erro do log.

### Erro: "sharp module not found"

```bash
cd functions
npm install sharp --platform=linux --arch=x64
npm run build
```

## Custos Estimados

| Função | Execuções/mês | Custo/execução | Total/mês |
|--------|---------------|----------------|-----------|
| cleanupOldXpLogs | 4 | ~$0.001 | $0.004 |
| cleanupOldActivities | 4 | ~$0.001 | $0.004 |
| cleanupOldNotifications | 4 | ~$0.001 | $0.004 |
| cleanupSoftDeleted* | 12 | ~$0.001 | $0.012 |
| **TOTAL** | | | **~$0.024/mês** |

**Economia em storage**: ~$0.50/mês (10GB de logs deletados)
**ROI**: 20x o custo das funções
