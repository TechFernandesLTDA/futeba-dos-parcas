# Infrastructure Implementation Checklist

Checklist de validação para implementação de infraestrutura de monitoring e otimizações.

## ✅ Definition of Done

### 1. Budget Alerts (Firebase Console)

- [ ] **Budget diário criado** ($10/dia)
  - Alertas em: 50%, 80%, 100%, 120%
  - Notificações: email admin

- [ ] **Budget semanal criado** ($50/semana)
  - Alertas em: 50%, 80%, 100%, 120%
  - Notificações: email admin

- [ ] **Budget mensal criado** ($200/mês)
  - Alertas em: 50%, 75%, 90%, 100%, 110%
  - Notificações: email admin + SMS

- [ ] **Pub/Sub topic criado** (`budget-alerts`)
- [ ] **Budgets conectados ao Pub/Sub**
- [ ] **Teste de alerta recebido** (email ou Pub/Sub)

**Como validar**:
```bash
# Verificar se pub/sub topic existe
gcloud pubsub topics list | grep budget-alerts

# Testar pub/sub manualmente
gcloud pubsub topics publish budget-alerts --message '{"test": true}'
```

---

### 2. TTL Cleanup Implementado

- [ ] **cleanupOldXpLogs deployed**
  - Schedule: Domingo 03:00
  - TTL: 1 ano
  - Região: southamerica-east1

- [ ] **cleanupOldActivities deployed**
  - Schedule: Domingo 04:00
  - TTL: 90 dias

- [ ] **cleanupOldNotifications deployed**
  - Schedule: Domingo 05:00
  - TTL: 30 dias (apenas lidas)

- [ ] **Firestore indexes criados**
  - `xp_logs`: `created_at` ASC
  - `activities`: `created_at` ASC
  - `notifications`: `read` ASC, `created_at` ASC

**Como validar**:
```bash
# Ver funções deployed
firebase functions:list | grep cleanup

# Testar manualmente (emulator)
firebase emulators:start --only functions
curl -X POST http://localhost:5001/.../cleanupOldXpLogs

# Ver logs de execução
firebase functions:log --only cleanupOldXpLogs --limit 50
```

---

### 3. Multi-Region Deployment

- [ ] **Funções principais em southamerica-east1**
  - onGameStatusUpdate
  - recalculateLeagueRating
  - All scheduled functions

- [ ] **Latência medida** (antes/depois)
  - Brasil SP: < 50ms
  - Brasil NE: < 80ms

- [ ] **Documentação atualizada** (MONITORING_GUIDE.md)

**Como validar**:
```bash
# Ver região de cada função
firebase functions:list

# Ver logs com tempo de execução
firebase functions:log --only onGameStatusUpdate --limit 20 | grep "execution took"
```

---

### 4. Cloud Storage Thumbnails

- [ ] **generateProfileThumbnail deployed**
  - Trigger: profile_photos/
  - Resize: 200x200px
  - Formato: JPEG 80%

- [ ] **generateGroupThumbnail deployed**
  - Trigger: group_photos/
  - Resize: 200x200px

- [ ] **Dependências instaladas**
  - `sharp` (v0.34+)
  - `@google-cloud/storage` (v7+)

- [ ] **Usuários atualizados com photo_thumbnail_url**
- [ ] **App Android usando thumbnails em listas**

**Como validar**:
```bash
# Instalar dependências
cd functions && ./install-infrastructure-deps.sh

# Build
npm run build

# Deploy
firebase deploy --only functions:generateProfileThumbnail,functions:generateGroupThumbnail

# Testar upload de imagem
# 1. Fazer upload via app
# 2. Ver logs
firebase functions:log --only generateProfileThumbnail --limit 10

# Verificar storage
gsutil ls gs://futebadosparcas.appspot.com/profile_photos/thumbnails/
```

**Validação no App**:
```kotlin
// Verificar que thumbnail_url está sendo usado
// Em PlayerItem, RankingItem, etc.
AsyncImage(
  model = user.photoThumbnailUrl ?: user.photoUrl,
  ...
)
```

---

### 5. Soft Delete Implementado

- [ ] **Firestore Rules atualizadas**
  - `games`: soft-delete support
  - `groups`: soft-delete support
  - `locations`: soft-delete support

- [ ] **Cleanup functions deployed**
  - cleanupSoftDeletedGames (Sábado 02:00)
  - cleanupSoftDeletedGroups (Sábado 02:30)
  - cleanupSoftDeletedLocations (Sábado 03:00)

- [ ] **softDeleteGame callable function deployed**
- [ ] **Queries atualizadas** (filtrar `deleted_at == null`)
- [ ] **UI atualizada** (ação de delete usa soft-delete)

**Como validar**:
```bash
# Testar soft-delete via callable
# (usar app ou script de teste)

# Verificar que documento tem deleted_at
# Firestore Console -> games -> ver documento deletado

# Verificar que não aparece em queries normais
# (app não deve mostrar jogos deletados)

# Verificar que admin pode ver deletados
# (implementar tela de admin recovery)
```

**Firestore Rules Test**:
```javascript
// Usuário normal NÃO vê soft-deleted
read(/databases/futebadosparcas/documents/games/GAME_ID_DELETED)
// → DENY (se deleted_at != null)

// Admin VÊ soft-deleted
read(/databases/futebadosparcas/documents/games/GAME_ID_DELETED)
// → ALLOW (se isAdmin())
```

---

### 6. Métricas Coletadas

- [ ] **collectHourlyMetrics deployed**
  - Schedule: A cada hora
  - Coleção: `metrics`
  - Type: `hourly_snapshot`

- [ ] **collectDailyMetrics deployed**
  - Schedule: 23:59 diariamente
  - Type: `daily_snapshot`

