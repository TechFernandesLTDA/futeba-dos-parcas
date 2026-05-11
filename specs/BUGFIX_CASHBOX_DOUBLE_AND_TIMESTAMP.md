# BUGFIX: Cashbox armazena dinheiro em Double IEEE 754 e `created_at` como String

> **Status:** `TRIAGED`
> **Severidade:** `CRITICAL`
> **Autor:** Auditoria automatizada (Wave 3 / 2026-05-10)
> **Data:** 2026-05-10
> **Issues:** #947 (Double IEEE), #948 (created_at toString)
> **PR:** _pendente_

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

**Bug A — `amount` e `balance` armazenados como `Double` (IEEE 754):**

```kotlin
// shared/src/commonMain/kotlin/com/futebadosparcas/domain/model/CashboxModels.kt:90,185
data class CashboxEntry(
    ...
    val amount: Double = 0.0,         // <-- BUG
    ...
)
data class CashboxSummary(
    val balance: Double = 0.0,         // <-- BUG
    val totalIncome: Double = 0.0,
    val totalExpense: Double = 0.0,
    ...
)
```

Operações de soma/subtração em Double acumulam erro de ponto flutuante. Em BRL, isso causa:
- Saldo de R$ 100,00 + R$ 0,10 + R$ 0,20 = R$ 100,30000000000001
- Reconciliação de extrato impossível
- Reembolsos de centavos incorretos

**Bug B — `created_at` salvo como `Instant.toString()` em vez de Firestore Timestamp:**

```kotlin
// CashboxRepositoryImpl.addCashboxEntry (a verificar via Read)
docRef.set(
    mapOf(
        "amount" to entry.amount,
        "created_at" to Clock.System.now().toString(),  // <-- BUG: vira String
        ...
    )
)
```

Conseqüências:
- `orderBy("created_at")` ordena lexicograficamente em vez de cronologicamente
- Filtros `where("created_at", ">=", timestamp)` não funcionam (string vs timestamp)
- Funções Cloud que filtram por intervalo temporal silenciosamente perdem entradas

### 1.2 Comportamento Esperado (Correto)

**Bug A**: `amount` e `balance` em `Long` representando centavos (`amountCents`).
- Display sempre formatado via helper `formatCents(value): String` → `"R$ 100,30"`
- Aritmética em Long é exata e segura

**Bug B**: `created_at` salvo como `FieldValue.serverTimestamp()` (Firestore Timestamp).
- Sempre confiável (timestamp do servidor, não do cliente)
- Compatível com índices Firestore e queries temporais

### 1.3 Passos para Reproduzir

**Bug A**:
1. Adicionar 3 entradas de R$ 0,10 no caixa do grupo
2. Observar saldo: aparece R$ 0,30000000000000004 ou similar (depende de quantas operações)

**Bug B**:
1. Criar 5 entradas de cashbox
2. Listar com `orderBy("created_at", "desc")`
3. Observar ordem ERRADA (lexicográfica) — entradas com `2026-05-10T15:00:00Z` aparecem antes de `2026-05-10T08:00:00Z` se string

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Versão do app | 1.21.x |
| Plataformas afetadas | Android, Web, Functions |
| Frequência | Sempre |
| Impacto | TODOS os grupos com cashbox ativo |
| Dados em prod | SIM — risco de migração necessária |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

- `CashboxModels.kt` declarou `amount: Double` desde criação inicial
- Não há ADR/spec discutindo precisão monetária
- Web `CashboxScreen.tsx` usa `parseFloat(amount)` no input e `.toFixed(2)` no display — dupla conversão Double→String→Double que perpetua o erro
- Firestore aceita Number (sempre float64 internamente em JSON), mas docs em prod já estão como `number` — backfill possível para `cents` (Long)

### 2.2 Causa Raiz

- **Bug A**: Decisão inicial de modelagem usando tipo "natural" (Double) para "valor monetário". Comum em projetos sem revisão financeira.
- **Bug B**: Provável copy-paste de outro repositório onde `Instant.toString()` foi usado para serializar. Sem teste de query temporal que pegasse o erro.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `shared/src/commonMain/kotlin/com/futebadosparcas/domain/model/CashboxModels.kt` | Tipos do modelo (Double → Long centavos) |
| `shared/src/nativeAndAndroidMain/kotlin/com/futebadosparcas/data/CashboxRepositoryImpl.kt` | Conversão write — `created_at` para `serverTimestamp()` + `amount` em centavos |
| `shared/src/nativeAndAndroidMain/kotlin/com/futebadosparcas/platform/firebase/CashboxFirebaseExt.kt` | Conversão read — backward-compat Double→Long e Timestamp/Number/String |
| `app/src/main/java/com/futebadosparcas/ui/groups/CashboxScreen.kt` | Display formatado (Long → R$ X,XX) |
| `app/src/main/java/com/futebadosparcas/ui/groups/CashboxViewModel.kt` | Validação e parsing input → centavos |
| `web/src/pages/groups/CashboxScreen.tsx` | parseInt(centavos), formatador BRL |
| `web/src/types/cashbox.ts` (se existir) | `amount: number` (em centavos, comentado) |
| `functions/src/...` | Triggers de cashbox que recalculam summary |
| `firestore.rules` (cashbox) | Validação `request.resource.data.amount is int` |
| `scripts/data-tools/recalculate_cashbox.js` | Script de migração + recalculo |

---

## 3. Plano de Migração de Dados

### 3.1 Estratégia: dual-read, single-write, depois flip

**Fase 1 — Compat read (deploy code-only, sem migração)** _(2-3h)_
- `CashboxFirebaseExt.toCashboxEntryOrNull()` aceita ambos:
  - `amount` numérico → trata como Reais (legacy), converte para centavos in-memory: `(amount * 100).toLong()`
  - `amount_cents` Long → usa direto
