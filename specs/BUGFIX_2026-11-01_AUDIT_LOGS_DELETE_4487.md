# BUGFIX: exclusão de conta não apaga `audit_logs.userId` (uid cru + IP)

> **Status:** `APPROVED`
> **Severidade:** `HIGH` (LGPD Art. 18 VI: dado pessoal sobrevive à exclusão)
> **Autor:** Renan Locatiz Fernandes (via Claude Code)
> **Data:** 2026-11-01
> **PR:** a preencher (Closes #4487)

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
O audit do `secureCallable` (`functions/src/middleware/secure-callable-wrapper.ts`, `logAudit`) grava em `audit_logs` o uid cru no campo `userId` e o IP. O `onUserDeleted` (`auth/account-cleanup.ts`) apaga `audit_logs` por `target_user_id`, `actor_user_id`, `performed_by`, `manager_uid` e `source_user_id`, mas não por `userId`. Esses registros sobrevivem à exclusão da conta.

### 1.2 Comportamento Esperado (Correto)
Após a exclusão, nenhum `audit_logs` com `userId == uid` permanece.

### 1.3 Passos para Reproduzir
1. Usuário chama qualquer callable com `enableAuditLog` ligado (default do wrapper).
2. Usuário exclui a conta.
3. `audit_logs` ainda contém docs com `userId == uid` e o IP.

### 1.4 Contexto
| Item | Valor |
|------|-------|
| Camada | Cloud Functions (sem impacto em app/web) |
| Frequência | Sempre |
| Relacionado | #4391 (`deleteAccount`), #4482/#4486 (`exportMyData` já lê `userId`) |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação
O mapa `AUDIT_LOGS` de `auth/uid-owned-collections.ts` lista os campos de uid dos escritores; `userId` (camelCase, escritor do wrapper) nunca entrou. A exportação (`export-my-data.ts`) já inclui `"userId"` em `uidFields`, então exportar e apagar divergiam.

### 2.2 Causa Raiz
Campo ausente em `AUDIT_LOGS.otherUidFields`, a lista que o cleanup percorre.

### 2.3 Arquivos Afetados
| Arquivo | Motivo |
|---------|--------|
| `functions/src/auth/uid-owned-collections.ts` | incluir `userId` em `AUDIT_LOGS.otherUidFields` |
| `functions/src/auth/account-cleanup.ts` | comentário (o laço já percorre a lista) |
| `functions/src/auth/delete-account.ts` | comentário desatualizado |
| `functions/test/auth/*.test.ts` | testes |

---

## 3. Solução Proposta

### 3.1 Abordagem
Reaproveitar o mecanismo existente: o passo 4b' do cleanup percorre `AUDIT_LOGS.otherUidFields` com `deleteAllByField` (lotes de 500, paginado, deduplicado pelo `queueDelete`). Basta incluir `userId`. Sem código paralelo.

### 3.2 Índice
Não precisa. Igualdade simples em um campo usa o índice single-field automático de escopo COLLECTION; `audit_logs.userId` não tem `fieldOverride` em `firestore.indexes.json`.

### 3.3 Fora de escopo
Audit do `deleteAccount`/`exportMyData` segue com `enableAuditLog: false` (registro próprio, sem PII); logs gravados depois da varredura por outras callables não são alcançados por esta correção.

---

## 4. Plano de Testes
- [x] Cleanup apaga `userId == uid` e preserva logs de outro uid.
- [x] `AUDIT_LOGS.otherUidFields` contém `userId`, sem duplicatas.
- [x] Paridade: todo campo de uid que `exportMyData` lê em `audit_logs` é coberto pelo cleanup (quando a exportação estiver na master).

## 5. Verificação
`cd functions && npm run build && npm run lint && npx jest --no-coverage`.
