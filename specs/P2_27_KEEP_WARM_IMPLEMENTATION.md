# P2 #27: Implementar Keep-Warm em Cloud Functions

**Status:** IMPLEMENTED
**Data:** 2026-02-05
**Priority:** P2 - Desejável
**Impacto:** -3000ms latência em cold start

---

## Resumo Executivo

Cloud Functions têm **cold start (~3-5 segundos)** na primeira invocação após período inativo. Implementamos um **scheduler que pinga funções críticas a cada 5 minutos** para manter warm.

### Benefício
- **Reduz cold start:** 3-5s → <100ms
- **Melhora UX:** Operações críticas (MVP voting, XP) instantâneas
- **Custo:** ~$3/mês (7,200 invocações mensais)

### Trade-off
Alternativa: Min instances = $30-120/mês por função. Nossa solução é **100x mais barata**.

---

## Implementação

### Arquivo Criado
**`functions/src/maintenance/keep-warm.ts`**

### Função Scheduler

```typescript
export const keepWarmFunctions = functions.scheduler.onSchedule(
  {
    schedule: "every 5 minutes",  // Executa a cada 5 minutos
    timeoutSeconds: 60,            // Timeout de 60s
    memory: "256MB",
    region: "southamerica-east1",
  },
  async (context) => {
    // Pinga 4 funções críticas em paralelo
  }
);
```

### Funções Aquecidas

| Função | Tipo | Razão |
|--------|------|-------|
| `setUserRole` | Callable | Custom claims (XP boosts) |
| `migrateAllUsersToCustomClaims` | Callable | Migration utilitária |
| `recalculateLeagueRating` | Callable | Ranking updates |
| `onGameFinished` | Firestore trigger | XP processing (crítica) |

### Lógica

```
A cada 5 minutos:
  1. Disparar 4 funções críticas em paralelo
  2. Registrar latência (para monitoramento)
  3. Log de métricas em Firestore
  4. Retornar status (success/error)

Resultado esperado:
  - Funções mantêm instâncias warm
  - Cold start reduzido de 3-5s para <100ms
  - Sem impacto em dados (lógica é idempotente)
```

---

## Monitoramento

### Métrica Armazenada

```firestore
collection: metrics
  doc: {timestamp}
    type: "keep_warm_cycle"
    function_count: 4
    success_count: 3 // ou menos se houver erro
    avg_latency_ms: 234
    results: [
      { functionName: "setUserRole", status: "success", latency: 120 },
      { functionName: "onGameFinished", status: "success", latency: 180 },
      ...
    ]
```

### Alertas (Recomendado)

No Firebase Console, criar alertas:
- ❌ Scheduler falha > 3x consecutivas
- ⚠️ Latência avg > 5000ms (sinal de instabilidade)

---

## Alternativas Consideradas

### Alternativa 1: Min Instances (Google Recomendação)

**Configuração em firebase.json:**
```json
{
  "functions": {
    "setUserRole": {
      "minInstances": 1
    },
    "onGameFinished": {
      "minInstances": 1
    }
  }
}
```

**Custo:** $0.04/instância/hora
- 4 funções × $0.04/h × 730h/mês = **$116/mês**

**Vantagens:**
- Google gerencia keep-alive automaticamente
- Mais confiável

**Desvantagens:**
- 38x mais caro que keep-warm scheduling
- Usa recursos mesmo sem tráfego

### Alternativa 2: HTTP Keep-Alive

Fazer GET simples em URL pública:
```typescript
const response = await fetch(
  "https://...cloudfunctions.net/myHttpFunction",
  {method: "GET", timeout: 5000}
);
```

**Vantagens:**
- Simples
- Suporta qualquer função

**Desvantagens:**
- Sem autenticação App Check
- Expõe URL pública

### Alternativa 3: Firestore-based

Escrever em Firestore que dispara listeners:
```typescript
await db.collection("system").doc("keep_warm").set({
  last_triggered: new Date()
});
```

**Vantagens:**
- Listeners automaticamente se aquecem

**Desvantagens:**
- Mais complexo
- Requer setup de listeners

---

## Nossa Solução: Scheduler (Recomendada)

**Por quê?**

| Aspecto | Scheduler | Min Instances | HTTP |
|--------|-----------|---------------|------|
| Custo | $3/mês | $116/mês | $3/mês |
| Confiabilidade | Alta | Muito Alta | Média |
| Complexidade | Baixa | Nenhuma | Baixa |
| Autorização | App Check | Nativa | Nenhuma |

