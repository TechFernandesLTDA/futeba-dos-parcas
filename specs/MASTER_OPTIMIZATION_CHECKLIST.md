# ✅ Master Optimization Checklist - Todos os 70 Problemas

**Status Geral:** 🟡 IN PROGRESS
**Atualizado:** 2026-02-04

---

## 🔥 CRÍTICOS (P0) - 15 items

### Firestore Security Rules
- [x] #1: Remover get() calls excessivos (getUserRole) ✅ (Migrado para Custom Claims - 0 reads)
- [x] #4: Migrar role para Custom Claims ✅ (FASE 2 COMPLETA - 100% usuários)
- [x] #29: Validar que XP não é editável por FIELD_OWNER ✅ (Arquiteturalmente protegido - CF only)
- [x] #30: Adicionar bounds validation em scores (max 100) ✅ (isValidScore() implementado)
- [ ] #32: Implementar Firebase App Check (em permissive mode, aguardando enforcement)

### Cloud Functions
- [ ] #6: Implementar processamento paralelo/batch de XP (não síncrono)
- [ ] #7: Adicionar Firestore batch writes (até 500 ops)
- [ ] #9: Implementar idempotência com transaction IDs
- [x] #10: Adicionar rate limiting em callable functions ✅ (2026-02-04)

### Performance
- [x] #22: Fixar memory leaks em ViewModels ✅ (Análise: todos os 37 VMs têm cleanup adequado)
- [x] #24: Habilitar offline persistence do Firestore ✅ (Já configurado: 100MB PersistentCache)
- [x] #25: Configurar Coil image caching (100MB) ✅ (Atualizado: 50MB → 100MB + hardware bitmaps)

### Segurança
- [x] #33: Proteger FCM tokens de leitura pública ✅ (Multi-layer protection implementado)
- [ ] #34: Implementar quotas por usuário (anti-bot)
- [ ] #35: Configurar Firebase Budget Alerts ($10/dia) - MANUAL

---

## 🟠 IMPORTANTES (P1) - 25 items

### Firestore Optimization
- [ ] #2: Otimizar isGroupMember() (usado em 10+ lugares)
- [ ] #3: Otimizar isGameOwner() (usado em confirmations, teams, stats)
- [ ] #5: Implementar get() em sub-coleções recursivas
- [ ] #12: Adicionar .limit() em todas as queries sem paginação
- [ ] #13: Criar compound indexes faltantes
- [ ] #14: Implementar whereIn() batching automático (chunks de 10)

### Cloud Functions
- [ ] #8: Prevenir race conditions em listeners (xp_processing flag)
- [ ] #11: Otimizar cold start (keep-alive ou migrar linguagem)
- [ ] #17: Migrar league recalculation para queue-based
- [ ] #18: Verificar badges apenas quando relevante (não TODOS)
- [ ] #19: Implementar compactação de streaks antigos
- [ ] #21: Implementar timeout para season reset (max 9 min)

### Cache & Paging
- [ ] #18: Implementar Room Database (games, users, groups)
- [ ] #19: Criar LRU cache (200 entries)
- [ ] #20: Adicionar TTL em XP logs (1 ano)
- [ ] #23: Implementar Repository Pattern consistente

### UI Performance
- [ ] #26: Auditar e otimizar Compose recompositions
- [ ] #27: Adicionar key() em LazyColumn.items()
- [ ] #28: Gerar Baseline Profiles

### Network
- [ ] #1: Reduzir queries sequenciais (3-5 por tela → 1-2)
- [ ] #3: Implementar whereIn() chunking eficiente
- [ ] #7: Implementar Paging 3 em listas

---

## 🟡 DESEJÁVEIS (P2) - 30 items

### Latência & Network
- [ ] #2: Implementar prefetching de game details
- [ ] #4: Detach real-time listeners em background
- [ ] #5: Singleton FirebaseFirestore instance
- [ ] #6: Usar Firebase Storage thumbnails (200x200)
- [ ] #8: Implementar request deduplication

### UI/UX
- [ ] #9: Otimizar recompositions com derivedStateOf
- [ ] #10: Adicionar key() em TODOS os LazyColumn
- [ ] #11: Simplificar GameCard (reduzir composables)
- [ ] #12: Usar ShimmerLoading consistentemente
- [ ] #13: Adicionar animateContentSize()
- [ ] #14: Implementar pull-to-refresh debounce (500ms)
- [ ] #15: Adicionar Coil placeholders + crossfade
- [ ] #16: Debouncing em gesture handlers (300ms)

### Memory & Caching
- [ ] #17: Cleanup de listeners em ViewModels.onCleared()
- [ ] #20: Implementar stateIn() em Flows compartilhados
- [ ] #21: Configurar Coil disk cache (100MB)

