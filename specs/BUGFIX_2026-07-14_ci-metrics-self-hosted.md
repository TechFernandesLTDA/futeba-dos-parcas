# BUGFIX: CI Metrics sem dependência de hosted runner

> **Status:** `VERIFIED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-14

## 1. Problema

O job `collect` usava `ubuntu-latest`. Com o orçamento de GitHub-hosted Actions
bloqueado, a coleta não iniciava, mesmo sendo um workflow informativo executado
fora do caminho crítico. Além disso, a cota de artifacts saturada poderia tornar
o job vermelho depois de uma coleta bem-sucedida.

## 2. Comportamento esperado

O job deve usar o roteamento self-hosted configurável já adotado pelo
repositório. A coleta permanece autoritativa; somente o upload histórico é
best-effort, com retenção curta para reduzir pressão sobre a cota.

## 3. Solução aprovada

1. Usar o padrão `RUNNER_LABELS` com fallback para `self-hosted`, `macOS` e
   `ARM64`.
2. Manter a coleta sem `continue-on-error`.
3. Tornar somente o upload `continue-on-error`, com retenção de 1 dia e
   compressão máxima.

O evento `workflow_run` usa o workflow do branch padrão, portanto não faz
checkout de código arbitrário da branch observada.

## 4. Verificação

- [x] `actionlint .github/workflows/ci-metrics.yml`
- [x] parse YAML
- [x] sintaxe do coletor Node
- [x] smoke test local das funções puras do coletor
- [x] contrato executável de runner e upload best-effort
- [x] `git diff --check`

## 5. Riscos

- A coleta ficará em fila quando nenhum runner compatível estiver online.
- Com a cota cheia, o JSON pode não ser anexado; o summary do run permanece.

## Histórico

| Data | Autor | Alteração |
|---|---|---|
| 2026-07-14 | Codex | Roteamento self-hosted e upload best-effort validados |