- [ ] **cleanupOldMetrics deployed**
  - Schedule: Segunda 02:00
  - TTL: 90 dias

- [ ] **Métricas visíveis** (Firestore Console ou Dashboard)

**Como validar**:
```bash
# Deploy metrics functions
firebase deploy --only functions:collectHourlyMetrics,functions:collectDailyMetrics,functions:cleanupOldMetrics

# Aguardar 1 hora ou trigger manualmente
firebase emulators:start
curl -X POST http://localhost:5001/.../collectHourlyMetrics

# Ver métricas coletadas
# Firestore Console -> metrics collection -> type: "hourly_snapshot"
```

**Verificar estrutura de métricas**:
```javascript
{
  type: "hourly_snapshot",
  timestamp: Timestamp,
  document_counts: {
    users: 152,
    games: 834,
    xp_logs: 4521,
    ...
  },
  deltas: {
    users: 3,    // +3 usuários na última hora
    games: 12,   // +12 jogos na última hora
    ...
  },
  games_last_24h: 45,
  active_users_last_7d: 78
}
```

---

### 7. Documentação Criada

- [ ] **MONITORING_GUIDE.md** completo
  - Budget alerts setup
  - TTL cleanup
  - Multi-region
  - Thumbnails
  - Soft delete
  - Métricas
  - Troubleshooting

- [ ] **maintenance/README.md** criado
- [ ] **install-infrastructure-deps.sh** criado
- [ ] **Checklist validado** (este arquivo)

---

## 🚀 Deploy Final

### Passo 1: Instalar Dependências

```bash
cd functions
./install-infrastructure-deps.sh
npm run build
```

### Passo 2: Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Passo 3: Deploy Functions (Staged)

**Stage 1**: Cleanup functions (low-risk)
```bash
firebase deploy --only functions:cleanupOldXpLogs,functions:cleanupOldActivities,functions:cleanupOldNotifications
```

**Aguardar 1 dia, verificar logs**

**Stage 2**: Soft-delete functions
```bash
firebase deploy --only functions:cleanupSoftDeletedGames,functions:cleanupSoftDeletedGroups,functions:cleanupSoftDeletedLocations,functions:softDeleteGame
```

**Aguardar 1 dia, verificar logs**

**Stage 3**: Thumbnails e metrics
```bash
firebase deploy --only functions:generateProfileThumbnail,functions:generateGroupThumbnail,functions:collectHourlyMetrics,functions:collectDailyMetrics,functions:cleanupOldMetrics
```

### Passo 4: Configurar Budget Alerts (Manual)

1. Acessar: https://console.cloud.google.com/billing
2. Criar 3 budgets (diário, semanal, mensal)
3. Conectar ao Pub/Sub topic `budget-alerts`
4. Testar alerta

---

## 📊 Validação de Sucesso

Após 7 dias de deploy:

- [ ] **Cleanup executado com sucesso**
  - Ver métricas de `xp_logs_cleanup`
  - Verificar redução de storage

- [ ] **Thumbnails sendo gerados**
  - Ver métricas de `thumbnail_generated`
  - Verificar redução de egress

- [ ] **Métricas coletadas**
  - Ver snapshots em `metrics` collection
  - Gráficos de crescimento funcionando

- [ ] **Soft-delete funcionando**
  - Usuários conseguem "deletar" jogos
  - Jogos deletados não aparecem em queries
  - Admin consegue recuperar deletados

- [ ] **Budget alerts funcionando**
  - Receber email de teste
  - Verificar que alertas chegam nos thresholds

---

## 🐛 Troubleshooting Common Issues

### Issue: "sharp module not found"

**Fix**:
```bash
cd functions
npm uninstall sharp
npm install sharp --platform=linux --arch=x64
npm run build
firebase deploy --only functions:generateProfileThumbnail
```

### Issue: "Missing index" em cleanup

**Fix**:
Ver link no erro do log → clicar → criar index automaticamente

Ou criar manualmente:
```bash
# Firestore Console → Indexes → Composite
# Collection: xp_logs
# Fields: created_at (ASC), __name__ (ASC)
```

### Issue: Scheduled functions não executam

**Fix**:
```bash
# Verificar que Cloud Scheduler está habilitado
gcloud services enable cloudscheduler.googleapis.com

# Listar schedules
gcloud scheduler jobs list

# Testar manualmente
gcloud scheduler jobs run cleanupOldXpLogs
```

### Issue: Budget alerts não chegam

**Fix**:
1. Verificar email correto em Budget settings
2. Verificar que Pub/Sub topic existe
3. Testar Pub/Sub manualmente

---

## 💰 Custos Esperados (Após Otimizações)

| Item | Antes | Depois | Economia |
|------|-------|--------|----------|
| Storage (10GB → 6GB) | $0.26/mês | $0.16/mês | 38% |
| Egress (thumbnails) | $0.12/mês | $0.005/mês | 96% |
| Firestore reads (cache) | $0.18/mês | $0.13/mês | 28% |
| Functions (+ cleanup) | $0.80/mês | $0.85/mês | -6% |
| **TOTAL** | **$1.36/mês** | **$1.15/mês** | **15% economia** |

**ROI**: Economia de ~$2.50/ano (1 café ☕)
**Benefício Real**: Melhor performance, dados limpos, monitoring proativo

---

## 📈 Próximos Passos (Phase 2)

Após validação completa (30 dias):

- [ ] Implementar cache Redis/Memorystore
- [ ] Exportar Firestore → BigQuery (analytics)
- [ ] Dashboard visual (Data Studio/Looker)
- [ ] Alertas Slack/Discord
- [ ] CDN para imagens (Cloud CDN)
- [ ] Auto-scaling inteligente

**Prioridade**: Baseado em métricas coletadas
