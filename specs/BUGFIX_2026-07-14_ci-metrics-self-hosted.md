# BUGFIX: CI Metrics sem dependência de hosted runner

> **Status:** `VERIFIED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-14

## 1. Problema

O job `collect` usa `ubuntu-latest`. Com o orçamento de GitHub-hosted Actions
bloqueado, a coleta não inicia, mesmo sendo um workflow informativo executado
fora do caminho crítico.

## 2. Comportamento esperado

O job deve usar o roteamento self-hosted configurável já adotado pelo
repositório, preservando permissões mínimas, timeout, lógica de coleta e
artefatos.

## 3. Solução aprovada

Trocar exclusivamente `runs-on` pelo padrão:

```yaml
runs-on: ${{ fromJSON(vars.RUNNER_LABELS || '["self-hosted","macOS","ARM64"]') }}
```

O fallback atende os runners atuais; `RUNNER_LABELS` continua permitindo o
roteamento futuro para qualquer runner self-hosted compatível. O evento
`workflow_run` usa o workflow do branch padrão, portanto não faz checkout de
código arbitrário da branch observada.

## 4. Verificação

- [x] `actionlint .github/workflows/ci-metrics.yml`
- [x] parse YAML
- [x] sintaxe do coletor Node
- [x] smoke test local das funções puras do coletor
- [x] `git diff --check`

## 5. Riscos

- A coleta ficará em fila quando nenhum runner compatível estiver online.
- A alteração não corrige outros workflows que ainda usam hosted runners.

## Histórico

| Data | Autor | Alteração |
|---|---|---|
| 2026-07-14 | Codex | Requisitos e correção mínima aprovados antes da implementação |
| 2026-07-14 | Codex | Workflow e coletor validados; dois runners compatíveis online |