- `created_at` aceita `Timestamp`, `Number` (millis), `String` (parse ISO ou millis)
- **Writes ainda em Double + String** — backward-compatible com leitores antigos

**Fase 2 — Backfill (script, em horário de baixa carga)** _(30min execução)_
- `scripts/data-tools/migrate_cashbox_to_cents.js`:
  - Para cada `groups/{gid}/cashbox/*`:
    - Read `amount` (Double), `created_at` (string ou timestamp)
    - Calcular `amount_cents = round(amount * 100)`
    - Parse `created_at` para `Timestamp`
    - Write batch update: `{amount_cents, created_at_timestamp, _migrated: true}`
  - Para cada `groups/{gid}/cashbox_summary/current`:
    - Recalcular `balance_cents`, `total_income_cents`, `total_expense_cents`
- **Roll-forward only, irreversível.** Backup Firestore antes.

**Fase 3 — Switch writes (deploy)** _(1-2h)_
- `addEntry()` agora escreve `amount_cents` (Long) e `created_at` (`serverTimestamp()`)
- Mantém `amount` Double e `created_at` String **lendo** mas não escrevendo (compat)
- Validação Firestore Rules atualizada

**Fase 4 — Cleanup (após 30 dias)** _(1h)_
- Remove campos legados (`amount`, `created_at` string)
- Script `cleanup_legacy_cashbox_fields.js`

### 3.2 Riscos

| Risco | Mitigação |
|-------|-----------|
| Backfill double-aplica (round error em entradas centavos) | Flag `_migrated: true` + check antes de escrever |
| Scripts de admin externos quebrar (esperam `amount` Double) | Manter `amount` legacy por 30 dias durante Fase 3 |
| Web/Android antigo lendo só `amount_cents` (não tem) | Fase 1 garante leitura compatível antes do write switch |
| Race: usuário escreve durante backfill | Janela de manutenção curta (30min) + retry idempotente |

---

## 4. UX/UI

Sem mudança visível pro usuário. Saldos exibidos continuam em `R$ X,XX` formato.

Exceto: usuários com saldo "esquisito" tipo `R$ 100,30000000000001` agora veem `R$ 100,30` corretamente.

---

## 5. Tasks (sequencial)

### Fase 1 — Compat read (PR 1)
- [ ] Atualizar `CashboxFirebaseExt.toCashboxEntryOrNull()` para aceitar ambos `amount` Double e `amount_cents` Long
- [ ] Atualizar `getDateFieldAsInstant()` (já trata Timestamp/Number/String — verificar se ISO string é parseada)
- [ ] Adicionar `CashboxFormatter.kt` em `shared/commonMain` com `formatCents(Long): String`
- [ ] Web: criar `cashboxFormatter.ts` com `parseCentsFromInput(string): number` e `formatBrl(cents: number): string`
- [ ] Atualizar Android `CashboxScreen` e Web `CashboxScreen.tsx` para usar formatter (mas read continua aceitando Double)
- [ ] Testes unitários: cobertura para edge cases (R$ 0,01, R$ 99.999,99, leitura de Double legacy)

### Fase 2 — Backfill (PR 2 — só script)
- [ ] `scripts/data-tools/migrate_cashbox_to_cents.js` — dry-run + execute mode
- [ ] Backup Firestore via `gcloud firestore export` ANTES
- [ ] Executar em ambiente de dev primeiro, validar contagens
- [ ] Executar em prod com janela de manutenção comunicada
- [ ] Verificar contadores: total entries antes vs depois, soma centavos = soma reais * 100

### Fase 3 — Switch writes (PR 3)
- [ ] `CashboxRepositoryImpl.addCashboxEntry()` escreve `amount_cents` (Long) + `created_at` (`FieldValue.serverTimestamp()`)
- [ ] Atualizar Firestore Rules para validar `amount_cents is int && amount_cents > 0`
- [ ] Atualizar Cloud Functions de cashbox para usar `amount_cents`
- [ ] Adicionar test de integração: criar entry → ler de volta → balance correto

### Fase 4 — Cleanup (PR 4 — após 30 dias)
- [ ] `scripts/data-tools/cleanup_legacy_cashbox_fields.js` (remove `amount` Double, `created_at` String)
- [ ] Atualizar models para parar de aceitar legacy fields
- [ ] Remover branches de compatibilidade em `CashboxFirebaseExt.kt`

---

## 6. Acceptance Criteria

- [ ] Soma de N entradas = soma esperada exata em centavos (sem drift IEEE)
- [ ] `orderBy("created_at")` retorna ordem cronológica correta
- [ ] Cloud Function `recalculateCashboxBalance` produz balance idêntico para grupo legacy + grupo novo
- [ ] Backward compat: app antigo (1.21.x) consegue ler dados após backfill (Fase 2)
- [ ] Display sempre formatado em `R$ X,XX` (2 casas decimais)
- [ ] Validação Firestore Rules rejeita `amount_cents` negativo, zero, ou > MAX (100_000_00 = R$ 100k)

---

## 7. Decisões / Open Questions

- [ ] **Ainda existe Cashbox em prod com dados ativos?** Se SIM → Fase 2 obrigatória. Se NÃO (só seed) → pular para Fase 3 direto + reset.
- [ ] **Manter compatibilidade com app antigo durante 30 dias é necessário?** (depende de % de usuários em versões pre-1.22.x)
- [ ] **Quem aprova janela de manutenção?** PR 2 (backfill) precisa horário combinado.
- [ ] **Limite máximo de centavos?** `Long.MAX_VALUE / 100` é gigantesco — uso `100_000_000_00` (R$ 100M) como cap defensivo.
