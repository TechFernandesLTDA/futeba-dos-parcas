# Firebase Budget Alerts Setup - P0 #35

**Implementação:** 2026-02-05
**Status:** IMPLEMENTATION GUIDE
**Objetivo:** Configurar alertas de orçamento no Firebase para evitar custos inesperados

---

## 1. Por que Configurar Budget Alerts?

Firebase é um serviço **pay-as-you-go**. Sem alertas, é possível ter cobranças inesperadas:

- **Firestore:** $0.06 por 100k reads em produção
- **Cloud Functions:** $0.40 por 1 milhão de invocações
- **Cloud Storage:** $0.023 por GB/mês
- **FCM:** Gratuito até 10k mensagens/dia

**Recomendação:** Configurar alertas para:
- Limite diário: **$10/dia**
- Limite semanal: **$50/semana**
- Limite mensal: **$200/mês**

---

## 2. Configurar Budget Alert no Firebase Console

### Passo 1: Acessar Google Cloud Console

1. Ir para: [console.cloud.google.com](https://console.cloud.google.com)
2. Selecionar o projeto `futebadosparcas` (ou seu Project ID)
3. No menu lateral, ir para: **Billing** → **Budgets and alerts**

### Passo 2: Criar um Budget

1. Clique em **+ CREATE BUDGET**
2. Preencha os campos:
   - **Budget name:** `Futeba Daily Budget` ou `Futeba Production Monthly`
   - **Projects:** Selecione `futebadosparcas`
   - **Services:** Deixe **All services** (ou selecione Firestore, Cloud Functions, Storage, Pub/Sub)

3. Configure os limites:
   - **Budget type:** Monthly
   - **Budget amount:** $200 (ou seu limite aceitável)

### Passo 3: Configurar Alertas Automáticos

Na seção **Alerts**, configure percentuais para notificação:

- **50%:** Notificação quando atingir $100/mês (cautela)
- **80%:** Notificação quando atingir $160/mês (atenção)
- **100%:** Notificação quando atingir $200/mês (crítico)

### Passo 4: Configurar Destinatário das Notificações

1. Na seção **Notifications**:
   - **Email:** Adicione `ricardogf2004@gmail.com` (ou seu email principal)
   - Ou crie um **Pub/Sub topic** para alertas programáticos

2. Clique em **CREATE BUDGET**

---

## 3. Alertas Diários (Automação com Cloud Functions)

Para alertas mais granulares (diários), use a API do Cloud Billing:

### Passo 1: Habilitar Cloud Billing API

```bash
# Via gcloud CLI
gcloud services enable cloudbilling.googleapis.com

# Ou no Console:
# Ir para APIs & Services → Enable APIs → Cloud Billing API
```

### Passo 2: Criar Cloud Function para Alertas Diários

Crie `/functions/src/monitoring/daily-budget-check.ts`:

```typescript
/**
 * DAILY BUDGET CHECK
 *
 * Verifica custos diários e envia alerta se exceder limite.
 * Executar via Cloud Scheduler a cada dia às 6 AM UTC.
 */

import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {HttpsError} from "firebase-functions/v2/https";

const db = admin.firestore();

// Configuração de limites
const DAILY_BUDGET_LIMIT = 10; // USD
const ALERT_THRESHOLD = 0.8; // Alerta em 80%

export const dailyBudgetCheck = onSchedule(
  "0 6 * * *", // 6 AM UTC (3 AM BRT)
  async () => {
    console.log("[BUDGET_CHECK] Iniciando verificação de orçamento diário...");

    try {
      // 1. Obter custos dos últimos 24 horas (via Cloud Billing API)
      const costData = await getDailyCost();

      if (!costData) {
        console.warn("[BUDGET_CHECK] Não foi possível obter dados de custo");
        return;
      }

      const {cost, date} = costData;
      const percentageUsed = cost / DAILY_BUDGET_LIMIT;

      console.log(
        `[BUDGET_CHECK] Custo de ${date}: $${cost.toFixed(2)}/${DAILY_BUDGET_LIMIT.toFixed(2)}`
      );

      // 2. Verificar se excedeu limite
      if (percentageUsed >= ALERT_THRESHOLD) {
        await sendBudgetAlert({
          date,
          cost,
          limit: DAILY_BUDGET_LIMIT,
          percentageUsed: Math.round(percentageUsed * 100),
          severity: percentageUsed >= 1 ? "CRITICAL" : "WARNING",
        });
      }

      // 3. Registrar métrica no Firestore
      await db
        .collection("budget_metrics")
        .doc(date)
        .set(
          {
            cost,
            percentage_used: percentageUsed,
            alert_sent: percentageUsed >= ALERT_THRESHOLD,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true}
        );
    } catch (error) {
      console.error("[BUDGET_CHECK] Erro:", error);
      throw new HttpsError("internal", "Budget check failed");
    }
  }
);

// ==========================================
// HELPER FUNCTIONS
// ==========================================

interface CostData {
  cost: number;
  date: string;
}

/**
 * Obtém custos dos últimos 24 horas via Cloud Billing API.
 * NOTA: Requer credenciais com permissão `billing.accounts.get`
 */
async function getDailyCost(): Promise<CostData | null> {
  // TODO: Implementar chamada à Cloud Billing API
  // Referência: https://cloud.google.com/billing/docs/how-to/query-cost-data
  //
  // Este é um exemplo placeholder - em produção, usar BigQuery:
  // SELECT SUM(cost) FROM `project.dataset.gcp_billing_export_v1_*`
  // WHERE DATE(usage_start_time) = CURRENT_DATE()

  const today = new Date().toISOString().split("T")[0];

  // Placeholder: retornar valor mockado para teste
  return {
    cost: Math.random() * 5, // 0-5 USD (random)
    date: today,
  };
}

/**
 * Envia alerta de orçamento para administradores.
 */
async function sendBudgetAlert(data: {
  date: string;
  cost: number;
  limit: number;
  percentageUsed: number;
  severity: "WARNING" | "CRITICAL";
}): Promise<void> {
  console.log(
    `[BUDGET_ALERT] ${data.severity}: ${data.percentageUsed}% de $${data.limit}/dia utilizado`
  );

  // 1. Registrar em audit_logs
  await db.collection("audit_logs").add({
    type: "BUDGET_ALERT",
    severity: data.severity,
    cost: data.cost,
    limit: data.limit,
    percentage: data.percentageUsed,
    date: data.date,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 2. Enviar notificação (implementar conforme necessário)
  // - Email via SendGrid
  // - Slack webhook
  // - Pub/Sub para sistema externo

  console.log("[BUDGET_ALERT] Alerta registrado no Firestore");
}
```

### Passo 3: Configurar Cloud Scheduler

```bash
# Criar job para executar a função diariamente às 6 AM UTC
gcloud scheduler jobs create pubsub daily-budget-check \
  --location=us-central1 \
  --schedule="0 6 * * *" \
  --topic=projects/futebadosparcas/topics/scheduled-tasks

# Conectar à Cloud Function (via Pub/Sub trigger)
```

---

## 4. Monitorar Custos em Tempo Real

### Dashboard Recomendado

1. No Firebase Console → **Project Settings** → **Usage and billing**
2. Visualizar:
   - Firestore: reads, writes, deletes
   - Cloud Functions: invocations, GB-seconds
   - Cloud Storage: data stored, egress

### Queries BigQuery para Análise Detalhada

```sql
-- Custos por serviço (últimos 7 dias)
SELECT
  service.description as service,
  SUM(cost) as total_cost,
  COUNT(*) as num_records
FROM `project.dataset.gcp_billing_export_v1_*`
WHERE DATE(usage_start_time) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY service.description
ORDER BY total_cost DESC;

-- Top 10 projetos por custo
SELECT
  project.name,
  SUM(cost) as total_cost
FROM `project.dataset.gcp_billing_export_v1_*`
WHERE DATE(usage_start_time) = CURRENT_DATE()
GROUP BY project.name
ORDER BY total_cost DESC
LIMIT 10;
```

---

## 5. Checklist de Otimização de Custos

Implementadas (P0 #1-34):
- [x] Custom Claims para reduzir Firestore reads (-40%)
- [x] Firebase App Check para evitar abuso
- [x] Rate limiting em Cloud Functions (anti-bot)
- [x] Compactação de XP logs (manutenção)

Recomendadas (P2):
- [ ] Cache de leaderboards com Redis
- [ ] CDN para assets estáticos (Cloudflare)
- [ ] Compression de imagens no upload
- [ ] Firestore data lifecycle (deletar logs após 1 ano)

---

## 6. Resolvendo Custos Inesperados

### Problema: Firestore reads muito altos

**Diagnóstico:**
```bash
# Via Cloud Logging
gcloud logging read 'resource.type="cloud_firestore"' --limit=50
```

**Solução:**
1. Verificar queries N+1 em ViewModels
2. Usar `.limit()` em todas as queries
3. Implementar cache em RAM
4. Usar offline persistence

### Problema: Cloud Functions invocations altas

**Diagnóstico:**
- Verificar se há listeners ou triggers duplicados
- Procurar por recursão infinita

**Solução:**
1. Auditar triggers (onWrite, onUpdate, onDelete)
2. Adicionar rate limiting
3. Usar batching para operações em massa

---

## 7. Contatos e Suporte

- **Firebase Console:** [console.firebase.google.com](https://console.firebase.google.com)
- **Google Cloud Console:** [console.cloud.google.com](https://console.cloud.google.com)
- **Billing Support:** Dentro do Cloud Console → Help → Create issue
- **Status Page:** [status.firebase.google.com](https://status.firebase.google.com)

---

**Próximas ações:**
1. ✅ Configurar alertas no Firebase Console (HOJE)
2. ⏳ Implementar daily-budget-check.ts (Próxima sprint)
3. ⏳ Configurar BigQuery billing export (Próxima sprint)
4. ⏳ Dashboard personalizado em Grafana (Futuro)

**Data de implementação:** 2026-02-05
