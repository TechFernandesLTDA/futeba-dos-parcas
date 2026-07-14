# BUGFIX: Timeout e isolamento do Web E2E agendado

> **Status:** `VERIFIED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-14
> **Run:** #29322971549

## 1. Problema

O Web E2E concluiu build, emuladores, seeds e `globalSetup`, anunciou 57 testes
e não emitiu outro resultado até o cancelamento externo de 60 minutos. As três
execuções agendadas mais recentes tiveram o mesmo cancelamento. Em paralelo, o
Test Harness falhou com `ENOTEMPTY` durante a instalação global das ferramentas.

## 2. Solução

1. `globalTimeout` de 15 minutos no CI e limite externo de 20 minutos no passo.
2. Job limitado a 30 minutos, com reporters GitHub e HTML.
3. Upload diagnóstico best-effort e retenção curta.
4. Mesmo concurrency group não cancelável nos dois workflows.
5. Node 22 alinhado ao requisito do repositório.
6. Remoção do `pkill -f` global; `firebase emulators:exec` controla seu teardown.
7. Contratos Node executados nos dois workflows.

## 3. Verificação

- [x] contratos dos workflows
- [x] `actionlint` e parse YAML
- [x] configuração Playwright lista 57 testes
- [x] `git diff --check`

## 4. Riscos

A serialização aumenta o tempo de fila quando ambos disparam juntos, mas elimina
a disputa por portas e processos. O limite transforma travamentos não observáveis
em falhas limitadas, sem mascarar o código de saída do E2E.
