# Monitoring & Infrastructure Guide

Guia completo de configuração e uso de monitoring, alertas de custos e otimizações de infraestrutura.

---

## 1. Budget Alerts (Firebase Console)

### Como Configurar Alertas de Orçamento

**⚠️ IMPORTANTE**: Budget alerts devem ser configurados no Firebase Console, não podem ser automatizados via código.

#### Passo 1: Acessar Cloud Billing

1. Acesse: https://console.cloud.google.com/billing
2. Selecione o projeto **FutebaDosParcas**
3. Menu lateral: **Budgets & Alerts**

#### Passo 2: Criar Alertas de Budget

Criar **3 budgets** com os seguintes limites:

##### Budget Diário ($10/dia)

```
Nome: Daily Budget - FutebaDosParcas
Escopo: Este projeto
Período: Diário
Valor: $10 USD
Alertas em: 50%, 80%, 100%, 120%
Notificações: email do admin + SMS (opcional)
```

##### Budget Semanal ($50/semana)

```
Nome: Weekly Budget - FutebaDosParcas
Escopo: Este projeto
Período: Semanal (segunda a domingo)
Valor: $50 USD
Alertas em: 50%, 80%, 100%, 120%
Notificações: email do admin
```

##### Budget Mensal ($200/mês)

```
Nome: Monthly Budget - FutebaDosParcas
Escopo: Este projeto
Período: Mensal
Valor: $200 USD
Alertas em: 50%, 75%, 90%, 100%, 110%
Notificações: email do admin + SMS
```

#### Passo 3: Configurar Pub/Sub para Alertas Programáticos

Para receber alertas via Cloud Functions:

1. Criar tópico Pub/Sub:
```bash
gcloud pubsub topics create budget-alerts
```

2. Conectar budget ao Pub/Sub:
   - Em cada budget, aba **Manage notifications**
   - Selecionar **Pub/Sub topic**: `budget-alerts`

3. Criar Cloud Function listener (opcional):
```typescript
// functions/src/monitoring/budget-alerts.ts
export const onBudgetAlert = functions.pubsub
  .topic("budget-alerts")
  .onPublish(async (message) => {
    const budgetData = message.json;
    const costAmount = budgetData.costAmount;
    const budgetAmount = budgetData.budgetAmount;
    const percentageUsed = (costAmount / budgetAmount) * 100;

    console.log(`[BUDGET] Alert: ${percentageUsed.toFixed(2)}% used`);

    // Enviar notificação no app
    // Desabilitar features não-essenciais se >90%
    // etc.
  });
```

---

## 2. TTL Cleanup (Limpeza Automática de Dados Antigos)

### XP Logs (1 ano)

**Função**: `cleanupOldXpLogs`
**Schedule**: Todo domingo às 03:00 (America/Sao_Paulo)
**TTL**: 1 ano

**O que faz**:
- Deleta `xp_logs` com `created_at` > 1 ano
- Processa em batches de 500 documentos
- Registra métricas de quantos docs foram deletados

**Como monitorar**:
```bash
# Ver logs da última execução
firebase functions:log --only cleanupOldXpLogs --limit 100

# Ver métricas de cleanup
# Firestore Console -> metrics collection -> type: "xp_logs_cleanup"
```

### Activities (90 dias)

**Função**: `cleanupOldActivities`
**Schedule**: Todo domingo às 04:00
**TTL**: 90 dias

Feed de atividades não precisa manter histórico infinito.

### Notifications (30 dias, apenas lidas)

**Função**: `cleanupOldNotifications`
**Schedule**: Todo domingo às 05:00
**TTL**: 30 dias (apenas notificações **lidas**)

**Nota**: Notificações não-lidas nunca são deletadas automaticamente.

### Como Testar Cleanup Localmente

```bash
# 1. Build functions
cd functions && npm run build

# 2. Invocar função manualmente (emulator)
firebase emulators:start --only functions

# 3. Em outro terminal, trigger via curl
curl -X POST http://localhost:5001/futebadosparcas/southamerica-east1/cleanupOldXpLogs
```

---

## 3. Multi-Region Deployment

### Configuração Atual

**Primary Region**: `southamerica-east1` (São Paulo, Brasil)
**Fallback Region**: `us-central1` (Iowa, EUA)

### Latência Esperada

| Região do Usuário | southamerica-east1 | us-central1 |
|-------------------|-------------------|-------------|
| Brasil (SP)       | ~10-30ms          | ~150-200ms  |
| Brasil (NE)       | ~30-50ms          | ~180-220ms  |
| Argentina         | ~50-80ms          | ~200-250ms  |
| EUA               | ~200-250ms        | ~20-50ms    |

### Deploy Multi-Region

**Principais funções**:
- XP processing: `southamerica-east1`
- Scheduled functions: `southamerica-east1`
- Storage triggers: `southamerica-east1`

**Como configurar**:

```typescript
// functions/src/index.ts
export const onGameStatusUpdate = onDocumentUpdated({
  document: "games/{gameId}",
  region: "southamerica-east1",  // ← Primary region
  memory: "1GiB"
}, async (event) => { ... });
```