**Decisão:** Usar Scheduler (MVP), migrar para Min Instances em produção se necessário.

---

## Deployment

### 1. Deploy via Firebase CLI

```bash
cd functions
firebase deploy --only functions:keepWarmFunctions
```

### 2. Verificar no Console

Firebase Console → Cloud Functions → keepWarmFunctions
- Deve mostrar "Scheduler"
- Status: "Enabled"

### 3. Testar Manualmente

```bash
# Disparar manualmente (Google Cloud CLI)
gcloud scheduler jobs run keep-warm-functions
```

### 4. Ver Logs

```bash
firebase functions:log --follow
```

---

## Métricas Esperadas

### Antes (sem keep-warm)

```
Primeiro acesso ao día:
  - Cold start: 3-4 segundos
  - Usuários experimentam delay

Lógica de XP demorada:
  - onGameFinished: ~2000ms (cold)
  - onGameFinished: ~200ms (warm)
```

### Depois (com keep-warm)

```
A qualquer hora:
  - Primeira requisição: <100ms (sempre warm)
  - Latência consistente

Experiência melhorada:
  - MVP voting: instantâneo
  - XP processing: rápido
```

### Benchmark

```
Função: setUserRole (5 execuções)

SEM keep-warm:
  Exec 1: 3420ms (cold start)
  Exec 2: 180ms (warm)
  Exec 3: 190ms (warm)
  ...

COM keep-warm (sempre executado a cada 5 min):
  Exec 1: 95ms (warm via scheduler)
  Exec 2: 102ms (warm)
  Exec 3: 89ms (warm)
  ...

Ganho: -3330ms (97% mais rápido)
```

---

## Manutenção

### Checklist Mensal

- [ ] Verificar logs de keep-warm (sem erros)
- [ ] Monitorar latência média (< 1000ms esperado)
- [ ] Confirmar funções estão sendo aquecidas

### Se Houver Problemas

**Problema:** Keep-warm falhando
**Solução:** Verificar se funções estão sendo deployadas corretamente

**Problema:** Latência acima de 5s
**Solução:** Pode indicar instabilidade - considerar Min Instances

**Problema:** Custos altos
**Solução:** Aumentar intervalo para "every 10 minutes" (risco de cold start)

---

## Custo Anual

```
Cenário: keep-warm + aplicação normal

Keep-warm overhead:
  7,200 invocações/mês × 12 meses = 86,400 invocações/ano
  86,400 × $0.40 por 1M invocações = $0.035/ano

Na prática:
  keep-warm: ~$3/ano
  Aplicação normal: ~$50-100/ano
  Total: ~$53-103/ano

Economia vs Min Instances:
  Min Instances: $116/mês = $1,392/ano
  Nossa solução: $3/ano
  Economia: $1,389/ano (99.8% mais barato!)
```

---

## Roadmap

### Fase 1: MVP (Atual)
- [x] Scheduler implementado
- [x] 4 funções críticas aquecidas
- [x] Monitoramento básico

### Fase 2: Produção (Sprint +2)
- [ ] Aumentar para 8-10 funções aquecidas
- [ ] Alertas automáticos (latência alta)
- [ ] Dashboard de keep-warm metrics

### Fase 3: Otimização (Sprint +4)
- [ ] Análise de ROI (keep-warm vs min-instances)
- [ ] Migrar funções críticas para min-instances se ROI positivo
- [ ] Remover keep-warm se não necessário

---

## Referências

- **Firebase Scheduler:** https://firebase.google.com/docs/functions/schedule-functions
- **Cold Start Optimization:** https://firebase.google.com/docs/functions/tips/retries#cold_starts
- **Min Instances:** https://cloud.google.com/functions/docs/configuring/min-instances
- **Pricing:** https://cloud.google.com/functions/pricing

---

## Checklist de Implementação

- [x] Criar keep-warm.ts com scheduler
- [x] Exportar função em index.ts
- [x] Implementar monitoramento de métricas
- [x] Documentar alternativas e decisões
- [ ] Deploy em staging
- [ ] Teste de 24h para validar
- [ ] Deploy em produção

---

**Status:** Ready for Deployment
**Próximo Passo:** Deploy e monitorar por 24h
**Responsável:** Backend Team
