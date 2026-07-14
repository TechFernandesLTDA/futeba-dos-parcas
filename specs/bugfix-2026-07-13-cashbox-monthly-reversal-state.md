# BUGFIX: estorno mensal restaura estado recalculável

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex (cashbox wave 2026-07-13)
> **Data:** 2026-07-13
> **PR:** #TBD
> **Issues:** #3591, #3597

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

`voidCashboxEntry` estorna uma baixa de mensalidade, mas sempre persiste o
período como `FINALIZED` e não decrementa `settlement_count`. Depois do estorno
da última baixa, `rebuildMonthlyCycle` e `setMonthlyGameOverride` continuam
tratando a competência como paga e bloqueiam correções legítimas.

### 1.2 Comportamento Esperado (Correto)

- O estorno deve decrementar `settlement_count`, sem permitir valor negativo.
- O período só deve voltar a `DRAFT` quando o valor recebido ficar zerado e não
  existir outro settlement `ACTIVE` além do settlement estornado.
- Se restar valor recebido ou outra baixa ativa, o período deve permanecer
  `FINALIZED`.
- O settlement estornado deve registrar o mesmo status final gravado no período.
- Replays do mesmo estorno devem continuar idempotentes.

### 1.3 Passos para Reproduzir

1. Finalizar uma competência mensal e registrar sua única baixa.
2. Estornar a entrada de caixa criada pela baixa.
3. Tentar recalcular a competência ou alterar seu override.
4. Observar o bloqueio causado por `FINALIZED` e `settlement_count > 0`, apesar
   de não existir baixa ativa nem valor recebido.

### 1.4 Critérios de Aceite

- [x] Última baixa estornada, sem valor residual: período em `DRAFT` e
  `settlement_count = 0`.
- [x] Estorno com outra baixa ativa: período permanece `FINALIZED` e contador é
  decrementado uma única vez.
- [x] Estorno que ainda deixa valor recebido: período permanece `FINALIZED`.
- [x] `period_status_after_void` corresponde ao status persistido no período.
- [x] Repetição da mesma chamada não aplica novo decremento.

---

## 2. Análise de Causa Raiz

O fluxo de baixa em `settleMonthlyCharge` incrementa `settlement_count`, mas o
fluxo inverso em `voidCashboxEntry` não mantém essa simetria. Além disso, o
status pós-estorno foi codificado como constante, sem considerar os agregados e
os settlements ativos restantes.

| Arquivo | Motivo |
|---------|--------|
| `functions/src/cashbox/callable.ts` | Calcular e persistir contador/status pós-estorno |
| `functions/test/cashbox-callable.test.ts` | Cobrir última baixa e baixa ativa remanescente |

---

## 3. Solução Aprovada

Dentro da mesma transação do estorno:

1. Consultar até dois settlements `ACTIVE` do período e desconsiderar o próprio
   settlement alvo para saber se existe outra baixa ativa.
2. Calcular `nextSettlementCount = max(0, settlement_count - 1)`.
3. Calcular `nextPeriodStatus = DRAFT` somente quando
   `nextReceivedCents === 0` e não houver outra baixa ativa; usar `FINALIZED`
   nos demais casos.
4. Atualizar período e trilha auditável do settlement de forma atômica.

### Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Reabrir período com outra baixa | Consulta autoritativa de settlements `ACTIVE` |
| Contador negativo | Piso explícito em zero |
| Divergência de auditoria | Mesmo status calculado no período e no settlement |
| Duplo decremento em replay | Guardas idempotentes existentes antes das escritas |

---

## 4. Verificação

- [x] Testes focados de `cashbox-callable` (12/12)
- [x] Suíte completa de Cloud Functions (1436 passaram, 13 ignorados)
- [x] Build TypeScript
- [x] ESLint
- [x] Patch validado com `git apply --check`

## 5. Impacto de Release

Correção server-side em Firebase Functions. Não exige migração de schema nem
mudança de contrato do callable; deve constar nas notas da próxima versão de
Functions e ser publicada junto ao release consolidado.

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-13 | Codex | Spec criada e aprovada antes da implementação |
| 2026-07-13 | Codex | Implementação e validação concluídas |