**Deploy**:
```bash
cd functions
npm run build
firebase deploy --only functions
```

### Monitorar Latência

```bash
# Ver métricas de execução
firebase functions:log --only onGameStatusUpdate --limit 50

# Buscar por "execution took"
# Exemplo: "Function execution took 1234 ms"
```

---

## 4. Cloud Storage Thumbnails

### Como Funciona

**Trigger**: Quando uma imagem é enviada para `/profile_photos/` ou `/group_photos/`

**Processo**:
1. Cloud Function `generateProfileThumbnail` é acionada
2. Download da imagem original
3. Resize para 200x200px usando Sharp
4. Upload do thumbnail para `/thumbnails/`
5. Atualizar documento do usuário com `photo_thumbnail_url`

### Instalação de Dependências

```bash
cd functions
npm install sharp @google-cloud/storage
npm install --save-dev @types/sharp
```

### Configuração no App (Android)

**Antes** (carregava imagem full-size em listas):
```kotlin
AsyncImage(
  model = user.photoUrl,
  contentDescription = null
)
```

**Depois** (usa thumbnail em listas, full-size em perfil):
```kotlin
// Em listas (PlayerItem, RankingItem, etc.)
AsyncImage(
  model = user.photoThumbnailUrl ?: user.photoUrl,
  contentDescription = null
)

// Em perfil completo
AsyncImage(
  model = user.photoUrl,
  contentDescription = null
)
```

### Monitorar Thumbnails

```bash
# Ver logs de thumbnail generation
firebase functions:log --only generateProfileThumbnail --limit 50

# Verificar métricas
# Firestore -> metrics -> type: "thumbnail_generated"
```

### Redução de Custos Esperada

| Item | Antes | Depois | Economia |
|------|-------|--------|----------|
| Tamanho médio imagem | 500KB | 20KB (thumb) | 96% |
| Egress/mês (1000 usuários) | ~500MB | ~20MB | 96% |
| Custo egress/mês | ~$0.12 | ~$0.005 | 96% |

---

## 5. Soft Delete (Recuperação de Dados)

### Como Funciona

Ao invés de deletar permanentemente, documentos são marcados com `deleted_at`:

```typescript
// Soft delete de um game
await gameRef.update({
  deleted_at: Timestamp.now(),
  deleted_by: userId,
  status: "DELETED"
});
```

### Queries com Soft Delete

**Android (Repository)**:
```kotlin
// Buscar apenas jogos NÃO deletados
fun getActiveGames(): Flow<List<Game>> {
    return firestore.collection("games")
        .whereEqualTo("deleted_at", null)  // ← Filtro soft-delete
        .orderBy("created_at", Query.Direction.DESCENDING)
        .snapshots()
        .map { it.toObjects<Game>() }
}
```

**Firestore Rules** (já atualizado):
```javascript
// Regra para evitar leitura acidental de deletados
match /games/{gameId} {
  allow read: if isAuthenticated() &&
    (resource.data.deleted_at == null || isAdmin());
}
```

### Cleanup Permanente (90 dias)

**Função**: `cleanupSoftDeletedGames`, `cleanupSoftDeletedGroups`, `cleanupSoftDeletedLocations`
**Schedule**: Sábado às 02:00, 02:30, 03:00
**TTL**: 90 dias após `deleted_at`

Documentos soft-deleted são mantidos por 90 dias para recuperação, depois deletados permanentemente.

### Recuperar Documento Deletado (Admin)

```typescript
// Cloud Function callable (apenas admin)
export const recoverSoftDeleted = functions.https.onCall(async (request) => {
  const { collection, docId } = request.data;

  // Verificar se é admin
  if (!isAdmin(request.auth.uid)) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  await db.collection(collection).doc(docId).update({
    deleted_at: FieldValue.delete(),
    deleted_by: FieldValue.delete(),
    status: "ACTIVE"
  });

  return { success: true };
});
```

---

## 6. Dashboard de Métricas

### Estrutura da Coleção `metrics`

```typescript
interface Metric {
  type: string;  // "hourly_snapshot" | "daily_snapshot" | "xp_logs_cleanup" | etc
  timestamp: Timestamp;

  // Hourly snapshot
  document_counts?: Record<string, number>;  // Contadores por coleção
  deltas?: Record<string, number>;           // Crescimento na última hora
  games_last_24h?: number;
  active_users_last_7d?: number;

  // Daily snapshot
  date?: string;  // YYYY-MM-DD
  games_created?: number;
  games_finished?: number;
  users_created?: number;

  // Cleanup
  deleted_count?: number;
  cutoff_date?: Timestamp;
}
```

### Como Visualizar Métricas

#### Opção 1: Firestore Console (manual)

1. Acessar: https://console.firebase.google.com/project/futebadosparcas/firestore
2. Coleção: `metrics`
3. Filtrar por `type`:
   - `hourly_snapshot`: métricas horárias
   - `daily_snapshot`: resumo diário
   - `xp_logs_cleanup`: logs de limpeza

