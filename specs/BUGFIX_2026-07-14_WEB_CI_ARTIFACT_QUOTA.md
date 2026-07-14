# BUGFIX: Upload best-effort do relatório Stryker

> **Status:** `VERIFIED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-14
> **Run:** #29308391990

## 1. Problema

O mutation testing terminou com sucesso e score de 69,61%, mas o job noturno
ficou vermelho porque `actions/upload-artifact` encontrou a cota de armazenamento
esgotada. O upload também solicitava 14 dias, acima do máximo de 7 configurado
no repositório.

## 2. Comportamento esperado

- O exit code do Stryker continua sendo a autoridade do job.
- O relatório é enviado mesmo após falha do Stryker, quando existir e houver
  cota disponível.
- Falha operacional exclusiva do upload não muda o resultado do mutation test.
- A retenção minimiza pressão futura sobre a cota sem eliminar o relatório mais
  recente do cron diário.

## 3. Solução aprovada

1. Manter `Run mutation testing` sem `continue-on-error`.
2. Manter o upload com `if: always()` e tornar somente esse passo
   `continue-on-error: true`.
3. Reduzir a retenção do relatório noturno para 1 dia e usar compressão máxima.
4. Fixar esse contrato no teste executável do workflow.

## 4. Verificação

- [x] Teste de contrato do Web CI (6/6)
- [x] `actionlint .github/workflows/web-ci.yml`
- [x] Parse YAML local
- [x] `git diff --check`

## 5. Riscos

- Com cota cheia, o relatório continuará indisponível, mas o log do Stryker
  preserva score e mutantes sobreviventes.
- A limpeza de artifacts no GitHub não é imediata; retenção menor reduz uso
  futuro, mas não libera a cota instantaneamente.