### Processamento
- [ ] #22: XP calculation em Dispatchers.Default (não Main)
- [ ] #23: Usar kotlinx.serialization (mais rápido que Gson)
- [ ] #24: Date formatting com remember {}
- [ ] #25: Sorting em Firestore query (não no ViewModel)
- [ ] #26: Usar Dispatchers customizados (IO, Default)

### Backend
- [ ] #27: Implementar keep-warm em Cloud Functions
- [ ] #28: Cache de leaderboards (Redis ou Firestore)
- [ ] #29: Batch FCM notifications (aguardar 30s)
- [ ] #30: CDN para responses públicas (rankings)

### Infraestrutura
- [ ] #36: Compressão de imagens no upload
- [ ] #37: Configurar CDN para assets (Cloudflare)
- [ ] #38: Multi-region deployment (southamerica-east1)
- [ ] #39: Implementar MVP voting sem race condition
- [ ] #40: Soft delete com deleted_at timestamp

---

## 📊 PROGRESSO POR CATEGORIA

```
🔐 Security        [██████░░░░] 6/10   (60%)  - Custom Claims, FCM, XP, Scores ✅
⚡ Performance     [███░░░░░░░] 3/20   (15%)  - ViewModels, Firestore Cache, Coil ✅
🎨 UI/UX           [█░░░░░░░░░] 1/15   (7%)   - ErrorState moderno ✅
📡 Backend         [█░░░░░░░░░] 1/15   (7%)   - Rate limiting ✅
💰 Costs           [░░░░░░░░░░] 0/10   (0%)

TOTAL: 11/70 (16%)
```

---

## 🎯 AGENTES RESPONSÁVEIS

### Agent-Security
Resolvendo: #1, #2, #3, #4, #5, #29, #30, #31, #32, #33

### Agent-Backend
Resolvendo: #6, #7, #8, #9, #10, #11, #17, #18, #21, #27, #28

### Agent-Performance
Resolvendo: #12, #13, #14, #18, #19, #20, #23, #24

### Agent-UI
Resolvendo: #22, #25, #26, #27, #9, #10, #11, #12, #15, #16, #17, #20

### Agent-Infrastructure
Resolvendo: #20, #34, #35, #36, #37, #38, #40

---

## 📝 NOTAS DE IMPLEMENTAÇÃO

### ✅ Completados (2026-02-04)
**Security (6/10):**
- #1 getUserRole(): Migrado para Custom Claims (0 Firestore reads)
- #4 Custom Claims: FASE 2 completa (100% usuários migrados)
- #29 XP Validation: Protegido arquiteturalmente (CF-only)
- #30 Score Bounds: isValidScore() enforces 0-100
- #33 FCM Tokens: Multi-layer protection (read/write blocked)
- #10 Rate Limiting: setUserRole (5/min), migrate (1/hora)

**Performance (3/20):**
- #22 Memory Leaks: Todos os 37 ViewModels têm cleanup adequado
- #24 Offline Persistence: 100MB PersistentCache habilitado
- #25 Coil Caching: Aumentado 50MB → 100MB + hardware bitmaps + RGB565

**UI/UX (1/15):**
- ErrorState moderno aplicado em HomeScreen, GamesScreen, ProfileScreen

### 🚧 Em Progresso
- PR #111: Rate limiting + UI modernization (aguardando merge)
- App Check em modo permissivo (aguardando 1 semana para enforcement)
- Coil optimization local (não commitado ainda)

### ⏸️ Bloqueados
- #35 Budget Alerts: Requer configuração manual no Google Cloud Console

### ❌ Cancelados/Adiados
(Nenhum cancelamento)

---

## 🎓 LEARNINGS & DECISÕES

### Decisão #1: Custom Claims vs Firestore for Roles
**Escolha:** Custom Claims
**Razão:** Gratuito, mais rápido, built-in no token
**Trade-off:** Requer logout/login para atualizar

### Decisão #2: Room vs Pure Firestore Cache
**Escolha:** Room Database
**Razão:** Estruturado, queries SQL, offline-first
**Trade-off:** Mais complexo, requer migrations

### Decisão #3: Batching vs Individual Writes
**Escolha:** Batch Writes
**Razão:** 12x mais rápido, atômico
**Trade-off:** Limite de 500 ops, requer refactoring

### Decisão #4: Gradual Rollout Strategy
**Escolha:** 10% → 50% → 100%
**Razão:** Minimizar risco, detectar issues cedo
**Trade-off:** Rollout mais lento (4 semanas vs 1)

---

## 📅 TIMELINE

- **Dia 1 (2026-02-02):** Specs criadas, agentes lançados
- **Dia 2-3:** Implementação core completa
- **Dia 4-5:** Supervisão e correções
- **Dia 8-10:** Alpha testing (10% usuários)
- **Dia 11-14:** Beta testing (50% usuários)
- **Dia 15+:** General Availability (100%)

---

**Última Atualização:** 2026-02-02
**Próxima Revisão:** Após conclusão dos agentes