#### Opção 2: Query Programática

```kotlin
// Android - ViewModel
suspend fun getMetricsLast7Days(): List<DailyMetric> {
    val sevenDaysAgo = Timestamp.now().seconds - (7 * 24 * 60 * 60)

    return firestore.collection("metrics")
        .whereEqualTo("type", "daily_snapshot")
        .whereGreaterThan("timestamp", Timestamp(sevenDaysAgo, 0))
        .orderBy("timestamp", Query.Direction.DESCENDING)
        .get()
        .await()
        .toObjects<DailyMetric>()
}
```

#### Opção 3: Google Data Studio (recomendado para produção)

1. Acessar: https://datastudio.google.com
2. Criar novo relatório
3. Conectar ao Firestore:
   - Data source: **BigQuery**
   - Exportar Firestore para BigQuery (ativar no console)
4. Criar gráficos:
   - Linha: jogos criados/dia
   - Barra: contadores de documentos
   - Gauge: % de budget usado

### Métricas Principais a Monitorar

| Métrica | Alerta | Ação |
|---------|--------|------|
| Jogos criados/dia | < 5 | Verificar engajamento |
| Usuários ativos (7d) | < 50 | Campanha de retenção |
| XP logs/dia | > 1000 | Verificar se há spam |
| Storage usado | > 80% quota | Limpar storage antigo |
| Firestore reads/dia | > 100k | Otimizar queries |

---

## 7. Checklist de Deployment

Antes de fazer deploy de novas funções de infraestrutura:

- [ ] **Testar localmente com emulators**
```bash
firebase emulators:start --only functions,firestore
```

- [ ] **Verificar region** (southamerica-east1)

- [ ] **Verificar memory/timeout**
  - Cleanup: 512MiB, 540s
  - Thumbnails: 1GiB, 120s
  - Metrics: 512MiB, 300s

- [ ] **Testar em dev environment** (projeto separado)
```bash
firebase use futebadosparcas-dev
firebase deploy --only functions:cleanupOldXpLogs
```

- [ ] **Verificar Firestore indexes** (criar se necessário)
```bash
# Ver indexes necessários
firebase firestore:indexes

# Criar index via console se erro de "missing index"
```

- [ ] **Deploy em produção**
```bash
firebase use futebadosparcas
firebase deploy --only functions
```

- [ ] **Monitorar logs após deploy**
```bash
firebase functions:log --limit 100
```

---

## 8. Troubleshooting

### Problema: Cleanup não está deletando documentos

**Causa**: Index faltando em `deleted_at` ou `created_at`

**Solução**:
```bash
# Ver erro nos logs
firebase functions:log --only cleanupOldXpLogs

# Criar index via console (link aparece no erro)
```

### Problema: Thumbnails não são gerados

**Causa**: Dependência `sharp` não instalada ou incompatível

**Solução**:
```bash
cd functions
rm -rf node_modules package-lock.json
npm install
npm install sharp --platform=linux --arch=x64
npm run build
firebase deploy --only functions:generateProfileThumbnail
```

### Problema: Métricas não aparecem

**Causa**: Timezone ou schedule incorreto

**Solução**:
```bash
# Ver próxima execução agendada
firebase functions:log --only collectHourlyMetrics

# Testar manualmente via curl (emulator)
curl -X POST http://localhost:5001/.../collectHourlyMetrics
```

### Problema: Budget alerts não chegam

**Causa**: Email não configurado ou Pub/Sub não conectado

**Solução**:
1. Verificar configuração de notificações no Budget
2. Testar Pub/Sub:
```bash
gcloud pubsub topics publish budget-alerts --message '{"test": true}'
```

---

## 9. Custos Estimados (Monthly)

| Serviço | Uso Estimado | Custo |
|---------|--------------|-------|
| Firestore Reads | 500k/mês | $0.18 |
| Firestore Writes | 100k/mês | $0.54 |
| Cloud Functions | 200k invocations | $0.80 |
| Cloud Storage (10GB) | 10GB | $0.26 |
| Storage Egress (thumbnails) | 20MB | $0.005 |
| **TOTAL** | | **~$1.80/mês** |

**Com otimizações** (thumbnails, TTL cleanup, caching):
- Redução de reads: 30%
- Redução de storage: 40%
- **TOTAL OTIMIZADO**: ~$1.20/mês

---

## 10. Próximos Passos (Roadmap)

- [ ] Implementar cache Redis para queries frequentes
- [ ] Exportar Firestore para BigQuery (analytics)
- [ ] Dashboard visual com Data Studio
- [ ] Alertas proativos (Slack/Discord webhook)
- [ ] Auto-scaling de Cloud Functions
- [ ] CDN para imagens (Cloud CDN ou Cloudflare)

---

## Referências

- [Firebase Pricing](https://firebase.google.com/pricing)
- [Cloud Functions Quotas](https://cloud.google.com/functions/quotas)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Budget Alerts Setup](https://cloud.google.com/billing/docs/how-to/budgets)
